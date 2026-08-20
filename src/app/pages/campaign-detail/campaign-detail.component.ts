import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { Candidate, PhaseKey } from '../../core/models';

interface CandidateView extends Candidate {
  avatarBg: string;
  avatarColor: string;
  pctLabel: string;
  ringStyle: string;
  statusColor: string;
  statusBg: string;
}

const AVATAR_STYLES = [
  { bg: 'rgba(184,90,62,0.18)', color: '#B85A3E' },
  { bg: 'rgba(192,146,129,0.2)', color: '#a8674f' },
  { bg: 'rgba(58,74,46,0.16)', color: '#3A4A2E' },
];

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  'Aguardando análise da IA': { color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.06)' },
  'Em análise · Fit Cultural': { color: '#a8674f', bg: 'rgba(192,146,129,0.18)' },
  'Em análise · Triagem Técnica': { color: '#a8674f', bg: 'rgba(192,146,129,0.18)' },
  'Aguardando decisão': { color: '#934832', bg: 'rgba(184,90,62,0.18)' },
  'Proposta em elaboração': { color: '#3A4A2E', bg: 'rgba(58,74,46,0.16)' },
};

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
    const raw = this.candidatesState.data() ?? [];
    return raw.map((c, i) => {
      const avatar = AVATAR_STYLES[i % AVATAR_STYLES.length];
      const status = STATUS_STYLES[c.status] ?? { color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.06)' };
      const deg = c.matchPct != null ? Math.round(c.matchPct * 3.6) : 0;
      return {
        ...c,
        avatarBg: avatar.bg,
        avatarColor: avatar.color,
        pctLabel: c.matchPct != null ? `${c.matchPct}%` : '—',
        ringStyle:
          c.matchPct != null
            ? `background:conic-gradient(#B85A3E 0deg ${deg}deg, rgba(21,26,34,0.1) ${deg}deg 360deg)`
            : 'background:rgba(21,26,34,0.08)',
        statusColor: status.color,
        statusBg: status.bg,
      };
    });
  }
}
