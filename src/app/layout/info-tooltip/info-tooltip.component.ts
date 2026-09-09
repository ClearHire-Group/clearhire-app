import { Component, ElementRef, HostListener, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Botão "?" reutilizável: clique abre um popover minúsculo explicando o campo, sem tocar em nenhum estado de página. */
@Component({
  selector: 'app-info-tooltip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './info-tooltip.component.html',
  styleUrl: './info-tooltip.component.scss',
})
export class InfoTooltipComponent {
  @Input() label = 'Mais informações';
  @Input() heading = '';

  private elementRef = inject(ElementRef<HTMLElement>);
  readonly isOpen = signal(false);

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isOpen.set(false);
  }
}
