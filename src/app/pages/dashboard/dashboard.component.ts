import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private api = inject(DataApi);

  readonly subTabs: SubTab[] = [
    { label: 'Visão Geral', route: '/dashboard', exact: true },
    { label: 'Atividade', route: '/dashboard/atividade' },
  ];

  readonly campaignsState = toLoadable(this.api.getCampaigns());
  readonly metricsState = toLoadable(this.api.getDashboardMetrics());
  readonly suggestionsState = toLoadable(this.api.getAiSuggestions());

  readonly activeCampaigns = computed(() =>
    (this.campaignsState.data() ?? []).filter((c) => c.status !== 'encerrada'),
  );
}
