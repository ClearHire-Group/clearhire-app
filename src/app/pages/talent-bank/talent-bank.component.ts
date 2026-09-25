import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { InfoTooltipComponent } from '../../layout/info-tooltip/info-tooltip.component';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { CONSENT_STATE_LABELS, ConsentState, ManualTalentInput, TalentMatch, TalentOrigin } from '../../core/models';
import { completenessTier, toTalentMatchViews, TalentMatchView } from '../../core/talent-view';
import { findSimilarInPool, searchTalentPool } from '../../core/talent-matching';
import { ROWS_PAGE, SortSpec, SortState, ariaSort, nextSort, parseSort, rankIn, searchKey, sortDescription, sortRows } from '../../core/table-sort';
import { InViewDirective } from '../../shared/in-view.directive';
import { charCount, validateName } from '../../core/application-validation';
import { HttpErrorResponse } from '@angular/common/http';

type ManualField = 'name' | 'rawProfileText' | 'contextNote';
const MANUAL_LIMITS = { rawText: 14000, note: 2000 } as const;

type ConsentFilter = 'todos' | ConsentState;
type OriginFilter = 'todos' | TalentOrigin;
type BankView = 'lista' | 'cobertura';

/** Busca ativa: texto livre ou "parecidos com" um talento. */
type ActiveQuery = { kind: 'search'; text: string } | { kind: 'similar'; id: string; name: string };

type SortKey = 'nome' | 'local' | 'skills' | 'senioridade' | 'perfil' | 'consentimento' | 'match';
const SORT_KEYS: readonly SortKey[] = ['nome', 'local', 'skills', 'senioridade', 'perfil', 'consentimento', 'match'];

/** Consentimento agrupado do mais utilizável ao bloqueado. */
const CONSENT_ORDER = ['consentido', 'notificado', 'nao_notificado', 'oposicao_exclusao'] as const;
const COMPLETENESS_ORDER = ['basico', 'parcial', 'completo'] as const;

const seniorityCache = new Map<string, number | null>();

/**
 * Senioridade como número — "Pleno-Sênior" (texto livre de alguns perfis) fica entre Pleno e Sênior.
 * Memorizada por rótulo: há poucos rótulos distintos e a normalização de texto é o custo da função.
 */
function seniorityRank(label: string): number | null {
  if (seniorityCache.has(label)) return seniorityCache.get(label)!;
  const rank = computeSeniorityRank(label);
  seniorityCache.set(label, rank);
  return rank;
}

function computeSeniorityRank(label: string): number | null {
  const s = searchKey(label);
  if (s.includes('especialista')) return 4;
  if (s.includes('pleno') && s.includes('senior')) return 2.5;
  if (s.includes('senior')) return 3;
  if (s.includes('pleno')) return 2;
  if (s.includes('junior')) return 1;
  return null;
}

