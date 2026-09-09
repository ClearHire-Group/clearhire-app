import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AuthShellComponent } from '../../layout/auth-shell/auth-shell.component';

const MIN_PASSWORD_LENGTH = 8;

/** Cadastro inicial — cria a empresa + primeiro RH (`role=owner`). O backend não loga
 * automaticamente (`POST /companies` não devolve sessão), então o sucesso redireciona pro
 * login já com o e-mail preenchido em vez de tentar autenticar aqui. */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterLink, AuthShellComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly companyName = signal('');
  readonly ownerName = signal('');
  readonly ownerEmail = signal('');
  readonly ownerPassword = signal('');
  readonly confirmPassword = signal('');

  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  readonly passwordTooShort = computed(
    () => this.ownerPassword().length > 0 && this.ownerPassword().length < MIN_PASSWORD_LENGTH,
  );
  readonly passwordMismatch = computed(
    () => this.confirmPassword().length > 0 && this.confirmPassword() !== this.ownerPassword(),
  );

  readonly canSubmit = computed(
    () =>
      this.companyName().trim().length > 0 &&
      this.ownerName().trim().length > 0 &&
      this.ownerEmail().trim().length > 0 &&
      this.ownerPassword().length >= MIN_PASSWORD_LENGTH &&
      this.confirmPassword() === this.ownerPassword(),
  );

  onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set('');

    const email = this.ownerEmail().trim();
    this.auth
      .registerCompany({
        companyName: this.companyName().trim(),
        ownerName: this.ownerName().trim(),
        ownerEmail: email,
        ownerPassword: this.ownerPassword(),
      })
      .subscribe({
        next: () => this.router.navigate(['/login'], { queryParams: { registrado: '1', email } }),
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set('Não foi possível criar a conta — este e-mail já está cadastrado.');
        },
      });
  }
}
