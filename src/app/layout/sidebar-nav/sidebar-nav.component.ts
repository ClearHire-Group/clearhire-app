import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

type PrimarySection = 'dashboard' | 'campanhas' | 'banco-de-talentos' | 'relatorios' | 'configuracoes' | null;

const COLLAPSED_STORAGE_KEY = 'clearhire.sidebar.collapsed';

function sectionForUrl(url: string): PrimarySection {
  if (url.startsWith('/dashboard')) return 'dashboard';
  if (url.startsWith('/campanhas')) return 'campanhas';
  if (url.startsWith('/banco-de-talentos') || url.startsWith('/candidatos')) return 'banco-de-talentos';
  if (url.startsWith('/relatorios')) return 'relatorios';
  if (url.startsWith('/configuracoes')) return 'configuracoes';
  return null;
}

/** Closed by default — an explicit stored preference (from the collapse button) always wins. */
function readStoredCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    return stored === null ? true : stored === '1';
  } catch {
    return true;
  }
}

/**
 * Global, always-on sidebar nav. Derives the active section from the current URL instead of
 * each page passing an `activeTab` input, so pages don't need to know anything about the nav.
 */
@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar-nav.component.html',
  styleUrl: './sidebar-nav.component.scss',
})
export class SidebarNavComponent {
  private router = inject(Router);

  readonly activeSection = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => sectionForUrl(e.urlAfterRedirects)),
    ),
    { initialValue: sectionForUrl(this.router.url) },
  );

  readonly collapsed = signal(readStoredCollapsed());

  /** Sections whose submenu is expanded — both open by default. */
  private expandedGroups = signal<ReadonlySet<PrimarySection>>(new Set(['dashboard', 'banco-de-talentos', 'configuracoes']));

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* localStorage unavailable — collapse state just won't persist across reloads */
    }
  }

  isExpanded(section: PrimarySection): boolean {
    return this.expandedGroups().has(section);
  }

  toggleGroup(section: PrimarySection, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const next = new Set(this.expandedGroups());
    if (next.has(section)) next.delete(section);
    else next.add(section);
    this.expandedGroups.set(next);
  }
}
