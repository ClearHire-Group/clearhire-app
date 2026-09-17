import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { activityTimeLabel } from '../../core/relative-time';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent, ErrorStateComponent],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.scss',
})
export class ActivityComponent {
  private api = inject(DataApi);

  readonly subTabs: SubTab[] = [
    { label: 'Visão Geral', route: '/dashboard', exact: true },
    { label: 'Atividade', route: '/dashboard/atividade' },
  ];

  readonly activityState = toLoadable(this.api.getActivityFeed());

  /**
   * O feed mostra tempo relativo, então o rótulo tem que envelhecer junto com a aba aberta — sem
   * este tick, "há 12 minutos" ficaria congelado no instante em que a resposta chegou (que é
   * exatamente o motivo de `createdAt` vir ISO do servidor em vez de rótulo pronto). 60s é a
   * granularidade mais fina que o rótulo expressa; tickar mais rápido não mudaria nenhum texto.
   */
  private readonly now = signal(new Date());

  constructor() {
    const tick = setInterval(() => this.now.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }

  /** `undefined` (não `[]`) enquanto não há dado, pra o `@if` do template continuar distinguindo
   *  carregando/erro de "carregou e está vazio" — lista vazia é um valor truthy. */
  readonly rows = computed(() => {
    const items = this.activityState.data();
    if (!items) return undefined;
    const now = this.now();
    return items.map((item) => ({ ...item, timeLabel: activityTimeLabel(item.createdAt, now) }));
  });
}
