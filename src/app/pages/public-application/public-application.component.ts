import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Observable, map, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { ErrorStateComponent } from '../../layout/error-state/error-state.component';
import {
  ApplicationField,
  ApplicationMode,
  BRAZILIAN_STATES,
  FieldErrors,
  LIMITS,
  ResumeSubMode,
  charCount,
  emailDomainWarning,
  splitSkills,
  validateApplicationForm,
  validateCity,
  validateEmail,
  validateLinkedIn,
  validateName,
  validatePdfFile,
  validatePhone,
  validateSkills,
} from '../../core/application-validation';

import { parseJobItems } from '../../core/job-description';
import { JobDescriptionComponent } from '../../shared/job-description/job-description.component';

type PageTab = 'vaga' | 'candidatura';

/** id do elemento de cada campo no template — usado para focar o primeiro campo com erro. */
const FIELD_IDS: Record<ApplicationField, string> = {
  name: 'f-name',
  email: 'f-email',
  phone: 'f-phone',
  linkedinUrl: 'f-linkedin',
  city: 'f-city',
  state: 'f-state',
  yearsExperience: 'f-years',
  summary: 'f-summary',
  educationDegree: 'f-degree',
  educationInstitution: 'f-institution',
  educationPeriod: 'f-period',
  skills: 'f-skills',
  resumeText: 'f-resume-text',
  file: 'f-file',
  consent: 'f-consent',
};

/** Ordem em que os campos aparecem na tela (a de FIELD_IDS), para focar o PRIMEIRO com erro. */
const FIELD_ORDER = Object.keys(FIELD_IDS) as ApplicationField[];

/** Campos comuns aos dois modos: os únicos cujo erro do servidor sobrevive à troca de modo. */
const COMMON_FIELDS: ReadonlySet<ApplicationField> = new Set(['name', 'email', 'consent']);

/**
 * Página pública (sem login) de candidatura a uma campanha — acessada via link gerado na tela de
 * detalhe da campanha (`/vagas/:campaignId`). Não usa AuthShellComponent: aquele shell é um pitch
 * comercial pro recrutador ("Recrutamento com clareza..."), errado pro contexto de alguém se
 * candidatando a uma vaga específica.
 *
 * Validação: as regras vivem em core/application-validation.ts (espelhadas no backend). O erro de
 * um campo aparece embaixo dele depois que a pessoa sai do campo ou tenta enviar — nunca enquanto
 * ainda está digitando pela primeira vez. Erros que só o servidor conhece (e-mail já usado nesta
 * vaga, PDF com páginas demais) voltam em `fields` e aparecem no mesmo lugar.
 */
@Component({
  selector: 'app-public-application',
  standalone: true,
  imports: [CommonModule, ErrorStateComponent, JobDescriptionComponent],
  templateUrl: './public-application.component.html',
  styleUrl: './public-application.component.scss',
})
export class PublicApplicationComponent {
  private route = inject(ActivatedRoute);
  private api = inject(DataApi);

  private campaignId$ = this.route.paramMap.pipe(map((p) => p.get('campaignId') ?? ''));
  readonly campaignId = toSignal(this.campaignId$, { initialValue: '' });

  readonly campaignState = toLoadable(this.campaignId$.pipe(switchMap((id) => this.api.getPublicCampaignInfo(id))));

  readonly jobItems = computed(() => {
    const job = this.campaignState.data();
    return {
      responsibilities: parseJobItems(job?.responsibilities ?? ''),
      requirements: parseJobItems(job?.requirements ?? ''),
      benefits: parseJobItems(job?.benefits ?? ''),
    };
  });

  readonly states = BRAZILIAN_STATES;
  readonly limits = LIMITS;

  /** Abre na descrição da vaga: quem chega pelo link precisa saber do que se trata antes de decidir
   * se preenche o formulário. */
  readonly activeTab = signal<PageTab>('vaga');

  readonly mode = signal<ApplicationMode>('manual');
  readonly resumeSubMode = signal<ResumeSubMode>('text');

