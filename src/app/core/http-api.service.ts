import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DataApi } from './data-api';
import { APP_CONFIG } from './app-config';
import {
  ActivityItem,
  AddTalentsResult,
  AiSuggestion,
  AuthSession,
  Campaign,
  CampaignPerformance,
  Candidate,
  CandidateAssessment,
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
  PublicProfileLead,
  PublicProfileSource,
  RegisterCompanyInput,
  RegisterCompanyResult,
  RejectionReasonKey,
  ReferralProspectInput,
  SourcingProspect,
  Talent,
  TalentMatch,
  TalentRecommendation,
  TeamMember,
  UpdateCampaignInput,
  UserProfile,
  XRayProspectInput,
} from './models';
import { ReportRange } from './report-period';

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
 *   PATCH /campaigns/:id                              -> Campaign (404 -> undefined; body: UpdateCampaignInput; 400 em payload inválido)
 *   PATCH /campaigns/:id/phases                       -> Campaign (404 -> undefined; body: { phaseKeys }; 400 se remover fase com candidato)
 *   POST /campaigns/:id/toggle-pause                   -> Campaign (404 -> undefined)
 *   GET  /campaigns/:id/candidates?phase=:phaseKey    -> Candidate[]  (phase optional)
 *   GET  /candidates/:id                              -> CandidateProfileData (404 -> undefined)
 *   POST /candidates/:id/assessment                   -> CandidateAssessment  (análise da IA; 503 se a IA não está habilitada)
 *   POST /candidates/:id/decisions                    -> { phase?, talentId? }  (endpoint único; body: { decision: 'avancar'|'reprovar', rejectionReasonKey?, sendBankInvite? })
 *   POST /campaigns/:id/public-application-link       -> Campaign  (liga/desliga o link público; body: { enabled })
 *   GET  /public/campaigns/:id                        -> PublicCampaignInfo  (sem auth; 404 idêntico pra não existe/pausada/link desligado)
 *   POST /public/campaigns/:id/applications           -> void  (sem auth; body: { mode: 'manual'|'resume_text', name, email, ... , consent })
 *   POST /public/campaigns/:id/applications/resume-file -> void  (sem auth; multipart: name, email, consent, file — extração determinística, sem IA)
 *   GET  /company-profile                             -> CompanyProfile
 *   POST /company-profile                              -> CompanyProfile  (body: { tone, importance, values })
 *   GET  /dashboard/metrics                           -> DashboardMetrics
 *   GET  /dashboard/ai-suggestions                    -> AiSuggestion[]
 *   GET  /dashboard/activity?limit=:n                 -> ActivityItem[]  (limit opcional, default 50, teto 200)
 *   GET  /notifications                               -> Notification[]
 *   POST /notifications/:id/read                       -> Notification (404 -> undefined)
 *   GET  /reports/funnel-summary?from=&to=            -> Phase[] (aggregate across campaigns)
 *   GET  /reports/campaign-performance?from=&to=      -> CampaignPerformance[]
 *        (from/to são instantes RFC3339, from inclusivo e to exclusivo; ausentes = todo o período)
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
 *   POST /campaigns/:id/talent-recommendations/assess    -> TalentRecommendation[]  (etapa 2: leitura de IA sob demanda,
 *        até 5 talentos por chamada, body: { talentIds }; campanha JÁ CRIADA, nunca um rascunho)
 *   POST /campaigns/:id/talents                          -> AddTalentsResult  (puxa talentos pro funil, fase Recebidos;
 *        body: { talentIds }; quem não entra — exclusão solicitada ou ainda não notificado — volta em `skipped` com o motivo)
 *
 *   -- Sourcing (fase antes de "Recebidos") — NENHUM destes endpoints existe no backend ainda. --
 *   -- Protótipo frontend/mock desta sessão (documentos/sourcing-fase-funil-plano.md); contrato   --
 *   -- pretendido abaixo, pra quando o backend real for desenhado.                                --
 *   GET  /campaigns/:id/sourcing/prospects                -> SourcingProspect[]
 *   POST /campaigns/:id/sourcing/prospects/referral        -> SourcingProspect  (body: ReferralProspectInput)
 *   GET  /campaigns/:id/sourcing/public-search?source=     -> PublicProfileLead[]  (source: 'github'|'stackoverflow')
 *   POST /campaigns/:id/sourcing/prospects/public-search    -> SourcingProspect[]  (body: { leads: PublicProfileLead[] })
 *   POST /campaigns/:id/sourcing/prospects/x-ray            -> SourcingProspect  (body: XRayProspectInput)
 *   POST /campaigns/:id/sourcing/prospects/:prospectId/register -> { prospect, talent }  (body: ManualTalentInput)
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

  /**
   * Mesmo raciocínio de `emptyOnUnavailable`, mas pra endpoints de entidade única: só 404 vira
   * `undefined` ("não encontrado" — o próprio backend, por design, devolve o mesmo 404 pra "não
   * existe" e pra "existe mas não é desta empresa", ver comentário do endpoint público acima).
   * Qualquer outro status (401/403/500, rede fora do ar) propaga como erro de verdade — sem isso,
   * `toLoadable().error()` nunca fica `true` nesses endpoints e a UI não consegue diferenciar "não
   * encontrado" de "falha ao carregar" (ver ErrorStateComponent).
   */
  private undefinedOnNotFound<T>(source$: Observable<T>): Observable<T | undefined> {
    return source$.pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          return of(undefined);
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
    return this.undefinedOnNotFound(this.http.get<Campaign>(`${APP_CONFIG.apiBaseUrl}/campaigns/${id}`));
  }

  updateCampaign(campaignId: string, input: UpdateCampaignInput): Observable<Campaign | undefined> {
    return this.undefinedOnNotFound(this.http.patch<Campaign>(`${APP_CONFIG.apiBaseUrl}/campaigns/${campaignId}`, input));
  }

  updateCampaignPhases(
    campaignId: string,
    phaseKeys: Array<'fit' | 'tecnica' | 'entrevista'>,
  ): Observable<Campaign | undefined> {
    return this.undefinedOnNotFound(
      this.http.patch<Campaign>(`${APP_CONFIG.apiBaseUrl}/campaigns/${campaignId}/phases`, { phaseKeys }),
    );
  }

  toggleCampaignPause(campaignId: string): Observable<Campaign | undefined> {
    return this.undefinedOnNotFound(
      this.http.post<Campaign>(`${APP_CONFIG.apiBaseUrl}/campaigns/${campaignId}/toggle-pause`, {}),
    );
  }

  setCampaignPublicLink(campaignId: string, enabled: boolean): Observable<Campaign | undefined> {
    return this.undefinedOnNotFound(
      this.http.post<Campaign>(`${APP_CONFIG.apiBaseUrl}/campaigns/${campaignId}/public-application-link`, { enabled }),
    );
  }

  getPublicCampaignInfo(campaignId: string): Observable<PublicCampaignInfo | undefined> {
    return this.undefinedOnNotFound(
      this.http.get<PublicCampaignInfo>(`${APP_CONFIG.apiBaseUrl}/public/campaigns/${campaignId}`),
    );
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
    return this.undefinedOnNotFound(
      this.http.get<CandidateProfileData>(`${APP_CONFIG.apiBaseUrl}/candidates/${candidateId}`),
    );
  }

  assessCandidate(candidateId: string): Observable<CandidateAssessment> {
    return this.http.post<CandidateAssessment>(`${APP_CONFIG.apiBaseUrl}/candidates/${candidateId}/assessment`, {});
  }

  advanceCandidate(candidateId: string): Observable<Candidate | undefined> {
    // Backend real usa um endpoint único de decisão (POST .../decisions com { decision }), não
    // dois separados — casa com candidate_decisions ter uma coluna decision_kind só, não duas
    // tabelas. A resposta só traz { phase, talentId? } (ver DecideResponse no backend); o único
    // campo que approveAndAdvance() de fato lê é candidate.phase, então o resto fica vazio de
    // propósito — nunca fabricar dado que não veio do servidor.
    return this.undefinedOnNotFound(
      this.http
        .post<{ phase: PhaseKey; talentId?: string }>(`${APP_CONFIG.apiBaseUrl}/candidates/${candidateId}/decisions`, {
          decision: 'avancar',
        })
        // talentId vem quando a aprovação levou a pessoa ao Banco de Talentos (chegou a Selecionados
        // com consentimento) — a tela mostra o link para o perfil.
        .pipe(map((res) => ({ phase: res.phase, talentId: res.talentId }) as Candidate)),
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
    return this.undefinedOnNotFound(this.http.post<Notification>(`${APP_CONFIG.apiBaseUrl}/notifications/${id}/read`, {}));
  }

  /** Monta `?from=&to=`; período "todo" não manda parâmetro nenhum, e o backend trata a ausência
   * como sem limite (ver parseReportPeriod no campaign/handler.go). */
  private reportParams(range?: ReportRange): HttpParams {
    let params = new HttpParams();
    if (range?.from) params = params.set('from', range.from);
    if (range?.to) params = params.set('to', range.to);
    return params;
  }

  getFunnelSummary(range?: ReportRange): Observable<Phase[]> {
    return this.emptyOnUnavailable(
      this.http.get<Phase[]>(`${APP_CONFIG.apiBaseUrl}/reports/funnel-summary`, { params: this.reportParams(range) }),
    );
  }

  getCampaignPerformance(range?: ReportRange): Observable<CampaignPerformance[]> {
    return this.emptyOnUnavailable(
      this.http.get<CampaignPerformance[]>(`${APP_CONFIG.apiBaseUrl}/reports/campaign-performance`, {
        params: this.reportParams(range),
      }),
    );
  }

  getTalents(): Observable<Talent[]> {
    return this.emptyOnUnavailable(this.http.get<Talent[]>(`${APP_CONFIG.apiBaseUrl}/talents`));
  }

  getTalent(id: string): Observable<Talent | undefined> {
    return this.undefinedOnNotFound(this.http.get<Talent>(`${APP_CONFIG.apiBaseUrl}/talents/${id}`));
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
    return this.undefinedOnNotFound(this.http.post<Talent>(`${APP_CONFIG.apiBaseUrl}/talents/${talentId}/first-contact`, {}));
  }

  addTalentsToCampaign(campaignId: string, talentIds: string[]): Observable<AddTalentsResult> {
    return this.http.post<AddTalentsResult>(`${APP_CONFIG.apiBaseUrl}/campaigns/${campaignId}/talents`, { talentIds });
  }

  getReverseMatchForNewCampaign(criteria: {
    title: string;
    modality?: string;
    seniority?: string;
    requirements?: string;
  }): Observable<TalentMatch[]> {
    return this.emptyOnUnavailable(this.http.post<TalentMatch[]>(`${APP_CONFIG.apiBaseUrl}/campaigns/reverse-match`, criteria));
  }

  assessTalentsForCampaign(campaignId: string, talentIds: string[]): Observable<TalentRecommendation[]> {
    return this.http.post<TalentRecommendation[]>(
      `${APP_CONFIG.apiBaseUrl}/campaigns/${campaignId}/talent-recommendations/assess`,
      { talentIds },
    );
  }

  // --- Sourcing (fase antes de "Recebidos") ---------------------------------------------------
  //
  // Protótipo frontend/mock desta sessão: nenhum endpoint existe no backend ainda (ver contrato
  // pretendido no bloco de comentários no topo deste arquivo). Erra explícito em vez de tentar uma
  // rota que não existe — a tela de Sourcing só funciona com `APP_CONFIG.useMockApi = true` por
  // ora.

  private sourcingNotImplemented<T>(): Observable<T> {
    return throwError(
      () => new Error('Sourcing ainda não tem backend implementado — disponível só em modo mock (APP_CONFIG.useMockApi = true).'),
    );
  }

  getSourcingProspects(_campaignId: string): Observable<SourcingProspect[]> {
    return this.sourcingNotImplemented();
  }

  addReferralProspect(_campaignId: string, _input: ReferralProspectInput): Observable<SourcingProspect> {
    return this.sourcingNotImplemented();
  }

  searchPublicProfiles(_campaignId: string, _source: PublicProfileSource): Observable<PublicProfileLead[]> {
    return this.sourcingNotImplemented();
  }

  addPublicProfileProspects(_campaignId: string, _leads: PublicProfileLead[]): Observable<SourcingProspect[]> {
    return this.sourcingNotImplemented();
  }

  addXRayProspect(_campaignId: string, _input: XRayProspectInput): Observable<SourcingProspect> {
    return this.sourcingNotImplemented();
  }

  registerSourcingProspectAsTalent(
    _campaignId: string,
    _prospectId: string,
    _input: ManualTalentInput,
  ): Observable<{ prospect: SourcingProspect; talent: Talent }> {
    return this.sourcingNotImplemented();
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
