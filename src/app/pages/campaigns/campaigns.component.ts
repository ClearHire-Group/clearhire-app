import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { Campaign, CampaignStatus, Phase } from '../../core/models';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent],
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

  /** Nunca criou campanha nenhuma. */
  readonly isFirstCampaign = computed(() => (this.campaignsState.data() ?? []).length === 0);

  /** Tem histórico, mas nada ativo/pausado agora — todas as campanhas estão encerradas. As
   * encerradas continuam acessíveis pela sub-aba própria, não precisam duplicar aqui embaixo. */
  readonly allCampaignsClosed = computed(() => {
    const all = this.campaignsState.data() ?? [];
    return all.length > 0 && all.every((c) => c.status === 'encerrada');
  });

  /** O card de call-to-action só aparece na aba "Todas" (sem filtro) — abas filtradas por status
   * já têm a mensagem contextual de `filteredEmptyMessage` pra lista vazia. */
  readonly showCampaignPrompt = computed(
    () => !this.statusFilter() && (this.isFirstCampaign() || this.allCampaignsClosed()),
  );

  readonly filteredEmptyMessage = computed(() => {
    switch (this.statusFilter()) {
      case 'ativa':
        return 'Nenhuma campanha ativa no momento.';
      case 'pausada':
        return 'Nenhuma campanha pausada no momento.';
      case 'encerrada':
        return 'Nenhuma campanha encerrada ainda.';
      default:
        return 'Nenhuma campanha encontrada.';
    }
  });

  /** Campanha ativa em destaque na listagem: a com mais candidatos em processo agora. */
  readonly featuredCampaignId = computed(() => {
    const ativas = (this.campaignsState.data() ?? []).filter((c) => c.status === 'ativa');
    if (!ativas.length) return null;
    return ativas.reduce((max, c) => (c.totalCandidates > max.totalCandidates ? c : max)).id;
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

  readonly copiedCampaignId = signal<string | null>(null);

  copyLink(campaign: Campaign, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!campaign.acceptsPublicApplications) return;
    const url = `${location.origin}/vagas/${campaign.id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copiedCampaignId.set(campaign.id);
      setTimeout(() => {
        if (this.copiedCampaignId() === campaign.id) this.copiedCampaignId.set(null);
      }, 1800);
    });
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
