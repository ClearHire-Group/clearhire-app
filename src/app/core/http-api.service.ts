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
  AuthSession,
  Campaign,
  CampaignPerformance,
  Candidate,
  CandidateProfileData,
  CompanyProfile,
  CoverageEntry,
  DashboardMetrics,
  LoginCredentials,
  ManualTalentInput,
  Notification,
  Phase,
  PhaseKey,
  RegisterCompanyInput,
  RegisterCompanyResult,
  RejectionReasonKey,
  Talent,
  TalentMatch,
} from './models';

/**
 * Real backend implementation. Endpoints below are the contract the API needs to satisfy —
 * shapes match `models.ts` exactly, so once the backend exists, flipping
 * `APP_CONFIG.useMockApi` to `false` is the only change required.
 *
 *   POST /companies                                   -> { id, name }  (public — cadastro inicial da empresa + owner)
 *   POST /auth/login                                   -> { accessToken }  (public; refresh token vem via cookie httpOnly)
 *   POST /auth/refresh                                  -> { accessToken }  (public; lê o cookie httpOnly, rotaciona-o)
 *   POST /auth/logout                                   -> void  (public; revoga e limpa o cookie)
 *   GET  /campaigns                                 -> Campaign[]
 *   GET  /campaigns/:id                              -> Campaign (404 -> undefined)
 *   POST /campaigns/:id/toggle-pause                   -> Campaign (404 -> undefined)
 *   GET  /campaigns/:id/candidates?phase=:phaseKey    -> Candidate[]  (phase optional)
 *   GET  /candidates/:id/profile                      -> CandidateProfileData (404 -> undefined)
 *   POST /candidates/:id/advance                      -> Candidate (404 -> undefined)
 *   POST /candidates/:id/reject                       -> { talent?: Talent }  (body: { reasonKey, sendBankInvite })
 *   GET  /company-profile                             -> CompanyProfile
 *   POST /company-profile                              -> CompanyProfile  (body: { tone, importance })
 *   GET  /dashboard/metrics                           -> DashboardMetrics
 *   GET  /dashboard/ai-suggestions                    -> AiSuggestion[]
 *   GET  /dashboard/activity                          -> ActivityItem[]
 *   GET  /notifications                               -> Notification[]
 *   POST /notifications/:id/read                       -> Notification (404 -> undefined)
 *   GET  /reports/funnel-summary                      -> Phase[] (aggregate across campaigns)
 *   GET  /reports/campaign-performance                -> CampaignPerformance[]
 *   GET  /reports/ai-trust                            -> AiTrustMetrics
 *
 *   -- Banco de Talentos: LLM na escrita (ingestão/tradução de busca), determinismo na leitura --
 *   GET  /talents                                     -> Talent[]  (full roster, no score)
 *   GET  /talents/:id                                  -> Talent (404 -> undefined)
 *   GET  /talents/search?q=:query                      -> TalentMatch[]  (NL query -> filters -> deterministic rank)
 *   GET  /talents/:id/similar                           -> TalentMatch[]  (vector similarity, zero LLM at read time)
 *   GET  /talents/coverage                              -> CoverageEntry[]  (aggregate SQL)
 *   POST /talents                                       -> Talent  (manual entry, body: ManualTalentInput)
 *   POST /talents/:id/first-contact                     -> Talent (404 -> undefined)
 *   POST /campaigns/reverse-match                        -> TalentMatch[]  (body: { title, modality?, seniority? })
 */
@Injectable()
export class HttpApiService extends DataApi {
  constructor(private http: HttpClient) {
    super();
  }

  registerCompany(input: RegisterCompanyInput): Observable<RegisterCompanyResult> {
    return this.http.post<RegisterCompanyResult>(`${APP_CONFIG.apiBaseUrl}/companies`, input);
  }

