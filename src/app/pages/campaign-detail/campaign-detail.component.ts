import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataService } from '../../core/data.service';
import { Campaign, Candidate, PhaseKey } from '../../core/models';

interface CandidateView extends Candidate {
  avatarBg: string;
  avatarColor: string;
  pctLabel: string;
  ringStyle: string;
  statusColor: string;
  statusBg: string;
}

const AVATAR_STYLES = [
  { bg: 'rgba(184,90,62,0.18)', color: '#B85A3E' },
  { bg: 'rgba(192,146,129,0.2)', color: '#a8674f' },
  { bg: 'rgba(58,74,46,0.16)', color: '#3A4A2E' },
];

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  'Aguardando análise da IA': { color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.06)' },
  'Em análise · Fit Cultural': { color: '#a8674f', bg: 'rgba(192,146,129,0.18)' },
  'Em análise · Triagem Técnica': { color: '#a8674f', bg: 'rgba(192,146,129,0.18)' },
  'Aguardando decisão': { color: '#934832', bg: 'rgba(184,90,62,0.18)' },
  'Proposta em elaboração': { color: '#3A4A2E', bg: 'rgba(58,74,46,0.16)' },
};

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, TopNavComponent],
  templateUrl: './campaign-detail.component.html',
  styleUrl: './campaign-detail.component.scss',
})
export class CampaignDetailComponent implements OnInit {
  campaign?: Campaign;
  campaignId = '';
  selectedPhase: PhaseKey = 'entrevista';
  subTabs: SubTab[] = [];

  constructor(private route: ActivatedRoute, private data: DataService) {}

  ngOnInit(): void {
    this.campaignId = this.route.snapshot.paramMap.get('campaignId') ?? '';
    this.campaign = this.data.getCampaign(this.campaignId);
    if (this.campaign) {
      this.selectedPhase = this.campaign.currentPhaseKey;
    }
    this.subTabs = [
      { label: 'Visão Geral' },
      { label: 'Funil', active: true },
      { label: 'Candidatos' },
      { label: 'Configurações da Campanha' },
    ];
  }

  selectPhase(key: PhaseKey): void {
    this.selectedPhase = key;
  }

  get activePhaseLabel(): string {
    return this.campaign?.phases.find((p) => p.key === this.selectedPhase)?.label ?? '';
  }

  get activePhaseCount(): number {
    return this.campaign?.phases.find((p) => p.key === this.selectedPhase)?.count ?? 0;
  }

  get candidates(): CandidateView[] {
    const raw = this.data.getCandidates(this.campaignId, this.selectedPhase);
    return raw.map((c, i) => {
      const avatar = AVATAR_STYLES[i % AVATAR_STYLES.length];
      const status = STATUS_STYLES[c.status] ?? { color: 'rgba(21,26,34,0.55)', bg: 'rgba(21,26,34,0.06)' };
      const deg = c.matchPct != null ? Math.round(c.matchPct * 3.6) : 0;
      return {
        ...c,
        avatarBg: avatar.bg,
        avatarColor: avatar.color,
        pctLabel: c.matchPct != null ? `${c.matchPct}%` : '—',
        ringStyle:
          c.matchPct != null
            ? `background:conic-gradient(#B85A3E 0deg ${deg}deg, rgba(21,26,34,0.1) ${deg}deg 360deg)`
            : 'background:rgba(21,26,34,0.08)',
        statusColor: status.color,
        statusBg: status.bg,
      };
    });
  }
}
