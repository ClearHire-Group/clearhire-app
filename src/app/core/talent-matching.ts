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

function allKnownSkillTerms(pool: Talent[]): string[] {
  const set = new Set<string>();
  for (const t of pool) for (const s of t.skills) set.add(s.term);
  return [...set];
}

function parseQuery(query: string, pool: Talent[]): ParsedQuery {
  const norm = normalize(query);
  const skills = allKnownSkillTerms(pool).filter((term) => norm.includes(normalize(term)));
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

function scoreAgainstQuery(talent: Talent, parsed: ParsedQuery): TalentMatch {
  const breakdown: ScoreBreakdownLine[] = [];
  let total = 50;

  for (const term of parsed.skills) {
    const skill = talent.skills.find((s) => normalize(s.term) === normalize(term));
    const delta = skill ? levelWeight(skill.level) : -15;
    total += delta;
    breakdown.push({
      label: skill?.level ? `${term} (${skill.level})` : term,
      detail: skill ? `possui${skill.yearsExperience ? `, ${skill.yearsExperience} anos` : ''}` : 'não possui',
      delta,
    });
  }

  if (parsed.sector) {
    const has = talent.sectors.some((s) => normalize(s).includes(normalize(parsed.sector!)));
    const delta = has ? 18 : -12;
    total += delta;
    breakdown.push({ label: `Setor ${parsed.sector}`, detail: has ? 'possui' : 'não possui', delta });
  }

  if (parsed.modality) {
    const match = normalize(talent.modality) === normalize(parsed.modality);
    const delta = match ? 10 : -15;
    total += delta;
    breakdown.push({
      label: `Modalidade ${parsed.modality}`,
      detail: match ? 'compatível' : `não compatível (${talent.modality})`,
      delta,
    });
  }

  if (parsed.uf) {
    const match = normalize(talent.location).includes(normalize(parsed.uf));
    const delta = match ? 12 : -20;
    total += delta;
    breakdown.push({
      label: `Localização ${parsed.uf.toUpperCase()}`,
      detail: match ? 'compatível' : 'fora da localização desejada',
      delta,
    });
  }

  if (parsed.mentionsAvailability) {
    const unavailable = normalize(talent.availabilityLabel).includes('indisponivel');
    const delta = unavailable ? -25 : 8;
    total += delta;
    breakdown.push({ label: 'Disponibilidade', detail: talent.availabilityLabel, delta });
  }

  return { talent, matchPct: clampScore(total), breakdown };
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
  let results = hasSignal
    ? eligible.map((talent) => scoreAgainstQuery(talent, parsed))
    : eligible.map((talent) => fallbackTextScore(talent, criteria.title));

  if (criteria.seniority) {
    results = results.map((m) => {
      const match = normalize(m.talent.seniority).includes(normalize(criteria.seniority!));
      const delta = match ? 10 : -10;
      return {
        ...m,
        matchPct: clampScore(m.matchPct + delta),
        breakdown: [...m.breakdown, { label: `Senioridade ${criteria.seniority}`, detail: match ? 'compatível' : `perfil é ${m.talent.seniority}`, delta }],
      };
    });
  }

  return results.filter((m) => m.matchPct > 0).sort((a, b) => b.matchPct - a.matchPct);
}
