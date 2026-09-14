import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataApi } from '../../core/data-api';
import { CampaignContextService } from '../../core/campaign-context';

/**
 * Sub-tela "Configurações da Campanha" — v1 cobre só o que a API já suporta hoje (pausar/retomar,
 * link de candidaturas). Edição de título/descrição/fases fica marcada como "em breve": não existe
 * `updateCampaign` no `DataApi`/backend ainda — ver `docs/API.md` do backend antes de destravar.
 */
@Component({
  selector: 'app-campaign-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './campaign-settings.component.html',
  styleUrl: './campaign-settings.component.scss',
})
export class CampaignSettingsComponent {
  private api = inject(DataApi);
  private ctx = inject(CampaignContextService);

  readonly campaignId = this.ctx.campaignId;
  readonly campaignState = this.ctx.campaignState;

  readonly pauseSaving = signal(false);
  readonly linkSaving = signal(false);

  togglePause(): void {
    if (this.pauseSaving()) return;
    this.pauseSaving.set(true);
    this.api.toggleCampaignPause(this.campaignId()).subscribe(() => {
      this.pauseSaving.set(false);
      this.ctx.refresh();
    });
  }

  setPublicLink(enabled: boolean): void {
    if (this.linkSaving()) return;
    this.linkSaving.set(true);
    this.api.setCampaignPublicLink(this.campaignId(), enabled).subscribe(() => {
      this.linkSaving.set(false);
      this.ctx.refresh();
    });
  }

  get publicApplicationUrl(): string {
    return `${location.origin}/vagas/${this.campaignId()}`;
  }
}
