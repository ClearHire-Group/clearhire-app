/**
 * Rótulo de tempo relativo em pt-BR para o feed de atividade.
 *
 * Separado de `talent-view.ts` (que também escreve "há X") de propósito: lá a granularidade é em
 * dias e o texto carrega um verbo do domínio ("Atualizado há 3 dias"); aqui precisa de minuto/hora
 * e do formato "ontem às 17:20", que é o vocabulário que a tela de Atividade já usava.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function time(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function plural(n: number, singular: string, plural: string): string {
  return `há ${n} ${n === 1 ? singular : plural}`;
}

/**
 * A faixa de minutos/horas usa tempo decorrido; de "ontem" pra trás usa diferença de DIA DE
 * CALENDÁRIO, não de 24h. Isso é intencional: às 00:30, algo de 23:50 é "ontem às 23:50" para quem
 * lê, mesmo tendo 40 minutos de idade — o corte que importa pra pessoa é a virada do dia.
 */
export function activityTimeLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const elapsed = now.getTime() - then.getTime();
  // Relógio do cliente atrás do servidor faz elapsed negativo; trata como "agora" em vez de
  // imprimir "há -3 minutos".
  if (elapsed < MINUTE_MS) return 'agora mesmo';
  if (elapsed < HOUR_MS) return plural(Math.floor(elapsed / MINUTE_MS), 'minuto', 'minutos');

  const daysApart = Math.round((startOfDay(now) - startOfDay(then)) / (24 * HOUR_MS));
  if (daysApart <= 0) return plural(Math.floor(elapsed / HOUR_MS), 'hora', 'horas');
  if (daysApart === 1) return `ontem às ${time(then)}`;
  if (daysApart < 7) return plural(daysApart, 'dia', 'dias');
  return `${then.toLocaleDateString('pt-BR')} às ${time(then)}`;
}
