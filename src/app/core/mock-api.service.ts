import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { DataApi } from './data-api';
import { APP_CONFIG } from './app-config';
import {
  ActivityItem,
  AiSuggestion,
  AiTrustMetrics,
  Campaign,
  CampaignPerformance,
  Candidate,
  CandidateProfileData,
  CompanyProfile,
  CoverageEntry,
  DashboardMetrics,
  ManualTalentInput,
  Notification,
  Phase,
  PhaseKey,
  PHASE_LABELS,
  REJECTION_REASONS,
  RejectionReasonKey,
  Talent,
  TalentMatch,
} from './models';
import {
  MOCK_ACTIVITY_FEED,
  MOCK_AI_SUGGESTIONS,
  MOCK_AI_TRUST,
  MOCK_CAMPAIGNS,
  MOCK_CANDIDATES_BY_CAMPAIGN,
  MOCK_CANDIDATE_PROFILES,
  MOCK_COMPANY_PROFILE,
  MOCK_DASHBOARD_METRICS,
  MOCK_NOTIFICATIONS,
  MOCK_TALENTS,
} from './mock-data';
import { computeCoverage, findSimilarInPool, reverseMatchForCriteria, searchTalentPool } from './talent-matching';

/** Stand-in backend: same contract as HttpApiService, served from in-memory data. */
@Injectable()
export class MockApiService extends DataApi {
  /** Estado "vivo" do banco — cadastro manual e reprovação qualificada escrevem aqui em runtime. */
  private talents: Talent[] = [...MOCK_TALENTS];
  /** Estado "vivo" das notificações — marcar como lida escreve aqui em runtime. */
  private notifications: Notification[] = [...MOCK_NOTIFICATIONS];

  getCampaigns(): Observable<Campaign[]> {
    return this.simulate(MOCK_CAMPAIGNS);
  }

  getCampaign(id: string): Observable<Campaign | undefined> {
    return this.simulate(MOCK_CAMPAIGNS.find((c) => c.id === id));
  }

  getCandidates(campaignId: string, phase?: PhaseKey): Observable<Candidate[]> {
    const all = MOCK_CANDIDATES_BY_CAMPAIGN[campaignId] ?? [];
    return this.simulate(phase ? all.filter((c) => c.phase === phase) : all);
  }

  getCandidateProfile(candidateId: string): Observable<CandidateProfileData | undefined> {
    return this.simulate(MOCK_CANDIDATE_PROFILES[candidateId]);
  }

  getCompanyProfile(): Observable<CompanyProfile> {
    return this.simulate(MOCK_COMPANY_PROFILE);
  }

  getDashboardMetrics(): Observable<DashboardMetrics> {
    return this.simulate(MOCK_DASHBOARD_METRICS);
  }

  getAiSuggestions(): Observable<AiSuggestion[]> {
    return this.simulate(MOCK_AI_SUGGESTIONS);
  }

  getActivityFeed(): Observable<ActivityItem[]> {
    return this.simulate(MOCK_ACTIVITY_FEED);
  }

  getNotifications(): Observable<Notification[]> {
    return this.simulate(this.notifications);
  }

