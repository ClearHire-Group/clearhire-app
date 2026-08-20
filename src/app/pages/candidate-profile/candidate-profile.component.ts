import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';

@Component({
  selector: 'app-candidate-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, TopNavComponent],
  templateUrl: './candidate-profile.component.html',
  styleUrl: './candidate-profile.component.scss',
})
export class CandidateProfileComponent {
  private route = inject(ActivatedRoute);
  private api = inject(DataApi);

  private campaignId$ = this.route.paramMap.pipe(map((p) => p.get('campaignId') ?? ''));
  private candidateId$ = this.route.paramMap.pipe(map((p) => p.get('candidateId') ?? ''));

  readonly campaignId = this.route.snapshot.paramMap.get('campaignId') ?? '';

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
}
