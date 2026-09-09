import { Observable } from 'rxjs';
import {
  ActivityItem,
  AiSuggestion,
  AiTrustMetrics,
  Campaign,
  CampaignPerformance,
  Candidate,
  CandidateProfileData,
  CompanyProfile,
  CoverageEntry,
  DashboardMetrics,
  ManualTalentInput,
  Notification,
  Phase,
  PhaseKey,
  RejectionReasonKey,
  Talent,
  TalentMatch,
} from './models';

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
  abstract getCandidateProfile(candidateId: string): Observable<CandidateProfileData | undefined>;
  abstract getCompanyProfile(): Observable<CompanyProfile>;
  abstract getDashboardMetrics(): Observable<DashboardMetrics>;
  abstract getAiSuggestions(): Observable<AiSuggestion[]>;
  abstract getActivityFeed(): Observable<ActivityItem[]>;

  /** Sino de notificações da top-bar, visível em toda a aplicação. */
  abstract getNotifications(): Observable<Notification[]>;
  abstract markNotificationRead(id: string): Observable<Notification | undefined>;

  /** Aggregate candidate count per funnel phase, across every campaign. */
  abstract getFunnelSummary(): Observable<Phase[]>;
  /** One row per campaign: totals, conversion rate, current phase — powers the Relatórios comparison table. */
  abstract getCampaignPerformance(): Observable<CampaignPerformance[]>;
  abstract getAiTrustMetrics(): Observable<AiTrustMetrics>;

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
  /** "Match reverso": talents from the bank that fit a campaign still being drafted (título/modalidade/senioridade do step 1). */
  abstract getReverseMatchForNewCampaign(criteria: {
    title: string;
    modality?: string;
    seniority?: string;
  }): Observable<TalentMatch[]>;
}
