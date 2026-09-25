import { Directive, ElementRef, EventEmitter, NgZone, OnDestroy, OnInit, Output, inject } from '@angular/core';

/**
 * Emite `inView` quando o elemento chega perto da área visível — usado para carregar a próxima página
 * de linhas de uma tabela conforme a pessoa rola (renderização progressiva).
 *
 * O IntersectionObserver roda FORA da zona do Angular: rolar a página não dispara detecção de
 * mudanças; só a emissão (quando precisa carregar mais) volta para a zona.
 */
@Directive({ selector: '[appInView]', standalone: true })
export class InViewDirective implements OnInit, OnDestroy {
  @Output() readonly inView = new EventEmitter<void>();

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') return; // sem suporte: sobra o botão "Mostrar mais"
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) this.zone.run(() => this.inView.emit());
        },
        // Começa a carregar ~1 tela antes do fim, para a pessoa não ver a lista "acabar".
        { rootMargin: '0px 0px 800px 0px' },
      );
      this.observer.observe(this.el.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
