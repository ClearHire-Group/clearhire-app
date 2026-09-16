import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-job-description',
  standalone: true,
  templateUrl: './job-description.component.html',
  styleUrl: './job-description.component.scss',
})
export class JobDescriptionComponent {
  readonly description = input('');
  readonly responsibilities = input<string[]>([]);
  readonly requirements = input<string[]>([]);
  readonly benefits = input<string[]>([]);
  readonly emptyMessage = input('A empresa ainda não publicou os detalhes desta vaga. Você pode se candidatar mesmo assim — a equipe de recrutamento entrará em contato com mais informações.');
  readonly sections = computed(() => [
    { title: 'Responsabilidades', items: this.responsibilities().filter((item) => item.trim()) },
    { title: 'Requisitos', items: this.requirements().filter((item) => item.trim()) },
    { title: 'Benefícios', items: this.benefits().filter((item) => item.trim()) },
  ].filter((section) => section.items.length));
}
