import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataService } from '../../core/data.service';
import { CompanyProfile } from '../../core/models';

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
  imports: [CommonModule, RouterLink, TopNavComponent],
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
  readonly companyProfile: CompanyProfile;

  selected: ModuleKey[] = ['fit', 'tecnica', 'entrevista'];

  constructor(private data: DataService) {
    this.companyProfile = this.data.getCompanyProfile();
  }

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
}
