import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
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
  PHASE_LABELS,
  REJECTION_REASONS,
  RegisterCompanyInput,
  RegisterCompanyResult,
  RejectionReasonKey,
  Talent,
  TalentMatch,
  TeamMember,
  UserProfile,
} from './models';
import {
  MOCK_ACTIVITY_FEED,
  MOCK_AI_SUGGESTIONS,
  MOCK_AI_TRUST,
  MOCK_AUTH_USERS,
  MOCK_CAMPAIGNS,
  MOCK_CANDIDATES_BY_CAMPAIGN,
  MOCK_CANDIDATE_PROFILES,
  MOCK_COMPANY_PROFILE,
  MOCK_DASHBOARD_METRICS,
  MOCK_NOTIFICATIONS,
  MOCK_TALENTS,
  MockAuthUser,
} from './mock-data';
import { computeCoverage, findSimilarInPool, reverseMatchForCriteria, searchTalentPool } from './talent-matching';

/** Stand-in backend: same contract as HttpApiService, served from in-memory data. */
@Injectable()
export class MockApiService extends DataApi {
  /** Estado "vivo" do banco — cadastro manual e reprovação qualificada escrevem aqui em runtime. */
  private talents: Talent[] = [...MOCK_TALENTS];
  /** Estado "vivo" das notificações — marcar como lida escreve aqui em runtime. */
  private notifications: Notification[] = [...MOCK_NOTIFICATIONS];
  /** Estado "vivo" do perfil da empresa — editar em Configurações escreve aqui em runtime. */
  private companyProfile: CompanyProfile = { ...MOCK_COMPANY_PROFILE };
  /** Estado "vivo" das contas cadastradas — registro de empresa, convite aceito e desativação de
   * assento escrevem aqui em runtime. */
  private authUsers: MockAuthUser[] = [...MOCK_AUTH_USERS];
  /** Convites de segundo RH ainda não aceitos — token é só o e-mail (mock não precisa de segredo
   * real, HttpApiService é quem fala com o backend de verdade). */
  private pendingInvitations: { email: string; companyId: string; companyName: string }[] = [];
  /** Aproximação do cookie httpOnly de refresh: "existe uma sessão renovável" enquanto esta
   * instância do serviço estiver viva. Reseta a `false` a cada reload de verdade (instância nova),
   * o mesmo efeito prático de um cookie que HttpApiService não consegue simular sem HTTP real. */
  private hasRefreshSession = false;
  /** E-mail do usuário da sessão atual — só existe em memória, nunca em storage (mesma regra do
   * access token real, ver `auth.service.ts`). */
  private currentUserEmail: string | null = null;

  registerCompany(input: RegisterCompanyInput): Observable<RegisterCompanyResult> {
    const emailTaken = this.authUsers.some((u) => u.email.toLowerCase() === input.ownerEmail.toLowerCase());
    if (emailTaken) {
      return this.simulateError('Este e-mail já está cadastrado.');
    }
    const companyId = this.slugifyCompany(input.companyName);
    this.authUsers = [
      ...this.authUsers,
      {
        id: `user-${Date.now()}`,
        name: input.ownerName,
        email: input.ownerEmail,
        password: input.ownerPassword,
        companyName: input.companyName,
        companyId,
        role: 'owner',
        isActive: true,
      },
    ];
    return this.simulate({ id: companyId, name: input.companyName });
  }

  login(credentials: LoginCredentials): Observable<AuthSession> {
    const user = this.authUsers.find(
      (u) => u.email.toLowerCase() === credentials.email.toLowerCase() && u.password === credentials.password,
    );
    if (!user || !user.isActive) {
      return this.simulateError('E-mail ou senha incorretos.');
    }
    this.hasRefreshSession = true;
    this.currentUserEmail = user.email;
    return this.simulate({ accessToken: `mock-access-${Date.now()}` });
  }

  refresh(): Observable<AuthSession> {
    if (!this.hasRefreshSession) {
      return this.simulateError('Sessão inválida ou expirada.');
    }
    return this.simulate({ accessToken: `mock-access-${Date.now()}` });
  }

