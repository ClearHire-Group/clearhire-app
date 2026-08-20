import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { Campaign, Phase } from '../../core/models';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, RouterLink, TopNavComponent],
  templateUrl: './campaigns.component.html',
  styleUrl: './campaigns.component.scss',
})
export class CampaignsComponent {
  private api = inject(DataApi);

  readonly campaignsState = toLoadable(this.api.getCampaigns());

  readonly subTabs = computed<SubTab[]>(() => {
    const campaigns = this.campaignsState.data() ?? [];
    const ativas = campaigns.filter((c) => c.status === 'ativa').length;
    const pausadas = campaigns.filter((c) => c.status === 'pausada').length;
    const encerradas = campaigns.filter((c) => c.status === 'encerrada').length;
    return [
      { label: `Todas · ${campaigns.length}`, active: true },
      { label: `Ativas · ${ativas}` },
      { label: `Pausadas · ${pausadas}` },
      { label: `Encerradas · ${encerradas}` },
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
