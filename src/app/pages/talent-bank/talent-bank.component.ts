import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { InfoTooltipComponent } from '../../layout/info-tooltip/info-tooltip.component';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { CONSENT_STATE_LABELS, ConsentState, ManualTalentInput, TalentMatch, TalentOrigin } from '../../core/models';
import { toTalentMatchViews, TalentMatchView } from '../../core/talent-view';
import { charCount, validateName } from '../../core/application-validation';
import { HttpErrorResponse } from '@angular/common/http';

type ManualField = 'name' | 'rawProfileText' | 'contextNote';
const MANUAL_LIMITS = { rawText: 14000, note: 2000 } as const;

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
  imports: [CommonModule, RouterLink, PageTabsComponent, InfoTooltipComponent, ErrorStateComponent],
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
    { label: 'Talentos', route: '/banco-de-talentos', exact: true },
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
  readonly manualFormError = signal('');
  readonly limits = MANUAL_LIMITS;
  private readonly manualTouched = signal<ReadonlySet<ManualField>>(new Set());
  private readonly manualSubmitAttempted = signal(false);
  private readonly manualServerErrors = signal<Partial<Record<ManualField, string>>>({});
  readonly manualRawCount = computed(() => charCount(this.manualRawText().trim()));
  readonly manualNoteCount = computed(() => charCount(this.manualNote().trim()));

  /** Mesmas regras do backend (candidate/manual_talent.go): nome e sobrenome, tamanhos máximos. */
  private readonly manualErrors = computed<Partial<Record<ManualField, string>>>(() => {
    const errors: Partial<Record<ManualField, string>> = {};
    const name = validateName(this.manualName());
    if (name.error) errors.name = name.error;
    if (this.manualRawCount() > MANUAL_LIMITS.rawText) {
      errors.rawProfileText = `O perfil pode ter no máximo ${MANUAL_LIMITS.rawText} caracteres (você usou ${this.manualRawCount()}).`;
    }
    if (this.manualNoteCount() > MANUAL_LIMITS.note) {
      errors.contextNote = `A nota pode ter no máximo ${MANUAL_LIMITS.note} caracteres (você usou ${this.manualNoteCount()}).`;
    }
    return errors;
  });

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

  manualErr(field: ManualField): string {
    const client = this.manualErrors()[field];
    if (client && (this.manualSubmitAttempted() || this.manualTouched().has(field))) return client;
    return this.manualServerErrors()[field] ?? '';
  }

  setManual(field: ManualField, target: { set(v: string): void }, value: string): void {
    target.set(value);
    this.manualFormError.set('');
    if (this.manualServerErrors()[field]) {
      this.manualServerErrors.update((e) => ({ ...e, [field]: undefined }));
    }
  }

  touchManual(field: ManualField): void {
    this.manualTouched.update((s) => new Set(s).add(field));
  }

  openManualForm(): void {
    this.showManualForm.set(true);
  }

  closeManualForm(): void {
    this.showManualForm.set(false);
    this.manualName.set('');
    this.manualRawText.set('');
    this.manualNote.set('');
    this.manualFormError.set('');
    this.manualTouched.set(new Set());
    this.manualSubmitAttempted.set(false);
    this.manualServerErrors.set({});
  }

  submitManualTalent(): void {
    if (this.manualSaving()) return;
    this.manualSubmitAttempted.set(true);
    const invalid = Object.keys(this.manualErrors()).length;
    if (invalid > 0) {
      this.manualFormError.set(invalid === 1 ? 'Revise o campo destacado.' : `Revise os ${invalid} campos destacados.`);
      return;
    }
    const input: ManualTalentInput = {
      name: validateName(this.manualName()).value,
      rawProfileText: this.manualRawText().trim(),
      contextNote: this.manualNote().trim(),
    };
    this.manualSaving.set(true);
    this.api.registerManualTalent(input).subscribe({
      next: () => {
        this.manualSaving.set(false);
        this.closeManualForm();
        this.refreshTrigger.update((n) => n + 1);
      },
      error: (err: unknown) => {
        // Antes não havia tratamento de erro: o botão ficava em "Cadastrando…" para sempre.
        this.manualSaving.set(false);
        const body = err instanceof HttpErrorResponse ? ((err.error ?? {}) as { error?: string; fields?: Partial<Record<ManualField, string>> }) : {};
        if (body.fields && Object.keys(body.fields).length > 0) {
          this.manualServerErrors.set(body.fields);
          this.manualFormError.set('Revise os campos destacados.');
        } else if (err instanceof HttpErrorResponse && err.status === 0) {
          this.manualFormError.set('Sem conexão com o servidor. Tente novamente.');
        } else {
          this.manualFormError.set(body.error ?? 'Não foi possível cadastrar o talento. Tente novamente.');
        }
      },
    });
  }
}