  logout(): Observable<void> {
    this.hasRefreshSession = false;
    this.currentUserEmail = null;
    return this.simulate(undefined);
  }

  acceptInvitation(token: string, input: { name: string; password: string }): Observable<{ email: string }> {
    const invitation = this.pendingInvitations.find((i) => i.email === token);
    if (!invitation) {
      return this.simulateError('Convite inválido ou expirado.');
    }
    this.authUsers = [
      ...this.authUsers,
      {
        id: `user-${Date.now()}`,
        name: input.name,
        email: invitation.email,
        password: input.password,
        companyName: invitation.companyName,
        companyId: invitation.companyId,
        role: 'member',
        isActive: true,
      },
    ];
    this.pendingInvitations = this.pendingInvitations.filter((i) => i.email !== token);
    return this.simulate({ email: invitation.email });
  }

  requestPasswordReset(email: string): Observable<{ resetLink?: string }> {
    const exists = this.authUsers.some((u) => u.email.toLowerCase() === email.toLowerCase() && u.isActive);
    return this.simulate(exists ? { resetLink: `/redefinir-senha/${email}` } : {});
  }

  confirmPasswordReset(token: string, newPassword: string): Observable<void> {
    const user = this.authUsers.find((u) => u.email === token);
    if (!user) {
      return this.simulateError('Link inválido ou expirado.');
    }
    user.password = newPassword;
    return this.simulate(undefined);
  }

  getCampaigns(): Observable<Campaign[]> {
    return this.simulate(MOCK_CAMPAIGNS);
  }

  getCampaign(id: string): Observable<Campaign | undefined> {
    return this.simulate(MOCK_CAMPAIGNS.find((c) => c.id === id));
  }

  toggleCampaignPause(campaignId: string): Observable<Campaign | undefined> {
    const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
    if (campaign && campaign.status !== 'encerrada') {
      campaign.status = campaign.status === 'ativa' ? 'pausada' : 'ativa';
    }
    return this.simulate(campaign);
  }

  getCandidates(campaignId: string, phase?: PhaseKey): Observable<Candidate[]> {
    const all = MOCK_CANDIDATES_BY_CAMPAIGN[campaignId] ?? [];
    return this.simulate(phase ? all.filter((c) => c.phase === phase) : all);
  }

  getCandidateProfile(candidateId: string): Observable<CandidateProfileData | undefined> {
    return this.simulate(MOCK_CANDIDATE_PROFILES[candidateId]);
  }

  advanceCandidate(candidateId: string): Observable<Candidate | undefined> {
    const order: PhaseKey[] = ['recebidos', 'fit', 'tecnica', 'entrevista', 'selecionados'];
    const candidate = Object.values(MOCK_CANDIDATES_BY_CAMPAIGN)
      .flat()
      .find((c) => c.id === candidateId);
    if (candidate) {
      const nextIndex = order.indexOf(candidate.phase) + 1;
      if (nextIndex < order.length) candidate.phase = order[nextIndex];
    }
    return this.simulate(candidate);
  }

  getCompanyProfile(): Observable<CompanyProfile> {
    return this.simulate(this.companyProfile);
  }

