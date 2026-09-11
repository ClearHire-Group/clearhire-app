import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DataApi } from '../../core/data-api';
import { AuthShellComponent } from '../../layout/auth-shell/auth-shell.component';

const MIN_PASSWORD_LENGTH = 8;

/** Aceita um convite de segundo RH (`/aceitar-convite/:token`) — define nome e senha da própria
 * conta. Não loga automaticamente (mesmo padrão de RegisterComponent: o backend nunca devolve
 * sessão de um endpoint de criação de conta), então o sucesso redireciona pro login já com o
 * e-mail do convite preenchido. */
@Component({
  selector: 'app-accept-invitation',
  standalone: true,
  imports: [CommonModule, RouterLink, AuthShellComponent],
  templateUrl: './accept-invitation.component.html',
  styleUrl: './accept-invitation.component.scss',
})
export class AcceptInvitationComponent {
  private api = inject(DataApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private token = toSignal(this.route.paramMap, { initialValue: null });

  readonly name = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  readonly passwordTooShort = computed(() => this.password().length > 0 && this.password().length < MIN_PASSWORD_LENGTH);
  readonly passwordMismatch = computed(
    () => this.confirmPassword().length > 0 && this.confirmPassword() !== this.password(),
  );

  readonly canSubmit = computed(
    () =>
      this.name().trim().length > 0 &&
      this.password().length >= MIN_PASSWORD_LENGTH &&
      this.confirmPassword() === this.password(),
  );

  onSubmit(event: Event): void {
    event.preventDefault();
    const token = this.token()?.get('token');
    if (!this.canSubmit() || this.submitting() || !token) return;
    this.submitting.set(true);
    this.errorMessage.set('');

    this.api.acceptInvitation(token, { name: this.name().trim(), password: this.password() }).subscribe({
      next: ({ email }) => this.router.navigate(['/login'], { queryParams: { convite_aceito: '1', email } }),
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set('Este convite é inválido ou expirou. Peça um novo convite ao owner da empresa.');
      },
    });
  }
}
