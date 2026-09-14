export type PhaseKey = 'recebidos' | 'fit' | 'tecnica' | 'entrevista' | 'selecionados';

export const PHASE_LABELS: Record<PhaseKey, string> = {
  recebidos: 'Recebidos',
  fit: 'Fit Cultural',
  tecnica: 'Triagem Técnica',
  entrevista: 'Entrevista Estruturada',
  selecionados: 'Selecionados',
};

export interface Phase {
  key: PhaseKey;
  num: number;
  label: string;
  count: number;
}

export type CampaignStatus = 'ativa' | 'pausada' | 'encerrada';
export type CampaignModality = 'remoto' | 'hibrido' | 'presencial';
export type CampaignContractType = 'clt' | 'pj' | 'estagio';
export type CampaignSeniority = 'junior' | 'pleno' | 'senior';

/** Labels pt-BR pros enums acima — espelha `modalityLabels`/`contractTypeLabels`/`seniorityLabels`
 * de `clearhire-server/internal/domain/campaign/dto.go`, mesmo texto dos dois lados. */
export const CAMPAIGN_MODALITY_LABELS: Record<CampaignModality, string> = {
  remoto: 'Remoto',
  hibrido: 'Híbrido',
  presencial: 'Presencial',
};

export const CAMPAIGN_CONTRACT_TYPE_LABELS: Record<CampaignContractType, string> = {
  clt: 'CLT',
  pj: 'PJ',
  estagio: 'Estágio',
};

export const CAMPAIGN_SENIORITY_LABELS: Record<CampaignSeniority, string> = {
  junior: 'Júnior',
  pleno: 'Pleno',
  senior: 'Sênior',
};

export interface Campaign {
  id: string;
  title: string;
  status: CampaignStatus;
  location: string;
  meta: string;
  totalCandidates: number;
  currentPhaseLabel: string;
  currentPhaseKey: PhaseKey;
  funnelPercent: number;
  phases: Phase[];
  /** Se o link público de candidatura desta campanha está ligado — independente de status: pausar/
   * encerrar a campanha já derruba o link, mas o recrutador também pode ligar/desligar só o link
   * sem mexer no status da campanha. */
  acceptsPublicApplications: boolean;
}

/** Payload de `POST /campaigns` — tela Nova Campanha. `phaseKeys` são só os módulos OPCIONAIS
 * escolhidos (fit/tecnica/entrevista), na ordem montada no step 3 — Recebidos e Selecionados são
 * sempre implícitos, o backend quem monta a lista completa (ver `buildPhases` no service Go). */
export interface CreateCampaignInput {
  title: string;
  city: string;
  state: string;
  modality: CampaignModality;
  contractType: CampaignContractType;
  seniority: CampaignSeniority;
  phaseKeys: Array<'fit' | 'tecnica' | 'entrevista'>;
}

export interface Candidate {
  id: string;
  campaignId: string;
  phase: PhaseKey;
  name: string;
  email: string;
  experience: string;
  location: string;
  matchPct: number | null;
  status: string;
  initials: string;
  avatarColorIndex: 0 | 1 | 2;
  /** Set once this application produced (or is linked to) a bank entry — see Banco de Talentos. */
  talentId?: string;
  /** Set when `status` is 'Reprovada' — the structured reason chosen at rejection time. */
  rejectionReasonKey?: RejectionReasonKey;
}

export interface ExperienceEntry {
  role: string;
  company: string;
  period: string;
  description: string;
}

/**
 * Talento vs. Candidatura: um Talento é a pessoa, existe independente de vaga e atravessa
 * campanhas; uma Candidatura (`Candidate` acima) é a participação dele numa campanha específica.
 * Por isso `Talent` nunca guarda match/score — o match só faz sentido contra os critérios de
 * UMA vaga por vez e é sempre recalculado (ver `TalentMatch`).
 */
export type ConsentState = 'consentido' | 'nao_notificado' | 'notificado' | 'oposicao_exclusao';
export type LegalBasis = 'consentimento' | 'legitimo_interesse' | 'a_avaliar';
export type TalentOrigin = 'reprovacao_qualificada' | 'cadastro_manual' | 'importacao';

