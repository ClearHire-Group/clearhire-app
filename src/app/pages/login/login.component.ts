import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { AuthShellComponent } from '../../layout/auth-shell/auth-shell.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, AuthShellComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private queryParamMap = toSignal(this.route.queryParamMap);

  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly registered = signal(false);
  readonly passwordReset = signal(false);
  readonly invitationAccepted = signal(false);
  readonly sessionExpired = signal(false);

  readonly canSubmit = computed(() => this.email().trim().length > 0 && this.password().length > 0);

  constructor() {
    // Preenche a partir de /login?registrado=1&email=... (redirecionamento pós-cadastro),
    // ?redefinido=1 (pós-reset de senha) ou ?convite_aceito=1&email=... (pós-aceite de convite) —
    // reativo via queryParamMap em vez de snapshot, mesma regra de `route.paramMap` do resto do app.
    effect(() => {
      const params = this.queryParamMap();
      if (!params) return;
      if (params.get('registrado') === '1') this.registered.set(true);
      if (params.get('redefinido') === '1') this.passwordReset.set(true);
      if (params.get('convite_aceito') === '1') this.invitationAccepted.set(true);
      if (params.get('sessionExpired') === '1') this.sessionExpired.set(true);
      const prefillEmail = params.get('email');
      if (prefillEmail) this.email.set(prefillEmail);
    });
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set('');
    this.auth.login({ email: this.email().trim(), password: this.password() }).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set('E-mail ou senha incorretos.');
      },
    });
  }
}
