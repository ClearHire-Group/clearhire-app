import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { PhaseKey } from '../../core/models';
import { CandidateView, toCandidateViews } from '../../core/candidate-view';

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, TopNavComponent],
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

  readonly campaignState = toLoadable(this.campaignId$.pipe(switchMap((id) => this.api.getCampaign(id))));

  /** null until the campaign loads and seeds it with the campaign's current phase. */
  readonly selectedPhase = signal<PhaseKey | null>(null);
  private phase$ = toObservable(this.selectedPhase);

  readonly candidatesState = toLoadable(
    combineLatest([this.campaignId$, this.phase$]).pipe(
      switchMap(([id, phase]) => (phase ? this.api.getCandidates(id, phase) : of([]))),
    ),
  );

  constructor() {
    effect(() => {
      const campaign = this.campaignState.data();
      if (campaign) this.selectedPhase.set(campaign.currentPhaseKey);
    });
  }

  selectPhase(key: PhaseKey): void {
    this.selectedPhase.set(key);
  }

  get campaignId(): string {
    return this.route.snapshot.paramMap.get('campaignId') ?? '';
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
