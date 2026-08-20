import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [CommonModule, RouterLink, TopNavComponent],
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
