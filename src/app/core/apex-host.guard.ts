import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { CanMatchFn } from '@angular/router';

/** Hosts que servem a landing pública em `/` em vez da ferramenta autenticada.
 * Vazio hoje, de propósito: produção é um domínio só (clearhire.b2byte.com), que abre direto a
 * ferramenta — a landing fica acessível pelo alias `/landing`. Se um dia a landing ganhar
 * domínio próprio, ele entra aqui e a ferramenta vai para APP_ORIGIN. `localhost` nunca entra —
 * dev local continua indo direto para dashboard/login. */
const APEX_HOSTS: string[] = [];

/** Origem absoluta da ferramenta autenticada — trocar junto com APEX_HOSTS. */
const APP_ORIGIN = 'https://clearhire.b2byte.com';

export const apexHostGuard: CanMatchFn = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return false;
  return APEX_HOSTS.includes(inject(DOCUMENT).location.hostname);
};

/**
 * Base de URL pros CTAs "ir pra ferramenta" da landing: absoluta (cross-origin) só quando
 * o host atual é de fato o domínio raiz de marketing — ali é o único jeito de chegar em
 * app.<dominio> (precisa ser navegação real de página, não SPA, pro cookie de sessão e o
 * CORS_ORIGIN do backend baterem com a origem certa). Em qualquer outro host (dev local,
 * preview deploy, ou já estando em app.<dominio> via o alias /landing), fica relativo —
 * mesma origem, sem depender do subdomínio existir de verdade ainda.
 */
export function appLinkBase(document: Document): string {
  return APEX_HOSTS.includes(document.location.hostname) ? APP_ORIGIN : '';
}
