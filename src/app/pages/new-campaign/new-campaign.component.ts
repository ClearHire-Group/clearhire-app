import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { CampaignContractType, CampaignModality, CampaignSeniority, TalentMatch } from '../../core/models';
import { toTalentMatchViews, TalentMatchView } from '../../core/talent-view';
import { ModuleKey, MODULES } from '../../core/campaign-modules';

@Component({
  selector: 'app-new-campaign',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent, ErrorStateComponent],
  templateUrl: './new-campaign.component.html',
  styleUrl: './new-campaign.component.scss',
})
export class NewCampaignComponent {
  readonly subTabs: SubTab[] = [
    { label: 'Dados da Vaga', active: true },
    { label: 'Descrição' },
    { label: 'Perfil Cultural' },
    { label: 'Funil' },
  ];

  readonly modules = MODULES;

  private api = inject(DataApi);
  private router = inject(Router);
  readonly companyProfileState = toLoadable(this.api.getCompanyProfile());

  readonly title = signal('');
  readonly description = signal('');
  readonly responsibilities = signal('');
  readonly requirements = signal('');
  readonly benefits = signal('');
  readonly city = signal('');
  readonly state = signal('');
  readonly modality = signal<CampaignModality>('hibrido');
  readonly contractType = signal<CampaignContractType>('clt');
  readonly seniority = signal<CampaignSeniority>('pleno');

  selected: ModuleKey[] = ['fit', 'tecnica', 'entrevista'];

  isActive(key: ModuleKey): boolean {
    return this.selected.includes(key);
  }

  toggle(key: ModuleKey): void {
    this.selected = this.isActive(key) ? this.selected.filter((k) => k !== key) : [...this.selected, key];
  }

  move(key: ModuleKey, dir: -1 | 1): void {
    const idx = this.selected.indexOf(key);
    const newIdx = idx + dir;
    if (idx === -1 || newIdx < 0 || newIdx >= this.selected.length) return;
    const next = [...this.selected];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    this.selected = next;
  }

  labelFor(key: ModuleKey): string {
    return MODULES.find((m) => m.key === key)?.label ?? '';
  }

  get finalNum(): number {
    return this.selected.length + 2;
  }

  readonly reverseMatchLoading = signal(false);
  readonly reverseMatchResults = signal<TalentMatchView[] | null>(null);
  readonly selectedTalentIds = signal<ReadonlySet<string>>(new Set());

  /**
   * Match reverso (seção 8.2): sugestão visual — o recrutador revisa e decide, mas puxar o
   * selecionado pro funil inicial ainda não tem endpoint no backend (só a campanha em si
   * persiste de verdade, via createCampaign()). `selectedTalentIds` não é enviado na criação.
   */
  viewSuggestedTalents(): void {
    this.reverseMatchLoading.set(true);
    this.reverseMatchResults.set(null);
    this.api
      .getReverseMatchForNewCampaign({
        title: this.title(),
        modality: this.modality(),
        seniority: this.seniority(),
      })
      .subscribe((matches: TalentMatch[]) => {
        this.reverseMatchLoading.set(false);
        this.reverseMatchResults.set(toTalentMatchViews(matches));
      });
  }

  toggleTalentSelection(id: string): void {
    const next = new Set(this.selectedTalentIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedTalentIds.set(next);
  }

  isTalentSelected(id: string): boolean {
    return this.selectedTalentIds().has(id);
  }

  readonly creating = signal(false);
  readonly createError = signal('');

  get canCreate(): boolean {
    return !this.creating() && this.title().trim().length > 0;
  }

  createCampaign(): void {
    if (!this.canCreate) return;
    this.creating.set(true);
    this.createError.set('');
    this.api
      .createCampaign({
        title: this.title().trim(),
        description: this.description().trim(),
        responsibilities: this.responsibilities().trim(),
        requirements: this.requirements().trim(),
        benefits: this.benefits().trim(),
        city: this.city().trim(),
        state: this.state().trim(),
        modality: this.modality(),
        contractType: this.contractType(),
        seniority: this.seniority(),
        phaseKeys: this.selected,
      })
      .subscribe({
        next: (campaign) => this.router.navigate(['/campanhas', campaign.id]),
        error: (err: unknown) => {
          this.creating.set(false);
          this.createError.set(this.createErrorMessage(err));
        },
      });
  }

  private createErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { error?: string } | null;
      if (err.status === 400 && body?.error) return body.error;
    } else if (err instanceof Error && err.message) {
      return err.message;
    }
    return 'Não foi possível criar a campanha. Tente novamente.';
  }
}
