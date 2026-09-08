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
export type ProfileDepth = 'alto' | 'medio' | 'baixo';

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
  profileDepth: ProfileDepth;
  profileDepthNote: string;
  freshnessLabel: string;
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

export interface CompanyProfile {
  name: string;
  values: string[];
  tone: string;
  importance: string;
}

export interface DashboardMetrics {
  activeCampaigns: number;
  activeCampaignsTrendLabel: string;
  candidatesInProcess: number;
  candidatesInProcessContextLabel: string;
  hiresInPeriod: number;
  hiresGoalLabel: string;
  avgFunnelDays: number;
  avgFunnelDaysTrendLabel: string;
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
