import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DataApi } from '../../core/data-api';
import { AuthShellComponent } from '../../layout/auth-shell/auth-shell.component';

const MIN_PASSWORD_LENGTH = 8;

/** Confirma a redefinição de senha a partir do token na URL (`/redefinir-senha/:token`). Lê o
 * token via `paramMap` reativo, nunca snapshot (mesma regra de candidate-profile/talent-profile —
 * ver CLAUDE.md). Sucesso derruba todas as sessões ativas no backend; este componente só redireciona
 * pro login. */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, RouterLink, AuthShellComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  private api = inject(DataApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private token = toSignal(this.route.paramMap, { initialValue: null });

  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  readonly passwordTooShort = computed(
    () => this.newPassword().length > 0 && this.newPassword().length < MIN_PASSWORD_LENGTH,
  );
  readonly passwordMismatch = computed(
    () => this.confirmPassword().length > 0 && this.confirmPassword() !== this.newPassword(),
  );

  readonly canSubmit = computed(
    () => this.newPassword().length >= MIN_PASSWORD_LENGTH && this.confirmPassword() === this.newPassword(),
  );

  onSubmit(event: Event): void {
    event.preventDefault();
    const token = this.token()?.get('token');
    if (!this.canSubmit() || this.submitting() || !token) return;
    this.submitting.set(true);
    this.errorMessage.set('');

    this.api.confirmPasswordReset(token, this.newPassword()).subscribe({
      next: () => this.router.navigate(['/login'], { queryParams: { redefinido: '1' } }),
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set('Este link é inválido ou expirou. Peça um novo link de redefinição.');
      },
    });
  }
}
