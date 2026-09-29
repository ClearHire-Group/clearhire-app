import { CoverageEntry, ScoreBreakdownLine, Talent, TalentMatch } from './models';

/**
 * Motor de match do Banco de Talentos: LLM na escrita, determinismo na leitura (seção 6 do
 * documento de especificação). Tudo aqui é puro e sem chamada externa — o único passo "LLM-like"
 * é `parseQuery`, que fica no lugar de uma tradução de linguagem natural para filtros estruturados
 * (pequena, uma vez por busca, nunca por perfil).
 */

interface ParsedQuery {
  skills: string[];
  sector?: string;
  modality?: string;
  uf?: string;
  mentionsAvailability: boolean;
}

const KNOWN_SECTORS = ['varejo', 'indústria', 'fintech', 'tecnologia', 'saas', 'produto digital'];
const UF_CODES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB',
  'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
const LEVEL_WEIGHT: Record<string, number> = { especialista: 35, avançado: 30, intermediário: 20, básico: 10 };

const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', é: 'e', ê: 'e', í: 'i', ó: 'o', ô: 'o', õ: 'o', ú: 'u', ç: 'c',
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áàâãéêíóôõúç]/g, (ch) => ACCENT_MAP[ch] ?? ch);
}

/**
 * O texto contém o termo como PALAVRA, não como pedaço de outra: "Skill 1" não casa com "Skill 12",
 * "Go" não casa com "Google", "C" não casa com "C++". Mesma regra do casamento de skills do backend
 * (candidate/skillmatch.go). Os dois lados chegam já normalizados (minúsculo, sem acento).
 */
function containsTerm(normText: string, normTerm: string): boolean {
  if (!normTerm) return false;
  const escaped = normTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Termo que começa com símbolo (".net") não exige fronteira antes: "asp.net" contém ".net".
  const before = /^[\p{L}\p{N}]/u.test(normTerm) ? '(^|[^\\p{L}\\p{N}])' : '';
  return new RegExp(`${before}${escaped}(?![\\p{L}\\p{N}+#])`, 'u').test(normText);
}

function allKnownSkillTerms(pool: Talent[]): string[] {
  const set = new Set<string>();
  for (const t of pool) for (const s of t.skills) set.add(s.term);
  return [...set];
}

function parseQuery(query: string, pool: Talent[]): ParsedQuery {
  const norm = normalize(query);
  const skills = allKnownSkillTerms(pool).filter((term) => containsTerm(norm, normalize(term)));
  const sector = KNOWN_SECTORS.find((s) => norm.includes(normalize(s)));
  const modality = norm.includes('remoto')
    ? 'Remoto'
    : norm.includes('hibrido')
      ? 'Híbrido'
      : norm.includes('presencial')
        ? 'Presencial'
        : undefined;
  const uf = UF_CODES.find((code) => new RegExp(`\\b${code.toLowerCase()}\\b`).test(norm));
  return { skills, sector, modality, uf, mentionsAvailability: /dispon/.test(norm) };
}

