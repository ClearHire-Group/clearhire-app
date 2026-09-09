import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { PhaseKey } from '../../core/models';
import { CandidateView, toCandidateViews } from '../../core/candidate-view';

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent],
  templateUrl: './campaign-detail.component.html',
  styleUrl: './campaign-detail.component.scss',
})
export class CampaignDetailComponent {
  private route = inject(ActivatedRoute);
  private api = inject(DataApi);

  private campaignId$ = this.route.paramMap.pipe(map((p) => p.get('campaignId') ?? ''));

  readonly subTabs: SubTab[] = [
    { label: 'Visão Geral' },
    { label: 'Funil', active: true },
    { label: 'Candidatos' },
    { label: 'Configurações da Campanha' },
  ];

  private refreshTrigger = signal(0);
  readonly campaignState = toLoadable(
    combineLatest([this.campaignId$, toObservable(this.refreshTrigger)]).pipe(
      switchMap(([id]) => this.api.getCampaign(id)),
    ),
  );
  readonly pauseSaving = signal(false);

  /** null until the campaign loads and seeds it with the campaign's current phase. */
  readonly selectedPhase = signal<PhaseKey | null>(null);
  private phase$ = toObservable(this.selectedPhase);

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

  /** Reativo (não `snapshot`): o Angular reaproveita esta instância ao navegar entre duas campanhas da mesma rota. */
  readonly campaignId = toSignal(this.campaignId$, { initialValue: '' });

  togglePause(): void {
    if (this.pauseSaving()) return;
    this.pauseSaving.set(true);
    this.api.toggleCampaignPause(this.campaignId()).subscribe(() => {
      this.pauseSaving.set(false);
      this.refreshTrigger.update((n) => n + 1);
    });
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
