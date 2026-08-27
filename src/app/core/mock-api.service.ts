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
  DashboardMetrics,
  Phase,
  PhaseKey,
  PHASE_LABELS,
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
} from './mock-data';

/** Stand-in backend: same contract as HttpApiService, served from in-memory data. */
@Injectable()
export class MockApiService extends DataApi {
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

  getAllCandidates(): Observable<Candidate[]> {
    return this.simulate(Object.values(MOCK_CANDIDATES_BY_CAMPAIGN).flat());
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

  private simulate<T>(value: T): Observable<T> {
    return of(value).pipe(delay(APP_CONFIG.mockLatencyMs));
  }
}
