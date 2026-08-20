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
}

export interface ExperienceEntry {
  role: string;
  company: string;
  period: string;
  description: string;
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
