import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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
  CreateCampaignInput,
  DashboardMetrics,
  LoginCredentials,
  ManualTalentInput,
  Notification,
  Phase,
  PhaseKey,
  PublicApplicationManualInput,
  PublicCampaignInfo,
  RegisterCompanyInput,
  RegisterCompanyResult,
  RejectionReasonKey,
  Talent,
  TalentMatch,
  TeamMember,
  UserProfile,
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
 *   POST /auth/invitations/:token/accept                -> { email }  (public; não loga, front redireciona pro login)
 *   POST /auth/password-reset                           -> { resetLink? }  (public; sempre 200, nunca revela se o e-mail existe)
 *   POST /auth/password-reset/:token                    -> void  (public)
 *   GET  /users/me                                      -> UserProfile
 *   PATCH /users/me                                      -> UserProfile  (body: { name })
 *   GET  /users                                          -> TeamMember[]  (ativos/inativos + convites pendentes)
 *   POST /users/invitations                              -> { inviteLink? }  (só owner; body: { email })
 *   DELETE /users/invitations/:id                        -> void  (só owner; convite tem que estar pending)
 *   POST /users/invitations/:id/resend                   -> { inviteLink? }  (só owner; revoga o antigo e cria um novo)
 *   DELETE /users/:id                                     -> void  (só owner; nunca a própria conta; body: { password } — senha do owner)
 *   GET  /campaigns                                 -> Campaign[]
 *   POST /campaigns                                 -> Campaign  (body: CreateCampaignInput; 400 em payload inválido)
 *   GET  /campaigns/:id                              -> Campaign (404 -> undefined)
 *   POST /campaigns/:id/toggle-pause                   -> Campaign (404 -> undefined)
 *   GET  /campaigns/:id/candidates?phase=:phaseKey    -> Candidate[]  (phase optional)
 *   GET  /candidates/:id                              -> CandidateProfileData (404 -> undefined)
 *   POST /candidates/:id/decisions                    -> { phase?, talentId? }  (endpoint único; body: { decision: 'avancar'|'reprovar', rejectionReasonKey?, sendBankInvite? })
 *   POST /campaigns/:id/public-application-link       -> Campaign  (liga/desliga o link público; body: { enabled })
 *   GET  /public/campaigns/:id                        -> PublicCampaignInfo  (sem auth; 404 idêntico pra não existe/pausada/link desligado)
 *   POST /public/campaigns/:id/applications           -> void  (sem auth; body: { mode: 'manual'|'resume_text', name, email, ... , consent })
 *   POST /public/campaigns/:id/applications/resume-file -> void  (sem auth; multipart: name, email, consent, file — extração determinística, sem IA)
 *   GET  /company-profile                             -> CompanyProfile
 *   POST /company-profile                              -> CompanyProfile  (body: { tone, importance, values })
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

  /**
   * 404 (rota inexistente) e 501 (endpoint ainda esqueleto no backend) viram lista vazia em vez de
   * erro — pra o front, "esse domínio ainda não foi construído" e "não tem nada aqui" são a mesma
   * coisa: nenhum dos dois é uma falha de verdade que mereça a mensagem de erro. Qualquer outro
   * status (400/401/403/500, rede fora do ar) continua propagando como erro genuíno — só esses dois
   * códigos têm esse significado específico neste backend (ver docs/API.md do clearhire-server).
   */
  private emptyOnUnavailable<T>(source$: Observable<T[]>): Observable<T[]> {
    return source$.pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && (err.status === 404 || err.status === 501)) {
          return of([]);
        }
        return throwError(() => err);
      }),
    );
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

  acceptInvitation(token: string, input: { name: string; password: string }): Observable<{ email: string }> {
    return this.http.post<{ email: string }>(`${APP_CONFIG.apiBaseUrl}/auth/invitations/${token}/accept`, input);
  }

  requestPasswordReset(email: string): Observable<{ resetLink?: string }> {
    return this.http.post<{ resetLink?: string }>(`${APP_CONFIG.apiBaseUrl}/auth/password-reset`, { email });
  }

  confirmPasswordReset(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${APP_CONFIG.apiBaseUrl}/auth/password-reset/${token}`, { newPassword });
  }

  getCampaigns(): Observable<Campaign[]> {
    return this.emptyOnUnavailable(this.http.get<Campaign[]>(`${APP_CONFIG.apiBaseUrl}/campaigns`));
  }

  createCampaign(input: CreateCampaignInput): Observable<Campaign> {
    return this.http.post<Campaign>(`${APP_CONFIG.apiBaseUrl}/campaigns`, input);
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

  setCampaignPublicLink(campaignId: string, enabled: boolean): Observable<Campaign | undefined> {
    return this.http
      .post<Campaign>(`${APP_CONFIG.apiBaseUrl}/campaigns/${campaignId}/public-application-link`, { enabled })
      .pipe(catchError(() => of(undefined)));
  }

  getPublicCampaignInfo(campaignId: string): Observable<PublicCampaignInfo | undefined> {
    return this.http
      .get<PublicCampaignInfo>(`${APP_CONFIG.apiBaseUrl}/public/campaigns/${campaignId}`)
      .pipe(catchError(() => of(undefined)));
  }

  submitPublicApplicationManual(campaignId: string, input: PublicApplicationManualInput): Observable<void> {
    const { honeypot, ...rest } = input;
    return this.http.post<void>(`${APP_CONFIG.apiBaseUrl}/public/campaigns/${campaignId}/applications`, {
      mode: 'manual',
      website: honeypot ?? '',
      ...rest,
    });
  }

  submitPublicApplicationResumeText(
    campaignId: string,
    name: string,
    email: string,
    resumeText: string,
    consent: boolean,
    honeypot?: string,
  ): Observable<void> {
    return this.http.post<void>(`${APP_CONFIG.apiBaseUrl}/public/campaigns/${campaignId}/applications`, {
      mode: 'resume_text',
      name,
      email,
      resumeText,
      consent,
      website: honeypot ?? '',
    });
  }

  submitPublicApplicationResumeFile(
    campaignId: string,
    name: string,
    email: string,
    file: File,
    consent: boolean,
    honeypot?: string,
  ): Observable<void> {
    const form = new FormData();
    form.append('name', name);
    form.append('email', email);
    form.append('consent', String(consent));
    form.append('website', honeypot ?? '');
    form.append('file', file);
    return this.http.post<void>(`${APP_CONFIG.apiBaseUrl}/public/campaigns/${campaignId}/applications/resume-file`, form);
  }

  getCandidates(campaignId: string, phase?: PhaseKey): Observable<Candidate[]> {
    const params = phase ? new HttpParams().set('phase', phase) : undefined;
    return this.emptyOnUnavailable(
      this.http.get<Candidate[]>(`${APP_CONFIG.apiBaseUrl}/campaigns/${campaignId}/candidates`, { params }),
    );
  }

  getCandidateProfile(candidateId: string): Observable<CandidateProfileData | undefined> {
    return this.http
      .get<CandidateProfileData>(`${APP_CONFIG.apiBaseUrl}/candidates/${candidateId}`)
      .pipe(catchError(() => of(undefined)));
  }

  advanceCandidate(candidateId: string): Observable<Candidate | undefined> {
    // Backend real usa um endpoint único de decisão (POST .../decisions com { decision }), não
    // dois separados — casa com candidate_decisions ter uma coluna decision_kind só, não duas
    // tabelas. A resposta só traz { phase, talentId? } (ver DecideResponse no backend); o único
    // campo que approveAndAdvance() de fato lê é candidate.phase, então o resto fica vazio de
    // propósito — nunca fabricar dado que não veio do servidor.
    return this.http
      .post<{ phase: PhaseKey; talentId?: string }>(`${APP_CONFIG.apiBaseUrl}/candidates/${candidateId}/decisions`, {
        decision: 'avancar',
      })
      .pipe(
        map((res) => ({ phase: res.phase }) as Candidate),
        catchError(() => of(undefined)),
      );
  }

  getCompanyProfile(): Observable<CompanyProfile> {
    return this.http.get<CompanyProfile>(`${APP_CONFIG.apiBaseUrl}/company-profile`);
  }

  updateCompanyProfile(update: Pick<CompanyProfile, 'tone' | 'importance' | 'values'>): Observable<CompanyProfile> {
    return this.http.post<CompanyProfile>(`${APP_CONFIG.apiBaseUrl}/company-profile`, update);
  }

  getDashboardMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${APP_CONFIG.apiBaseUrl}/dashboard/metrics`);
  }

  getAiSuggestions(): Observable<AiSuggestion[]> {
    return this.emptyOnUnavailable(this.http.get<AiSuggestion[]>(`${APP_CONFIG.apiBaseUrl}/dashboard/ai-suggestions`));
  }

  getActivityFeed(): Observable<ActivityItem[]> {
    return this.emptyOnUnavailable(this.http.get<ActivityItem[]>(`${APP_CONFIG.apiBaseUrl}/dashboard/activity`));
  }

  getNotifications(): Observable<Notification[]> {
    return this.emptyOnUnavailable(this.http.get<Notification[]>(`${APP_CONFIG.apiBaseUrl}/notifications`));
  }

  markNotificationRead(id: string): Observable<Notification | undefined> {
    return this.http
      .post<Notification>(`${APP_CONFIG.apiBaseUrl}/notifications/${id}/read`, {})
      .pipe(catchError(() => of(undefined)));
  }

  getFunnelSummary(): Observable<Phase[]> {
    return this.emptyOnUnavailable(this.http.get<Phase[]>(`${APP_CONFIG.apiBaseUrl}/reports/funnel-summary`));
  }

  getCampaignPerformance(): Observable<CampaignPerformance[]> {
    return this.emptyOnUnavailable(
      this.http.get<CampaignPerformance[]>(`${APP_CONFIG.apiBaseUrl}/reports/campaign-performance`),
    );
  }

  getAiTrustMetrics(): Observable<AiTrustMetrics> {
    return this.http.get<AiTrustMetrics>(`${APP_CONFIG.apiBaseUrl}/reports/ai-trust`);
  }

  getTalents(): Observable<Talent[]> {
    return this.emptyOnUnavailable(this.http.get<Talent[]>(`${APP_CONFIG.apiBaseUrl}/talents`));
  }

  getTalent(id: string): Observable<Talent | undefined> {
    return this.http.get<Talent>(`${APP_CONFIG.apiBaseUrl}/talents/${id}`).pipe(catchError(() => of(undefined)));
  }

  searchTalents(query: string): Observable<TalentMatch[]> {
    const params = new HttpParams().set('q', query);
    return this.emptyOnUnavailable(this.http.get<TalentMatch[]>(`${APP_CONFIG.apiBaseUrl}/talents/search`, { params }));
  }

  findSimilarTalents(talentId: string): Observable<TalentMatch[]> {
    return this.emptyOnUnavailable(this.http.get<TalentMatch[]>(`${APP_CONFIG.apiBaseUrl}/talents/${talentId}/similar`));
  }

  getTalentPoolCoverage(): Observable<CoverageEntry[]> {
    return this.emptyOnUnavailable(this.http.get<CoverageEntry[]>(`${APP_CONFIG.apiBaseUrl}/talents/coverage`));
  }

  registerManualTalent(input: ManualTalentInput): Observable<Talent> {
    return this.http.post<Talent>(`${APP_CONFIG.apiBaseUrl}/talents`, input);
  }

  submitCandidateRejection(
    candidateId: string,
    reasonKey: RejectionReasonKey,
    sendBankInvite: boolean,
  ): Observable<{ talent?: Talent }> {
    // Mesmo endpoint único de decisão que advanceCandidate() usa. confirmReject() só lê
    // talent?.id (pra linkar o perfil no Banco de Talentos), então um Talent parcial com só o id
    // já basta — o domínio talent ainda nem existe de verdade pra montar o objeto completo.
    return this.http
      .post<{ talentId?: string }>(`${APP_CONFIG.apiBaseUrl}/candidates/${candidateId}/decisions`, {
        decision: 'reprovar',
        rejectionReasonKey: reasonKey,
        sendBankInvite,
      })
      .pipe(map((res) => ({ talent: res.talentId ? ({ id: res.talentId } as Talent) : undefined })));
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
    return this.emptyOnUnavailable(this.http.post<TalentMatch[]>(`${APP_CONFIG.apiBaseUrl}/campaigns/reverse-match`, criteria));
  }

  getMyProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${APP_CONFIG.apiBaseUrl}/users/me`);
  }

  updateMyProfile(name: string): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${APP_CONFIG.apiBaseUrl}/users/me`, { name });
  }

  getTeam(): Observable<TeamMember[]> {
    return this.emptyOnUnavailable(this.http.get<TeamMember[]>(`${APP_CONFIG.apiBaseUrl}/users`));
  }

  inviteTeamMember(email: string): Observable<{ inviteLink?: string }> {
    return this.http.post<{ inviteLink?: string }>(`${APP_CONFIG.apiBaseUrl}/users/invitations`, { email });
  }

  cancelInvitation(invitationId: string): Observable<void> {
    return this.http.delete<void>(`${APP_CONFIG.apiBaseUrl}/users/invitations/${invitationId}`);
  }

  resendInvitation(invitationId: string): Observable<{ inviteLink?: string }> {
    return this.http.post<{ inviteLink?: string }>(`${APP_CONFIG.apiBaseUrl}/users/invitations/${invitationId}/resend`, {});
  }

  deactivateTeamMember(userId: string, password: string): Observable<void> {
    return this.http.delete<void>(`${APP_CONFIG.apiBaseUrl}/users/${userId}`, { body: { password } });
  }
}
