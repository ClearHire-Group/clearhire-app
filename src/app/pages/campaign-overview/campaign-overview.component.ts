import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CampaignContextService } from '../../core/campaign-context';
import { Phase } from '../../core/models';
import { CountUpDirective } from '../../shared/count-up.directive';

interface PhaseBar extends Phase {
  /** Largura da barra em % relativa à primeira fase do funil (Recebidos) — mede o drop-off acumulado. */
  widthPct: number;
  /** % desta fase em relação à fase anterior — conversão etapa a etapa. */
  stepConversionPct: number | null;
}

/** Sub-tela "Visão Geral" — snapshot rápido da campanha: KPIs, drop-off do funil e atalhos. */
@Component({
  selector: 'app-campaign-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, CountUpDirective],
  templateUrl: './campaign-overview.component.html',
  styleUrl: './campaign-overview.component.scss',
})
export class CampaignOverviewComponent {
  private ctx = inject(CampaignContextService);

  readonly campaignId = this.ctx.campaignId;
  readonly campaignState = this.ctx.campaignState;

  readonly selectedCount = computed(
    () => this.campaignState.data()?.phases.find((p) => p.key === 'selecionados')?.count ?? 0,
  );

  readonly conversionPct = computed(() => {
    const campaign = this.campaignState.data();
    if (!campaign || campaign.totalCandidates === 0) return 0;
    return Math.round((this.selectedCount() / campaign.totalCandidates) * 1000) / 10;
  });

  readonly phaseBars = computed<PhaseBar[]>(() => {
    const phases = this.campaignState.data()?.phases ?? [];
    const first = phases[0]?.count ?? 0;
    return phases.map((phase, i) => ({
      ...phase,
      widthPct: first > 0 ? Math.round((phase.count / first) * 100) : 0,
      stepConversionPct:
        i === 0 || !phases[i - 1] || phases[i - 1].count === 0
          ? null
          : Math.round((phase.count / phases[i - 1].count) * 1000) / 10,
    }));
  });
}
