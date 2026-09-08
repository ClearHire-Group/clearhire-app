import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [CommonModule, RouterLink, PageTabsComponent],
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
}