function levelWeight(level: string | undefined): number {
  if (!level) return 25;
  return LEVEL_WEIGHT[normalize(level) as keyof typeof LEVEL_WEIGHT] ?? 25;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Um critério de match: quanto o talento atende esse requisito, de 0 (não atende) a 1 (atende
 * plenamente). 0.5 é reservado para "não informado" — nem soma nem penaliza, e por isso rende
 * `delta` 0 no breakdown (sem cor), visualmente distinto de "atende" (verde) e "não atende" (vermelho).
 */
interface Criterion {
  label: string;
  detail: string;
  achieved: number;
}

const NEUTRAL = 0.5;

/**
 * Ter a skill já vale a maior parte do critério (piso 0.6) — o nível (básico a especialista) só
 * nuança dentro disso. Sem isso, alguém júnior com a skill apareceria com `delta` negativo, como se
 * não tivesse. Não ter a skill é 0: não existe "meio-termo" de posse de skill.
 */
function skillAchievement(level: string | undefined): number {
  return 0.6 + 0.4 * (levelWeight(level) / 35);
}

/**
 * "Indisponível" contém "disponível" como substring — por isso a checagem de indisponibilidade
 * vem primeiro. Qualquer rótulo que não seja claramente disponível nem indisponível ("A confirmar",
 * "A combinar", ...) é tratado como não informado, não como positivo.
 */
function availabilityAchievement(label: string): number {
  const norm = normalize(label);
  if (norm.includes('indisponivel')) return 0;
  if (norm.includes('disponivel')) return 1;
  return NEUTRAL;
}

/**
 * Pontuação = média ponderada dos critérios pedidos, cada um valendo o mesmo tanto (1 unidade em
 * `criteria.length`) — só quem atende TODOS os critérios chega a 100%; quem atende só parte nunca
 * empata com quem atende tudo, não importa o nível de cada skill isolada. `delta` no breakdown é a
 * contribuição de cada critério relativa ao neutro (0), pra manter o sinal +/− que a UI já colore.
 */
function finalizeScore(talent: Talent, criteria: Criterion[]): TalentMatch {
  if (criteria.length === 0) return { talent, matchPct: 0, breakdown: [] };
  const unit = 100 / criteria.length;
  let sum = 0;
  const breakdown: ScoreBreakdownLine[] = criteria.map((c) => {
    sum += c.achieved;
    return { label: c.label, detail: c.detail, delta: Math.round((c.achieved - NEUTRAL) * unit) };
  });
  return { talent, matchPct: clampScore((sum / criteria.length) * 100), breakdown };
}

function scoreAgainstQuery(talent: Talent, parsed: ParsedQuery, extra: Criterion[] = []): TalentMatch {
  const criteria: Criterion[] = parsed.skills.map((term) => {
    const skill = talent.skills.find((s) => normalize(s.term) === normalize(term));
    return {
      label: skill?.level ? `${term} (${skill.level})` : term,
      detail: skill ? `possui${skill.yearsExperience ? `, ${skill.yearsExperience} anos` : ''}` : 'não possui',
      achieved: skill ? skillAchievement(skill.level) : 0,
    };
  });

  if (parsed.sector) {
    const has = talent.sectors.some((s) => normalize(s).includes(normalize(parsed.sector!)));
    criteria.push({ label: `Setor ${parsed.sector}`, detail: has ? 'possui' : 'não possui', achieved: has ? 1 : 0 });
  }

  if (parsed.modality) {
    const match = normalize(talent.modality) === normalize(parsed.modality);
    criteria.push({
      label: `Modalidade ${parsed.modality}`,
      detail: match ? 'compatível' : `não compatível (${talent.modality})`,
      achieved: match ? 1 : 0,
    });
  }

  if (parsed.uf) {
    const match = normalize(talent.location).includes(normalize(parsed.uf));
    criteria.push({
      label: `Localização ${parsed.uf.toUpperCase()}`,
      detail: match ? 'compatível' : 'fora da localização desejada',
      achieved: match ? 1 : 0,
    });
  }

  if (parsed.mentionsAvailability) {
    criteria.push({ label: 'Disponibilidade', detail: talent.availabilityLabel, achieved: availabilityAchievement(talent.availabilityLabel) });
  }

  return finalizeScore(talent, [...criteria, ...extra]);
}

function fallbackTextScore(talent: Talent, query: string): TalentMatch {
  const words = normalize(query)
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const haystack = normalize(
    [talent.name, talent.summary, talent.seniority, ...talent.skills.map((s) => s.term), ...talent.sectors].join(' '),
  );
  const hits = words.filter((w) => haystack.includes(w));
  const matchPct = words.length ? clampScore((hits.length / words.length) * 100) : 0;
  return {
    talent,
    matchPct,
    breakdown: [
      { label: 'Correspondência textual', detail: `${hits.length} de ${words.length} termos da busca encontrados no perfil`, delta: matchPct },
    ],
  };
}

/** Talentos com exclusão solicitada nunca aparecem em busca, similaridade, match reverso ou cobertura. */
function eligiblePool(pool: Talent[]): Talent[] {
  return pool.filter((t) => t.consentState !== 'oposicao_exclusao');
}

export function searchTalentPool(query: string, pool: Talent[]): TalentMatch[] {
  const eligible = eligiblePool(pool);
  const trimmed = query.trim();
  if (!trimmed) return eligible.map((talent) => ({ talent, matchPct: 0, breakdown: [] }));

  const parsed = parseQuery(trimmed, eligible);
  const hasSignal = parsed.skills.length > 0 || !!parsed.sector || !!parsed.modality || !!parsed.uf || parsed.mentionsAvailability;
  return eligible
    .map((talent) => (hasSignal ? scoreAgainstQuery(talent, parsed) : fallbackTextScore(talent, trimmed)))
    .filter((m) => m.matchPct > 0)
    .sort((a, b) => b.matchPct - a.matchPct);
}

export function findSimilarInPool(referenceId: string, pool: Talent[]): TalentMatch[] {
  const reference = pool.find((t) => t.id === referenceId);
  if (!reference) return [];

  const refTerms = new Set(reference.skills.map((s) => normalize(s.term)));
  const refSectors = new Set(reference.sectors.map(normalize));

  return eligiblePool(pool)
    .filter((t) => t.id !== referenceId)
    .map((talent) => {
      const breakdown: ScoreBreakdownLine[] = [];
      let total = 0;
      for (const skill of talent.skills) {
        if (refTerms.has(normalize(skill.term))) {
          total += 20;
          breakdown.push({ label: skill.term, detail: 'em comum', delta: 20 });
        }
      }
      for (const sector of talent.sectors) {
        if (refSectors.has(normalize(sector))) {
          total += 18;
          breakdown.push({ label: `Setor ${sector}`, detail: 'em comum', delta: 18 });
        }
      }
      if (normalize(talent.seniority) === normalize(reference.seniority)) {
        total += 10;
        breakdown.push({ label: 'Senioridade', detail: 'equivalente', delta: 10 });
      }
      return { talent, matchPct: clampScore(total), breakdown };
    })
    .filter((m) => m.matchPct > 0)
    .sort((a, b) => b.matchPct - a.matchPct);
}

export function computeCoverage(pool: Talent[]): CoverageEntry[] {
  const counts = new Map<string, number>();
  for (const talent of eligiblePool(pool)) {
    for (const skill of talent.skills) counts.set(skill.term, (counts.get(skill.term) ?? 0) + 1);
  }
  return [...counts.entries()].map(([skillTerm, count]) => ({ skillTerm, count })).sort((a, b) => b.count - a.count);
}

export function reverseMatchForCriteria(
  criteria: { title: string; modality?: string; seniority?: string },
  pool: Talent[],
): TalentMatch[] {
  const eligible = eligiblePool(pool);
  const parsed = parseQuery(criteria.title, eligible);
  if (criteria.modality) parsed.modality = criteria.modality;
  const hasSignal = parsed.skills.length > 0 || !!parsed.sector || !!parsed.modality || !!parsed.uf;

  const seniorityCriterion = (talent: Talent): Criterion | null => {
    if (!criteria.seniority) return null;
    const match = normalize(talent.seniority).includes(normalize(criteria.seniority));
    return { label: `Senioridade ${criteria.seniority}`, detail: match ? 'compatível' : `perfil é ${talent.seniority}`, achieved: match ? 1 : 0 };
  };

  // Caminho com sinal (skill/setor/modalidade/UF): senioridade entra como mais um critério na MESMA
  // média ponderada — assim "atende tudo" continua sendo a única forma de chegar a 100%, mesmo com
  // senioridade no meio. Sem isso, um bônus fixo somado depois do clamp reabriria o mesmo bug do
  // relatório (empate/estouro de 100% por quem não atende todos os critérios).
  const results = hasSignal
    ? eligible.map((talent) => {
        const sr = seniorityCriterion(talent);
        return scoreAgainstQuery(talent, parsed, sr ? [sr] : []);
      })
    : eligible.map((talent) => {
        const base = fallbackTextScore(talent, criteria.title);
        const sr = seniorityCriterion(talent);
        if (!sr) return base;
        const delta = sr.achieved ? 10 : -10;
        return {
          ...base,
          matchPct: clampScore(base.matchPct + delta),
          breakdown: [...base.breakdown, { label: sr.label, detail: sr.detail, delta }],
        };
      });

  return results.filter((m) => m.matchPct > 0).sort((a, b) => b.matchPct - a.matchPct);
}
