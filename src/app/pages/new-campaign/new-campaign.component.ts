import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { TalentMatch } from '../../core/models';
import { toTalentMatchViews, TalentMatchView } from '../../core/talent-view';

type ModuleKey = 'fit' | 'tecnica' | 'entrevista';

interface ModuleInfo {
  key: ModuleKey;
  label: string;
  desc: string;
}

const MODULES: ModuleInfo[] = [
  { key: 'fit', label: 'Fit Cultural', desc: 'Avalia alinhamento com valores e cultura da empresa através de questionário estruturado.' },
  { key: 'tecnica', label: 'Triagem Técnica', desc: 'Testes e desafios técnicos automatizados, analisados e ranqueados pela IA.' },
  { key: 'entrevista', label: 'Entrevista Estruturada', desc: 'Roteiro de entrevista padronizado com apoio de IA na consolidação dos pareceres.' },
];

@Component({
  selector: 'app-new-campaign',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent],
  templateUrl: './new-campaign.component.html',
  styleUrl: './new-campaign.component.scss',
})
export class NewCampaignComponent {
  readonly subTabs: SubTab[] = [
    { label: 'Dados da Vaga', active: true },
    { label: 'Perfil Cultural' },
    { label: 'Funil' },
  ];

  readonly modules = MODULES;

  private api = inject(DataApi);
  readonly companyProfileState = toLoadable(this.api.getCompanyProfile());

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
   * Match reverso (seção 8.2): puramente visual, no mesmo nível de fidelidade do botão
   * "Criar campanha" — não há persistência real de campanha neste protótipo ainda.
   */
  viewSuggestedTalents(titleInput: HTMLInputElement, modalitySelect: HTMLSelectElement, senioritySelect: HTMLSelectElement): void {
    this.reverseMatchLoading.set(true);
    this.reverseMatchResults.set(null);
    this.api
      .getReverseMatchForNewCampaign({
        title: titleInput.value,
        modality: modalitySelect.value,
        seniority: senioritySelect.value,
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
}
