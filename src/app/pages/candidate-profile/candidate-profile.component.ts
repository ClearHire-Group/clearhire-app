import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';
import { DataApi } from '../../core/data-api';
import { CountUpDirective } from '../../shared/count-up.directive';
import { toLoadable } from '../../core/loadable';
import { HttpErrorResponse } from '@angular/common/http';
import { CandidateAssessment, CandidateAssessmentHistoryEntry, PHASE_LABELS, REJECTION_REASONS, RejectionReasonKey } from '../../core/models';

/** Rótulo do badge de confiança no card de IA — 'insuficiente' não usa isto, tem card próprio. */
const CONFIDENCE_LABELS: Record<Exclude<CandidateAssessment['confidence'], 'insuficiente'>, string> = {
  alta: 'Conclusão',
  media: 'Hipótese',
  baixa: 'Conclusão (confiança baixa)',
};

const COMPARISON_LABELS: Record<Exclude<CandidateAssessment['comparisonFlag'], ''>, string> = {
  reforca_anterior: 'Reforça avaliação anterior',
  diverge_anterior: 'Diverge da avaliação anterior',
  novo: 'Ponto novo',
};

/** Estado resumido de uma avaliação pra linha "Avaliação Global" — puramente uma leitura de
 * matchPct/confidence já existentes, nunca uma nova chamada de IA (ver análise da tela de Funil). */
type GlobalState = 'forte' | 'moderado' | 'atencao' | 'sem-dado';

function globalStateFor(a: CandidateAssessment): GlobalState {
  if (a.confidence === 'insuficiente') return 'sem-dado';
  if (a.matchPct >= 85) return 'forte';
  if (a.matchPct >= 65) return 'moderado';
  return 'atencao';
}

const GLOBAL_STATE_LABELS: Record<GlobalState, string> = {
  forte: 'forte',
  moderado: 'moderado',
  atencao: 'atenção',
  'sem-dado': 'sem dado',
};

@Component({
  selector: 'app-candidate-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent, ErrorStateComponent, CountUpDirective],
  templateUrl: './candidate-profile.component.html',
  styleUrl: './candidate-profile.component.scss',
})
export class CandidateProfileComponent {
  private route = inject(ActivatedRoute);
  private api = inject(DataApi);

  private campaignId$ = this.route.paramMap.pipe(map((p) => p.get('campaignId') ?? ''));
  private candidateId$ = this.route.paramMap.pipe(map((p) => p.get('candidateId') ?? ''));

  /** Reativos (não `snapshot`): o Angular reaproveita esta instância ao navegar entre dois candidatos da mesma rota. */
  readonly campaignId = toSignal(this.campaignId$, { initialValue: '' });
  readonly candidateId = toSignal(this.candidateId$, { initialValue: '' });

  readonly rejectionReasons = REJECTION_REASONS;
  readonly rejectModalOpen = signal(false);
  readonly rejectStep = signal<'motivo' | 'convite'>('motivo');
  readonly selectedReasonKey = signal<RejectionReasonKey | null>(null);
  readonly sendBankInvite = signal(true);
  readonly rejectSaving = signal(false);
  readonly rejectResult = signal<{ talentId?: string; reasonQualifies: boolean; sentToBank: boolean } | null>(null);

  readonly advanceSaving = signal(false);
  readonly advanceResult = signal<{ nextPhaseLabel: string; talentId?: string } | null>(null);
  /** Falha de avançar/reprovar. Antes não havia tratamento: o botão ficava em "Confirmando…" sem aviso. */
  readonly decisionError = signal('');

  readonly selectedReason = computed(() => this.rejectionReasons.find((r) => r.key === this.selectedReasonKey()) ?? null);

  readonly campaignState = toLoadable(this.campaignId$.pipe(switchMap((id) => this.api.getCampaign(id))));
  readonly profileState = toLoadable(this.candidateId$.pipe(switchMap((id) => this.api.getCandidateProfile(id))));

  readonly loading = computed(() => this.campaignState.loading() || this.profileState.loading());
  readonly hasError = computed(() => this.campaignState.error() || this.profileState.error());

