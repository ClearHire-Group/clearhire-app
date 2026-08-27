import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
} from './models';

/**
 * Real backend implementation. Endpoints below are the contract the API needs to satisfy —
 * shapes match `models.ts` exactly, so once the backend exists, flipping
 * `APP_CONFIG.useMockApi` to `false` is the only change required.
 *
 *   GET  /campaigns                                 -> Campaign[]
 *   GET  /campaigns/:id                              -> Campaign (404 -> undefined)
 *   GET  /campaigns/:id/candidates?phase=:phaseKey    -> Candidate[]  (phase optional)
 *   GET  /candidates                                  -> Candidate[]  (all campaigns)
 *   GET  /candidates/:id/profile                      -> CandidateProfileData (404 -> undefined)
 *   GET  /company-profile                             -> CompanyProfile
 *   GET  /dashboard/metrics                           -> DashboardMetrics
 *   GET  /dashboard/ai-suggestions                    -> AiSuggestion[]
 *   GET  /dashboard/activity                          -> ActivityItem[]
 *   GET  /reports/funnel-summary                      -> Phase[] (aggregate across campaigns)
 *   GET  /reports/campaign-performance                -> CampaignPerformance[]
 *   GET  /reports/ai-trust                            -> AiTrustMetrics
 */
@Injectable()
export class HttpApiService extends DataApi {
  constructor(private http: HttpClient) {
    super();
  }

  getCampaigns(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(`${APP_CONFIG.apiBaseUrl}/campaigns`);
  }

  getCampaign(id: string): Observable<Campaign | undefined> {
    return this.http
      .get<Campaign>(`${APP_CONFIG.apiBaseUrl}/campaigns/${id}`)
      .pipe(catchError(() => of(undefined)));
  }

  getCandidates(campaignId: string, phase?: PhaseKey): Observable<Candidate[]> {
    const params = phase ? new HttpParams().set('phase', phase) : undefined;
    return this.http.get<Candidate[]>(`${APP_CONFIG.apiBaseUrl}/campaigns/${campaignId}/candidates`, { params });
  }

  getAllCandidates(): Observable<Candidate[]> {
    return this.http.get<Candidate[]>(`${APP_CONFIG.apiBaseUrl}/candidates`);
  }

  getCandidateProfile(candidateId: string): Observable<CandidateProfileData | undefined> {
    return this.http
      .get<CandidateProfileData>(`${APP_CONFIG.apiBaseUrl}/candidates/${candidateId}/profile`)
      .pipe(catchError(() => of(undefined)));
  }

  getCompanyProfile(): Observable<CompanyProfile> {
    return this.http.get<CompanyProfile>(`${APP_CONFIG.apiBaseUrl}/company-profile`);
  }

  getDashboardMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${APP_CONFIG.apiBaseUrl}/dashboard/metrics`);
  }

  getAiSuggestions(): Observable<AiSuggestion[]> {
    return this.http.get<AiSuggestion[]>(`${APP_CONFIG.apiBaseUrl}/dashboard/ai-suggestions`);
  }

  getActivityFeed(): Observable<ActivityItem[]> {
    return this.http.get<ActivityItem[]>(`${APP_CONFIG.apiBaseUrl}/dashboard/activity`);
  }

  getFunnelSummary(): Observable<Phase[]> {
    return this.http.get<Phase[]>(`${APP_CONFIG.apiBaseUrl}/reports/funnel-summary`);
  }

  getCampaignPerformance(): Observable<CampaignPerformance[]> {
    return this.http.get<CampaignPerformance[]>(`${APP_CONFIG.apiBaseUrl}/reports/campaign-performance`);
  }

  getAiTrustMetrics(): Observable<AiTrustMetrics> {
    return this.http.get<AiTrustMetrics>(`${APP_CONFIG.apiBaseUrl}/reports/ai-trust`);
  }
}
