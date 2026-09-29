import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, switchMap } from 'rxjs';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { TalentMatch, TALENT_ORIGIN_LABELS } from '../../core/models';
import { toTalentViews } from '../../core/talent-view';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';

@Component({
  selector: 'app-talent-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, ErrorStateComponent],
  templateUrl: './talent-profile.component.html',
  styleUrl: './talent-profile.component.scss',
})
export class TalentProfileComponent {
  private route = inject(ActivatedRoute);
  private api = inject(DataApi);

  private talentId$ = this.route.paramMap.pipe(map((p) => p.get('talentId') ?? ''));
  readonly talentId = toSignal(this.talentId$, { initialValue: '' });
  private readonly campaignIdParam = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('campaignId'))), {
    initialValue: null,
  });

  private refreshTrigger = signal(0);
  readonly talentState = toLoadable(
    combineLatest([this.talentId$, toObservable(this.refreshTrigger)]).pipe(
      switchMap(([id]) => this.api.getTalent(id)),
    ),
  );

  readonly talentView = computed(() => {
    const talent = this.talentState.data();
    return talent ? toTalentViews([talent])[0] : undefined;
  });

  readonly campaignMatch = signal<{ loading: boolean; match: TalentMatch | null }>({ loading: false, match: null });
  readonly firstContactSaving = signal(false);
  readonly originLabels = TALENT_ORIGIN_LABELS;

  constructor() {
    effect(() => {
      const campaignId = this.campaignIdParam();
      const id = this.talentId();
      if (!campaignId || !id) {
        this.campaignMatch.set({ loading: false, match: null });
        return;
      }
      this.campaignMatch.set({ loading: true, match: null });
      this.api.getCampaign(campaignId).subscribe((campaign) => {
        if (!campaign) {
          this.campaignMatch.set({ loading: false, match: null });
          return;
        }
        this.api.getReverseMatchForNewCampaign({ title: `${campaign.title} ${campaign.location}` }).subscribe((matches) => {
          const match = matches.find((m) => m.talent.id === id) ?? null;
          this.campaignMatch.set({ loading: false, match });
        });
      });
    });
  }

  markFirstContact(): void {
    const id = this.talentId();
    if (!id || this.firstContactSaving()) return;
    this.firstContactSaving.set(true);
    this.api.markTalentFirstContact(id).subscribe(() => {
      this.firstContactSaving.set(false);
      this.refreshTrigger.update((n) => n + 1);
    });
  }
}
