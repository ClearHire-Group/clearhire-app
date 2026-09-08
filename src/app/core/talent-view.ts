import { CONSENT_STATE_LABELS, ConsentState, ProfileDepth, Talent, TalentMatch } from './models';
import { AVATAR_STYLES } from './candidate-view';

export interface TalentView extends Talent {
  avatarBg: string;
  avatarColor: string;
  consentLabel: string;
  consentColor: string;
  consentBg: string;
  depthLabel: string;
  depthColor: string;
  depthBg: string;
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

const DEPTH_STYLES: Record<ProfileDepth, { label: string; color: string; bg: string }> = {
  alto: { label: 'Perfil completo', color: '#3A4A2E', bg: 'rgba(58,74,46,0.16)' },
  medio: { label: 'Perfil parcial', color: '#a8674f', bg: 'rgba(192,146,129,0.18)' },
  baixo: { label: 'Perfil básico', color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.06)' },
};

function decorate(talent: Talent): TalentView {
  const avatar = AVATAR_STYLES[talent.avatarColorIndex];
  const consent = CONSENT_STYLES[talent.consentState];
  const depth = DEPTH_STYLES[talent.profileDepth];
  return {
    ...talent,
    avatarBg: avatar.bg,
    avatarColor: avatar.color,
    consentLabel: CONSENT_STATE_LABELS[talent.consentState],
    consentColor: consent.color,
    consentBg: consent.bg,
    depthLabel: depth.label,
    depthColor: depth.color,
    depthBg: depth.bg,
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
