import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { Campaign, CampaignStatus, Phase } from '../../core/models';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, RouterLink, TopNavComponent],
  templateUrl: './campaigns.component.html',
  styleUrl: './campaigns.component.scss',
})
export class CampaignsComponent {
  private api = inject(DataApi);
  private route = inject(ActivatedRoute);

  readonly campaignsState = toLoadable(this.api.getCampaigns());

  readonly statusFilter = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('status') as CampaignStatus | null)),
    { initialValue: null },
  );

  readonly filteredCampaigns = computed(() => {
    const all = this.campaignsState.data() ?? [];
    const status = this.statusFilter();
    return status ? all.filter((c) => c.status === status) : all;
  });

  readonly subTabs = computed<SubTab[]>(() => {
    const campaigns = this.campaignsState.data() ?? [];
    const ativas = campaigns.filter((c) => c.status === 'ativa').length;
    const pausadas = campaigns.filter((c) => c.status === 'pausada').length;
    const encerradas = campaigns.filter((c) => c.status === 'encerrada').length;
    return [
      { label: `Todas · ${campaigns.length}`, route: '/campanhas', exact: true },
      { label: `Ativas · ${ativas}`, route: '/campanhas', queryParams: { status: 'ativa' }, exact: true },
      { label: `Pausadas · ${pausadas}`, route: '/campanhas', queryParams: { status: 'pausada' }, exact: true },
      { label: `Encerradas · ${encerradas}`, route: '/campanhas', queryParams: { status: 'encerrada' }, exact: true },
    ];
  });

  statusLabel(status: Campaign['status']): string {
    return status === 'ativa' ? 'ATIVA' : status === 'pausada' ? 'PAUSADA' : 'ENCERRADA';
  }

  /** Funnel-bar color: gray track (not reached), sand (current stage),
   *  accent (final "Selecionados" destination) or success (already passed / campaign closed). */
  barModifier(campaign: Campaign, phase: Phase): 'track' | 'success' | 'sand' | 'accent' {
    if (phase.count === 0) return 'track';
    if (campaign.status === 'encerrada') return 'success';
    if (phase.key === campaign.currentPhaseKey) return 'sand';
    if (phase.key === 'selecionados') return 'accent';
    return 'success';
  }
}
