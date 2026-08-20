import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { DataApi } from './data-api';
import { APP_CONFIG } from './app-config';
import { ActivityItem, AiSuggestion, Campaign, Candidate, CandidateProfileData, CompanyProfile, DashboardMetrics, PhaseKey } from './models';
import {
  MOCK_ACTIVITY_FEED,
  MOCK_AI_SUGGESTIONS,
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

  private simulate<T>(value: T): Observable<T> {
    return of(value).pipe(delay(APP_CONFIG.mockLatencyMs));
  }
}
