import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { DataApi } from '../../core/data-api';
import { CampaignContextService } from '../../core/campaign-context';
import { toLoadable } from '../../core/loadable';
import { Phase, PhaseKey } from '../../core/models';
import { CandidateView, toCandidateViews } from '../../core/candidate-view';
import { activityTimeLabel } from '../../core/relative-time';
import { ROWS_PAGE, SortSpec, SortState, ariaSort, nextSort, parseSort, rankIn, searchKey, sortDescription, sortRows } from '../../core/table-sort';
import { InViewDirective } from '../../shared/in-view.directive';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';

interface PhaseChip {
  key: PhaseKey;
  label: string;
  /** Contagem real dentre os candidatos carregados (não a contagem acumulada do funil, que mede
   * "chegou a esta fase" e não bate com o filtro por fase atual do candidato — ver nota abaixo). */
  count: number;
}

type SortKey = 'nome' | 'fase' | 'experiencia' | 'local' | 'match' | 'status' | 'candidatura';
const SORT_KEYS: readonly SortKey[] = ['nome', 'fase', 'experiencia', 'local', 'match', 'status', 'candidatura'];
/** O que a tela sempre prometeu no cabeçalho ("ordenado por match da IA") — agora de verdade. */
const DEFAULT_SORT: SortState<SortKey> = { key: 'match', dir: 'desc' };

/**
 * Ordem dos status ao agrupar: primeiro o que pede ação do recrutador, depois o que está andando,
 * por último o que já saiu do funil. Os textos são os mesmos de STATUS_STYLES (candidate-view.ts).
 */
const STATUS_ORDER = [
  'Aguardando decisão',
  'Aguardando análise da IA',
  'Em análise · Fit Cultural',
  'Em análise · Triagem Técnica',
  'Em análise · Entrevista Estruturada',
  'Em análise',
  'Entrevista concluída',
  'Proposta em elaboração',
  'Contratada',
  'Reprovada',
] as const;

interface Row extends CandidateView {
  appliedLabel: string;
  /** Texto normalizado (sem acento/caixa) para a busca rápida — calculado uma vez por carga, não por tecla. */
  searchText: string;
}

/**
 * Sub-tela "Candidatos" — todos os candidatos da campanha, em qualquer fase, com a fase de cada
 * um visível e filtrável. Diferente do Funil (que só mostra a fase selecionada de cada vez) e do
 * Banco de Talentos (que não é escopado por campanha nem mostra fase).
 *
 * Filtro por fase, busca rápida e ordenação por coluna rodam sobre a lista já carregada (ver
 * core/table-sort.ts). A ordenação fica na URL (?sort=&dir=): voltar do perfil de um candidato
 * mantém a ordem, e o link pode ser compartilhado.
 */
