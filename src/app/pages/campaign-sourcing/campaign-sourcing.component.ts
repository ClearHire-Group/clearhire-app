import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, switchMap } from 'rxjs';
import { CampaignContextService } from '../../core/campaign-context';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { Campaign, ManualTalentInput, PublicProfileLead, PublicProfileSource, SourcingToolKey } from '../../core/models';
import { SourcingProspectView, toProspectViews } from '../../core/sourcing-view';
import { buildXRaySearch, XRaySearchQuery } from '../../core/xray-search';
import { validateName } from '../../core/application-validation';
import { ManualTalentField, validateManualTalentInput } from '../../core/manual-talent-validation';

/**
 * Fase "Sourcing": prospects que o recrutador está buscando ativamente pra esta campanha, que
 * nunca se candidataram. Vive fora do funil real (PhaseKey) — ver documentos/sourcing-fase-funil-
 * plano.md pra decisão de modelagem completa.
 *
 * As 3 ferramentas trocam de painel via `?tool=` (mesmo esquema de `talent-bank.component.ts`'s
 * `view`) em vez de modal — são instrumentos de primeira classe da tela, não popups utilitários.
 * O único modal que resta é "Cadastrar no Banco de Talentos": ação contida sobre UM prospect já
 * existente, mesma categoria do modal de reprovação em candidate-profile.
 */
