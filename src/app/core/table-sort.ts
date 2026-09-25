/**
 * Ordenação de tabelas por coluna, compartilhada pelas listagens (candidatos da campanha, Banco de
 * Talentos).
 *
 * Roda no navegador, sobre a lista já carregada — decisão medida, não suposta: ordenar 3 mil linhas
 * leva ~2 ms e 10 mil ~5 ms, enquanto uma ida ao servidor por clique levaria dezenas/centenas de ms e
 * exigiria expor parâmetros de ordenação na API. Se um dia a lista passar de dezenas de milhares de
 * linhas, o caminho é paginar no servidor, e aí a ordenação vai junto (com lista fechada de colunas).
 *
 * Regras, iguais em qualquer tabela:
 *  - primeiro clique numa coluna usa a direção "mais útil" dela (match: maior primeiro; nome: A→Z);
 *    clicar de novo inverte;
 *  - valor vazio (sem análise, sem cidade…) fica SEMPRE no fim, nos dois sentidos — inverter a ordem
 *    não pode jogar "sem informação" para o topo;
 *  - empate é desfeito pelo nome e depois pelo id, então a ordem é determinística (não "pula" entre
 *    renderizações);
 *  - colunas de categoria (status, fase, consentimento) ordenam por uma ordem de negócio fixa, o que
 *    agrupa cada tipo em sequência.
 */

export type SortDir = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

type SortValue = string | number | null | undefined;

export interface SortSpec<T> {
  /** Rótulo usado no texto "Ordenado por …". */
  label: string;
  /** Direção do primeiro clique. */
  first: SortDir;
  /** Valor de ordenação. null/undefined/'' = sem informação (sempre no fim). */
  value: (row: T) => SortValue;
  /** Texto de cada direção no "Ordenado por …" (ex.: { desc: 'maior primeiro', asc: 'menor primeiro' }). */
  dirLabels?: Partial<Record<SortDir, string>>;
}

/**
 * Comparação de texto em português: ignora acento, caixa e pontuação e entende números ("Vaga 2"
 * antes de "Vaga 10"). Ignorar acento/caixa é o que agrupa respostas livres não padronizadas —
 * "Brasília", "brasilia" e "BRASILIA" ficam lado a lado.
 */
export const ptCollator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true, ignorePunctuation: true });

const isEmpty = (v: SortValue): boolean => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return ptCollator.compare(String(a), String(b));
}

/**
 * Devolve uma NOVA lista ordenada (não muta a original — ela é estado compartilhado de um signal).
 * Calcula o valor de cada linha uma vez só (decorate-sort-undecorate): o comparador roda O(n log n)
 * vezes e o extrator de valor pode ser caro (normalização de texto, busca de posição de fase).
 */
export function sortRows<T extends { id: string; name: string }>(rows: readonly T[], spec: SortSpec<T>, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((row) => ({ row, v: spec.value(row) }))
    .sort((x, y) => {
      const ex = isEmpty(x.v);
      const ey = isEmpty(y.v);
      if (ex !== ey) return ex ? 1 : -1;
      const byValue = ex ? 0 : sign * compareValues(x.v as string | number, y.v as string | number);
      return byValue || ptCollator.compare(x.row.name, y.row.name) || (x.row.id < y.row.id ? -1 : x.row.id > y.row.id ? 1 : 0);
    })
    .map((x) => x.row);
}

/** Estado depois de um clique no cabeçalho: mesma coluna inverte; outra coluna começa na direção dela. */
export function nextSort<K extends string>(current: SortState<K> | null, key: K, specs: Record<K, SortSpec<never>>): SortState<K> {
  if (current?.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: specs[key].first };
}

/** Valor de `aria-sort` do cabeçalho (leitores de tela anunciam a ordenação). */
export function ariaSort<K extends string>(current: SortState<K> | null, key: K): 'ascending' | 'descending' | 'none' {
  if (current?.key !== key) return 'none';
  return current.dir === 'asc' ? 'ascending' : 'descending';
}

/**
 * Lê a ordenação da URL aceitando SÓ colunas conhecidas — a URL é editável e compartilhável, então
 * qualquer valor fora da lista é ignorado (volta ao padrão) em vez de chegar ao código.
 */
export function parseSort<K extends string>(key: string | null, dir: string | null, allowed: readonly K[]): SortState<K> | null {
  if (!key || !(allowed as readonly string[]).includes(key)) return null;
  return { key: key as K, dir: dir === 'asc' ? 'asc' : 'desc' };
}

/** Texto "Ordenado por …" para o estado atual. */
export function sortDescription<T>(state: SortState<string>, spec: SortSpec<T>): string {
  const dirText = spec.dirLabels?.[state.dir] ?? (state.dir === 'asc' ? 'A → Z' : 'Z → A');
  return `${spec.label} · ${dirText}`;
}

/** Posição numa ordem de negócio fixa (agrupamento); fora da lista = sem informação. */
export function rankIn(order: readonly string[], value: string | null | undefined): number | null {
  if (!value) return null;
  const i = order.indexOf(value);
  return i < 0 ? null : i;
}

/** Normaliza texto para busca: minúsculo, sem acento, espaços colapsados. */
export function searchKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Linhas desenhadas por vez. Ordenar 3 mil linhas custa ~2 ms, mas o navegador REDESENHAR 3 mil
 * linhas de tabela custava 600-900 ms por clique (medido). Desenhando 50 por vez e carregando mais ao
 * rolar, ordenar, filtrar e buscar voltam a ser instantâneos — e continuam valendo para a lista
 * inteira: só o desenho é incremental.
 */
export const ROWS_PAGE = 50;
