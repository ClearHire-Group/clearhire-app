import { Observable } from 'rxjs';
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
 * Contract every page depends on. Two implementations exist today:
 * `MockApiService` (in-memory data, simulated latency) and `HttpApiService`
 * (real backend, wired but inactive). Swapping which one is injected — see
 * `APP_CONFIG.useMockApi` in app.config.ts — is the only change needed to go live;
 * no page component references mock data or HttpClient directly.
 */
export abstract class DataApi {
  // --- Autenticação ----------------------------------------------------------
  /** Cadastra a empresa + primeiro RH (`role=owner`). Não devolve sessão — o cadastro não loga
   * automaticamente (ver `docs/API.md` do backend); chamar `login()` em seguida. */
  abstract registerCompany(input: RegisterCompanyInput): Observable<RegisterCompanyResult>;
  /** Autentica e devolve o access token (o refresh token vem só como cookie httpOnly, nunca em
   * JSON). Erro genérico tanto pra e-mail inexistente quanto senha incorreta — de propósito, pra
   * não revelar qual e-mail está cadastrado. */
  abstract login(credentials: LoginCredentials): Observable<AuthSession>;
  /** Troca o refresh token (cookie httpOnly, enviado automaticamente pelo browser) por um access
   * token novo — chamado no bootstrap da app e proativamente antes dos 15min de expiração. */
  abstract refresh(): Observable<AuthSession>;
  /** Revoga a sessão no servidor e limpa o cookie de refresh. Melhor esforço — o chamador limpa o
   * estado local independente do resultado desta chamada. */
  abstract logout(): Observable<void>;
  /** Aceita um convite de segundo RH — cria a conta (role=member) e define a senha. Não loga
   * automaticamente (mesmo padrão de `registerCompany`); devolve o e-mail pra pré-preencher o
   * login. */
  abstract acceptInvitation(token: string, input: { name: string; password: string }): Observable<{ email: string }>;
  /** Sempre "funciona" do ponto de vista do chamador, exista ou não o e-mail — nunca revela se
   * uma conta existe. `resetLink` só vem preenchido em desenvolvimento (sem e-mail real ainda). */
  abstract requestPasswordReset(email: string): Observable<{ resetLink?: string }>;
  abstract confirmPasswordReset(token: string, newPassword: string): Observable<void>;

  // --- Conta e equipe ----------------------------------------------------------
  abstract getMyProfile(): Observable<UserProfile>;
  abstract updateMyProfile(name: string): Observable<UserProfile>;
  /** Roster da empresa — RH ativos/inativos e convites pendentes, tela Equipe em Configurações. */
  abstract getTeam(): Observable<TeamMember[]>;
  /** Só o owner pode convidar; `inviteLink` só vem preenchido em desenvolvimento. */
  abstract inviteTeamMember(email: string): Observable<{ inviteLink?: string }>;
  /** Revoga um convite ainda pendente — o link já enviado vira permanentemente inválido (a pessoa
   * não consegue mais aceitar com ele). Só o owner pode cancelar; um convite já aceito, expirado
   * ou já cancelado não pode ser cancelado de novo. */
  abstract cancelInvitation(invitationId: string): Observable<void>;
  /** Gera um convite NOVO pro mesmo e-mail e invalida o antigo — não existe "recuperar" o link
   * original (o servidor nunca guarda o token em texto puro, só o hash, igual senha). `inviteLink`
   * só vem preenchido em desenvolvimento; em produção a pessoa recebe por e-mail de novo. */
  abstract resendInvitation(invitationId: string): Observable<{ inviteLink?: string }>;
  /** Só o owner pode desativar, e nunca a própria conta — a API recusa os dois casos. `password`
   * é a senha do OWNER autenticado (reconfirmação), nunca a do alvo — ação destrutiva sobre outra
   * conta exige provar posse da própria, não só o access token já em mãos. */
  abstract deactivateTeamMember(userId: string, password: string): Observable<void>;

  abstract getCampaigns(): Observable<Campaign[]>;
  abstract getCampaign(id: string): Observable<Campaign | undefined>;
  /** Cria a campanha (+ fases do funil) já como 'ativa' — não existe rascunho no backend ainda.
   * Erros de validação (título vazio, enum inválido) propagam como erro pro chamador tratar; não há
   * fallback silencioso aqui, diferente das leituras (`getCampaign` etc.) — uma falha em criar tem
   * que chegar até o usuário. */
  abstract createCampaign(input: CreateCampaignInput): Observable<Campaign>;
  /** Atualiza título/descrição/local/modalidade/contrato/senioridade — seção "Dados da campanha" em
   * Configurações da Campanha. Erros de validação (título vazio etc.) propagam pro chamador tratar. */
  abstract updateCampaign(campaignId: string, input: UpdateCampaignInput): Observable<Campaign | undefined>;
  /** Substitui os módulos OPCIONAIS do funil (fit/tecnica/entrevista) — seção "Fases do funil" em
   * Configurações da Campanha. Recusa (erro 400, propaga pro chamador) remover uma fase que ainda
   * tem candidato nela. */
  abstract updateCampaignPhases(
    campaignId: string,
    phaseKeys: ('fit' | 'tecnica' | 'entrevista')[],
  ): Observable<Campaign | undefined>;
  /** Alterna entre 'ativa' e 'pausada'; não afeta campanhas já encerradas. */
  abstract toggleCampaignPause(campaignId: string): Observable<Campaign | undefined>;
  /** Liga/desliga o link público de candidatura desta campanha — estado desejado explícito, não
   * um toggle cego ("gerar link" e "desativar link" são duas ações distintas na tela). */
  abstract setCampaignPublicLink(campaignId: string, enabled: boolean): Observable<Campaign | undefined>;

