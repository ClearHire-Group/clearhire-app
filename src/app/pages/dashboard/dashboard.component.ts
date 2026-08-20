import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataService } from '../../core/data.service';
import { Campaign } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TopNavComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly subTabs: SubTab[] = [
    { label: 'Visão Geral', active: true },
    { label: 'Atividade' },
  ];

  readonly activeCampaigns: Campaign[];

  constructor(private data: DataService) {
    this.activeCampaigns = this.data
      .getCampaigns()
      .filter((c) => c.status !== 'encerrada');
  }
}
