import { SOURCING_TOOL_LABELS, SourcingProspect, SourcingProspectStatus, SourcingToolKey } from './models';
import { AVATAR_STYLES } from './candidate-view';

export interface SourcingProspectView extends SourcingProspect {
  avatarBg: string;
  avatarColor: string;
  toolLabel: string;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
}

const STATUS_STYLES: Record<SourcingProspectStatus, { label: string; color: string; bg: string }> = {
  novo: { label: 'Novo', color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.06)' },
  cadastrado: { label: 'Cadastrado(a) no banco ✓', color: '#3A4A2E', bg: 'rgba(58,74,46,0.16)' },
};

/** Mesma decoração visual de `talent-view.ts`/`candidate-view.ts` (avatar por índice, badges por
 * enum) — reaproveitada aqui pra Sourcing parecer irmão do resto do funil, não uma tela à parte. */
export function toProspectViews(prospects: SourcingProspect[]): SourcingProspectView[] {
  return prospects.map((p) => {
    const avatar = AVATAR_STYLES[p.avatarColorIndex % AVATAR_STYLES.length];
    const status = STATUS_STYLES[p.status];
    return {
      ...p,
      avatarBg: avatar.bg,
      avatarColor: avatar.color,
      toolLabel: SOURCING_TOOL_LABELS[p.tool as SourcingToolKey],
      statusLabel: status.label,
      statusColor: status.color,
      statusBg: status.bg,
    };
  });
}