  // --- Candidatura pública (link de campanha, sem login) -----------------------
  /** Dados da vaga pro candidato anônimo ver antes de se candidatar — undefined se a campanha não
   * existe, não está ativa, ou o link está desligado (o backend nunca diferencia os três casos). */
  abstract getPublicCampaignInfo(campaignId: string): Observable<PublicCampaignInfo | undefined>;
  /** Modo "preencher manualmente" — o mais confiável dos dois, porque não depende do
   * reconhecimento de padrão ter identificado tudo certo. `input.consent` precisa ser true; o
   * backend recusa sem isso. */
  abstract submitPublicApplicationManual(campaignId: string, input: PublicApplicationManualInput): Observable<void>;
  /** Modo "colar currículo" — extração determinística (e-mail, telefone, LinkedIn, skills contra a
   * taxonomia já cadastrada), sem IA nenhuma. `name` é sempre exigido mesmo aqui — não é algo que
   * dá pra reconhecer de forma confiável só com padrão de texto. `honeypot` é o campo-armadilha
   * invisível (ver PublicApplicationManualInput.honeypot) — sempre vazio num envio legítimo. */
  abstract submitPublicApplicationResumeText(
    campaignId: string,
    name: string,
    email: string,
    resumeText: string,
    consent: boolean,
    honeypot?: string,
  ): Observable<void>;
  /** Modo "enviar PDF" — o texto é extraído do PDF e passa pela mesma extração determinística do
   * modo texto colado (nunca fica salvo o arquivo em si, só o texto/dado extraído). */
  abstract submitPublicApplicationResumeFile(
    campaignId: string,
    name: string,
    email: string,
    file: File,
    consent: boolean,
    honeypot?: string,
  ): Observable<void>;
  abstract getCandidates(campaignId: string, phase?: PhaseKey): Observable<Candidate[]>;
  abstract getCandidateProfile(candidateId: string): Observable<CandidateProfileData | undefined>;
  /** Pede a análise da IA para o candidato na fase atual. Idempotente no servidor: se já existe
   * uma para esta fase, devolve a existente sem gerar custo. Erra (HttpErrorResponse) quando a IA
   * não está habilitada, o teto de gasto foi atingido ou o provedor está indisponível. */
  abstract assessCandidate(candidateId: string): Observable<CandidateAssessment>;
  /** Move o candidato para a próxima fase do funil; no-op se já estiver em "Selecionados". */
  abstract advanceCandidate(candidateId: string): Observable<Candidate | undefined>;
  abstract getCompanyProfile(): Observable<CompanyProfile>;
  /** Substitui tone/importance/values por inteiro — não é merge; mandar `values` sem um item
   * existente remove esse item. Perfil único por empresa, sem override por campanha. */
  abstract updateCompanyProfile(update: Pick<CompanyProfile, 'tone' | 'importance' | 'values'>): Observable<CompanyProfile>;
  abstract getDashboardMetrics(): Observable<DashboardMetrics>;
  abstract getAiSuggestions(): Observable<AiSuggestion[]>;
  /** Feed da empresa inteira, mais recente primeiro. O servidor limita a janela (ver
   *  `activity.DefaultLimit` no backend) — é histórico recente, não paginação completa. */
  abstract getActivityFeed(): Observable<ActivityItem[]>;

  /** Sino de notificações da top-bar, visível em toda a aplicação. */
  abstract getNotifications(): Observable<Notification[]>;
  abstract markNotificationRead(id: string): Observable<Notification | undefined>;

  /** Aggregate candidate count per funnel phase, across every campaign.
   * `range` recorta por data da candidatura; ausente/vazio = todo o período (ver report-period.ts). */
  abstract getFunnelSummary(range?: ReportRange): Observable<Phase[]>;
  /** One row per campaign: totals, conversion rate, current phase — powers the Relatórios comparison table. */
  abstract getCampaignPerformance(range?: ReportRange): Observable<CampaignPerformance[]>;