export const CONSENT_STATE_LABELS: Record<ConsentState, string> = {
  consentido: 'Consentido',
  nao_notificado: 'Não notificado',
  notificado: 'Notificado',
  oposicao_exclusao: 'Exclusão solicitada',
};

export type RejectionReasonKey =
  | 'perdeu_outro_candidato'
  | 'senioridade_acima'
  | 'faltou_skill'
  | 'pretensao_acima_budget'
  | 'timing_indisponibilidade'
  | 'reprovacao_tecnica'
  | 'fit_cultural_incompativel';

export interface RejectionReasonInfo {
  key: RejectionReasonKey;
  label: string;
  goesToBank: boolean;
  effectLabel: string;
}

/** Fonte única de verdade para o motivo de reprovação — usada pelo modal de reprovação e por qualquer
 * lugar que precise explicar por que um talento está (ou não) no banco. Espelha a Tabela 1 do documento. */
export const REJECTION_REASONS: RejectionReasonInfo[] = [
  {
    key: 'perdeu_outro_candidato',
    label: 'Perdeu para outro candidato',
    goesToBank: true,
    effectLabel: 'Perfil de maior valor do banco. Passou por todo o funil e foi aprovado tecnicamente.',
  },
  {
    key: 'senioridade_acima',
    label: 'Senioridade acima da vaga',
    goesToBank: true,
    effectLabel: 'Sinaliza para vagas de senioridade superior.',
  },
  {
    key: 'faltou_skill',
    label: 'Faltou skill específica',
    goesToBank: true,
    effectLabel: 'Registrar qual skill faltou. Revisitar em ~12 meses.',
  },
  {
    key: 'pretensao_acima_budget',
    label: 'Pretensão acima do budget',
    goesToBank: true,
    effectLabel: 'Registrar faixa. Pode caber em vaga com budget maior.',
  },
  {
    key: 'timing_indisponibilidade',
    label: 'Timing / indisponibilidade',
    goesToBank: true,
    effectLabel: 'Registrar quando volta a estar disponível.',
  },
  {
    key: 'reprovacao_tecnica',
    label: 'Reprovação técnica de fundo',
    goesToBank: false,
    effectLabel: 'Não reaproveitar. Poluiria o banco.',
  },
  {
    key: 'fit_cultural_incompativel',
    label: 'Fit cultural incompatível',
    goesToBank: false,
    effectLabel: 'Não reaproveitar.',
  },
];

export interface TalentSkill {
  term: string;
  level?: string;
  yearsExperience?: number;
}

export interface TalentHistoryEntry {
  campaignId: string;
  campaignTitle: string;
  reachedPhaseLabel: string;
  outcomeLabel: string;
  rejectionReasonKey?: RejectionReasonKey;
}

export interface Talent {
  id: string;
  name: string;
  initials: string;
  avatarColorIndex: 0 | 1 | 2;
  location: string;
  modality: string;
  seniority: string;
  yearsExperience: number;
  sectors: string[];
  skills: TalentSkill[];
  languages: string[];
  salaryRangeLabel: string;
  availabilityLabel: string;
  origin: TalentOrigin;
  legalBasis: LegalBasis;
  consentState: ConsentState;
  consentDateLabel?: string;
  /** ISO date da última atualização real do registro — base para o selo de atualização (ver `talent-view.ts`). Nunca exibir direto; sempre formatar como label relativo. */
  updatedAt: string;
  summary: string;
  experience: ExperienceEntry[];
  education: { degree: string; institution: string; period: string };
  recruiterNotes?: string;
  history: TalentHistoryEntry[];
}

export interface ScoreBreakdownLine {
  label: string;
  detail: string;
  delta: number;
}

/** Resultado transiente de busca/similaridade/match reverso — nunca persistido no Talento (invariante do documento). */
export interface TalentMatch {
  talent: Talent;
  matchPct: number;
  breakdown: ScoreBreakdownLine[];
}

export interface CoverageEntry {
  skillTerm: string;
  count: number;
}

export interface ManualTalentInput {
  name: string;
  rawProfileText: string;
  contextNote: string;
}

export interface CandidateProfileData {
  candidateId: string;
  name: string;
  initials: string;
  location: string;
  experienceLabel: string;
  phaseLabel: string;
  accent: 'terracota' | 'sand';
  contact: { email: string; phone: string; linkedin: string };
  summary: string;
  experience: ExperienceEntry[];
  education: { degree: string; institution: string; period: string };
  skills: string[];
  ai: {
    matchPct: number;
    matchLabel: string;
    matchNote: string;
    strengths: string[];
    concerns: string[];
    justification: string;
  };
}

