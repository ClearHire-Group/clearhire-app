import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { forkJoin, switchMap } from 'rxjs';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { TeamMemberStatus, UserRole } from '../../core/models';

const STATUS_LABELS: Record<TeamMemberStatus, string> = {
  active: 'Ativo',
  inactive: 'Desativado',
  pending: 'Convite pendente',
};

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  member: 'RH',
};

@Component({
  selector: 'app-settings-team',
  standalone: true,
  imports: [CommonModule, PageTabsComponent],
  templateUrl: './settings-team.component.html',
  styleUrl: './settings-team.component.scss',
})
export class SettingsTeamComponent {
  readonly subTabs: SubTab[] = [
    { label: 'Perfil da Empresa', route: ['/configuracoes'], exact: true },
    { label: 'Equipe', route: ['/configuracoes/equipe'], exact: true },
    { label: 'Integrações', disabled: true },
  ];

  readonly statusLabels = STATUS_LABELS;
  readonly roleLabels = ROLE_LABELS;

  private api = inject(DataApi);
  private refreshTrigger = signal(0);

  readonly pageState = toLoadable(
    toObservable(this.refreshTrigger).pipe(
      switchMap(() => forkJoin({ me: this.api.getMyProfile(), team: this.api.getTeam() })),
    ),
  );

  readonly isOwner = computed(() => this.pageState.data()?.me.role === 'owner');

  // --- Minha conta ---------------------------------------------------------
  readonly nameDraft = signal('');
  readonly savingName = signal(false);
  readonly nameSaved = signal(false);
  readonly nameError = signal('');

  readonly nameDirty = computed(() => {
    const me = this.pageState.data()?.me;
    return !!me && this.nameDraft().trim().length > 0 && this.nameDraft().trim() !== me.name;
  });

  constructor() {
    // Sincroniza o rascunho do nome sempre que o perfil (re)carrega — mesmo padrão de
    // `SettingsComponent` pro perfil cultural da empresa.
    effect(() => {
      const me = this.pageState.data()?.me;
      if (me) this.nameDraft.set(me.name);
    });
  }

  // --- Convidar --------------------------------------------------------------
  readonly inviteEmail = signal('');
  readonly inviting = signal(false);
  readonly inviteError = signal('');
  readonly inviteLink = signal('');

  readonly canInvite = computed(() => this.inviteEmail().trim().length > 0 && !this.inviting());

  // --- Desativar -------------------------------------------------------------
  readonly deactivatingId = signal('');
  readonly deactivateError = signal('');

  retry(): void {
    this.refreshTrigger.update((n) => n + 1);
  }

  discardName(): void {
    const me = this.pageState.data()?.me;
    if (me) this.nameDraft.set(me.name);
    this.nameSaved.set(false);
    this.nameError.set('');
  }

  saveName(): void {
    if (!this.nameDirty() || this.savingName()) return;
    this.savingName.set(true);
    this.nameSaved.set(false);
    this.nameError.set('');
    this.api.updateMyProfile(this.nameDraft().trim()).subscribe({
      next: () => {
        this.savingName.set(false);
        this.nameSaved.set(true);
        this.refreshTrigger.update((n) => n + 1);
      },
      error: () => {
        this.savingName.set(false);
        this.nameError.set('Não foi possível salvar o nome. Tente novamente.');
      },
    });
  }

  sendInvite(): void {
    if (!this.canInvite()) return;
    this.inviting.set(true);
    this.inviteError.set('');
    this.inviteLink.set('');
    this.api.inviteTeamMember(this.inviteEmail().trim()).subscribe({
      next: ({ inviteLink }) => {
        this.inviting.set(false);
        this.inviteEmail.set('');
        this.inviteLink.set(inviteLink ?? '');
        this.refreshTrigger.update((n) => n + 1);
      },
      error: () => {
        this.inviting.set(false);
        this.inviteError.set('Não foi possível enviar o convite — confira se o e-mail já não está em uso ou já tem um convite pendente.');
      },
    });
  }

  deactivate(memberId: string, memberName: string): void {
    if (this.deactivatingId()) return;
    if (!confirm(`Desativar o assento de ${memberName || 'este RH'}? A pessoa perde acesso imediatamente.`)) return;
    this.deactivatingId.set(memberId);
    this.deactivateError.set('');
    this.api.deactivateTeamMember(memberId).subscribe({
      next: () => {
        this.deactivatingId.set('');
        this.refreshTrigger.update((n) => n + 1);
      },
      error: () => {
        this.deactivatingId.set('');
        this.deactivateError.set('Não foi possível desativar este assento. Tente novamente.');
      },
    });
  }
}
