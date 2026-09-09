import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, PageTabsComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  readonly subTabs: SubTab[] = [
    { label: 'Perfil da Empresa', active: true },
    { label: 'Equipe', disabled: true },
    { label: 'Integrações', disabled: true },
  ];

  private api = inject(DataApi);
  private refreshTrigger = signal(0);
  readonly companyProfileState = toLoadable(
    toObservable(this.refreshTrigger).pipe(switchMap(() => this.api.getCompanyProfile())),
  );

  readonly toneDraft = signal('');
  readonly importanceDraft = signal('');
  readonly saving = signal(false);
  readonly saved = signal(false);

  readonly isDirty = computed(() => {
    const profile = this.companyProfileState.data();
    return !!profile && (this.toneDraft() !== profile.tone || this.importanceDraft() !== profile.importance);
  });
  readonly canSave = computed(() => this.isDirty() && !this.saving());

  constructor() {
    effect(() => {
      const profile = this.companyProfileState.data();
      if (profile) {
        this.toneDraft.set(profile.tone);
        this.importanceDraft.set(profile.importance);
      }
    });
  }

  discard(): void {
    const profile = this.companyProfileState.data();
    if (!profile) return;
    this.toneDraft.set(profile.tone);
    this.importanceDraft.set(profile.importance);
    this.saved.set(false);
  }

  save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.saved.set(false);
    this.api.updateCompanyProfile({ tone: this.toneDraft(), importance: this.importanceDraft() }).subscribe(() => {
      this.saving.set(false);
      this.saved.set(true);
      this.refreshTrigger.update((n) => n + 1);
    });
  }
}
