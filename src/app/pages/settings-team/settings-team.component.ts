import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { forkJoin, switchMap } from 'rxjs';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';
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
  imports: [CommonModule, PageTabsComponent, ErrorStateComponent],
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
  // confirmTarget != null abre o modal de confirmação (senha do owner obrigatória — ver
  // CLAUDE.md/backend: DELETE /users/:id agora exige reconfirmação de senha).
  readonly confirmTarget = signal<{ id: string; name: string } | null>(null);
  readonly confirmPassword = signal('');
  readonly confirmSubmitting = signal(false);
  readonly confirmError = signal('');

  // --- Cancelar convite --------------------------------------------------------
  // Sem senha aqui de propósito: diferente de desativar um assento ativo, cancelar um convite
  // pendente não tira acesso de ninguém (a pessoa nunca chegou a entrar) — o risco é bem menor,
  // então um confirm simples (sem reautenticação) já cobre.
  readonly cancelInviteTarget = signal<{ id: string; email: string } | null>(null);
  readonly cancelingInvite = signal(false);
  readonly cancelInviteError = signal('');

  // --- Reenviar convite --------------------------------------------------------
  // O link original nunca pode ser "reexibido" (servidor só guarda o hash do token, nunca o valor
  // cru — mesma lógica de senha) — reenviar sempre gera um convite novo e invalida o anterior.
  readonly resendingInviteId = signal('');
  readonly resendError = signal('');
  readonly resendLink = signal<{ email: string; link: string } | null>(null);

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

  openDeactivateModal(memberId: string, memberName: string): void {
    this.confirmTarget.set({ id: memberId, name: memberName });
    this.confirmPassword.set('');
    this.confirmError.set('');
  }

  closeDeactivateModal(): void {
    if (this.confirmSubmitting()) return; // não fecha no meio de uma chamada em andamento
    this.confirmTarget.set(null);
  }

  confirmDeactivate(): void {
    const target = this.confirmTarget();
    if (!target || !this.confirmPassword() || this.confirmSubmitting()) return;
    this.confirmSubmitting.set(true);
    this.confirmError.set('');
    this.api.deactivateTeamMember(target.id, this.confirmPassword()).subscribe({
      next: () => {
        this.confirmSubmitting.set(false);
        this.confirmTarget.set(null);
        this.refreshTrigger.update((n) => n + 1);
      },
      error: () => {
        this.confirmSubmitting.set(false);
        // Mensagem genérica de propósito — cobre tanto senha incorreta quanto rate limit (muitas
        // tentativas) sem diferenciar no cliente, mesma filosofia de nunca dar pista específica
        // demais sobre o motivo exato de uma falha de autenticação (ver login()).
        this.confirmError.set('Não foi possível confirmar. Verifique a senha e tente novamente.');
      },
    });
  }

  openCancelInviteModal(invitationId: string, email: string): void {
    this.cancelInviteTarget.set({ id: invitationId, email });
    this.cancelInviteError.set('');
  }

  closeCancelInviteModal(): void {
    if (this.cancelingInvite()) return;
    this.cancelInviteTarget.set(null);
  }

  confirmCancelInvite(): void {
    const target = this.cancelInviteTarget();
    if (!target || this.cancelingInvite()) return;
    this.cancelingInvite.set(true);
    this.cancelInviteError.set('');
    this.api.cancelInvitation(target.id).subscribe({
      next: () => {
        this.cancelingInvite.set(false);
        this.cancelInviteTarget.set(null);
        this.refreshTrigger.update((n) => n + 1);
      },
      error: () => {
        this.cancelingInvite.set(false);
        this.cancelInviteError.set('Não foi possível cancelar o convite. Tente novamente.');
      },
    });
  }

  resendInvitation(invitationId: string, email: string): void {
    if (this.resendingInviteId()) return;
    this.resendingInviteId.set(invitationId);
    this.resendError.set('');
    this.resendLink.set(null);
    this.api.resendInvitation(invitationId).subscribe({
      next: ({ inviteLink }) => {
        this.resendingInviteId.set('');
        if (inviteLink) this.resendLink.set({ email, link: inviteLink });
        this.refreshTrigger.update((n) => n + 1);
      },
      error: () => {
        this.resendingInviteId.set('');
        this.resendError.set('Não foi possível gerar um novo link. Tente novamente.');
      },
    });
  }
}
