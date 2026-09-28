/**
 * Recorte de período da tela Relatórios.
 *
 * O recorte é por DATA DA CANDIDATURA, não por "como o funil estava naquele dia" — o sistema não
 * guarda histórico de fase, então o relatório de um mês passado responde "dos que se candidataram
 * naquele mês, onde estão hoje". Ver ReportPeriod no backend (campaign/model.go) pro porquê.
 *
 * As bordas são calculadas AQUI, no navegador, e viajam como instantes ISO: é o front que conhece
 * o fuso do usuário, então nenhuma query no servidor precisa assumir um timezone. `from` é
 * inclusivo e `to` é exclusivo — "setembro" vai de 1º/09 00:00 até 1º/10 00:00.
 */

export type ReportPeriodKey = 'ultimos-30-dias' | 'ultimos-90-dias' | 'mes-atual' | 'mes-anterior' | 'tudo';

export const DEFAULT_REPORT_PERIOD: ReportPeriodKey = 'ultimos-30-dias';

export const REPORT_PERIODS: { key: ReportPeriodKey; label: string }[] = [
  { key: 'ultimos-30-dias', label: 'Últimos 30 dias' },
  { key: 'ultimos-90-dias', label: 'Últimos 90 dias' },
  { key: 'mes-atual', label: 'Mês atual' },
  { key: 'mes-anterior', label: 'Mês anterior' },
  { key: 'tudo', label: 'Todo o período' },
];

/** Intervalo pronto pra query string. Ambos ausentes = sem recorte nenhum. */
export interface ReportRange {
  from?: string;
  to?: string;
}

const MONTH_LABELS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysAgo(now: Date, days: number): Date {
  const start = startOfDay(now);
  start.setDate(start.getDate() - days);
  return start;
}

/** Início do dia SEGUINTE: como `to` é exclusivo, é isso que inclui o dia de hoje inteiro. */
function startOfTomorrow(now: Date): Date {
  const start = startOfDay(now);
  start.setDate(start.getDate() + 1);
  return start;
}

export function reportRangeFor(key: ReportPeriodKey, now = new Date()): ReportRange {
  switch (key) {
    case 'ultimos-30-dias':
      return { from: daysAgo(now, 30).toISOString(), to: startOfTomorrow(now).toISOString() };
    case 'ultimos-90-dias':
      return { from: daysAgo(now, 90).toISOString(), to: startOfTomorrow(now).toISOString() };
    case 'mes-atual':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      };
    case 'mes-anterior':
      // getMonth() - 1 em janeiro devolve dezembro do ano anterior: o próprio Date resolve a
      // virada de ano, não precisa de caso especial.
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
        to: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      };
    case 'tudo':
      return {};
  }
}

/** Só aceita chave da lista fechada — `?periodo=` adulterado cai no padrão em vez de quebrar. */
export function parseReportPeriodKey(raw: string | null): ReportPeriodKey {
  return REPORT_PERIODS.some((p) => p.key === raw) ? (raw as ReportPeriodKey) : DEFAULT_REPORT_PERIOD;
}

/**
 * Rótulo pro cabeçalho do PDF e pro breadcrumb. Os períodos de mês viram o mês por extenso
 * ("agosto de 2026") em vez de "mês anterior": num PDF que alguém vai arquivar ou encaminhar,
 * "mês anterior" é ambíguo assim que o arquivo sai da tela que o gerou.
 */
export function reportPeriodLabel(key: ReportPeriodKey, now = new Date()): string {
  switch (key) {
    case 'ultimos-30-dias':
      return 'últimos 30 dias';
    case 'ultimos-90-dias':
      return 'últimos 90 dias';
    case 'mes-atual':
      return `${MONTH_LABELS[now.getMonth()]} de ${now.getFullYear()}`;
    case 'mes-anterior': {
      const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${MONTH_LABELS[previous.getMonth()]} de ${previous.getFullYear()}`;
    }
    case 'tudo':
      return 'todo o período';
  }
}