  updateCompanyProfile(update: Pick<CompanyProfile, 'tone' | 'importance' | 'values'>): Observable<CompanyProfile> {
    this.companyProfile = { ...this.companyProfile, ...update };
    return this.simulate(this.companyProfile);
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
      updatedAt: this.today(),
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
      updatedAt: this.today(),
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

  private currentUser(): MockAuthUser | undefined {
    return this.authUsers.find((u) => u.email === this.currentUserEmail);
  }

  getMyProfile(): Observable<UserProfile> {
    const user = this.currentUser();
    if (!user) {
      return this.simulateError('Sessão inválida.');
    }
    return this.simulate({ id: user.id, name: user.name, email: user.email, role: user.role });
  }

  updateMyProfile(name: string): Observable<UserProfile> {
    const user = this.currentUser();
    if (!user) {
      return this.simulateError('Sessão inválida.');
    }
    user.name = name;
    return this.simulate({ id: user.id, name: user.name, email: user.email, role: user.role });
  }

  getTeam(): Observable<TeamMember[]> {
    const user = this.currentUser();
    if (!user) {
      return this.simulate([]);
    }
    const members: TeamMember[] = this.authUsers
      .filter((u) => u.companyId === user.companyId)
      .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.isActive ? 'active' : 'inactive' }));
    const pending: TeamMember[] = this.pendingInvitations
      .filter((i) => i.companyId === user.companyId)
      .map((i) => ({ id: i.email, name: '', email: i.email, role: 'member', status: 'pending' }));
    return this.simulate([...members, ...pending]);
  }

  inviteTeamMember(email: string): Observable<{ inviteLink?: string }> {
    const user = this.currentUser();
    if (!user) {
      return this.simulateError('Sessão inválida.');
    }
    if (user.role !== 'owner') {
      return this.simulateError('Apenas o owner pode convidar novos RHs.');
    }
    if (this.authUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return this.simulateError('Já existe uma conta com este e-mail.');
    }
    if (this.pendingInvitations.some((i) => i.email.toLowerCase() === email.toLowerCase())) {
      return this.simulateError('Já existe um convite pendente para este e-mail.');
    }
    this.pendingInvitations = [...this.pendingInvitations, { email, companyId: user.companyId, companyName: user.companyName }];
    return this.simulate({ inviteLink: `/aceitar-convite/${email}` });
  }

  cancelInvitation(invitationId: string): Observable<void> {
    const user = this.currentUser();
    if (!user) {
      return this.simulateError('Sessão inválida.');
    }
    if (user.role !== 'owner') {
      return this.simulateError('Apenas o owner pode cancelar convites.');
    }
    // getTeam() expõe o e-mail como "id" de uma linha pendente (não existe token/id próprio no
    // mock) — mesma convenção usada lá, ver abaixo.
    const invite = this.pendingInvitations.find((i) => i.email === invitationId && i.companyId === user.companyId);
    if (!invite) {
      return this.simulateError('Convite não encontrado ou já processado.');
    }
    this.pendingInvitations = this.pendingInvitations.filter((i) => i !== invite);
    return this.simulate(undefined);
  }

  resendInvitation(invitationId: string): Observable<{ inviteLink?: string }> {
    const user = this.currentUser();
    if (!user) {
      return this.simulateError('Sessão inválida.');
    }
    if (user.role !== 'owner') {
      return this.simulateError('Apenas o owner pode reenviar convites.');
    }
    const invite = this.pendingInvitations.find((i) => i.email === invitationId && i.companyId === user.companyId);
    if (!invite) {
      return this.simulateError('Convite não encontrado ou já processado.');
    }
    // No mock o "token" é o próprio e-mail (ver acceptInvitation) — não há token de verdade pra
    // regenerar, então só devolve o mesmo link de convite pra manter o contrato consistente.
    return this.simulate({ inviteLink: `/aceitar-convite/${invite.email}` });
  }

  deactivateTeamMember(userId: string, password: string): Observable<void> {
    const user = this.currentUser();
    if (!user) {
      return this.simulateError('Sessão inválida.');
    }
    if (user.role !== 'owner') {
      return this.simulateError('Apenas o owner pode desativar assentos.');
    }
    if (userId === user.id) {
      return this.simulateError('Não é possível desativar sua própria conta.');
    }
    // Reconfirma a senha do OWNER (user), nunca a do alvo — mesmo comparativo usado em login().
    if (user.password !== password) {
      return this.simulateError('Senha incorreta.');
    }
    const target = this.authUsers.find((u) => u.id === userId && u.companyId === user.companyId);
    if (!target) {
      return this.simulateError('Usuário não encontrado.');
    }
    target.isActive = false;
    return this.simulate(undefined);
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

  private slugifyCompany(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  private simulate<T>(value: T): Observable<T> {
    return of(value).pipe(delay(APP_CONFIG.mockLatencyMs));
  }

  private simulateError<T>(message: string): Observable<T> {
    return throwError(() => new Error(message)).pipe(delay(APP_CONFIG.mockLatencyMs));
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
