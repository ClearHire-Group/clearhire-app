import { Campaign } from './models';

export interface XRaySearchQuery {
  query: string;
  googleUrl: string;
}

const STOPWORDS = new Set([
  'anos', 'ano', 'com', 'de', 'da', 'do', 'das', 'dos', 'em', 'para', 'por', 'e', 'ou', 'a', 'o',
  'as', 'os', 'um', 'uma', 'na', 'no', 'nas', 'nos', 'que', 'ao', 'aos', 'sua', 'seu', 'suas',
  'seus', 'mais', 'muito', 'forte', 'sólida', 'solida', 'boa', 'bom', 'experiência', 'experiencia',
]);

/**
 * Placeholder deliberado: tokeniza `requirements` e filtra stopwords curtas em vez de extrair
 * skills de verdade contra uma taxonomia. A versão real (IA lendo a vaga, como a especificação de
 * Sourcing descreve) é trabalho de backend — fora de escopo desta rodada, só frontend/mock.
 */
function extractTerms(requirements: string): string[] {
  const words = requirements
    .split(/[\n,;.]+/)
    .flatMap((line) => line.trim().split(/\s+/))
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()) && !/^\d+\+?$/.test(w));

  const seen = new Set<string>();
  const terms: string[] = [];
  for (const w of words) {
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(w);
    if (terms.length >= 5) break;
  }
  return terms;
}

/**
 * Monta a string booleana e o link do Google pra achar perfis do LinkedIn — nenhuma automação
 * acessa o LinkedIn, o recrutador abre o link e navega normalmente, logado, como sempre navegaria.
 */
export function buildXRaySearch(campaign: Campaign): XRaySearchQuery {
  const terms = extractTerms(campaign.requirements);
  const parts = ['site:linkedin.com/in', `"${campaign.title}"`, ...terms.map((t) => `"${t}"`)];
  if (campaign.city) parts.push(`"${campaign.city}"`);
  parts.push('-recruiter', '-jobs');
  const query = parts.join(' ');
  return { query, googleUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}` };
}
