import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { HttpErrorResponse } from '@angular/common/http';
import { CandidateAssessment, PHASE_LABELS, REJECTION_REASONS, RejectionReasonKey } from '../../core/models';

@Component({
  selector: 'app-candidate-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent, ErrorStateComponent],
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

  readonly ringDeg = computed(() => Math.round((this.ai()?.matchPct ?? 0) * 3.6));

  readonly subTabs = computed<SubTab[]>(() => {
    const id = this.campaignId();
    return [
      { label: 'Visão Geral', route: ['/campanhas', id, 'visao-geral'] },
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
