import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { CanMatchFn } from '@angular/router';

/** Hosts que servem a landing pública em `/` em vez da ferramenta autenticada.
 * `.example` é um domínio reservado pela IANA (RFC 2606) que nunca resolve de verdade —
 * usado de propósito no lugar de um nome "genérico" como clearhire.com, que pode já
 * pertencer a outra empresa (foi exatamente isso que aconteceu na primeira versão deste
 * arquivo). Trocar pelo domínio real quando for registrado. `localhost` fica de fora de
 * propósito — dev local continua indo direto para dashboard/login. */
const APEX_HOSTS = ['clearhire.example', 'www.clearhire.example'];

/** Origem absoluta da ferramenta autenticada — trocar junto com APEX_HOSTS. */
const APP_ORIGIN = 'https://app.clearhire.example';

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