  // Nome e e-mail são os mesmos nos dois modos: trocar de modo não apaga o que já foi digitado.
  readonly name = signal('');
  readonly email = signal('');
  // --- Modo manual -------------------------------------------------------------
  readonly phone = signal('');
  readonly linkedinUrl = signal('');
  readonly city = signal('');
  readonly state = signal('');
  /** Texto cru do input: validar "4,5" ou "-1" exige ver o que foi digitado, não um número já convertido. */
  readonly yearsExperience = signal('');
  readonly summary = signal('');
  readonly educationDegree = signal('');
  readonly educationInstitution = signal('');
  readonly educationPeriod = signal('');
  readonly skillsText = signal('');
  // --- Modo currículo ----------------------------------------------------------
  readonly resumeText = signal('');
  readonly resumeFile = signal<File | null>(null);
  readonly fileError = signal('');
  readonly fileChecking = signal(false);

  readonly consent = signal(false);
  readonly honeypot = signal('');

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  /** Mensagem geral, perto do botão de envio. */
  readonly formError = signal('');

  /** Campos que a pessoa já visitou e deixou: só neles o erro aparece antes da tentativa de envio. */
  private readonly touched = signal<ReadonlySet<ApplicationField>>(new Set());
  private readonly submitAttempted = signal(false);
  /** Erros que só o servidor conhece. Somem assim que a pessoa edita o campo correspondente. */
  private readonly serverErrors = signal<FieldErrors>({});

  private readonly validation = computed(() => {
    const result = validateApplicationForm({
      mode: this.mode(),
      resumeSubMode: this.resumeSubMode(),
      name: this.name(),
      email: this.email(),
      phone: this.phone(),
      linkedinUrl: this.linkedinUrl(),
      city: this.city(),
      state: this.state(),
      yearsExperience: this.yearsExperience(),
      summary: this.summary(),
      educationDegree: this.educationDegree(),
      educationInstitution: this.educationInstitution(),
      educationPeriod: this.educationPeriod(),
      skillsText: this.skillsText(),
      resumeText: this.resumeText(),
      hasFile: this.resumeFile() !== null,
      consent: this.consent(),
    });
    // O conteúdo do PDF é conferido de forma assíncrona (onFileSelected); entra como erro do campo.
    if (this.mode() === 'resume' && this.resumeSubMode() === 'file' && !result.errors.file && this.fileError()) {
      result.errors.file = this.fileError();
    }
    return result;
  });

  readonly summaryCount = computed(() => charCount(this.summary().trim()));
  readonly resumeTextCount = computed(() => charCount(this.resumeText().trim()));
  /** Prévia do que vai ser registrado em skills (limpa e sem repetição) — a pessoa vê como o texto foi entendido. */
  readonly parsedSkills = computed(() => validateSkills(splitSkills(this.skillsText())).value);
  readonly emailSuggestion = computed(() => (this.touched().has('email') ? emailDomainWarning(this.email()) : ''));

  /** Mensagem de erro a mostrar no campo, ou ''. */
  err(field: ApplicationField): string {
    const client = this.validation().errors[field];
    const visible = this.submitAttempted() || this.touched().has(field) || (field === 'file' && this.resumeFile() !== null);
    if (client && visible) return client;
    return this.serverErrors()[field] ?? '';
  }

  /** Atualiza um campo. O erro do servidor daquele campo some: a pessoa está corrigindo. */
  set(field: ApplicationField, target: { set(v: string): void }, value: string): void {
    target.set(value);
    this.clearServerError(field);
  }

  /** Saiu do campo: passa a mostrar o erro dele e, se o valor é válido, mostra-o já normalizado. */
  blur(field: ApplicationField): void {
    this.touched.update((s) => new Set(s).add(field));
    const normalizers: Partial<Record<ApplicationField, [{ (): string; set(v: string): void }, (raw: string) => { value: string; error: string }]>> = {
      name: [this.name, validateName],
      email: [this.email, validateEmail],
      phone: [this.phone, validatePhone],
      linkedinUrl: [this.linkedinUrl, validateLinkedIn],
      city: [this.city, validateCity],
    };
    const entry = normalizers[field];
    if (entry) {
      const [target, validate] = entry;
      const checked = validate(target());
      if (!checked.error && checked.value !== target()) target.set(checked.value);
    }
  }

  applyEmailSuggestion(): void {
    const suggestion = this.emailSuggestion();
    if (suggestion) this.set('email', this.email, suggestion);
  }

  toggleConsent(checked: boolean): void {
    this.consent.set(checked);
    this.clearServerError('consent');
    this.touched.update((s) => new Set(s).add('consent'));
  }

  setTab(tab: PageTab): void {
    this.activeTab.set(tab);
  }

  setMode(mode: ApplicationMode): void {
    this.mode.set(mode);
    this.resetFeedbackOnModeChange();
  }

