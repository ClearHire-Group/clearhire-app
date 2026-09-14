import { Component, inject, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { LandingAiComponent } from './landing-ai.component';
import { LandingDemoComponent } from './landing-demo.component';
import { LandingProfileComponent } from './landing-profile.component';
import { appLinkBase } from '../../core/apex-host.guard';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [LandingDemoComponent, LandingProfileComponent, LandingAiComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements OnDestroy {
  readonly currentYear = new Date().getFullYear();
  // Preserve same-origin links locally and the app subdomain on the marketing host.
  private readonly document = inject(DOCUMENT);
  readonly appBase = appLinkBase(this.document);
  // Include the current route because the app's <base href="/"> resolves bare fragments to /.
  readonly landingPath = this.document.location.pathname + this.document.location.search;
  readonly faqs = [
    { question: 'Para quem é a Clearhire?', answer: 'Para equipes de RH e pessoas responsáveis por contratar que precisam reunir vagas, candidaturas e informações dos candidatos em um só lugar.' },
    { question: 'Como começo a usar?', answer: 'Crie a conta da sua empresa com seu nome, e-mail e senha. Depois, configure uma campanha com as informações da vaga e compartilhe o link de candidatura.' },
    { question: 'Como os candidatos se inscrevem?', answer: 'Cada vaga tem um link público de candidatura. Você compartilha esse link e as inscrições ficam vinculadas à campanha para acompanhamento no funil.' },
    { question: 'A análise por IA já está disponível?', answer: 'Ainda está em desenvolvimento. Estamos preparando análises com IA para apoiar a avaliação técnica e de alinhamento cultural. Hoje, você já pode organizar vagas, acompanhar candidaturas e consultar perfis. A decisão de contratação continua com sua equipe.' },
    { question: 'Posso reunir candidatos para futuras vagas?', answer: 'Sim. O banco de talentos reúne perfis para consulta e busca, ajudando sua equipe a encontrar pessoas para novas oportunidades.' },
  ];
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly previousTitle = this.title.getTitle();
  private readonly previousDescription = this.meta.getTag('name="description"')?.content;

  constructor() {
    this.title.setTitle('Clearhire — Recrutamento com clareza, em cada etapa');
    this.meta.updateTag({ name: 'description', content: 'Reúna vagas, candidatos e sua equipe em um só lugar. Conheça a Clearhire e organize seu recrutamento, da primeira candidatura à decisão final.' });
  }

  ngOnDestroy(): void {
    this.title.setTitle(this.previousTitle);
    if (this.previousDescription === undefined) {
      this.meta.removeTag('name="description"');
    } else {
      this.meta.updateTag({ name: 'description', content: this.previousDescription });
    }
  }
}
