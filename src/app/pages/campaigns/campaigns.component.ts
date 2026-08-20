import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataService } from '../../core/data.service';
import { Campaign, Phase } from '../../core/models';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, RouterLink, TopNavComponent],
  templateUrl: './campaigns.component.html',
  styleUrl: './campaigns.component.scss',
})
export class CampaignsComponent {
  readonly campaigns: Campaign[];
  readonly subTabs: SubTab[];

  constructor(private data: DataService) {
    this.campaigns = this.data.getCampaigns();
    const ativas = this.campaigns.filter((c) => c.status === 'ativa').length;
    const pausadas = this.campaigns.filter((c) => c.status === 'pausada').length;
    const encerradas = this.campaigns.filter((c) => c.status === 'encerrada').length;
    this.subTabs = [
      { label: `Todas · ${this.campaigns.length}`, active: true },
      { label: `Ativas · ${ativas}` },
      { label: `Pausadas · ${pausadas}` },
      { label: `Encerradas · ${encerradas}` },
    ];
  }

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
