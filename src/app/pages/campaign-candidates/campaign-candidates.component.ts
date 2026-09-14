import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DataApi } from '../../core/data-api';
import { CampaignContextService } from '../../core/campaign-context';
import { toLoadable } from '../../core/loadable';
import { Phase, PhaseKey } from '../../core/models';
import { toCandidateViews } from '../../core/candidate-view';

interface PhaseChip {
  key: PhaseKey;
  label: string;
  /** Contagem real dentre os candidatos carregados (não a contagem acumulada do funil, que mede
   * "chegou a esta fase" e não bate com o filtro por fase atual do candidato — ver nota abaixo). */
  count: number;
}

/**
 * Sub-tela "Candidatos" — todos os candidatos da campanha, em qualquer fase, com a fase de cada
 * um visível e filtrável. Diferente do Funil (que só mostra a fase selecionada de cada vez) e do
 * Banco de Talentos (que não é escopado por campanha nem mostra fase).
 */
@Component({
  selector: 'app-campaign-candidates',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './campaign-candidates.component.html',
  styleUrl: './campaign-candidates.component.scss',
})
export class CampaignCandidatesComponent {
  private api = inject(DataApi);
  private ctx = inject(CampaignContextService);

  readonly campaignId = this.ctx.campaignId;
  readonly campaignState = this.ctx.campaignState;

  readonly phaseFilter = signal<PhaseKey | 'todas'>('todas');

  readonly candidatesState = toLoadable(
    toObservable(this.campaignId).pipe(switchMap((id) => this.api.getCandidates(id))),
  );

  readonly candidateViews = computed(() => toCandidateViews(this.candidatesState.data() ?? []));

  readonly filteredViews = computed(() => {
    const phase = this.phaseFilter();
    const views = this.candidateViews();
    return phase === 'todas' ? views : views.filter((c) => c.phase === phase);
  });

  /**
   * Badges com a contagem real dos candidatos carregados por fase — de propósito, não
   * `campaign.phases[].count` (esse é o total acumulado do funil, "quantos já passaram por esta
   * fase", que não bate com o filtro aqui, que é "está NESTA fase agora"; usar o acumulado deixaria
   * o número do chip sem relação com o que aparece na tabela ao clicar nele).
   */
  readonly phaseChips = computed<PhaseChip[]>(() => {
    const phases = this.campaignState.data()?.phases ?? [];
    const views = this.candidateViews();
    return phases.map((phase: Phase) => ({
      key: phase.key,
      label: phase.label,
      count: views.filter((c) => c.phase === phase.key).length,
    }));
  });

  setPhaseFilter(phase: PhaseKey | 'todas'): void {
    this.phaseFilter.set(phase);
  }

  readonly activeFilterLabel = computed(() => {
    const phase = this.phaseFilter();
    return phase === 'todas' ? 'Todos os candidatos' : this.phaseLabel(phase);
  });

  phaseLabel(key: PhaseKey): string {
    return this.campaignState.data()?.phases.find((p) => p.key === key)?.label ?? key;
  }
}