@Component({
  selector: 'app-talent-bank',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent, InfoTooltipComponent, ErrorStateComponent, InViewDirective],
  templateUrl: './talent-bank.component.html',
  styleUrl: './talent-bank.component.scss',
})
export class TalentBankComponent {
  private api = inject(DataApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

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
  readonly activeQuery = signal<ActiveQuery | null>(null);

  // Estado do cadastro manual
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

  readonly hasActiveQuery = computed(() => this.activeQuery() !== null);

  /**
   * Busca e "parecidos" rodam sobre o banco JÁ carregado, com o motor determinístico de
   * core/talent-matching.ts (nenhuma IA na leitura — "LLM na escrita, determinismo na leitura").
   * Antes isto chamava rotas que o backend responde com 501, então toda busca voltava vazia. Com
   * a lista em memória o resultado é instantâneo; pontuar alguns milhares de perfis leva poucos ms.
   */
  readonly matches = computed<TalentMatch[] | null>(() => {
    const q = this.activeQuery();
    const pool = this.talentsState.data();
    if (!q || !pool) return null;
    return q.kind === 'search' ? searchTalentPool(q.text, pool) : findSimilarInPool(q.id, pool);
  });

  readonly resultLabel = computed(() => {
    const q = this.activeQuery();
    if (!q) return '';
    const n = this.matches()?.length ?? 0;
    const what = q.kind === 'search' ? `Resultados para “${q.text}”` : `Parecidos com ${q.name}`;
    return `${what} · ${n} ${n === 1 ? 'talento' : 'talentos'}`;
  });

  private readonly urlSort = toSignal(
    this.route.queryParamMap.pipe(map((p) => parseSort<SortKey>(p.get('sort'), p.get('dir'), SORT_KEYS))),
    { initialValue: null },
  );

  /**
   * Sem ordenação escolhida: com busca ativa, maior match primeiro; sem busca, a ordem do servidor
   * (entrada no banco, mais recentes primeiro). "match" só existe com busca ativa.
   */
  readonly sort = computed<SortState<SortKey> | null>(() => {
    const chosen = this.urlSort();
    if (chosen && (chosen.key !== 'match' || this.hasActiveQuery())) return chosen;
    return this.hasActiveQuery() ? { key: 'match', dir: 'desc' } : null;
  });

  readonly specs: Record<SortKey, SortSpec<TalentMatchView>> = {
    nome: { label: 'Nome', first: 'asc', value: (t) => t.name },
    local: { label: 'Localização', first: 'asc', value: (t) => (t.location === 'A confirmar' ? null : t.location) },
    skills: {
      label: 'Skills',
      first: 'desc',
      value: (t) => (t.skills.length ? t.skills.length : null),
      dirLabels: { desc: 'mais skills primeiro', asc: 'menos skills primeiro' },
    },
    senioridade: {
      label: 'Senioridade',
      first: 'desc',
      value: (t) => seniorityRank(t.seniority),
      dirLabels: { desc: 'mais sênior primeiro', asc: 'mais júnior primeiro' },
    },
    perfil: {
      label: 'Perfil',
      first: 'desc',
      // Completude e, dentro dela, o mais recente — "perfil completo e atualizado" primeiro.
      value: (t) => (rankIn(COMPLETENESS_ORDER, completenessTier(t)) ?? 0) * 1e13 + Date.parse(t.updatedAt),
      dirLabels: { desc: 'mais completos primeiro', asc: 'menos completos primeiro' },
    },
    consentimento: {
      label: 'Consentimento',
      first: 'asc',
      value: (t) => rankIn(CONSENT_ORDER, t.consentState),
      dirLabels: { asc: 'agrupado, consentidos primeiro', desc: 'agrupado, bloqueados primeiro' },
    },
    match: {
      label: 'Match',
      first: 'desc',
      value: (t) => t.matchPct,
      dirLabels: { desc: 'maior primeiro', asc: 'menor primeiro' },
    },
  };

  // Três etapas memorizadas separadas de propósito: clicar num cabeçalho só refaz a ORDENAÇÃO — a
  // decoração (cores, selos, tempo relativo) das milhares de linhas não é recalculada à toa.
  private readonly decoratedRows = computed<TalentMatchView[]>(() => {
    const active = this.matches();
    const base: TalentMatch[] = active ?? (this.talentsState.data() ?? []).map((talent) => ({ talent, matchPct: 0, breakdown: [] }));
    return toTalentMatchViews(base);
  });

  private readonly filteredRows = computed(() => {
    const consent = this.consentFilter();
    const origin = this.originFilter();
    return this.decoratedRows().filter((v) => (consent === 'todos' || v.consentState === consent) && (origin === 'todos' || v.origin === origin));
  });

  readonly displayedRows = computed<TalentMatchView[]>(() => {
    const rows = this.filteredRows();
    const sort = this.sort();
    return sort ? sortRows(rows, this.specs[sort.key], sort.dir) : rows;
  });

  /** Renderização progressiva — mesmo mecanismo da lista de candidatos (ver ROWS_PAGE). */
  private readonly listKey = computed(() => {
    const sort = this.sort();
    const q = this.activeQuery();
    const query = q ? (q.kind === 'search' ? `s:${q.text}` : `p:${q.id}`) : '';
    return `${sort?.key}:${sort?.dir}|${this.consentFilter()}|${this.originFilter()}|${query}|${this.talentsState.data()?.length}`;
  });
  private readonly page = signal({ key: '', count: ROWS_PAGE });
  private readonly visibleCount = computed(() => (this.page().key === this.listKey() ? this.page().count : ROWS_PAGE));
  readonly visibleRows = computed(() => this.displayedRows().slice(0, this.visibleCount()));
  readonly remaining = computed(() => this.displayedRows().length - this.visibleRows().length);

  showMore(): void {
    this.page.set({ key: this.listKey(), count: this.visibleCount() + ROWS_PAGE });
  }

  readonly sortLabel = computed(() => {
    const sort = this.sort();
    return sort ? sortDescription(sort, this.specs[sort.key]) : 'Entrada no banco · mais recentes primeiro';
  });

  readonly consentStateLabels = CONSENT_STATE_LABELS;

  readonly maxCoverageCount = computed(() => Math.max(1, ...(this.coverageState.data() ?? []).map((c) => c.count)));

  constructor() {
    // ?similarTo=<id> (vindo do perfil do talento): abre "parecidos com" assim que o banco carregar.
    effect(() => {
      const id = this.similarToId();
      const pool = this.talentsState.data();
      if (!id || !pool) return;
      const reference = pool.find((t) => t.id === id);
      if (reference) untracked(() => this.findSimilar(reference));
    });
  }

  onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  runSearch(): void {
    const text = this.searchTerm().trim();
    if (!text) {
      this.clearSearch();
      return;
    }
    this.activeQuery.set({ kind: 'search', text });
    this.resetSortToRelevance();
  }

  findSimilar(talent: { id: string; name: string }): void {
    this.searchTerm.set('');
    this.activeQuery.set({ kind: 'similar', id: talent.id, name: talent.name });
    this.resetSortToRelevance();
  }

  /**
   * Busca nova = resultados por relevância (maior match primeiro), mesmo que a lista estivesse
   * ordenada por outra coluna antes — quem busca espera o melhor resultado no topo. Tirar a ordenação
   * da URL faz o padrão da busca (match, maior primeiro) valer; clicar num cabeçalho depois continua
   * funcionando normalmente.
   */
  private resetSortToRelevance(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { sort: null, dir: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.activeQuery.set(null);
  }

  setConsentFilter(value: ConsentFilter): void {
    this.consentFilter.set(value);
  }

  setOriginFilter(value: OriginFilter): void {
    this.originFilter.set(value);
  }

  sortBy(key: SortKey): void {
    const next = nextSort(this.sort(), key, this.specs);
    this.router.navigate([], { relativeTo: this.route, queryParams: { sort: next.key, dir: next.dir }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    return ariaSort(this.sort(), key);
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
