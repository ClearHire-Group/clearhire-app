import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { toCandidateViews } from '../../core/candidate-view';
import { PHASE_LABELS } from '../../core/models';

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, RouterLink, TopNavComponent],
  templateUrl: './candidates.component.html',
  styleUrl: './candidates.component.scss',
})
export class CandidatesComponent {
  private api = inject(DataApi);

  readonly subTabs: SubTab[] = [];

  readonly candidatesState = toLoadable(this.api.getAllCandidates());
  readonly campaignsState = toLoadable(this.api.getCampaigns());

  readonly searchTerm = signal('');
  readonly campaignFilter = signal<string | null>(null);

  private campaignTitleById = computed(() => {
    const map = new Map<string, string>();
    for (const c of this.campaignsState.data() ?? []) map.set(c.id, c.title);
    return map;
  });

  readonly campaignOptions = computed(() =>
    (this.campaignsState.data() ?? []).map((c) => ({ id: c.id, title: c.title })),
  );

  readonly filteredCandidates = computed(() => {
    const all = toCandidateViews(this.candidatesState.data() ?? []);
    const term = this.searchTerm().trim().toLowerCase();
    const campaign = this.campaignFilter();
    return all
      .filter((c) => !campaign || c.campaignId === campaign)
      .filter((c) => !term || c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term))
      .sort((a, b) => (b.matchPct ?? -1) - (a.matchPct ?? -1));
  });

  campaignTitle(id: string): string {
    return this.campaignTitleById().get(id) ?? id;
  }

  phaseLabel(key: string): string {
    return PHASE_LABELS[key as keyof typeof PHASE_LABELS] ?? key;
  }

  onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  setCampaignFilter(id: string | null): void {
    this.campaignFilter.set(id);
  }
}
