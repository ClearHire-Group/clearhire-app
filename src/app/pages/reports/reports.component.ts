import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { CampaignStatus } from '../../core/models';
import {
  REPORT_PERIODS,
  ReportPeriodKey,
  parseReportPeriodKey,
  reportPeriodLabel,
  reportPeriodPhrase,
  reportRangeFor,
} from '../../core/report-period';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';
import { CountUpDirective } from '../../shared/count-up.directive';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterLink, ErrorStateComponent, CountUpDirective],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  private api = inject(DataApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly periods = REPORT_PERIODS;

  /** A URL é a fonte da verdade do filtro (`?periodo=`), não um signal solto: assim o relatório
   * de um mês específico é um link que dá pra compartilhar e recarregar. */
  private periodKey$ = this.route.queryParamMap.pipe(map((p) => parseReportPeriodKey(p.get('periodo'))));
  readonly periodKey = toSignal(this.periodKey$, { initialValue: parseReportPeriodKey(null) });

  /** Diferente do resto do app, trocar o filtro REFAZ a chamada: a agregação é do servidor, não
   * dá pra recortar no cliente uma contagem que já veio somada. */
  readonly funnelState = toLoadable(this.periodKey$.pipe(switchMap((key) => this.api.getFunnelSummary(reportRangeFor(key)))));
  readonly performanceState = toLoadable(
    this.periodKey$.pipe(switchMap((key) => this.api.getCampaignPerformance(reportRangeFor(key)))),
  );
  /** Só pra nomear a empresa no cabeçalho do PDF — a tela já é da empresa logada. */
  readonly companyState = toLoadable(this.api.getCompanyProfile());

  readonly periodLabel = computed(() => reportPeriodLabel(this.periodKey()));
  /** Com preposição, só pro cabeçalho do PDF — ver reportPeriodPhrase. */
  readonly periodPhrase = computed(() => reportPeriodPhrase(this.periodKey()));

  /** Recalculada a cada impressão (inclusive Ctrl+P, via listener) — uma aba aberta desde ontem
   * geraria um PDF datado de ontem se isto fosse fixado na construção do componente. */
  readonly generatedAt = signal(this.formatToday());

  constructor() {
    // `beforeprint` e não só o clique no botão: Ctrl+P do navegador também gera o PDF e também
    // precisa carimbar a data certa.
    window.addEventListener('beforeprint', this.refreshGeneratedAt);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeprint', this.refreshGeneratedAt));
  }

  private refreshGeneratedAt = () => this.generatedAt.set(this.formatToday());

  private formatToday(): string {
    return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  readonly funnelRows = computed(() => {
    const phases = this.funnelState.data() ?? [];
    if (!phases.length) return [];
    const max = phases[0].count || 1;
    return phases.map((p, i) => {
      const prevCount = i > 0 ? phases[i - 1].count : null;
      const conversionPct = prevCount && prevCount > 0 ? Math.round((p.count / prevCount) * 1000) / 10 : null;
      return { ...p, barPct: (p.count / max) * 100, conversionPct };
    });
  });

  readonly overallConversionPct = computed(() => {
    const phases = this.funnelState.data() ?? [];
    if (phases.length < 2) return 0;
    const first = phases[0].count;
    const last = phases[phases.length - 1].count;
    return first > 0 ? Math.round((last / first) * 1000) / 10 : 0;
  });

  readonly receivedCount = computed(() => this.funnelState.data()?.find((p) => p.key === 'recebidos')?.count);
  readonly selectedCount = computed(() => this.funnelState.data()?.find((p) => p.key === 'selecionados')?.count);

  readonly performanceRows = computed(() => {
    const rows = this.performanceState.data() ?? [];
    const max = Math.max(...rows.map((r) => r.conversionPct), 0.1);
    return rows.map((r) => ({ ...r, barPct: (r.conversionPct / max) * 100 }));
  });

  selectPeriod(key: ReportPeriodKey): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { periodo: key }, queryParamsHandling: 'merge' });
  }

  statusLabel(status: CampaignStatus): string {
    return status === 'ativa' ? 'ATIVA' : status === 'pausada' ? 'PAUSADA' : 'ENCERRADA';
  }

  /** O PDF é o próprio diálogo de impressão do navegador ("Salvar como PDF") sobre a folha de
   * estilo de impressão — sem lib de geração, sem rota nova no backend. */
  downloadPdf(): void {
    window.print();
  }
}
