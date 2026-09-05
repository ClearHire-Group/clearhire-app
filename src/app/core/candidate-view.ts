import { Candidate } from './models';

export interface CandidateView extends Candidate {
  avatarBg: string;
  avatarColor: string;
  pctLabel: string;
  ringStyle: string;
  statusColor: string;
  statusBg: string;
}

export const AVATAR_STYLES = [
  { bg: 'rgba(184,90,62,0.18)', color: '#B85A3E' },
  { bg: 'rgba(192,146,129,0.2)', color: '#a8674f' },
  { bg: 'rgba(58,74,46,0.16)', color: '#3A4A2E' },
];

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  'Aguardando análise da IA': { color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.06)' },
  'Em análise · Fit Cultural': { color: '#a8674f', bg: 'rgba(192,146,129,0.18)' },
  'Em análise · Triagem Técnica': { color: '#a8674f', bg: 'rgba(192,146,129,0.18)' },
  'Aguardando decisão': { color: '#934832', bg: 'rgba(184,90,62,0.18)' },
  'Proposta em elaboração': { color: '#3A4A2E', bg: 'rgba(58,74,46,0.16)' },
  'Entrevista concluída': { color: '#934832', bg: 'rgba(184,90,62,0.18)' },
  Contratada: { color: '#F0F0E6', bg: '#3A4A2E' },
  Reprovada: { color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.08)' },
};
const DEFAULT_STATUS_STYLE = { color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.06)' };

/** Shared candidate-row styling (avatar tint, match ring, status pill) — used by any table listing candidates. */
export function toCandidateViews(candidates: Candidate[]): CandidateView[] {
  return candidates.map((c, i) => {
    const avatar = AVATAR_STYLES[i % AVATAR_STYLES.length];
    const status = STATUS_STYLES[c.status] ?? DEFAULT_STATUS_STYLE;
    const deg = c.matchPct != null ? Math.round(c.matchPct * 3.6) : 0;
    return {
      ...c,
      avatarBg: avatar.bg,
      avatarColor: avatar.color,
      pctLabel: c.matchPct != null ? `${c.matchPct}%` : '—',
      ringStyle:
        c.matchPct != null
          ? `background:conic-gradient(#B85A3E 0deg ${deg}deg, rgba(21,26,34,0.1) ${deg}deg 360deg)`
          : 'background:rgba(21,26,34,0.08)',
      statusColor: status.color,
      statusBg: status.bg,
    };
  });
}
