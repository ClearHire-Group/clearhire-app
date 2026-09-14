import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, switchMap } from 'rxjs';
import { DataApi } from './data-api';
import { toLoadable } from './loadable';

/**
 * Estado da campanha compartilhado entre a casca (`CampaignDetailComponent`) e suas sub-telas
 * (Funil/Candidatos/Visão Geral/Configurações), providenciado no nível da casca — cada sub-tela
 * injeta a mesma instância via `<router-outlet>` em vez de refazer `getCampaign` por conta própria.
 */
@Injectable()
export class CampaignContextService {
  private route = inject(ActivatedRoute);
  private api = inject(DataApi);

  private campaignId$ = this.route.paramMap.pipe(map((p) => p.get('campaignId') ?? ''));
  /** Reativo (não `snapshot`): o Angular reaproveita a casca ao navegar entre campanhas. */
  readonly campaignId = toSignal(this.campaignId$, { initialValue: '' });

  private refreshTrigger = signal(0);
  readonly campaignState = toLoadable(
    combineLatest([this.campaignId$, toObservable(this.refreshTrigger)]).pipe(
      switchMap(([id]) => this.api.getCampaign(id)),
    ),
  );

  /** Chamar depois de uma mutação (pausar/retomar, alternar link público) pra recarregar a campanha. */
  refresh(): void {
    this.refreshTrigger.update((n) => n + 1);
  }
}