@Component({
  selector: 'app-campaign-candidates',
  standalone: true,
  imports: [CommonModule, RouterLink, ErrorStateComponent, InViewDirective],
  templateUrl: './campaign-candidates.component.html',
  styleUrl: './campaign-candidates.component.scss',
})
export class CampaignCandidatesComponent {
  private api = inject(DataApi);
  private ctx = inject(CampaignContextService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly campaignId = this.ctx.campaignId;
  readonly campaignState = this.ctx.campaignState;

  readonly phaseFilter = signal<PhaseKey | 'todas'>('todas');
  readonly query = signal('');

  readonly candidatesState = toLoadable(
    toObservable(this.campaignId).pipe(switchMap((id) => this.api.getCandidates(id))),
  );

  private readonly urlSort = toSignal(
    this.route.queryParamMap.pipe(map((p) => parseSort<SortKey>(p.get('sort'), p.get('dir'), SORT_KEYS))),
    { initialValue: null },
  );
  readonly sort = computed<SortState<SortKey>>(() => this.urlSort() ?? DEFAULT_SORT);

  /** Posição de cada fase no funil DESTA campanha (a ordem é configurável por campanha). */
  private readonly phasePosition = computed(() => {
    const positions = new Map<string, number>();
    (this.campaignState.data()?.phases ?? []).forEach((p, i) => positions.set(p.key, i));
    return positions;
  });

  readonly specs: Record<SortKey, SortSpec<Row>> = {
    nome: { label: 'Nome', first: 'asc', value: (r) => r.name },
    fase: {
      label: 'Fase',
      first: 'desc',
      value: (r) => this.phasePosition().get(r.phase),
      dirLabels: { desc: 'mais avançados primeiro', asc: 'ordem do funil' },
    },
    experiencia: {
      label: 'Experiência',
      first: 'desc',
      value: (r) => r.yearsExperience,
      dirLabels: { desc: 'mais experientes primeiro', asc: 'menos experientes primeiro' },
    },
    local: { label: 'Localização', first: 'asc', value: (r) => r.location },
    match: {
      label: 'Match da IA',
      first: 'desc',
      value: (r) => r.matchPct,
      dirLabels: { desc: 'maior primeiro', asc: 'menor primeiro' },
    },
    status: {
      label: 'Status',
      first: 'asc',
      value: (r) => rankIn(STATUS_ORDER, r.status),
      dirLabels: { asc: 'agrupado, pendentes primeiro', desc: 'agrupado, encerrados primeiro' },
    },
    candidatura: {
      label: 'Candidatura',
      first: 'desc',
      value: (r) => (r.appliedAt ? Date.parse(r.appliedAt) : null),
      dirLabels: { desc: 'mais recentes primeiro', asc: 'mais antigas primeiro' },
    },
  };

  readonly candidateViews = computed<Row[]>(() => {
    const now = new Date();
    return toCandidateViews(this.candidatesState.data() ?? []).map((c) => ({
      ...c,
      appliedLabel: c.appliedAt ? activityTimeLabel(c.appliedAt, now) : '—',
      searchText: searchKey([c.name, c.email, c.location, c.status].join(' ')),
    }));
  });

  readonly filteredViews = computed(() => {
    const phase = this.phaseFilter();
    const q = searchKey(this.query());
    return this.candidateViews().filter((c) => (phase === 'todas' || c.phase === phase) && (!q || c.searchText.includes(q)));
  });

  readonly sortedViews = computed(() => {
    const { key, dir } = this.sort();
    return sortRows(this.filteredViews(), this.specs[key], dir);
  });

  readonly sortLabel = computed(() => sortDescription(this.sort(), this.specs[this.sort().key]));

  /**
   * Renderização progressiva (ver ROWS_PAGE): a lista inteira é filtrada e ordenada, mas só as
   * primeiras N linhas são desenhadas. A contagem é presa à "identidade" da lista — mudou ordenação,
   * fase ou busca, volta para a primeira página sozinha, sem effect.
   */
  private readonly listKey = computed(() => `${this.sort().key}:${this.sort().dir}|${this.phaseFilter()}|${searchKey(this.query())}`);
  private readonly page = signal({ key: '', count: ROWS_PAGE });
  private readonly visibleCount = computed(() => (this.page().key === this.listKey() ? this.page().count : ROWS_PAGE));
  readonly visibleViews = computed(() => this.sortedViews().slice(0, this.visibleCount()));
  readonly remaining = computed(() => this.sortedViews().length - this.visibleViews().length);

  showMore(): void {
    this.page.set({ key: this.listKey(), count: this.visibleCount() + ROWS_PAGE });
  }

  /**
   * Badges com a contagem real dos candidatos carregados por fase — de propósito, não
   * `campaign.phases[].count` (esse é o total acumulado do funil, "quantos já passaram por esta
   * fase", que não bate com o filtro aqui, que é "está NESTA fase agora"; usar o acumulado deixaria
   * o número do chip sem relação com o que aparece na tabela ao clicar nele).
   */
  readonly phaseChips = computed<PhaseChip[]>(() => {
    const phases = this.campaignState.data()?.phases ?? [];
    const counts = new Map<string, number>();
    for (const c of this.candidateViews()) counts.set(c.phase, (counts.get(c.phase) ?? 0) + 1);
    return phases.map((phase: Phase) => ({ key: phase.key, label: phase.label, count: counts.get(phase.key) ?? 0 }));
  });

  setPhaseFilter(phase: PhaseKey | 'todas'): void {
    this.phaseFilter.set(phase);
  }

  onQuery(value: string): void {
    this.query.set(value);
  }

  sortBy(key: SortKey): void {
    const next = nextSort(this.sort(), key, this.specs);
    // replaceUrl: cada clique não vira uma entrada no histórico (o "voltar" do navegador sai da tela).
    this.router.navigate([], { relativeTo: this.route, queryParams: { sort: next.key, dir: next.dir }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    return ariaSort(this.sort(), key);
  }

  readonly activeFilterLabel = computed(() => {
    const phase = this.phaseFilter();
    return phase === 'todas' ? 'Todos os candidatos' : this.phaseLabel(phase);
  });

  phaseLabel(key: PhaseKey): string {
    return this.campaignState.data()?.phases.find((p) => p.key === key)?.label ?? key;
  }
}
