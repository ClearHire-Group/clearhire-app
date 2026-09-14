import { Component, computed, signal } from '@angular/core';

interface DemoCandidate {
  name: string;
  initials: string;
  role: string;
  experience: string;
}

interface DemoStage {
  label: string;
  status: string;
  candidates: DemoCandidate[];
}

@Component({
  selector: 'app-landing-demo',
  standalone: true,
  templateUrl: './landing-demo.component.html',
  styleUrl: './landing-demo.component.scss',
})
export class LandingDemoComponent {
  readonly selectedStage = signal(2);
  // Fictional demo isolated from company data and the API.
  readonly stages: DemoStage[] = [
    { label: 'Recebidos', status: 'Recebido', candidates: [
      { name: 'Ana Martins', initials: 'AM', role: 'UX Designer', experience: '3 anos' },
      { name: 'Lucas Melo', initials: 'LM', role: 'Designer de Produto', experience: '4 anos' },
      { name: 'Lia Almeida', initials: 'LA', role: 'Product Designer', experience: '3 anos' },
    ] },
    { label: 'Fit Cultural', status: 'Em análise', candidates: [
      { name: 'Clara Reis', initials: 'CR', role: 'Designer de Produto', experience: '4 anos' },
      { name: 'Bruno Dias', initials: 'BD', role: 'UX/UI Designer', experience: '3 anos' },
    ] },
    { label: 'Triagem Técnica', status: 'Em análise', candidates: [
      { name: 'Marina Costa', initials: 'MC', role: 'Designer de Produto', experience: '5 anos' },
      { name: 'Rafael Lima', initials: 'RL', role: 'Product Designer', experience: '4 anos' },
      { name: 'Camila Rocha', initials: 'CR', role: 'UX/UI Designer', experience: '3 anos' },
    ] },
    { label: 'Entrevista', status: 'Em entrevista', candidates: [
      { name: 'Pedro Alves', initials: 'PA', role: 'Product Designer', experience: '5 anos' },
      { name: 'Sofia Nunes', initials: 'SN', role: 'Designer de Produto', experience: '4 anos' },
    ] },
    { label: 'Selecionados', status: 'Selecionado', candidates: [
      { name: 'Daniel Santos', initials: 'DS', role: 'Designer de Produto', experience: '5 anos' },
    ] },
  ];
  readonly activeStage = computed(() => this.stages[this.selectedStage()]);
  readonly totalCandidates = this.stages.reduce((total, stage) => total + stage.candidates.length, 0);
}