  /** Análise pedida nesta tela. Guarda o id junto: o Angular reaproveita esta instância ao navegar
   * entre candidatos, e a análise de um não pode aparecer no perfil do outro. */
  private readonly requested = signal<{ candidateId: string; assessment: CandidateAssessment } | null>(null);
  readonly assessing = signal(false);
  readonly assessError = signal('');

  /** A análise a exibir: a que acabou de ser pedida, ou a que o servidor já tinha. `null` = ainda não avaliado. */
  readonly ai = computed<CandidateAssessment | null>(() => {
    const requested = this.requested();
    if (requested && requested.candidateId === this.candidateId()) return requested.assessment;
    return this.profileState.data()?.ai ?? null;
  });

  /** Candidato pra quem já disparamos a tentativa automática (sucesso ou erro, tanto faz) — trava
   * o auto-disparo a UMA tentativa por candidato/fase, pra um erro (teto de gasto, provedor fora)
   * não virar loop de retry sozinho. O botão "Analisar com IA" continua na tela pra retry manual
   * quando `assessError()` estiver preenchido. */
  private readonly autoAssessTriedFor = signal<string | null>(null);

  constructor() {
    // Dispara a análise sozinho ao abrir um perfil sem avaliação nesta fase — em vez de esperar o
    // clique em "Analisar com IA". O gatilho continua sendo "alguém está olhando pra este
    // candidato agora" (mesmo princípio do botão manual: nunca gasta com quem ninguém abriu), só
    // sem o clique extra. Ver discussão de por que NÃO disparar no avanço de fase em background.
    effect(() => {
      const profile = this.profileState.data();
      const id = this.candidateId();
      if (!profile || !id) return;
      if (this.ai() !== null) return;
      if (this.assessing() || this.autoAssessTriedFor() === id) return;

      this.autoAssessTriedFor.set(id);
      this.requestAssessment();
    });
  }

  readonly ringDeg = computed(() => Math.round((this.ai()?.matchPct ?? 0) * 3.6));
  /** O ângulo já com unidade, pra ir inteiro numa custom property — não dependemos de o Angular
   * aplicar sufixo de unidade em `[style.--x]`, que não é garantido como em `[style.width.px]`.
   * É o alvo que o keyframe ring-sweep varre (ver o SCSS). */
  readonly ringTarget = computed(() => `${this.ringDeg()}deg`);

  /** Fases ANTERIORES já avaliadas (a atual já vem em `ai`, nunca duplicada aqui — ver comentário
   * de CandidateProfileData.aiHistory). `[]` até o perfil carregar ou se esta é a primeira fase
   * avaliada. */
  readonly aiHistory = computed<CandidateAssessmentHistoryEntry[]>(() => this.profileState.data()?.aiHistory ?? []);

  /** O chip de comparação só aparece quando HÁ de verdade uma fase anterior no histórico — não só
   * porque o campo veio preenchido. A IA às vezes devolve um valor mesmo sem <fase_anterior> ter
   * sido enviada (observado em teste real contra o Groq); a tela não confia cegamente nisso. */
  showComparisonChip(a: CandidateAssessment): boolean {
    return a.comparisonFlag !== '' && this.aiHistory().length > 0;
  }

  confidenceLabel(confidence: Exclude<CandidateAssessment['confidence'], 'insuficiente'>): string {
    return CONFIDENCE_LABELS[confidence];
  }

  // Aceita o tipo completo (não só o Exclude<'', ...>): o template não consegue provar pro
  // compilador que showComparisonChip() já garantiu que não é '' antes de chamar isto.
  comparisonLabel(flag: CandidateAssessment['comparisonFlag']): string {
    return flag === '' ? '' : COMPARISON_LABELS[flag];
  }

  /**
   * Avaliação Global: leitura determinística sobre `ai` + `aiHistory`, NUNCA uma nova chamada de
   * IA — a IA já fez o trabalho caro em cada fase; isto só resume o que já foi dito. `matchPct` é
   * o da avaliação CONCLUSIVA mais recente (confidence ≠ 'insuficiente'), não uma média — a fase
   * mais recente é a mais informada sobre o candidato agora.
   */
  readonly globalSummary = computed(() => {
    const profile = this.profileState.data();
    const current = this.ai();
    const history = this.aiHistory();

    const entries = [
      ...history.map((h) => ({ phaseLabel: h.phaseLabel, state: globalStateFor(h), stateLabel: GLOBAL_STATE_LABELS[globalStateFor(h)] })),
      ...(current && profile ? [{ phaseLabel: profile.phaseLabel, state: globalStateFor(current), stateLabel: GLOBAL_STATE_LABELS[globalStateFor(current)] }] : []),
    ];

    const latestConclusive = current && current.confidence !== 'insuficiente' ? current : [...history].reverse().find((h) => h.confidence !== 'insuficiente');

    return { entries, matchPct: latestConclusive?.matchPct ?? null };
  });

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