  setResumeSubMode(sub: ResumeSubMode): void {
    this.resumeSubMode.set(sub);
    this.resetFeedbackOnModeChange();
  }

  async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.resumeFile.set(file);
    this.fileError.set('');
    this.clearServerError('file');
    if (!file) return;
    this.fileChecking.set(true);
    const error = await validatePdfFile(file);
    // A pessoa pode ter trocado de arquivo enquanto este era lido: só vale o resultado do atual.
    if (this.resumeFile() === file) {
      this.fileError.set(error);
      this.fileChecking.set(false);
    }
  }

  submit(): void {
    if (this.submitting() || this.fileChecking()) return;
    this.submitAttempted.set(true);
    this.formError.set('');

    const { errors, normalized } = this.validation();
    const invalid = FIELD_ORDER.filter((f) => errors[f]);
    if (invalid.length > 0) {
      this.formError.set(
        invalid.length === 1 ? 'Revise o campo destacado antes de enviar.' : `Revise os ${invalid.length} campos destacados antes de enviar.`,
      );
      this.focusField(invalid[0]);
      return;
    }

    this.submitting.set(true);
    const campaignId = this.campaignId();
    let request$: Observable<void>;
    if (this.mode() === 'manual') {
      request$ = this.api.submitPublicApplicationManual(campaignId, {
        name: normalized.name,
        email: normalized.email,
        phone: normalized.phone,
        linkedinUrl: normalized.linkedinUrl,
        city: normalized.city,
        state: normalized.state,
        yearsExperience: normalized.yearsExperience,
        summary: normalized.summary,
        educationDegree: normalized.educationDegree,
        educationInstitution: normalized.educationInstitution,
        educationPeriod: normalized.educationPeriod,
        experience: [],
        skills: normalized.skills,
        consent: this.consent(),
        honeypot: this.honeypot(),
      });
    } else if (this.resumeSubMode() === 'text') {
      request$ = this.api.submitPublicApplicationResumeText(
        campaignId, normalized.name, normalized.email, normalized.resumeText, this.consent(), this.honeypot(),
      );
    } else {
      request$ = this.api.submitPublicApplicationResumeFile(
        campaignId, normalized.name, normalized.email, this.resumeFile()!, this.consent(), this.honeypot(),
      );
    }

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.handleServerError(err);
      },
    });
  }

  /**
   * Traduz a resposta de erro do servidor em feedback: erros por campo vão para os campos; o resto
   * vira a mensagem geral. A mensagem do servidor é mostrada como veio — ela já é escrita para quem
   * está se candidatando (e o backend nunca manda detalhe interno nela).
   */
  private handleServerError(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) {
      this.formError.set('Não foi possível enviar sua candidatura. Tente novamente.');
      return;
    }
    const body = (err.error ?? {}) as { error?: string; fields?: FieldErrors };
    if (err.status === 0) {
      this.formError.set('Sem conexão com o servidor. Verifique sua internet e tente novamente.');
      return;
    }
    if (body.fields && Object.keys(body.fields).length > 0) {
      this.serverErrors.set(body.fields);
      const first = FIELD_ORDER.find((f) => body.fields?.[f]);
      const count = Object.keys(body.fields).length;
      this.formError.set(count === 1 ? 'Revise o campo destacado.' : `Revise os ${count} campos destacados.`);
      if (first) this.focusField(first);
      return;
    }
    if (err.status === 404) {
      this.formError.set('Esta vaga não está mais recebendo candidaturas.');
      return;
    }
    if (err.status >= 500) {
      this.formError.set('Tivemos um problema do nosso lado. Tente novamente em instantes.');
      return;
    }
    this.formError.set(body.error ?? 'Não foi possível enviar sua candidatura. Tente novamente.');
  }

  private clearServerError(field: ApplicationField): void {
    if (this.serverErrors()[field]) {
      this.serverErrors.update((e) => {
        const next = { ...e };
        delete next[field];
        return next;
      });
    }
    this.formError.set('');
  }

  private resetFeedbackOnModeChange(): void {
    this.formError.set('');
    this.serverErrors.update((e) => {
      const kept: FieldErrors = {};
      for (const f of COMMON_FIELDS) if (e[f]) kept[f] = e[f];
      return kept;
    });
  }

  private focusField(field: ApplicationField): void {
    // Depois da renderização do erro, para o leitor de tela anunciar a mensagem junto com o campo.
    setTimeout(() => {
      const el = document.getElementById(FIELD_IDS[field]);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    });
  }
}
