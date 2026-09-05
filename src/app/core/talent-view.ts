import { ConsentState, ProfileDepth, Talent, TalentMatch, isWarmConsent } from './models';
import { AVATAR_STYLES } from './candidate-view';

export interface TalentView extends Talent {
  avatarBg: string;
  avatarColor: string;
  warmLabel: string;
  warmColor: string;
  warmBg: string;
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

const WARM_STYLE = { label: 'Quente — sabe que está no banco', color: '#3A4A2E', bg: 'rgba(58,74,46,0.16)' };
const COLD_STYLE = { label: 'Frio — encontrado por conta própria', color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.06)' };
const EXCLUDED_STYLE = { label: 'Exclusão solicitada — não usar', color: '#934832', bg: 'rgba(184,90,62,0.18)' };

const DEPTH_STYLES: Record<ProfileDepth, { label: string; color: string; bg: string }> = {
  alto: { label: 'Perfil profundo', color: '#3A4A2E', bg: 'rgba(58,74,46,0.16)' },
  medio: { label: 'Perfil parcial', color: '#a8674f', bg: 'rgba(192,146,129,0.18)' },
  baixo: { label: 'Perfil superficial', color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.06)' },
};

function warmStyleFor(state: ConsentState) {
  if (state === 'oposicao_exclusao') return EXCLUDED_STYLE;
  return isWarmConsent(state) ? WARM_STYLE : COLD_STYLE;
}

function decorate(talent: Talent): TalentView {
  const avatar = AVATAR_STYLES[talent.avatarColorIndex];
  const warm = warmStyleFor(talent.consentState);
  const depth = DEPTH_STYLES[talent.profileDepth];
  return {
    ...talent,
    avatarBg: avatar.bg,
    avatarColor: avatar.color,
    warmLabel: warm.label,
    warmColor: warm.color,
    warmBg: warm.bg,
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