/** Vaga vista pelo candidato anônimo, via link público de campanha — só o subconjunto seguro de
 * exibir (ver GET /public/campaigns/:id no backend). Nunca confundir com Campaign, a visão do
 * recrutador (autenticada, com contagens internas). */
export interface PublicCampaignInfo {
  id: string;
  title: string;
  companyName: string;
  location: string;
  modality: string;
  contractType: string;
  seniority: string;
}

export interface PublicApplicationExperienceInput {
  role: string;
  company: string;
  periodLabel: string;
  description: string;
}

/** Payload do modo "preencher manualmente" da candidatura pública — o caminho mais confiável dos
 * dois (não depende de a IA ter lido o currículo certo). consent tem que vir true pra a chamada
 * não ser recusada pelo backend. */
export interface PublicApplicationManualInput {
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  city: string;
  state: string;
  yearsExperience: number | null;
  summary: string;
  educationDegree: string;
  educationInstitution: string;
  educationPeriod: string;
  experience: PublicApplicationExperienceInput[];
  skills: string[];
  consent: boolean;
  /** Campo-armadilha invisível pro usuário real — se vier preenchido, é bot. Vazio em qualquer
   * envio legítimo. */
  honeypot?: string;
}

export interface CompanyProfile {
  name: string;
  values: string[];
  tone: string;
  importance: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/** Sessão devolvida por login/refresh. `accessToken` expira em 15min — só isso trafega em JSON.
 * O refresh token nunca toca o frontend: o backend o entrega como cookie httpOnly (ver
 * `auth.service.ts`), então nem o modelo nem nenhuma chamada de API o expõe aqui. */
export interface AuthSession {
  accessToken: string;
}

/** Payload de `POST /companies` — cadastra a empresa junto com o primeiro RH (`role=owner`). */
export interface RegisterCompanyInput {
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

export interface RegisterCompanyResult {
  id: string;
  name: string;
}

export type UserRole = 'owner' | 'member';

/** Conta de RH autenticada — não confundir com Candidate/Talent, é conceito novo do backend, sem
 * equivalente no protótipo original (ver `GET /users/me`). */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type TeamMemberStatus = 'active' | 'inactive' | 'pending';

/** Linha da tela Equipe (Configurações) — RH ativo/inativo e convite pendente na mesma forma;
 * `name` vem vazio pra um convite ainda não aceito (a pessoa não definiu nome nenhum ainda). */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: TeamMemberStatus;
}

export interface DashboardMetrics {
  activeCampaigns: number;
  activeCampaignsTrendLabel: string;
  /** Série recente (5-6 pontos) para o sparkline — campanhas ativas é uma métrica de evolução no tempo. */
  activeCampaignsTrend: number[];
  candidatesInProcess: number;
  candidatesInProcessContextLabel: string;
  hiresInPeriod: number;
  hiresGoal: number;
  avgFunnelDays: number;
  avgFunnelDaysTrendLabel: string;
  /** Série recente (5-6 pontos) para o sparkline — dias caindo é uma tendência positiva. */
  avgFunnelDaysTrend: number[];
}

export interface AiSuggestion {
  id: string;
  message: string;
  primaryActionLabel: string;
  primaryActionRoute: string[];
  highlighted: boolean;
}

export type ActivityActor = 'ia' | 'recrutador';

export interface ActivityItem {
  id: string;
  actor: ActivityActor;
  message: string;
  campaignId: string;
  campaignTitle: string;
  timestampLabel: string;
}

export interface Notification {
  id: string;
  actor: ActivityActor;
  message: string;
  timestampLabel: string;
  read: boolean;
  route: string[];
}

export interface CampaignPerformance {
  campaignId: string;
  campaignTitle: string;
  status: CampaignStatus;
  totalCandidates: number;
  selectedCount: number;
  conversionPct: number;
  currentPhaseLabel: string;
}

export interface AiTrustMetrics {
  agreementRatePct: number;
  decisionsAnalyzed: number;
  overriddenApprovals: number;
  overriddenRejections: number;
}
