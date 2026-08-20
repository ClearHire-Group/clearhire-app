import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataService } from '../../core/data.service';
import { Campaign, CandidateProfileData } from '../../core/models';

@Component({
  selector: 'app-candidate-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, TopNavComponent],
  templateUrl: './candidate-profile.component.html',
  styleUrl: './candidate-profile.component.scss',
})
export class CandidateProfileComponent implements OnInit {
  campaign?: Campaign;
  campaignId = '';
  profile?: CandidateProfileData;
  subTabs: SubTab[] = [];
  ringDeg = 0;

  constructor(private route: ActivatedRoute, private data: DataService) {}

  ngOnInit(): void {
    this.campaignId = this.route.snapshot.paramMap.get('campaignId') ?? '';
    const candidateId = this.route.snapshot.paramMap.get('candidateId') ?? '';
    this.campaign = this.data.getCampaign(this.campaignId);
    this.profile = this.data.getCandidateProfile(candidateId);
    this.ringDeg = this.profile ? Math.round(this.profile.ai.matchPct * 3.6) : 0;

    this.subTabs = [
      { label: 'Visão Geral' },
      { label: 'Funil' },
      { label: 'Candidatos', active: true },
      { label: 'Configurações da Campanha' },
    ];
  }

  get breadcrumb(): string {
    if (!this.campaign) return '';
    const name = this.profile?.name ?? '';
    return `Campanhas / ${this.campaign.title} / Candidatos / ${name}`;
  }
}
