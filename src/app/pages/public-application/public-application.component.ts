import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { PublicApplicationExperienceInput } from '../../core/models';

type ApplicationMode = 'manual' | 'resume';
type ResumeSubMode = 'text' | 'file';

/**
 * Página pública (sem login) de candidatura a uma campanha — acessada via link gerado na tela de
 * detalhe da campanha (`/vagas/:campaignId`). Não usa AuthShellComponent: aquele shell é um pitch
 * comercial pro recrutador ("Recrutamento com clareza..."), errado pro contexto de alguém se
 * candidatando a uma vaga específica.
 */
@Component({
  selector: 'app-public-application',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-application.component.html',
  styleUrl: './public-application.component.scss',
})
export class PublicApplicationComponent {
  private route = inject(ActivatedRoute);
  private api = inject(DataApi);

  private campaignId$ = this.route.paramMap.pipe(map((p) => p.get('campaignId') ?? ''));
  readonly campaignId = toSignal(this.campaignId$, { initialValue: '' });

  readonly campaignState = toLoadable(this.campaignId$.pipe(switchMap((id) => this.api.getPublicCampaignInfo(id))));

  readonly mode = signal<ApplicationMode>('manual');
  readonly resumeSubMode = signal<ResumeSubMode>('text');

  // --- Modo manual -------------------------------------------------------------
  readonly name = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly linkedinUrl = signal('');
  readonly city = signal('');
  readonly state = signal('');
  readonly yearsExperience = signal<number | null>(null);
  readonly summary = signal('');
  readonly educationDegree = signal('');
  readonly educationInstitution = signal('');
  readonly educationPeriod = signal('');
  readonly skillsText = signal('');

  // --- Modo currículo ------------------------------------------------------------
  // Nome é sempre exigido, mesmo aqui — a extração é determinística (padrão de texto: e-mail,
  // telefone, LinkedIn, skills contra a taxonomia), não uma IA lendo o currículo inteiro, então
  // não tenta adivinhar o nome da pessoa.
  readonly resumeName = signal('');
  readonly resumeEmail = signal('');
  readonly resumeText = signal('');
  readonly resumeFile = signal<File | null>(null);

  readonly consent = signal(false);
  readonly honeypot = signal('');

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal('');

  setMode(mode: ApplicationMode): void {
    this.mode.set(mode);
    this.errorMessage.set('');
  }

  setResumeSubMode(sub: ResumeSubMode): void {
    this.resumeSubMode.set(sub);
    this.errorMessage.set('');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.resumeFile.set(input.files?.[0] ?? null);
  }

  get canSubmit(): boolean {
    if (this.submitting() || !this.consent()) return false;
    if (this.mode() === 'manual') {
      return this.name().trim().length > 0 && this.email().trim().length > 0;
    }
    if (!this.resumeName().trim() || !this.resumeEmail().trim()) return false;
    if (this.resumeSubMode() === 'text') {
      return this.resumeText().trim().length > 0;
    }
    return this.resumeFile() !== null;
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.submitting.set(true);
    this.errorMessage.set('');

    const campaignId = this.campaignId();
    const onDone = (): void => {
      this.submitting.set(false);
      this.submitted.set(true);
    };
    const onError = (): void => {
      this.submitting.set(false);
      this.errorMessage.set(
        this.mode() === 'resume'
          ? 'Não foi possível processar seu currículo. Tente o formulário manual.'
          : 'Não foi possível enviar sua candidatura. Confira os dados e tente novamente.',
      );
    };

    if (this.mode() === 'manual') {
      const skills = this.skillsText()
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const experience: PublicApplicationExperienceInput[] = [];

      this.api
        .submitPublicApplicationManual(campaignId, {
          name: this.name().trim(),
          email: this.email().trim(),
          phone: this.phone().trim(),
          linkedinUrl: this.linkedinUrl().trim(),
          city: this.city().trim(),
          state: this.state().trim(),
          yearsExperience: this.yearsExperience(),
          summary: this.summary().trim(),
          educationDegree: this.educationDegree().trim(),
          educationInstitution: this.educationInstitution().trim(),
          educationPeriod: this.educationPeriod().trim(),
          experience,
          skills,
          consent: this.consent(),
          honeypot: this.honeypot(),
        })
        .subscribe({ next: onDone, error: onError });
      return;
    }

    if (this.resumeSubMode() === 'text') {
      this.api
        .submitPublicApplicationResumeText(
          campaignId,
          this.resumeName().trim(),
          this.resumeEmail().trim(),
          this.resumeText().trim(),
          this.consent(),
          this.honeypot(),
        )
        .subscribe({ next: onDone, error: onError });
      return;
    }

    const file = this.resumeFile();
    if (!file) return;
    this.api
      .submitPublicApplicationResumeFile(
        campaignId,
        this.resumeName().trim(),
        this.resumeEmail().trim(),
        file,
        this.consent(),
        this.honeypot(),
      )
      .subscribe({ next: onDone, error: onError });
  }
}
