import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DataApi } from '../../core/data-api';
import { CampaignContextService } from '../../core/campaign-context';
import { CopyLinkButtonComponent } from '../../layout/copy-link-button/copy-link-button.component';
import { CampaignContractType, CampaignModality, CampaignSeniority, Phase } from '../../core/models';
import { ModuleKey, MODULES } from '../../core/campaign-modules';

/**
 * Sub-tela "Configurações da Campanha". Duas seções com dirty-check independente (mesmo padrão de
 * `settings.component.ts`, perfil da empresa): "Dados da campanha" (PATCH /campaigns/:id) e "Fases
 * do funil" (PATCH /campaigns/:id/phases) — endpoints separados porque remover uma fase ocupada é
 * uma regra de negócio (candidato ainda nela), não validação simples de campo.
 */
@Component({
  selector: 'app-campaign-settings',
  standalone: true,
  imports: [CommonModule, CopyLinkButtonComponent],
  templateUrl: './campaign-settings.component.html',
  styleUrl: './campaign-settings.component.scss',
})
export class CampaignSettingsComponent {
  private api = inject(DataApi);
  private ctx = inject(CampaignContextService);

  readonly campaignId = this.ctx.campaignId;
  readonly campaignState = this.ctx.campaignState;
  readonly modules = MODULES;

  readonly pauseSaving = signal(false);
  readonly linkSaving = signal(false);

  /** Espelha a trava do backend: sem descrição salva, gerar o link abriria uma vaga sem conteúdo.
   * Lê a descrição PERSISTIDA, não o rascunho — digitar sem salvar não libera o botão, do mesmo
   * jeito que não passaria no backend. */
  readonly canGeneratePublicLink = computed(() => (this.campaignState.data()?.description ?? '').trim().length > 0);

  // --- Dados da campanha ---
  readonly titleDraft = signal('');
  readonly descriptionDraft = signal('');
  readonly responsibilitiesDraft = signal('');
  readonly requirementsDraft = signal('');
  readonly benefitsDraft = signal('');
  readonly cityDraft = signal('');
  readonly stateDraft = signal('');
  readonly modalityDraft = signal<CampaignModality>('hibrido');
  readonly contractTypeDraft = signal<CampaignContractType>('clt');
  readonly seniorityDraft = signal<CampaignSeniority>('pleno');

  readonly detailsSaving = signal(false);
  readonly detailsSaved = signal(false);
  readonly detailsError = signal('');

  readonly isDetailsDirty = computed(() => {
    const c = this.campaignState.data();
    if (!c) return false;
    return (
      this.titleDraft() !== c.title ||
      this.descriptionDraft() !== c.description ||
      this.responsibilitiesDraft() !== c.responsibilities ||
      this.requirementsDraft() !== c.requirements ||
      this.benefitsDraft() !== c.benefits ||
      this.cityDraft() !== c.city ||
      this.stateDraft() !== c.state ||
      this.modalityDraft() !== c.modality ||
      this.contractTypeDraft() !== c.contractType ||
      this.seniorityDraft() !== c.seniority
    );
  });
  readonly canSaveDetails = computed(
    () => this.isDetailsDirty() && !this.detailsSaving() && this.titleDraft().trim().length > 0,
  );

  // --- Fases do funil ---
  readonly selectedPhases = signal<ModuleKey[]>([]);
  readonly phasesSaving = signal(false);
  readonly phasesSaved = signal(false);
  readonly phasesError = signal('');

  readonly isPhasesDirty = computed(() => {
    const c = this.campaignState.data();
    if (!c) return false;
    return !arraysEqual(this.selectedPhases(), optionalKeysOf(c.phases));
  });
  readonly canSavePhases = computed(() => this.isPhasesDirty() && !this.phasesSaving());

  constructor() {
    effect(() => {
      const c = this.campaignState.data();
      if (!c) return;
      this.titleDraft.set(c.title);
      this.descriptionDraft.set(c.description);
      this.responsibilitiesDraft.set(c.responsibilities);
      this.requirementsDraft.set(c.requirements);
      this.benefitsDraft.set(c.benefits);
      this.cityDraft.set(c.city);
      this.stateDraft.set(c.state);
      this.modalityDraft.set(c.modality);
      this.contractTypeDraft.set(c.contractType);
      this.seniorityDraft.set(c.seniority);
    });
    effect(() => {
      const c = this.campaignState.data();
      if (!c) return;
      this.selectedPhases.set(optionalKeysOf(c.phases));
    });
  }