  markNotificationRead(id: string): Observable<Notification | undefined> {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification) notification.read = true;
    return this.simulate(notification);
  }

  getFunnelSummary(): Observable<Phase[]> {
    const keys: PhaseKey[] = ['recebidos', 'fit', 'tecnica', 'entrevista', 'selecionados'];
    const summary: Phase[] = keys.map((key, i) => ({
      key,
      num: i + 1,
      label: PHASE_LABELS[key],
      count: MOCK_CAMPAIGNS.reduce((sum, c) => sum + (c.phases.find((p) => p.key === key)?.count ?? 0), 0),
    }));
    return this.simulate(summary);
  }

  getCampaignPerformance(): Observable<CampaignPerformance[]> {
    const rows: CampaignPerformance[] = MOCK_CAMPAIGNS.map((c) => {
      const selected = c.phases.find((p) => p.key === 'selecionados')?.count ?? 0;
      return {
        campaignId: c.id,
        campaignTitle: c.title,
        status: c.status,
        totalCandidates: c.totalCandidates,
        selectedCount: selected,
        conversionPct: c.totalCandidates > 0 ? Math.round((selected / c.totalCandidates) * 1000) / 10 : 0,
        currentPhaseLabel: c.currentPhaseLabel,
      };
    });
    return this.simulate(rows);
  }

  getAiTrustMetrics(): Observable<AiTrustMetrics> {
    return this.simulate(MOCK_AI_TRUST);
  }

  getTalents(): Observable<Talent[]> {
    return this.simulate(this.talents);
  }

  getTalent(id: string): Observable<Talent | undefined> {
    return this.simulate(this.talents.find((t) => t.id === id));
  }

  searchTalents(query: string): Observable<TalentMatch[]> {
    return this.simulate(searchTalentPool(query, this.talents));
  }

  findSimilarTalents(talentId: string): Observable<TalentMatch[]> {
    return this.simulate(findSimilarInPool(talentId, this.talents));
  }

  getTalentPoolCoverage(): Observable<CoverageEntry[]> {
    return this.simulate(computeCoverage(this.talents));
  }

  registerManualTalent(input: ManualTalentInput): Observable<Talent> {
    const id = this.slugify(input.name);
    const talent: Talent = {
      id,
      name: input.name,
      initials: this.initialsFor(input.name),
      avatarColorIndex: (this.talents.length % 3) as 0 | 1 | 2,
      location: 'A confirmar',
      modality: 'A confirmar',
      seniority: 'A confirmar',
      yearsExperience: 0,
      sectors: [],
      // Em produção, o LLM extrai skills/setor/senioridade de `rawProfileText` na ingestão (seção 6.1).
      // Aqui ficam vazios até o recrutador complementar o perfil no cadastro manual.
      skills: [],
      languages: [],
      salaryRangeLabel: 'A confirmar',
      availabilityLabel: 'A confirmar',
      origin: 'cadastro_manual',
      legalBasis: 'legitimo_interesse',
      consentState: 'nao_notificado',
      profileDepth: 'baixo',
      profileDepthNote: 'Cadastro manual, sem entrevistas realizadas ainda.',
      freshnessLabel: 'Cadastrado agora',
      summary: input.rawProfileText,
      experience: [],
      education: { degree: '', institution: '', period: '' },
      recruiterNotes: input.contextNote,
      history: [],
    };
    this.talents = [talent, ...this.talents];
    return this.simulate(talent);
  }

  submitCandidateRejection(
    candidateId: string,
    reasonKey: RejectionReasonKey,
    sendBankInvite: boolean,
  ): Observable<{ talent?: Talent }> {
    const candidate = Object.values(MOCK_CANDIDATES_BY_CAMPAIGN)
      .flat()
      .find((c) => c.id === candidateId);
    if (!candidate) return this.simulate({ talent: undefined });

    const reason = REJECTION_REASONS.find((r) => r.key === reasonKey);
    candidate.status = 'Reprovada';
    candidate.rejectionReasonKey = reasonKey;

    if (!reason || !reason.goesToBank || !sendBankInvite) {
      return this.simulate({ talent: undefined });
    }

    const existing = this.talents.find((t) => t.id === candidate.talentId);
    if (existing) return this.simulate({ talent: existing });

    const campaign = MOCK_CAMPAIGNS.find((c) => c.id === candidate.campaignId);
    const depthByPhase: Record<string, Talent['profileDepth']> = {
      entrevista: 'alto',
      selecionados: 'alto',
      tecnica: 'medio',
      fit: 'medio',
      recebidos: 'baixo',
    };

    const talent: Talent = {
      id: candidate.id,
      name: candidate.name,
      initials: candidate.initials,
      avatarColorIndex: candidate.avatarColorIndex,
      location: candidate.location,
      modality: 'A confirmar',
      seniority: 'A confirmar',
      yearsExperience: 0,
      sectors: [],
      skills: [],
      languages: [],
      salaryRangeLabel: 'A confirmar',
      availabilityLabel: 'Disponível imediatamente',
      origin: 'reprovacao_qualificada',
      legalBasis: 'consentimento',
      consentState: 'consentido',
      consentDateLabel: 'Consentiu agora',
      profileDepth: depthByPhase[candidate.phase] ?? 'baixo',
      profileDepthNote: `Passou pela fase ${PHASE_LABELS[candidate.phase]} nesta empresa.`,
      freshnessLabel: 'Atualizado agora',
      summary: `${candidate.experience}. ${candidate.location}.`,
      experience: [],
      education: { degree: '', institution: '', period: '' },
      history: [
        {
          campaignId: candidate.campaignId,
          campaignTitle: campaign?.title ?? candidate.campaignId,
          reachedPhaseLabel: PHASE_LABELS[candidate.phase],
          outcomeLabel: `Reprovado — ${reason.label.toLowerCase()}`,
          rejectionReasonKey: reasonKey,
        },
      ],
    };

    this.talents = [talent, ...this.talents];
    candidate.talentId = talent.id;
    return this.simulate({ talent });
  }

  markTalentFirstContact(talentId: string): Observable<Talent | undefined> {
    const talent = this.talents.find((t) => t.id === talentId);
    if (talent && talent.consentState === 'nao_notificado') {
      talent.consentState = 'notificado';
    }
    return this.simulate(talent);
  }

  getReverseMatchForNewCampaign(criteria: { title: string; modality?: string; seniority?: string }): Observable<TalentMatch[]> {
    return this.simulate(reverseMatchForCriteria(criteria, this.talents));
  }

  private slugify(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return this.talents.some((t) => t.id === base) ? `${base}-${this.talents.length}` : base;
  }

  private initialsFor(name: string): string {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }

  private simulate<T>(value: T): Observable<T> {
    return of(value).pipe(delay(APP_CONFIG.mockLatencyMs));
  }
}
