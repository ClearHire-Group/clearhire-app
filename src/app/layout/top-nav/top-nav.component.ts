import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface SubTab {
  label: string;
  active?: boolean;
  disabled?: boolean;
}

export type PrimaryTab = 'dashboard' | 'campanhas' | 'candidatos' | 'relatorios' | 'configuracoes';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './top-nav.component.html',
  styleUrl: './top-nav.component.scss',
})
export class TopNavComponent {
  @Input() activeTab: PrimaryTab = 'dashboard';
  @Input() subTabs: SubTab[] = [];
  @Input() breadcrumb = '';
  @Input() dateChip = false;
}
