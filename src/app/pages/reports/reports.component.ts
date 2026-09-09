import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { CampaignStatus } from '../../core/models';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  private api = inject(DataApi);

  readonly funnelState = toLoadable(this.api.getFunnelSummary());
  readonly performanceState = toLoadable(this.api.getCampaignPerformance());
  readonly trustState = toLoadable(this.api.getAiTrustMetrics());

  readonly funnelRows = computed(() => {
    const phases = this.funnelState.data() ?? [];
    if (!phases.length) return [];
    const max = phases[0].count || 1;
    return phases.map((p, i) => {
      const prevCount = i > 0 ? phases[i - 1].count : null;
      const conversionPct = prevCount && prevCount > 0 ? Math.round((p.count / prevCount) * 1000) / 10 : null;
      return { ...p, barPct: (p.count / max) * 100, conversionPct };
    });
  });

  readonly overallConversionPct = computed(() => {
    const phases = this.funnelState.data() ?? [];
    if (phases.length < 2) return 0;
    const first = phases[0].count;
    const last = phases[phases.length - 1].count;
    return first > 0 ? Math.round((last / first) * 1000) / 10 : 0;
  });

  readonly receivedCount = computed(() => this.funnelState.data()?.find((p) => p.key === 'recebidos')?.count);
  readonly selectedCount = computed(() => this.funnelState.data()?.find((p) => p.key === 'selecionados')?.count);

  readonly performanceRows = computed(() => {
    const rows = this.performanceState.data() ?? [];
    const max = Math.max(...rows.map((r) => r.conversionPct), 0.1);
    return rows.map((r) => ({ ...r, barPct: (r.conversionPct / max) * 100 }));
  });

  readonly trustRingDeg = computed(() => {
    const trust = this.trustState.data();
    return trust ? Math.round(trust.agreementRatePct * 3.6) : 0;
  });

  statusLabel(status: CampaignStatus): string {
    return status === 'ativa' ? 'ATIVA' : status === 'pausada' ? 'PAUSADA' : 'ENCERRADA';
  }
}
