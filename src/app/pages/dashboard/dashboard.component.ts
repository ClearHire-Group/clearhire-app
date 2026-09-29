import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { Campaign } from '../../core/models';
import { CountUpDirective } from '../../shared/count-up.directive';

/** Quantas campanhas o resumo do dashboard mostra antes de empurrar o resto para "Ver todas". */
const DASHBOARD_CAMPAIGN_LIMIT = 4;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent, ErrorStateComponent, CountUpDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private api = inject(DataApi);

  readonly subTabs: SubTab[] = [
    { label: 'Visão Geral', route: '/dashboard', exact: true },
    { label: 'Atividade', route: '/dashboard/atividade' },
  ];

  readonly campaignsState = toLoadable(this.api.getCampaigns());
  readonly metricsState = toLoadable(this.api.getDashboardMetrics());
  readonly suggestionsState = toLoadable(this.api.getAiSuggestions());

  readonly activeCampaigns = computed(() =>
    (this.campaignsState.data() ?? [])
      .filter((c) => c.status !== 'encerrada')
      // Ativas primeiro — são as que pedem atenção agora; pausadas completam a lista se sobrar espaço.
      .sort((a, b) => Number(a.status === 'pausada') - Number(b.status === 'pausada'))
      .slice(0, DASHBOARD_CAMPAIGN_LIMIT),
  );

  /** Quantos candidatos já chegaram à fase atual da campanha — leitura concreta no lugar do % abstrato do funil. */
  phaseCount(campaign: Campaign): number {
    return campaign.phases.find((p) => p.key === campaign.currentPhaseKey)?.count ?? 0;
  }

  readonly hiresGoalPercent = computed(() => {
    const m = this.metricsState.data();
    return m && m.hiresGoal ? Math.min(100, Math.round((m.hiresInPeriod / m.hiresGoal) * 100)) : 0;
  });
}
