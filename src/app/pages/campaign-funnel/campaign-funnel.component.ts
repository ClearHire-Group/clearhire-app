import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, of, switchMap } from 'rxjs';
import { DataApi } from '../../core/data-api';
import { CampaignContextService } from '../../core/campaign-context';
import { toLoadable } from '../../core/loadable';
import { PhaseKey } from '../../core/models';
import { CandidateView, toCandidateViews } from '../../core/candidate-view';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';
import { CountUpDirective } from '../../shared/count-up.directive';

/** Sub-tela "Funil" — blocos de fase + tabela de candidatos da fase selecionada. */
@Component({
  selector: 'app-campaign-funnel',
  standalone: true,
  imports: [CommonModule, RouterLink, ErrorStateComponent, CountUpDirective],
  templateUrl: './campaign-funnel.component.html',
  styleUrl: './campaign-funnel.component.scss',
})
export class CampaignFunnelComponent {
  private api = inject(DataApi);
  private ctx = inject(CampaignContextService);

  readonly campaignId = this.ctx.campaignId;
  readonly campaignState = this.ctx.campaignState;

  /** null até a campanha carregar e semear com a fase atual dela. */
  readonly selectedPhase = signal<PhaseKey | null>(null);
  private phase$ = toObservable(this.selectedPhase);
  private campaignId$ = toObservable(this.campaignId);

  readonly candidatesState = toLoadable(
    combineLatest([this.campaignId$, this.phase$]).pipe(
      switchMap(([id, phase]) => (phase ? this.api.getCandidates(id, phase) : of([]))),
    ),
  );

  /** Só resemeia `selectedPhase` numa troca real de campanha — um refetch da mesma campanha (ex.: após pausar) não deve descartar a fase que o recrutador escolheu ver. */
  private lastSeenCampaignId: string | null = null;

  constructor() {
    effect(() => {
      const campaign = this.campaignState.data();
      if (campaign && campaign.id !== this.lastSeenCampaignId) {
        this.lastSeenCampaignId = campaign.id;
        this.selectedPhase.set(campaign.currentPhaseKey);
      }
    });
  }

  selectPhase(key: PhaseKey): void {
    this.selectedPhase.set(key);
  }

  get activePhaseLabel(): string {
    return this.campaignState.data()?.phases.find((p) => p.key === this.selectedPhase())?.label ?? '';
  }

  get activePhaseCount(): number {
    return this.campaignState.data()?.phases.find((p) => p.key === this.selectedPhase())?.count ?? 0;
  }

  get candidateViews(): CandidateView[] {
    return toCandidateViews(this.candidatesState.data() ?? []);
  }
}
