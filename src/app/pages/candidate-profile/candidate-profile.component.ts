import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { PHASE_LABELS, REJECTION_REASONS, RejectionReasonKey } from '../../core/models';

@Component({
  selector: 'app-candidate-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent],
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
  readonly rejectResult = signal<{ talentId?: string } | null>(null);

  readonly advanceSaving = signal(false);
  readonly advanceResult = signal<{ nextPhaseLabel: string } | null>(null);

  readonly selectedReason = computed(() => this.rejectionReasons.find((r) => r.key === this.selectedReasonKey()) ?? null);

  readonly campaignState = toLoadable(this.campaignId$.pipe(switchMap((id) => this.api.getCampaign(id))));
  readonly profileState = toLoadable(this.candidateId$.pipe(switchMap((id) => this.api.getCandidateProfile(id))));

  readonly loading = computed(() => this.campaignState.loading() || this.profileState.loading());
  readonly hasError = computed(() => this.campaignState.error() || this.profileState.error());

  readonly ringDeg = computed(() => {
    const profile = this.profileState.data();
    return profile ? Math.round(profile.ai.matchPct * 3.6) : 0;
  });

  readonly subTabs: SubTab[] = [
    { label: 'Visão Geral' },
    { label: 'Funil' },
    { label: 'Candidatos', active: true },
    { label: 'Configurações da Campanha' },
  ];

  readonly breadcrumb = computed(() => {
    const campaign = this.campaignState.data();
    const name = this.profileState.data()?.name ?? '';
    return campaign ? `Campanhas / ${campaign.title} / Candidatos / ${name}` : '';
  });

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
    this.api.submitCandidateRejection(this.candidateId(), reason.key, reason.goesToBank && this.sendBankInvite()).subscribe(({ talent }) => {
      this.rejectSaving.set(false);
      this.rejectModalOpen.set(false);
      this.rejectResult.set({ talentId: talent?.id });
    });
  }

  approveAndAdvance(): void {
    if (this.advanceSaving() || this.advanceResult() || this.rejectResult()) return;
    this.advanceSaving.set(true);
    this.api.advanceCandidate(this.candidateId()).subscribe((candidate) => {
      this.advanceSaving.set(false);
      this.advanceResult.set({ nextPhaseLabel: candidate ? PHASE_LABELS[candidate.phase] : '' });
    });
  }
}