  login(credentials: LoginCredentials): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${APP_CONFIG.apiBaseUrl}/auth/login`, credentials, { withCredentials: true });
  }

  refresh(): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${APP_CONFIG.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${APP_CONFIG.apiBaseUrl}/auth/logout`, {}, { withCredentials: true });
  }

  getCampaigns(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(`${APP_CONFIG.apiBaseUrl}/campaigns`);
  }

  getCampaign(id: string): Observable<Campaign | undefined> {
    return this.http
      .get<Campaign>(`${APP_CONFIG.apiBaseUrl}/campaigns/${id}`)
      .pipe(catchError(() => of(undefined)));
  }

  toggleCampaignPause(campaignId: string): Observable<Campaign | undefined> {
    return this.http
      .post<Campaign>(`${APP_CONFIG.apiBaseUrl}/campaigns/${campaignId}/toggle-pause`, {})
      .pipe(catchError(() => of(undefined)));
  }

  getCandidates(campaignId: string, phase?: PhaseKey): Observable<Candidate[]> {
    const params = phase ? new HttpParams().set('phase', phase) : undefined;
    return this.http.get<Candidate[]>(`${APP_CONFIG.apiBaseUrl}/campaigns/${campaignId}/candidates`, { params });
  }

  getCandidateProfile(candidateId: string): Observable<CandidateProfileData | undefined> {
    return this.http
      .get<CandidateProfileData>(`${APP_CONFIG.apiBaseUrl}/candidates/${candidateId}/profile`)
      .pipe(catchError(() => of(undefined)));
  }

  advanceCandidate(candidateId: string): Observable<Candidate | undefined> {
    return this.http
      .post<Candidate>(`${APP_CONFIG.apiBaseUrl}/candidates/${candidateId}/advance`, {})
      .pipe(catchError(() => of(undefined)));
  }

  getCompanyProfile(): Observable<CompanyProfile> {
    return this.http.get<CompanyProfile>(`${APP_CONFIG.apiBaseUrl}/company-profile`);
  }

  updateCompanyProfile(update: Pick<CompanyProfile, 'tone' | 'importance'>): Observable<CompanyProfile> {
    return this.http.post<CompanyProfile>(`${APP_CONFIG.apiBaseUrl}/company-profile`, update);
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

  getNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${APP_CONFIG.apiBaseUrl}/notifications`);
  }

  markNotificationRead(id: string): Observable<Notification | undefined> {
    return this.http
      .post<Notification>(`${APP_CONFIG.apiBaseUrl}/notifications/${id}/read`, {})
      .pipe(catchError(() => of(undefined)));
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

  getTalents(): Observable<Talent[]> {
    return this.http.get<Talent[]>(`${APP_CONFIG.apiBaseUrl}/talents`);
  }

  getTalent(id: string): Observable<Talent | undefined> {
    return this.http.get<Talent>(`${APP_CONFIG.apiBaseUrl}/talents/${id}`).pipe(catchError(() => of(undefined)));
  }

  searchTalents(query: string): Observable<TalentMatch[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<TalentMatch[]>(`${APP_CONFIG.apiBaseUrl}/talents/search`, { params });
  }

  findSimilarTalents(talentId: string): Observable<TalentMatch[]> {
    return this.http.get<TalentMatch[]>(`${APP_CONFIG.apiBaseUrl}/talents/${talentId}/similar`);
  }

  getTalentPoolCoverage(): Observable<CoverageEntry[]> {
    return this.http.get<CoverageEntry[]>(`${APP_CONFIG.apiBaseUrl}/talents/coverage`);
  }

  registerManualTalent(input: ManualTalentInput): Observable<Talent> {
    return this.http.post<Talent>(`${APP_CONFIG.apiBaseUrl}/talents`, input);
  }

  submitCandidateRejection(
    candidateId: string,
    reasonKey: RejectionReasonKey,
    sendBankInvite: boolean,
  ): Observable<{ talent?: Talent }> {
    return this.http.post<{ talent?: Talent }>(`${APP_CONFIG.apiBaseUrl}/candidates/${candidateId}/reject`, {
      reasonKey,
      sendBankInvite,
    });
  }

  markTalentFirstContact(talentId: string): Observable<Talent | undefined> {
    return this.http
      .post<Talent>(`${APP_CONFIG.apiBaseUrl}/talents/${talentId}/first-contact`, {})
      .pipe(catchError(() => of(undefined)));
  }

  getReverseMatchForNewCampaign(criteria: {
    title: string;
    modality?: string;
    seniority?: string;
  }): Observable<TalentMatch[]> {
    return this.http.post<TalentMatch[]>(`${APP_CONFIG.apiBaseUrl}/campaigns/reverse-match`, criteria);
  }
}
