import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { appLinkBase } from '../../core/apex-host.guard';

@Component({
  selector: 'app-landing',
  standalone: true,
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  readonly currentYear = new Date().getFullYear();
  /** Base dos links de CTA — vazia (mesma origem) fora do domínio raiz de marketing,
   * absoluta só nele. Ver `appLinkBase` pro porquê. */
  readonly appBase = appLinkBase(inject(DOCUMENT));
}
