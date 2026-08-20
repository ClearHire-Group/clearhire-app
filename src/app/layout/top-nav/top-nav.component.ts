import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface SubTab {
  label: string;
  /** When set, the tab renders as a real link (active state driven by the router). */
  route?: string | string[];
  /** Exact-match the route for `active` styling — needed when one route is a prefix of another (e.g. /dashboard vs /dashboard/atividade). */
  exact?: boolean;
  /** Manual active flag for tabs with no `route` yet (static placeholder tabs). */
  active?: boolean;
  disabled?: boolean;
}

export type PrimaryTab = 'dashboard' | 'campanhas' | 'candidatos' | 'relatorios' | 'configuracoes';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './top-nav.component.html',
  styleUrl: './top-nav.component.scss',
})
export class TopNavComponent {
  @Input() activeTab: PrimaryTab = 'dashboard';
  @Input() subTabs: SubTab[] = [];
  @Input() breadcrumb = '';
  @Input() dateChip = false;
}
