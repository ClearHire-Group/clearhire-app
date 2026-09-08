import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface SubTab {
  label: string;
  /** When set, the tab renders as a real link (active state driven by the router). */
  route?: string | string[];
  /** Query params to attach to the link — e.g. filter tabs on the same route ({ status: 'ativa' }). */
  queryParams?: Record<string, string>;
  /** Exact-match the route (and query params) for `active` styling — needed whenever two tabs share a base route. */
  exact?: boolean;
  /** Manual active flag for tabs with no `route` yet (static placeholder tabs). */
  active?: boolean;
  disabled?: boolean;
}

/**
 * In-page tab strip — lives inside a page's own content, not in the shared shell.
 * Same three behaviors as before the sidebar migration: a real routed link, a same-route
 * queryParams filter (read reactively via `route.queryParamMap`, never refetches for the filter
 * alone), or a static/disabled placeholder for a section that doesn't exist yet.
 */
@Component({
  selector: 'app-page-tabs',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './page-tabs.component.html',
  styleUrl: './page-tabs.component.scss',
})
export class PageTabsComponent {
  @Input() subTabs: SubTab[] = [];
}