  readonly breadcrumb = computed(() => {
    const campaign = this.campaignState.data();
    const name = this.profileState.data()?.name ?? '';
    return campaign ? `Campanhas / ${campaign.title} / Candidatos / ${name}` : '';
  });

  /** Pede a análise da IA. Sugestão apenas: não move o candidato de fase nem decide nada. */
  requestAssessment(): void {
    if (this.assessing()) return;
    const candidateId = this.candidateId();
    this.assessing.set(true);
    this.assessError.set('');
    this.api.assessCandidate(candidateId).subscribe({
      next: (assessment) => {
        this.assessing.set(false);
        this.requested.set({ candidateId, assessment });
      },
      error: (err: unknown) => {
        this.assessing.set(false);
        // A mensagem do servidor já é a certa para o recrutador (IA desligada, teto de gasto, provedor
        // fora); só cai no texto genérico se ela não vier.
        const serverMessage = err instanceof HttpErrorResponse ? (err.error?.error as string | undefined) : undefined;
        this.assessError.set(serverMessage ?? 'Não foi possível gerar a análise agora. Tente novamente em instantes.');
      },
    });
  }

  openRejectModal(): void {
    this.rejectModalOpen.set(true);
    this.rejectStep.set('motivo');
    this.selectedReasonKey.set(null);
    this.sendBankInvite.set(true);
  }

  closeRejectModal(): void {
    this.rejectModalOpen.set(false);
  }

  chooseReason(key: RejectionReasonKey): void {
    this.selectedReasonKey.set(key);
  }

  proceedFromMotivo(): void {
    const reason = this.selectedReason();
    if (!reason) return;
    if (reason.goesToBank) {
      this.rejectStep.set('convite');
    } else {
      this.confirmReject();
    }
  }

  confirmReject(): void {
    const reason = this.selectedReason();
    if (!reason || this.rejectSaving()) return;
    this.rejectSaving.set(true);
    const sentToBank = reason.goesToBank && this.sendBankInvite();
    this.decisionError.set('');
    this.api.submitCandidateRejection(this.candidateId(), reason.key, sentToBank).subscribe({
      next: ({ talent }) => {
        this.rejectSaving.set(false);
        this.rejectModalOpen.set(false);
        this.rejectResult.set({ talentId: talent?.id, reasonQualifies: reason.goesToBank, sentToBank });
      },
      error: (err: unknown) => {
        this.rejectSaving.set(false);
        this.rejectModalOpen.set(false);
        this.decisionError.set(this.decisionErrorMessage(err, 'Não foi possível registrar a reprovação.'));
      },
    });
  }

  approveAndAdvance(): void {
    if (this.advanceSaving() || this.advanceResult() || this.rejectResult()) return;
    this.advanceSaving.set(true);
    this.decisionError.set('');
    this.api.advanceCandidate(this.candidateId()).subscribe({
      next: (candidate) => {
        this.advanceSaving.set(false);
        this.advanceResult.set({ nextPhaseLabel: candidate ? PHASE_LABELS[candidate.phase] : '', talentId: candidate?.talentId });
      },
      error: (err: unknown) => {
        this.advanceSaving.set(false);
        this.decisionError.set(this.decisionErrorMessage(err, 'Não foi possível avançar o candidato.'));
      },
    });
  }

  private decisionErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return 'Sem conexão com o servidor. Tente novamente.';
      const message = (err.error as { error?: string } | null)?.error;
      if (message && err.status < 500) return message.charAt(0).toUpperCase() + message.slice(1) + (message.endsWith('.') ? '' : '.');
    }
    return `${fallback} Tente novamente.`;
  }
}
