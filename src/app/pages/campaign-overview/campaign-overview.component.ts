import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CampaignContextService } from '../../core/campaign-context';
import { DataApi } from '../../core/data-api';
import { AddTalentsResult, Phase, TalentMatch, TalentRecommendation } from '../../core/models';
import { CountUpDirective } from '../../shared/count-up.directive';
import { TalentMatchView, toTalentMatchViews } from '../../core/talent-view';

interface PhaseBar extends Phase {
  /** Largura da barra em % relativa à primeira fase do funil (Recebidos) — mede o drop-off acumulado. */
  widthPct: number;
  /** % desta fase em relação à fase anterior — conversão etapa a etapa. */
  stepConversionPct: number | null;
}

/** Teto de talentos por pedido de leitura de IA — espelha maxAssessedTalentsPerRequest no backend
 * (talent/service.go). Reforçado aqui só pra UX (desabilitar o botão cedo); a segurança de verdade
 * é o teto do lado do servidor. */
const MAX_ASSESSED_TALENTS = 5;

/** Sub-tela "Visão Geral" — snapshot rápido da campanha: KPIs, drop-off do funil, atalhos e
 * sugestões do Banco de Talentos (match reverso, seção 8.2 da especificação). */
@Component({
  selector: 'app-campaign-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, CountUpDirective],
  templateUrl: './campaign-overview.component.html',
  styleUrl: './campaign-overview.component.scss',
})
export class CampaignOverviewComponent {
  private ctx = inject(CampaignContextService);
  private api = inject(DataApi);

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

  // --- Sugestões do Banco de Talentos (match reverso) ---------------------------------------
  //
  // Etapa 1 (sempre): ranking determinístico, custo zero — mesmo motor/endpoint que o assistente
  // de Nova Campanha já usa. Etapa 2 (opt-in): leitura da IA sobre um recorte pequeno (até 5) dos
  // talentos que o recrutador já revisou e marcou — nunca automática (ver
  // documentos/banco-de-talentos-recomendacao-plano.md).

  readonly reverseMatchLoading = signal(false);
  readonly reverseMatchResults = signal<TalentMatchView[] | null>(null);
  readonly selectedTalentIds = signal<ReadonlySet<string>>(new Set());

  readonly assessLoading = signal(false);
  readonly assessError = signal('');
  /** Leitura da IA por talento já pedida nesta sessão de tela — sobrepõe o card do talento no
   * template quando presente. */
  readonly assessedById = signal<ReadonlyMap<string, TalentRecommendation>>(new Map());

  readonly canRequestAiReading = computed(() => {
    const n = this.selectedTalentIds().size;
    return n > 0 && n <= MAX_ASSESSED_TALENTS && !this.assessLoading();
  });

  viewSuggestedTalents(): void {
    const campaign = this.campaignState.data();
    if (!campaign) return;
    this.reverseMatchLoading.set(true);
    this.reverseMatchResults.set(null);
    this.selectedTalentIds.set(new Set());
    this.assessedById.set(new Map());
    this.assessError.set('');
    this.api
      .getReverseMatchForNewCampaign({
        title: campaign.title,
        modality: campaign.modality,
        seniority: campaign.seniority,
        requirements: campaign.requirements,
      })
      .subscribe((matches: TalentMatch[]) => {
        this.reverseMatchLoading.set(false);
        this.reverseMatchResults.set(toTalentMatchViews(matches));
      });
  }

  toggleTalentSelection(id: string): void {
    const next = new Set(this.selectedTalentIds());
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_ASSESSED_TALENTS) next.add(id);
    this.selectedTalentIds.set(next);
  }

  isTalentSelected(id: string): boolean {
    return this.selectedTalentIds().has(id);
  }

  requestAiReading(): void {
    const campaignId = this.campaignId();
    const ids = [...this.selectedTalentIds()];
    if (!campaignId || ids.length === 0) return;
    this.assessLoading.set(true);
    this.assessError.set('');
    this.api.assessTalentsForCampaign(campaignId, ids).subscribe({
      next: (recs) => {
        this.assessLoading.set(false);
        const next = new Map(this.assessedById());
        for (const r of recs) next.set(r.talent.id, r);
        this.assessedById.set(next);
      },
      error: () => {
        this.assessLoading.set(false);
        this.assessError.set('Não foi possível concluir a leitura da IA agora. Tente novamente em instantes.');
      },
    });
  }

  // --- Puxar pro funil -----------------------------------------------------------------------
  //
  // O passo que faltava depois de "ver talentos sugeridos"/"pedir leitura da IA": o recrutador
  // gostou do que viu e quer que a pessoa vire candidata de verdade nesta campanha. Talento com
  // exclusão solicitada, ou que ainda não foi notificado sobre o tratamento dos dados (LGPD —
  // documento de especificação, seção 5.2), não entra — volta em `addTalentsResult().skipped`,
  // nunca some sem explicação (ver campaign.Service.AddTalentsToCampaign no backend).

  readonly addTalentsLoading = signal(false);
  readonly addTalentsResult = signal<AddTalentsResult | null>(null);
  readonly addTalentsError = signal('');
  /** Ids já adicionados nesta sessão de tela — usado só pra trocar o botão da linha por "Adicionado
   * ✓", independente de o recrutador ter desmarcado o checkbox depois. */
  readonly addedTalentIds = signal<ReadonlySet<string>>(new Set());

  isTalentAdded(id: string): boolean {
    return this.addedTalentIds().has(id);
  }

  /** Motivo de um talento não ter entrado no último pedido — null quando não houve pedido, ou
   * quando este talento em particular nem foi tentado (não estava selecionado). */
  skipReasonFor(id: string): string | null {
    return this.addTalentsResult()?.skipped.find((s) => s.talentId === id)?.reason ?? null;
  }

  addSelectedTalentsToCampaign(): void {
    const campaignId = this.campaignId();
    const ids = [...this.selectedTalentIds()].filter((id) => !this.isTalentAdded(id));
    if (!campaignId || ids.length === 0) return;
    this.addTalentsLoading.set(true);
    this.addTalentsResult.set(null);
    this.addTalentsError.set('');
    this.api.addTalentsToCampaign(campaignId, ids).subscribe({
      next: (result) => {
        this.addTalentsLoading.set(false);
        this.addTalentsResult.set(result);
        if (result.added.length > 0) {
          const next = new Set(this.addedTalentIds());
          for (const id of result.added) next.add(id);
          this.addedTalentIds.set(next);
          this.ctx.refresh(); // recarrega KPIs/funil da campanha com os novos candidatos
        }
      },
      error: () => {
        this.addTalentsLoading.set(false);
        this.addTalentsError.set('Não foi possível adicionar os talentos agora. Tente novamente em instantes.');
      },
    });
  }
}
