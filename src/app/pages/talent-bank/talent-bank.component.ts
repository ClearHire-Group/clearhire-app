import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { InfoTooltipComponent } from '../../layout/info-tooltip/info-tooltip.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { CONSENT_STATE_LABELS, ConsentState, ManualTalentInput, TalentMatch, TalentOrigin } from '../../core/models';
import { toTalentMatchViews, TalentMatchView } from '../../core/talent-view';

type ConsentFilter = 'todos' | ConsentState;
type OriginFilter = 'todos' | TalentOrigin;
type BankView = 'lista' | 'cobertura';

interface SearchState {
  loading: boolean;
  matches: TalentMatch[] | null;
  label: string | null;
}

@Component({
  selector: 'app-talent-bank',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent, InfoTooltipComponent],
  templateUrl: './talent-bank.component.html',
  styleUrl: './talent-bank.component.scss',
})
export class TalentBankComponent {
  private api = inject(DataApi);
  private route = inject(ActivatedRoute);

  readonly view = toSignal(
    this.route.queryParamMap.pipe(map((p): BankView => (p.get('view') === 'cobertura' ? 'cobertura' : 'lista'))),
    { initialValue: 'lista' },
  );

  private readonly similarToId = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('similarTo'))), {
    initialValue: null,
  });

  readonly subTabs: SubTab[] = [
    { label: 'Talentos', route: '/banco-de-talentos', queryParams: { view: 'lista' }, exact: true },
    { label: 'Mapa de Cobertura', route: '/banco-de-talentos', queryParams: { view: 'cobertura' }, exact: true },
  ];

  private refreshTrigger = signal(0);
  readonly talentsState = toLoadable(toObservable(this.refreshTrigger).pipe(switchMap(() => this.api.getTalents())));
  readonly coverageState = toLoadable(toObservable(this.refreshTrigger).pipe(switchMap(() => this.api.getTalentPoolCoverage())));

  readonly searchTerm = signal('');
  readonly consentFilter = signal<ConsentFilter>('todos');
  readonly originFilter = signal<OriginFilter>('todos');
  readonly searchState = signal<SearchState>({ loading: false, matches: null, label: null });

  readonly showManualForm = signal(false);
  readonly manualName = signal('');
  readonly manualRawText = signal('');
  readonly manualNote = signal('');
  readonly manualSaving = signal(false);

  readonly hasActiveQuery = computed(() => this.searchState().matches !== null);

  readonly displayedRows = computed<TalentMatchView[]>(() => {
    const active = this.searchState().matches;
    const base: TalentMatch[] = active ?? (this.talentsState.data() ?? []).map((talent) => ({ talent, matchPct: 0, breakdown: [] }));
    const consent = this.consentFilter();
    const origin = this.originFilter();
    return toTalentMatchViews(base)
      .filter((v) => consent === 'todos' || v.consentState === consent)
      .filter((v) => origin === 'todos' || v.origin === origin);
  });

  readonly consentStateLabels = CONSENT_STATE_LABELS;

  readonly maxCoverageCount = computed(() => Math.max(1, ...(this.coverageState.data() ?? []).map((c) => c.count)));

  constructor() {
    effect(() => {
      const id = this.similarToId();
      if (!id) return;
      this.api.getTalent(id).subscribe((talent) => {
        if (talent) this.findSimilar(talent);
      });
    });
  }

  onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  runSearch(): void {
    const query = this.searchTerm().trim();
    if (!query) {
      this.clearSearch();
      return;
    }
    this.searchState.set({ loading: true, matches: null, label: null });
    this.api.searchTalents(query).subscribe((matches) => {
      this.searchState.set({ loading: false, matches, label: `Resultados para “${query}”` });
    });
  }

  findSimilar(talent: { id: string; name: string }): void {
    this.searchTerm.set('');
    this.searchState.set({ loading: true, matches: null, label: null });
    this.api.findSimilarTalents(talent.id).subscribe((matches) => {
      this.searchState.set({ loading: false, matches, label: `Parecidos com ${talent.name}` });
    });
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.searchState.set({ loading: false, matches: null, label: null });
  }

  setConsentFilter(value: ConsentFilter): void {
    this.consentFilter.set(value);
  }

  setOriginFilter(value: OriginFilter): void {
    this.originFilter.set(value);
  }

  breakdownSummary(view: TalentMatchView): string {
    return view.breakdown
      .slice(0, 2)
      .map((b) => `${b.label}: ${b.delta > 0 ? '+' : ''}${b.delta}`)
      .join(' · ');
  }

  openManualForm(): void {
    this.showManualForm.set(true);
  }

  closeManualForm(): void {
    this.showManualForm.set(false);
    this.manualName.set('');
    this.manualRawText.set('');
    this.manualNote.set('');
  }

  submitManualTalent(): void {
    const name = this.manualName().trim();
    if (!name || this.manualSaving()) return;
    const input: ManualTalentInput = {
      name,
      rawProfileText: this.manualRawText().trim(),
      contextNote: this.manualNote().trim(),
    };
    this.manualSaving.set(true);
    this.api.registerManualTalent(input).subscribe(() => {
      this.manualSaving.set(false);
      this.closeManualForm();
      this.refreshTrigger.update((n) => n + 1);
    });
  }
}
