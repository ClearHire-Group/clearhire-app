import { Observable } from 'rxjs';
import { ActivityItem, AiSuggestion, Campaign, Candidate, CandidateProfileData, CompanyProfile, DashboardMetrics, PhaseKey } from './models';

/**
 * Contract every page depends on. Two implementations exist today:
 * `MockApiService` (in-memory data, simulated latency) and `HttpApiService`
 * (real backend, wired but inactive). Swapping which one is injected — see
 * `APP_CONFIG.useMockApi` in app.config.ts — is the only change needed to go live;
 * no page component references mock data or HttpClient directly.
 */
export abstract class DataApi {
  abstract getCampaigns(): Observable<Campaign[]>;
  abstract getCampaign(id: string): Observable<Campaign | undefined>;
  abstract getCandidates(campaignId: string, phase?: PhaseKey): Observable<Candidate[]>;
  /** All candidates across every campaign — powers the global "Candidatos" directory. */
  abstract getAllCandidates(): Observable<Candidate[]>;
  abstract getCandidateProfile(candidateId: string): Observable<CandidateProfileData | undefined>;
  abstract getCompanyProfile(): Observable<CompanyProfile>;
  abstract getDashboardMetrics(): Observable<DashboardMetrics>;
  abstract getAiSuggestions(): Observable<AiSuggestion[]>;
  abstract getActivityFeed(): Observable<ActivityItem[]>;
}
