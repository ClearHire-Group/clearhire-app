import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Botão de copiar link com feedback visual — reusado no modal de link público e em Configurações. */
@Component({
  selector: 'app-copy-link-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './copy-link-button.component.html',
  styleUrl: './copy-link-button.component.scss',
})
export class CopyLinkButtonComponent {
  @Input({ required: true }) link!: string;

  readonly copied = signal(false);
  private resetTimer?: ReturnType<typeof setTimeout>;

  copy(): void {
    navigator.clipboard.writeText(this.link).then(() => {
      this.copied.set(true);
      clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => this.copied.set(false), 1800);
    });
  }
}
