import { DestroyRef, Directive, ElementRef, Input, NgZone, inject } from '@angular/core';

/**
 * Anima um número de onde ele está até o valor novo — rápido no começo e devagar no fim
 * (easeOutCubic), pra o dado "chegar" em vez de piscar na tela.
 *
 * Escreve direto no textContent, fora da zona do Angular: são ~60 quadros por segundo por número
 * na tela, e passar isso pela detecção de mudanças faria o app inteiro recalcular a cada quadro.
 * Por isso a diretiva é dona do conteúdo do elemento — não coloque interpolação dentro dele.
 *
 * Reanima quando o valor muda (trocar o período do relatório, por exemplo), sempre partindo do
 * número que está visível, nunca do zero de novo.
 */
@Directive({ selector: '[appCountUp]', standalone: true })
export class CountUpDirective {
  /** `undefined`/`null` = ainda sem dado: mostra travessão, igual ao resto do app. */
  @Input({ alias: 'appCountUp' }) set value(next: number | undefined | null) {
    this.animateTo(next ?? null);
  }
  @Input() countUpDecimals = 0;
  @Input() countUpSuffix = '';
  @Input() countUpDurationMs = 1000;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  private current = 0;
  private target = 0;
  private frame = 0;

  constructor() {
    // Imprimir no meio da animação sairia com número pela metade no PDF: ao imprimir, salta pro
    // valor final. Cobre tanto o botão "Baixar PDF" quanto o Ctrl+P do navegador.
    window.addEventListener('beforeprint', this.snapToTarget);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeprint', this.snapToTarget);
      cancelAnimationFrame(this.frame);
    });
  }

  private snapToTarget = () => {
    cancelAnimationFrame(this.frame);
    this.current = this.target;
    this.render(this.target);
  };

  private animateTo(next: number | null): void {
    cancelAnimationFrame(this.frame);

    if (next === null || Number.isNaN(next)) {
      this.render(null);
      return;
    }

    const from = this.current;
    this.target = next;

    // Quem pediu menos movimento no sistema recebe o número pronto, sem animação nenhuma.
    if (this.prefersReducedMotion() || from === next) {
      this.current = next;
      this.render(next);
      return;
    }

    const start = performance.now();
    this.zone.runOutsideAngular(() => {
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / this.countUpDurationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.current = from + (next - from) * eased;
        this.render(this.current);
        if (progress < 1) this.frame = requestAnimationFrame(step);
      };
      this.frame = requestAnimationFrame(step);
    });
  }

  private prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private render(value: number | null): void {
    if (value === null) {
      this.el.nativeElement.textContent = '—';
      return;
    }
    // Number() depois de toFixed derruba zero à direita: 20 continua "20", 2.1 continua "2.1" —
    // o mesmo texto que a interpolação mostrava antes desta diretiva existir.
    const rounded = String(Number(value.toFixed(this.countUpDecimals)));
    this.el.nativeElement.textContent = rounded + this.countUpSuffix;
  }
}