  togglePause(): void {
    if (this.pauseSaving()) return;
    this.pauseSaving.set(true);
    this.api.toggleCampaignPause(this.campaignId()).subscribe(() => {
      this.pauseSaving.set(false);
      this.ctx.refresh();
    });
  }

  setPublicLink(enabled: boolean): void {
    if (this.linkSaving()) return;
    this.linkSaving.set(true);
    this.api.setCampaignPublicLink(this.campaignId(), enabled).subscribe(() => {
      this.linkSaving.set(false);
      this.ctx.refresh();
    });
  }

  get publicApplicationUrl(): string {
    return `${location.origin}/vagas/${this.campaignId()}`;
  }

  discardDetails(): void {
    const c = this.campaignState.data();
    if (!c) return;
    this.titleDraft.set(c.title);
    this.descriptionDraft.set(c.description);
    this.responsibilitiesDraft.set(c.responsibilities);
    this.requirementsDraft.set(c.requirements);
    this.benefitsDraft.set(c.benefits);
    this.cityDraft.set(c.city);
    this.stateDraft.set(c.state);
    this.modalityDraft.set(c.modality);
    this.contractTypeDraft.set(c.contractType);
    this.seniorityDraft.set(c.seniority);
    this.detailsSaved.set(false);
    this.detailsError.set('');
  }

  saveDetails(): void {
    if (!this.canSaveDetails()) return;
    this.detailsSaving.set(true);
    this.detailsSaved.set(false);
    this.detailsError.set('');
    this.api
      .updateCampaign(this.campaignId(), {
        title: this.titleDraft().trim(),
        description: this.descriptionDraft().trim(),
        responsibilities: this.responsibilitiesDraft().trim(),
        requirements: this.requirementsDraft().trim(),
        benefits: this.benefitsDraft().trim(),
        city: this.cityDraft().trim(),
        state: this.stateDraft().trim(),
        modality: this.modalityDraft(),
        contractType: this.contractTypeDraft(),
        seniority: this.seniorityDraft(),
      })
      .subscribe({
        next: () => {
          this.detailsSaving.set(false);
          this.detailsSaved.set(true);
          this.ctx.refresh();
        },
        error: (err: unknown) => {
          this.detailsSaving.set(false);
          this.detailsError.set(this.extractErrorMessage(err, 'Não foi possível salvar os dados da campanha.'));
        },
      });
  }

  isPhaseSelected(key: ModuleKey): boolean {
    return this.selectedPhases().includes(key);
  }

  togglePhase(key: ModuleKey): void {
    this.phasesSaved.set(false);
    this.selectedPhases.update((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  }

  movePhase(key: ModuleKey, dir: -1 | 1): void {
    const keys = this.selectedPhases();
    const idx = keys.indexOf(key);
    const newIdx = idx + dir;
    if (idx === -1 || newIdx < 0 || newIdx >= keys.length) return;
    const next = [...keys];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    this.selectedPhases.set(next);
  }

  phaseLabel(key: ModuleKey): string {
    return MODULES.find((m) => m.key === key)?.label ?? '';
  }

  get finalPhaseNum(): number {
    return this.selectedPhases().length + 2;
  }

  discardPhases(): void {
    const c = this.campaignState.data();
    if (!c) return;
    this.selectedPhases.set(optionalKeysOf(c.phases));
    this.phasesSaved.set(false);
    this.phasesError.set('');
  }

  savePhases(): void {
    if (!this.canSavePhases()) return;
    this.phasesSaving.set(true);
    this.phasesSaved.set(false);
    this.phasesError.set('');
    this.api.updateCampaignPhases(this.campaignId(), this.selectedPhases()).subscribe({
      next: () => {
        this.phasesSaving.set(false);
        this.phasesSaved.set(true);
        this.ctx.refresh();
      },
      error: (err: unknown) => {
        this.phasesSaving.set(false);
        this.phasesError.set(this.extractErrorMessage(err, 'Não foi possível salvar as fases do funil.'));
      },
    });
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { error?: string } | null;
      if (err.status === 400 && body?.error) return body.error;
    } else if (err instanceof Error && err.message) {
      return err.message;
    }
    return fallback;
  }
}

/** Fases opcionais atuais (exclui Recebidos/Selecionados, que são sempre fixas). */
function optionalKeysOf(phases: Phase[]): ModuleKey[] {
  return phases.map((p) => p.key).filter((k): k is ModuleKey => k === 'fit' || k === 'tecnica' || k === 'entrevista');
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