@Component({
  selector: 'app-campaign-sourcing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './campaign-sourcing.component.html',
  styleUrl: './campaign-sourcing.component.scss',
})
export class CampaignSourcingComponent {
  private ctx = inject(CampaignContextService);
  private api = inject(DataApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly campaignId = this.ctx.campaignId;
  readonly campaignState = this.ctx.campaignState;

  /** Ferramenta ativa — `null` = tela de Prospects (default). Lido da URL, não de estado local:
   * navegável, compartilhável, botão Voltar do navegador funciona (mesmo esquema de `talent-bank`). */
  readonly tool = toSignal(
    this.route.queryParamMap.pipe(
      map((p): SourcingToolKey | null => {
        const t = p.get('tool');
        return t === 'indicacao' || t === 'busca_publica' || t === 'x_ray' ? t : null;
      }),
    ),
    { initialValue: null },
  );

  private refreshTrigger = signal(0);
  readonly prospectsState = toLoadable(
    combineLatest([toObservable(this.campaignId), toObservable(this.refreshTrigger)]).pipe(
      switchMap(([id]) => this.api.getSourcingProspects(id)),
    ),
  );
  readonly prospectViews = computed<SourcingProspectView[]>(() => toProspectViews(this.prospectsState.data() ?? []));
  readonly prospectCountLabel = computed(() => {
    const n = this.prospectViews().length;
    if (!this.prospectsState.data()) return 'Carregando…';
    return n === 0 ? 'Nenhum prospect ainda' : `${n} prospect${n === 1 ? '' : 's'} nesta campanha`;
  });

  private refresh(): void {
    this.refreshTrigger.update((n) => n + 1);
  }

  /** Volta pra Prospects (`?tool=` limpo) — usado ao cancelar, ao terminar, e automaticamente
   * depois de um envio bem-sucedido de Indicação/Busca pública (feedback: "voltou, olha o resultado"). */
  goToProspects(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tool: null }, queryParamsHandling: 'merge' });
  }

  xrayQueryFor(campaign: Campaign): XRaySearchQuery {
    return buildXRaySearch(campaign);
  }

  constructor() {
    // Cada painel reseta o próprio formulário ao ser aberto (navegação pra ?tool=X) — mesmo padrão
    // de effect+untracked já usado em talent-bank.component.ts pro parâmetro ?similarTo=.
    effect(() => {
      if (this.tool() === 'indicacao') untracked(() => this.resetReferralForm());
    });
    effect(() => {
      if (this.tool() === 'busca_publica') untracked(() => this.resetPublicSearch());
    });
    effect(() => {
      if (this.tool() === 'x_ray') untracked(() => this.resetXRayForm());
    });
  }

  // --- Cadastrar no Banco de Talentos (compartilhado pelas 3 ferramentas, continua modal) ----

  readonly registerModalOpen = signal(false);
  readonly registerProspect = signal<SourcingProspectView | null>(null);
  readonly registerName = signal('');
  readonly registerRawText = signal('');
  readonly registerNote = signal('');
  readonly registerSaving = signal(false);
  readonly registerFormError = signal('');
  private readonly registerTouched = signal<ReadonlySet<ManualTalentField>>(new Set());
  private readonly registerSubmitAttempted = signal(false);

  private readonly registerErrors = computed<Partial<Record<ManualTalentField, string>>>(() =>
    validateManualTalentInput(this.registerName(), this.registerRawText(), this.registerNote()),
  );

  openRegisterModal(prospect: SourcingProspectView): void {
    this.registerModalOpen.set(true);
    this.registerProspect.set(prospect);
    this.registerName.set(prospect.name);
    this.registerRawText.set(prospect.notes);
    this.registerNote.set(`Origem: Sourcing — ${prospect.toolLabel} — ${prospect.sourceLabel}.`);
    this.registerFormError.set('');
    this.registerTouched.set(new Set());
    this.registerSubmitAttempted.set(false);
  }

  closeRegisterModal(): void {
    if (this.registerSaving()) return;
    this.registerModalOpen.set(false);
    this.registerProspect.set(null);
  }

  registerErr(field: ManualTalentField): string {
    const client = this.registerErrors()[field];
    return client && (this.registerSubmitAttempted() || this.registerTouched().has(field)) ? client : '';
  }

  setRegister(target: { set(v: string): void }, value: string): void {
    target.set(value);
    this.registerFormError.set('');
  }

  touchRegister(field: ManualTalentField): void {
    this.registerTouched.update((s) => new Set(s).add(field));
  }

  confirmRegister(): void {
    const prospect = this.registerProspect();
    const campaignId = this.campaignId();
    if (!prospect || !campaignId || this.registerSaving()) return;
    this.registerSubmitAttempted.set(true);
    const invalid = Object.keys(this.registerErrors()).length;
    if (invalid > 0) {
      this.registerFormError.set(invalid === 1 ? 'Revise o campo destacado.' : `Revise os ${invalid} campos destacados.`);
      return;
    }
    const input: ManualTalentInput = {
      name: validateName(this.registerName()).value,
      rawProfileText: this.registerRawText().trim(),
      contextNote: this.registerNote().trim(),
      origin: prospect.tool === 'indicacao' ? 'indicacao' : undefined,
      referredBy: prospect.tool === 'indicacao' ? prospect.referrerName : undefined,
    };
    this.registerSaving.set(true);
    this.api.registerSourcingProspectAsTalent(campaignId, prospect.id, input).subscribe({
      next: () => {
        this.registerSaving.set(false);
        this.registerModalOpen.set(false);
        this.registerProspect.set(null);
        this.refresh();
      },
      error: (err: unknown) => {
        this.registerSaving.set(false);
        this.registerFormError.set(err instanceof Error ? err.message : 'Não foi possível cadastrar o talento agora. Tente novamente.');
      },
    });
  }

  // --- Ferramenta 1: Indicação -----------------------------------------------------------------

  readonly referralName = signal('');
  readonly referralContact = signal('');
  readonly referralReferrerName = signal('');
  readonly referralNote = signal('');
  readonly referralSaving = signal(false);
  readonly referralError = signal('');

  readonly canSubmitReferral = computed(
    () => !this.referralSaving() && validateName(this.referralName()).error === '' && this.referralReferrerName().trim().length > 0,
  );

  private resetReferralForm(): void {
    this.referralName.set('');
    this.referralContact.set('');
    this.referralReferrerName.set('');
    this.referralNote.set('');
    this.referralError.set('');
  }

  submitReferral(): void {
    const campaignId = this.campaignId();
    if (!campaignId || !this.canSubmitReferral()) return;
    this.referralSaving.set(true);
    this.referralError.set('');
    this.api
      .addReferralProspect(campaignId, {
        name: validateName(this.referralName()).value,
        contact: this.referralContact().trim(),
        referrerName: this.referralReferrerName().trim(),
        note: this.referralNote().trim(),
      })
      .subscribe({
        next: () => {
          this.referralSaving.set(false);
          this.refresh();
          this.goToProspects();
        },
        error: () => {
          this.referralSaving.set(false);
          this.referralError.set('Não foi possível adicionar a indicação agora. Tente novamente.');
        },
      });
  }

  // --- Ferramenta 2: Busca em fontes públicas ----------------------------------------------------

  readonly publicSearchSource = signal<PublicProfileSource>('github');
  readonly publicSearchLoading = signal(false);
  readonly publicSearchResults = signal<PublicProfileLead[] | null>(null);
  readonly publicSearchSelectedIds = signal<ReadonlySet<string>>(new Set());
  readonly publicSearchAdding = signal(false);
  readonly publicSearchError = signal('');

  private resetPublicSearch(): void {
    this.publicSearchSource.set('github');
    this.publicSearchResults.set(null);
    this.publicSearchSelectedIds.set(new Set());
    this.publicSearchError.set('');
  }

  setPublicSearchSource(source: PublicProfileSource): void {
    if (this.publicSearchLoading()) return;
    this.publicSearchSource.set(source);
    this.publicSearchResults.set(null);
    this.publicSearchSelectedIds.set(new Set());
  }

  runPublicSearch(): void {
    const campaignId = this.campaignId();
    if (!campaignId || this.publicSearchLoading()) return;
    this.publicSearchLoading.set(true);
    this.publicSearchResults.set(null);
    this.publicSearchSelectedIds.set(new Set());
    this.publicSearchError.set('');
    this.api.searchPublicProfiles(campaignId, this.publicSearchSource()).subscribe({
      next: (leads) => {
        this.publicSearchLoading.set(false);
        this.publicSearchResults.set(leads);
      },
      error: () => {
        this.publicSearchLoading.set(false);
        this.publicSearchError.set('Não foi possível buscar perfis agora. Tente novamente.');
      },
    });
  }

  toggleLeadSelection(id: string): void {
    const next = new Set(this.publicSearchSelectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.publicSearchSelectedIds.set(next);
  }

  isLeadSelected(id: string): boolean {
    return this.publicSearchSelectedIds().has(id);
  }

  addSelectedLeads(): void {
    const campaignId = this.campaignId();
    const results = this.publicSearchResults();
    const ids = this.publicSearchSelectedIds();
    if (!campaignId || !results || ids.size === 0 || this.publicSearchAdding()) return;
    const leads = results.filter((l) => ids.has(l.id));
    this.publicSearchAdding.set(true);
    this.publicSearchError.set('');
    this.api.addPublicProfileProspects(campaignId, leads).subscribe({
      next: () => {
        this.publicSearchAdding.set(false);
        this.refresh();
        this.goToProspects();
      },
      error: () => {
        this.publicSearchAdding.set(false);
        this.publicSearchError.set('Não foi possível adicionar os selecionados agora. Tente novamente.');
      },
    });
  }

  // --- Ferramenta 3: Gerador de busca X-Ray ------------------------------------------------------

  readonly xrayName = signal('');
  readonly xrayProfileUrl = signal('');
  readonly xrayNote = signal('');
  readonly xraySaving = signal(false);
  readonly xrayError = signal('');
  /** Nome de quem acabou de ser adicionado — confirmação inline; o painel fica aberto de propósito,
   * pra adicionar vários achados na mesma sessão de busca (por isso não navega de volta sozinho). */
  readonly xrayJustAdded = signal('');

  readonly canSubmitXRay = computed(() => !this.xraySaving() && validateName(this.xrayName()).error === '');

  private resetXRayForm(): void {
    this.xrayName.set('');
    this.xrayProfileUrl.set('');
    this.xrayNote.set('');
    this.xrayError.set('');
    this.xrayJustAdded.set('');
  }

  submitXRayProspect(): void {
    const campaignId = this.campaignId();
    if (!campaignId || !this.canSubmitXRay()) return;
    this.xraySaving.set(true);
    this.xrayError.set('');
    const name = validateName(this.xrayName()).value;
    this.api
      .addXRayProspect(campaignId, {
        name,
        profileUrl: this.xrayProfileUrl().trim(),
        note: this.xrayNote().trim(),
      })
      .subscribe({
        next: () => {
          this.xraySaving.set(false);
          this.xrayJustAdded.set(name);
          this.xrayName.set('');
          this.xrayProfileUrl.set('');
          this.xrayNote.set('');
          this.refresh();
        },
        error: () => {
          this.xraySaving.set(false);
          this.xrayError.set('Não foi possível adicionar agora. Tente novamente.');
        },
      });
  }
}