  // --- Banco de Talentos ---------------------------------------------------
  /** Full talent roster, no score attached — default view of the bank with no search active. */
  abstract getTalents(): Observable<Talent[]>;
  abstract getTalent(id: string): Observable<Talent | undefined>;
  /** Natural-language query translated to structured filters, then filtered + ranked deterministically. */
  abstract searchTalents(query: string): Observable<TalentMatch[]>;
  abstract findSimilarTalents(talentId: string): Observable<TalentMatch[]>;
  /** Aggregate skill coverage across the bank — powers the "Mapa de Cobertura" view. */
  abstract getTalentPoolCoverage(): Observable<CoverageEntry[]>;
  /** Manual entry outside any campaign (recruiter found someone via LinkedIn, an event, a referral). */
  abstract registerManualTalent(input: ManualTalentInput): Observable<Talent>;
  /**
   * Structured rejection: only reasons with `goesToBank` create/update a Talent record.
   * `sendBankInvite` is only meaningful when the reason goes to the bank.
   */
  abstract submitCandidateRejection(
    candidateId: string,
    reasonKey: RejectionReasonKey,
    sendBankInvite: boolean,
  ): Observable<{ talent?: Talent }>;
  /** Primeiro contato real com um talento de origem manual: dispara o aviso de tratamento e promove nao_notificado -> notificado (seção 5.2). */
  abstract markTalentFirstContact(talentId: string): Observable<Talent | undefined>;
  /**
   * Puxa talentos do banco pro funil (fase Recebidos) de uma campanha JÁ CRIADA — a ação que
   * faltava depois de "ver talentos sugeridos"/"pedir leitura da IA" na Visão Geral da campanha.
   * Talento com exclusão solicitada, ou ainda não notificado sobre o tratamento dos dados, não é
   * adicionado — volta em `skipped`, nunca falha silenciosamente (ver AddTalentsResult).
   */
  abstract addTalentsToCampaign(campaignId: string, talentIds: string[]): Observable<AddTalentsResult>;
  /**
   * "Match reverso": talents from the bank that fit a campaign still being drafted
   * (título/modalidade/senioridade do step 1). `requirements` é opcional mas importante: título
   * sozinho raramente nomeia skill ("Engenheiro de dados" não menciona nem "Python" nem "SQL"),
   * requisitos costuma nomear — ver MatchCriteria no backend (talent/reversematch.go).
   */
  abstract getReverseMatchForNewCampaign(criteria: {
    title: string;
    modality?: string;
    seniority?: string;
    requirements?: string;
  }): Observable<TalentMatch[]>;
  /**
   * Etapa 2 do match reverso: pede à IA uma leitura qualitativa de até 5 talentos já ranqueados
   * pelo match determinístico, contra a vaga de uma campanha JÁ CRIADA (nunca um rascunho — ver
   * documentos/banco-de-talentos-recomendacao-plano.md). Sempre uma ação explícita do recrutador
   * sobre um recorte que ele já escolheu, nunca disparada automaticamente.
   */
  abstract assessTalentsForCampaign(campaignId: string, talentIds: string[]): Observable<TalentRecommendation[]>;

  // --- Sourcing (fase antes de "Recebidos") ---------------------------------------------------
  /** Prospects já adicionados a esta campanha pelas 3 ferramentas de Sourcing — nunca candidatos
   * de verdade, nem talentos do banco, até serem explicitamente cadastrados (ver abaixo). */
  abstract getSourcingProspects(campaignId: string): Observable<SourcingProspect[]>;
  /** Ferramenta 1 — indicação formalizada: um funcionário indica alguém pra vaga. Sem busca, sem
   * IA; cria o prospect direto. */
  abstract addReferralProspect(campaignId: string, input: ReferralProspectInput): Observable<SourcingProspect>;
  /** Ferramenta 2, passo 1 — a IA lê a vaga e monta uma busca contra a API pública da fonte
   * escolhida; devolve perfis pro recrutador revisar. Resultado efêmero, nunca persistido até o
   * recrutador escolher adicionar (próximo método). */
  abstract searchPublicProfiles(campaignId: string, source: PublicProfileSource): Observable<PublicProfileLead[]>;
  /** Ferramenta 2, passo 2 — recebe os leads inteiros (não só ids): são resultado de busca
   * efêmero, não algo já persistido do lado do servidor pra buscar de novo por id. */
  abstract addPublicProfileProspects(campaignId: string, leads: PublicProfileLead[]): Observable<SourcingProspect[]>;
  /** Ferramenta 3 — gerador de busca X-Ray: o recrutador navega no LinkedIn por conta própria (ver
   * `core/xray-search.ts`, que monta a busca sem chamar o backend) e cola aqui quem encontrou. */
  abstract addXRayProspect(campaignId: string, input: XRayProspectInput): Observable<SourcingProspect>;
  /** Ponto de saída das 3 ferramentas: promove um prospect a Talent de verdade via o mesmo cadastro
   * manual que o Banco de Talentos já usa, e marca o prospect como `cadastrado`. */
  abstract registerSourcingProspectAsTalent(
    campaignId: string,
    prospectId: string,
    input: ManualTalentInput,
  ): Observable<{ prospect: SourcingProspect; talent: Talent }>;
}
