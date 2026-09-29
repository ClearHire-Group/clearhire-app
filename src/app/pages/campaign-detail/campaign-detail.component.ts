import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { CopyLinkButtonComponent } from '../../layout/copy-link-button/copy-link-button.component';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';
import { DataApi } from '../../core/data-api';
import { CampaignContextService } from '../../core/campaign-context';

/**
 * Casca da tela de campanha: carrega a campanha uma vez (via `CampaignContextService`, provido
 * aqui e injetado pelas sub-telas do `<router-outlet>`), renderiza header + abas reais, e deixa o
 * conteúdo de cada sub-tela (Funil/Candidatos/Visão Geral/Configurações) para as rotas filhas.
 */
@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [CommonModule, RouterOutlet, PageTabsComponent, CopyLinkButtonComponent, ErrorStateComponent],
  providers: [CampaignContextService],
  templateUrl: './campaign-detail.component.html',
  styleUrl: './campaign-detail.component.scss',
})
export class CampaignDetailComponent {
  private api = inject(DataApi);
  private ctx = inject(CampaignContextService);

  readonly campaignId = this.ctx.campaignId;
  readonly campaignState = this.ctx.campaignState;

  readonly subTabs = computed<SubTab[]>(() => {
    const id = this.campaignId();
    return [
      { label: 'Visão Geral', route: ['/campanhas', id, 'visao-geral'] },
      { label: 'Sourcing', route: ['/campanhas', id, 'sourcing'] },
      { label: 'Funil', route: ['/campanhas', id, 'funil'] },
      { label: 'Candidatos', route: ['/campanhas', id, 'candidatos'] },
      { label: 'Configurações da Campanha', route: ['/campanhas', id, 'configuracoes'] },
    ];
  });

  readonly pauseSaving = signal(false);

  togglePause(): void {
    if (this.pauseSaving()) return;
    this.pauseSaving.set(true);
    this.api.toggleCampaignPause(this.campaignId()).subscribe(() => {
      this.pauseSaving.set(false);
      this.ctx.refresh();
    });
  }

  // --- Link de candidatura pública --------------------------------------------
  readonly publicLinkModalOpen = signal(false);
  readonly publicLinkSaving = signal(false);
  readonly publicLinkError = signal('');

  /** Mesma trava do backend e da tela de Configurações: sem descrição salva, o link abriria uma
   * vaga sem conteúdo nenhum pro candidato. */
  readonly canGeneratePublicLink = computed(() => (this.campaignState.data()?.description ?? '').trim().length > 0);

  get publicApplicationUrl(): string {
    return `${location.origin}/vagas/${this.campaignId()}`;
  }

  openPublicLinkModal(): void {
    this.publicLinkModalOpen.set(true);
  }

  closePublicLinkModal(): void {
    if (this.publicLinkSaving()) return;
    this.publicLinkModalOpen.set(false);
    this.publicLinkError.set('');
  }

  setPublicLink(enabled: boolean): void {
    if (this.publicLinkSaving()) return;
    this.publicLinkSaving.set(true);
    this.publicLinkError.set('');
    this.api.setCampaignPublicLink(this.campaignId(), enabled).subscribe({
      next: () => {
        this.publicLinkSaving.set(false);
        this.ctx.refresh();
      },
      error: (err: unknown) => {
        this.publicLinkSaving.set(false);
        const body = err instanceof HttpErrorResponse ? (err.error as { error?: string } | null) : null;
        this.publicLinkError.set(body?.error ?? 'Não foi possível atualizar o link de candidatura.');
      },
    });
  }
}
