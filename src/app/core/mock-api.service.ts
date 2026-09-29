import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { DataApi } from './data-api';
import { APP_CONFIG } from './app-config';
import {
  ActivityItem,
  AddTalentsResult,
  AiSuggestion,
  AuthSession,
  CAMPAIGN_CONTRACT_TYPE_LABELS,
  CAMPAIGN_MODALITY_LABELS,
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
  PHASE_LABELS,
  PublicApplicationManualInput,
  PublicCampaignInfo,
  REJECTION_REASONS,
  RegisterCompanyInput,
  RegisterCompanyResult,
  RejectionReasonKey,
  Talent,
  TalentMatch,
  TalentRecommendation,
  TeamMember,
  UpdateCampaignInput,
  UserProfile,
} from './models';
import { ReportRange } from './report-period';
import {
  MOCK_ACTIVITY_FEED,
  MOCK_AI_SUGGESTIONS,
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

  createCampaign(input: CreateCampaignInput): Observable<Campaign> {
    const title = input.title.trim();
    if (!title) {
      return this.simulateError('Dados obrigatórios faltando ou inválidos.');
    }

    const phaseKeys: PhaseKey[] = ['recebidos', ...input.phaseKeys, 'selecionados'];
    const phases: Phase[] = phaseKeys.map((key, i) => ({ key, num: i + 1, label: PHASE_LABELS[key], count: 0 }));

    const campaign: Campaign = {
      id: this.slugifyCampaign(title),
      title,
      description: input.description,
      responsibilities: input.responsibilities,
      requirements: input.requirements,
      benefits: input.benefits,
      city: input.city,
      state: input.state,
      modality: input.modality,
      contractType: input.contractType,
      seniority: input.seniority,
      status: 'ativa',
      acceptsPublicApplications: false,
      location: this.buildCampaignLocation(input),
      meta: 'Aberta há 0 dias',
      totalCandidates: 0,
      currentPhaseLabel: PHASE_LABELS.recebidos,
      currentPhaseKey: 'recebidos',
      // Réplica de assembleView() no service Go: recém-criada, nenhuma fase tem candidato ainda,
      // então a posição atual é sempre a 1ª (Recebidos) — % é 1/nº total de fases.
      funnelPercent: Math.round((1 / phases.length) * 100),
      phases,
    };
    MOCK_CAMPAIGNS.unshift(campaign);
    return this.simulate(campaign);
  }

  private buildCampaignLocation(input: {
    city: string;
    state: string;
    modality: Campaign['modality'];
    contractType: Campaign['contractType'];
  }): string {
    const segments: string[] = [];
    if (input.city) segments.push(input.state ? `${input.city}, ${input.state}` : input.city);
    segments.push(CAMPAIGN_MODALITY_LABELS[input.modality], CAMPAIGN_CONTRACT_TYPE_LABELS[input.contractType]);
    return segments.join(' · ');
  }

  private slugifyCampaign(title: string): string {
    const base = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return MOCK_CAMPAIGNS.some((c) => c.id === base) ? `${base}-${MOCK_CAMPAIGNS.length}` : base;
  }

  getCampaign(id: string): Observable<Campaign | undefined> {
    return this.simulate(MOCK_CAMPAIGNS.find((c) => c.id === id));
  }

  updateCampaign(campaignId: string, input: UpdateCampaignInput): Observable<Campaign | undefined> {
    const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
    if (!campaign) return this.simulate(undefined);
    if (!input.title.trim()) {
      return this.simulateError('Dados obrigatórios faltando ou inválidos.');
    }

    campaign.title = input.title.trim();
    campaign.description = input.description.trim();
    campaign.responsibilities = input.responsibilities.trim();
    campaign.requirements = input.requirements.trim();
    campaign.benefits = input.benefits.trim();
    campaign.city = input.city.trim();
    campaign.state = input.state.trim();
    campaign.modality = input.modality;
    campaign.contractType = input.contractType;
    campaign.seniority = input.seniority;
    campaign.location = this.buildCampaignLocation(input);
    return this.simulate(campaign);
  }

  updateCampaignPhases(campaignId: string, phaseKeys: Array<'fit' | 'tecnica' | 'entrevista'>): Observable<Campaign | undefined> {
    const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
    if (!campaign) return this.simulate(undefined);

    const newKeys = new Set<PhaseKey>(['recebidos', ...phaseKeys, 'selecionados']);
    const removed = campaign.phases.filter((p) => !newKeys.has(p.key) && p.count > 0);
    if (removed.length > 0) {
      return this.simulateError(`Não é possível remover a fase '${removed[0].label}': ainda há candidato nela.`);
    }

    const keys: PhaseKey[] = ['recebidos', ...phaseKeys, 'selecionados'];
    campaign.phases = keys.map((key, i) => ({
      key,
      num: i + 1,
      label: PHASE_LABELS[key],
      count: campaign.phases.find((p) => p.key === key)?.count ?? 0,
    }));
    return this.simulate(campaign);
  }

  toggleCampaignPause(campaignId: string): Observable<Campaign | undefined> {
    const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
    if (campaign && campaign.status !== 'encerrada') {
      campaign.status = campaign.status === 'ativa' ? 'pausada' : 'ativa';
    }
    return this.simulate(campaign);
  }

  setCampaignPublicLink(campaignId: string, enabled: boolean): Observable<Campaign | undefined> {
    const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
    if (campaign) {
      campaign.acceptsPublicApplications = enabled;
    }
    return this.simulate(campaign);
  }

  getPublicCampaignInfo(campaignId: string): Observable<PublicCampaignInfo | undefined> {
    const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
    if (!campaign || campaign.status !== 'ativa' || !campaign.acceptsPublicApplications) {
      return this.simulate(undefined);
    }
    return this.simulate({
      id: campaign.id,
      title: campaign.title,
      companyName: MOCK_COMPANY_PROFILE.name,
      description: campaign.description,
      responsibilities: campaign.responsibilities,
      requirements: campaign.requirements,
      benefits: campaign.benefits,
      location: campaign.location,
      modality: '',
      contractType: '',
      seniority: '',
    });
  }

  submitPublicApplicationManual(_campaignId: string, _input: PublicApplicationManualInput): Observable<void> {
    return this.simulate(undefined);
  }

  submitPublicApplicationResumeText(
    _campaignId: string,
    _name: string,
    _email: string,
    _resumeText: string,
    _consent: boolean,
    _honeypot?: string,
  ): Observable<void> {
    return this.simulate(undefined);
  }

  submitPublicApplicationResumeFile(
    _campaignId: string,
    _name: string,
    _email: string,
    _file: File,
    _consent: boolean,
    _honeypot?: string,
  ): Observable<void> {
    return this.simulate(undefined);
  }

  getCandidates(campaignId: string, phase?: PhaseKey): Observable<Candidate[]> {
    const all = MOCK_CANDIDATES_BY_CAMPAIGN[campaignId] ?? [];
    return this.simulate(phase ? all.filter((c) => c.phase === phase) : all);
  }

  getCandidateProfile(candidateId: string): Observable<CandidateProfileData | undefined> {
    return this.simulate(MOCK_CANDIDATE_PROFILES[candidateId]);
  }

  assessCandidate(candidateId: string): Observable<CandidateAssessment> {
    const existing = MOCK_CANDIDATE_PROFILES[candidateId]?.ai;
    return this.simulate(
      existing ?? {
        matchPct: 72,
        matchLabel: 'Bom match',
        matchNote: 'Análise simulada (modo mock)',
        strengths: ['Perfil alinhado à vaga'],
        concerns: ['Dados simulados — sem análise real'],
        justification: 'Resposta de exemplo do modo mock; a análise real vem do backend.',
        confidence: 'media',
        stageInsight: '',
        missingInformation: [],
        comparisonFlag: '',
      },
    );
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

  /** O mock IGNORA o período: MOCK_CAMPAIGNS guarda contagem por fase, não candidatos com data,
   * então não há como recortar sem inventar dado. Trocar o período aqui devolve sempre o mesmo
   * número — o recorte de verdade só existe contra o backend. */
  getFunnelSummary(_range?: ReportRange): Observable<Phase[]> {
    const keys: PhaseKey[] = ['recebidos', 'fit', 'tecnica', 'entrevista', 'selecionados'];
    const summary: Phase[] = keys.map((key, i) => ({
      key,
      num: i + 1,
      label: PHASE_LABELS[key],
      count: MOCK_CAMPAIGNS.reduce((sum, c) => sum + (c.phases.find((p) => p.key === key)?.count ?? 0), 0),
    }));
    return this.simulate(summary);
  }

  getCampaignPerformance(_range?: ReportRange): Observable<CampaignPerformance[]> {
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

  // Mesma regra de LGPD do backend real (ver eligibleConsentStatesSQL em campaign/repository.go):
  // só consentido/notificado viram candidato ativo — nao_notificado precisa de primeiro contato
  // antes, oposicao_exclusao nunca entra.
  addTalentsToCampaign(campaignId: string, talentIds: string[]): Observable<AddTalentsResult> {
    const added: string[] = [];
    const skipped: AddTalentsResult['skipped'] = [];
    const list = (MOCK_CANDIDATES_BY_CAMPAIGN[campaignId] ??= []);

    for (const id of talentIds) {
      const talent = this.talents.find((t) => t.id === id);
      if (!talent) {
        skipped.push({ talentId: id, name: '', reason: 'não encontrado no banco desta empresa' });
        continue;
      }
      if (talent.consentState === 'oposicao_exclusao') {
        skipped.push({ talentId: id, name: talent.name, reason: 'esta pessoa pediu exclusão dos dados — nunca pode virar candidata' });
        continue;
      }
      if (talent.consentState === 'nao_notificado') {
        skipped.push({
          talentId: id,
          name: talent.name,
          reason: 'ainda não foi notificado(a) sobre o tratamento dos dados — marque "primeiro contato" antes de adicionar',
        });
        continue;
      }
      list.push({
        id: `mock-candidate-${talent.id}`,
        campaignId,
        phase: 'recebidos',
        name: talent.name,
        email: '',
        experience: talent.seniority,
        location: talent.location,
        matchPct: null,
        yearsExperience: talent.yearsExperience,
        status: 'Triagem IA',
        initials: talent.initials,
        avatarColorIndex: talent.avatarColorIndex,
        talentId: talent.id,
      });
      added.push(id);
    }
    return this.simulate({ added, skipped });
  }

  getReverseMatchForNewCampaign(criteria: { title: string; modality?: string; seniority?: string; requirements?: string }): Observable<TalentMatch[]> {
    // O motor client-side (talent-matching.ts) ainda só lê título/modalidade/senioridade — ler
    // requisitos também é uma melhoria só do backend real por ora (ver reversematch.go).
    return this.simulate(reverseMatchForCriteria(criteria, this.talents));
  }

  // Etapa 2 do match reverso: no backend real chama a IA (Groq), com orçamento/cache; aqui é só
  // uma resposta canônica "modo mock", mesmo espírito de assessCandidate() acima — o matchPct
  // reaproveita o score determinístico já calculado, o resto é texto de exemplo.
  assessTalentsForCampaign(campaignId: string, talentIds: string[]): Observable<TalentRecommendation[]> {
    const byId = new Map(this.talents.map((t) => [t.id, t]));
    const recommendations: TalentRecommendation[] = talentIds
      .map((id) => byId.get(id))
      .filter((t): t is Talent => !!t)
      .map((talent) => ({
        talent,
        assessment: {
          matchPct: 72,
          matchLabel: 'Bom match',
          matchNote: 'Análise simulada (modo mock)',
          strengths: ['Perfil alinhado à vaga'],
          concerns: ['Dados simulados — sem análise real'],
          justification: 'Resposta de exemplo do modo mock; a leitura real vem do backend.',
          confidence: 'media',
          missingInformation: [],
        },
      }));
    return this.simulate(recommendations);
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
