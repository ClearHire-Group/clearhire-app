import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';

const MAX_VALUES = 10;

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, PageTabsComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  readonly subTabs: SubTab[] = [
    { label: 'Perfil da Empresa', route: ['/configuracoes'], exact: true },
    { label: 'Equipe', route: ['/configuracoes/equipe'], exact: true },
    { label: 'Integrações', disabled: true },
  ];

  private api = inject(DataApi);
  private refreshTrigger = signal(0);
  readonly companyProfileState = toLoadable(
    toObservable(this.refreshTrigger).pipe(switchMap(() => this.api.getCompanyProfile())),
  );

  readonly toneDraft = signal('');
  readonly importanceDraft = signal('');
  readonly valuesDraft = signal<string[]>([]);
  readonly newValueInput = signal('');
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly saveError = signal('');

  readonly canAddValue = computed(() => this.newValueInput().trim().length > 0 && this.valuesDraft().length < MAX_VALUES);

  readonly isDirty = computed(() => {
    const profile = this.companyProfileState.data();
    if (!profile) return false;
    return (
      this.toneDraft() !== profile.tone ||
      this.importanceDraft() !== profile.importance ||
      !arraysEqual(this.valuesDraft(), profile.values)
    );
  });
  readonly canSave = computed(() => this.isDirty() && !this.saving());

  constructor() {
    effect(() => {
      const profile = this.companyProfileState.data();
      if (profile) {
        this.toneDraft.set(profile.tone);
        this.importanceDraft.set(profile.importance);
        this.valuesDraft.set([...profile.values]);
      }
    });
  }

  retry(): void {
    this.refreshTrigger.update((n) => n + 1);
  }

  addValue(): void {
    const value = this.newValueInput().trim();
    if (!value || this.valuesDraft().length >= MAX_VALUES) return;
    if (this.valuesDraft().includes(value)) {
      this.newValueInput.set('');
      return;
    }
    this.valuesDraft.update((values) => [...values, value]);
    this.newValueInput.set('');
  }

  removeValue(index: number): void {
    this.valuesDraft.update((values) => values.filter((_, i) => i !== index));
  }

  discard(): void {
    const profile = this.companyProfileState.data();
    if (!profile) return;
    this.toneDraft.set(profile.tone);
    this.importanceDraft.set(profile.importance);
    this.valuesDraft.set([...profile.values]);
    this.newValueInput.set('');
    this.saved.set(false);
    this.saveError.set('');
  }

  save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set('');
    this.api
      .updateCompanyProfile({ tone: this.toneDraft(), importance: this.importanceDraft(), values: this.valuesDraft() })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.set(true);
          this.refreshTrigger.update((n) => n + 1);
        },
        error: () => {
          this.saving.set(false);
          this.saveError.set('Não foi possível salvar o perfil. Tente novamente.');
        },
      });
  }
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
