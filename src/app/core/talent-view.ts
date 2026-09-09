import { CONSENT_STATE_LABELS, ConsentState, Talent, TalentMatch } from './models';
import { AVATAR_STYLES } from './candidate-view';

export type FreshnessTier = 'recente' | 'revisar' | 'desatualizado';
export type CompletenessTier = 'completo' | 'parcial' | 'basico';

export interface TalentView extends Talent {
  avatarBg: string;
  avatarColor: string;
  consentLabel: string;
  consentColor: string;
  consentBg: string;
  /** "Atualizado há X" / "Cadastrado há X" — ou o aviso de bloqueio, se a pessoa pediu exclusão. */
  freshnessLabel: string;
  freshnessColor: string;
  freshnessBg: string;
  /** Quantos campos estruturados do registro estão de fato preenchidos — não quão bem a pessoa foi avaliada (isso é o histórico). */
  completenessLabel: string;
  completenessColor: string;
  completenessBg: string;
}

export interface TalentMatchView extends TalentView {
  matchPct: number;
  breakdown: TalentMatch['breakdown'];
  pctLabel: string;
  ringStyle: string;
}

/** Cor/fundo por estado real de consentimento — o rótulo vem de `CONSENT_STATE_LABELS`, sem metáfora. */
const CONSENT_STYLES: Record<ConsentState, { color: string; bg: string }> = {
  consentido: { color: '#3A4A2E', bg: 'rgba(58,74,46,0.16)' },
  notificado: { color: '#a8674f', bg: 'rgba(192,146,129,0.18)' },
  nao_notificado: { color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.06)' },
  oposicao_exclusao: { color: '#934832', bg: 'rgba(184,90,62,0.18)' },
};

const FRESHNESS_STYLES: Record<FreshnessTier, { color: string; bg: string }> = {
  recente: { color: '#3A4A2E', bg: 'rgba(58,74,46,0.16)' },
  revisar: { color: '#a8674f', bg: 'rgba(192,146,129,0.18)' },
  desatualizado: { color: '#934832', bg: 'rgba(184,90,62,0.18)' },
};

const COMPLETENESS_STYLES: Record<CompletenessTier, { label: string; color: string; bg: string }> = {
  completo: { label: 'Perfil completo', color: '#3A4A2E', bg: 'rgba(58,74,46,0.16)' },
  parcial: { label: 'Perfil parcial', color: '#a8674f', bg: 'rgba(192,146,129,0.18)' },
  basico: { label: 'Perfil básico', color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.06)' },
};

function daysSince(isoDate: string): number {
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function freshnessTier(daysAgo: number): FreshnessTier {
  if (daysAgo <= 180) return 'recente';
  if (daysAgo <= 365) return 'revisar';
  return 'desatualizado';
}

function freshnessLabelText(talent: Talent, daysAgo: number): string {
  const verb = talent.origin === 'cadastro_manual' ? 'Cadastrado' : 'Atualizado';
  if (daysAgo < 1) return `${verb} agora`;
  if (daysAgo < 14) return `${verb} há ${daysAgo} dia${daysAgo === 1 ? '' : 's'}`;
  if (daysAgo < 60) return `${verb} há ${Math.round(daysAgo / 7)} semanas`;
  if (daysAgo < 365) return `${verb} há ${Math.round(daysAgo / 30)} meses`;
  const years = Math.round(daysAgo / 365);
  return `${verb} há ${years} ano${years === 1 ? '' : 's'}`;
}

/**
 * Completude dos campos estruturados do registro — nada a ver com quão bem a pessoa foi avaliada
 * (isso está em `talent.history`). Um perfil recém-cadastrado manualmente começa "básico" até o
 * recrutador complementar; um perfil vindo de reprovação qualificada pode continuar "básico" se
 * skills/pretensão salarial nunca foram preenchidos, mesmo com histórico de entrevista.
 */
function completenessTier(talent: Talent): CompletenessTier {
  const filledChecks = [
    talent.skills.length > 0,
    talent.languages.length > 0,
    talent.sectors.length > 0,
    talent.experience.length > 0,
    talent.salaryRangeLabel !== 'A confirmar',
    talent.availabilityLabel !== 'A confirmar',
    talent.modality !== 'A confirmar',
    talent.seniority !== 'A confirmar',
  ];
  const filled = filledChecks.filter(Boolean).length;
  if (filled >= 7) return 'completo';
  if (filled >= 4) return 'parcial';
  return 'basico';
}

function decorate(talent: Talent): TalentView {
  const avatar = AVATAR_STYLES[talent.avatarColorIndex];
  const consent = CONSENT_STYLES[talent.consentState];
  const completeness = COMPLETENESS_STYLES[completenessTier(talent)];

  // Exclusão solicitada trava o selo de atualização — o que importa comunicar aqui é elegibilidade, não recência.
  const blocked = talent.consentState === 'oposicao_exclusao';
  const daysAgo = daysSince(talent.updatedAt);
  const freshness = blocked ? CONSENT_STYLES.oposicao_exclusao : FRESHNESS_STYLES[freshnessTier(daysAgo)];
  const freshnessLabel = blocked ? 'Bloqueado para uso — não considerar em buscas' : freshnessLabelText(talent, daysAgo);

  return {
    ...talent,
    avatarBg: avatar.bg,
    avatarColor: avatar.color,
    consentLabel: CONSENT_STATE_LABELS[talent.consentState],
    consentColor: consent.color,
    consentBg: consent.bg,
    freshnessLabel,
    freshnessColor: freshness.color,
    freshnessBg: freshness.bg,
    completenessLabel: completeness.label,
    completenessColor: completeness.color,
    completenessBg: completeness.bg,
  };
}

/** Listagem sem score — estado default do Banco de Talentos, sem busca ativa. */
export function toTalentViews(talents: Talent[]): TalentView[] {
  return talents.map(decorate);
}

/** Resultado de busca/similaridade/match reverso — mesmo anel conic-gradient usado para candidaturas. */
export function toTalentMatchViews(matches: TalentMatch[]): TalentMatchView[] {
  return matches.map((m) => {
    const deg = Math.round(m.matchPct * 3.6);
    return {
      ...decorate(m.talent),
      matchPct: m.matchPct,
      breakdown: m.breakdown,
      pctLabel: `${m.matchPct}%`,
      ringStyle: `background:conic-gradient(#B85A3E 0deg ${deg}deg, rgba(21,26,34,0.1) ${deg}deg 360deg)`,
    };
  });
}
