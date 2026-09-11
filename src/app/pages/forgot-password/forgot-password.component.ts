import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataApi } from '../../core/data-api';
import { AuthShellComponent } from '../../layout/auth-shell/auth-shell.component';

/** Pede o link de redefinição de senha. A API sempre responde sucesso, exista ou não o e-mail —
 * este componente nunca distingue os dois casos, pra não vazar quem tem conta. `resetLink` só vem
 * preenchido em development (sem e-mail real configurado ainda, ver docs/API.md do backend). */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterLink, AuthShellComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private api = inject(DataApi);

  readonly email = signal('');
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly devResetLink = signal('');
  readonly errorMessage = signal('');

  readonly canSubmit = computed(() => this.email().trim().length > 0);

  onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set('');

    this.api.requestPasswordReset(this.email().trim()).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.submitted.set(true);
        this.devResetLink.set(result.resetLink ?? '');
      },
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set('Não foi possível processar o pedido. Tente novamente.');
      },
    });
  }
}
