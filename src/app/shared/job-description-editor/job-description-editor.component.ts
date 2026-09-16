import { Component, input, model, signal } from '@angular/core';
import { JobListEditorComponent } from '../job-list-editor/job-list-editor.component';
import { JobDescriptionComponent } from '../job-description/job-description.component';

@Component({
  selector: 'app-job-description-editor',
  standalone: true,
  imports: [JobListEditorComponent, JobDescriptionComponent],
  templateUrl: './job-description-editor.component.html',
  styleUrl: './job-description-editor.component.scss',
})
export class JobDescriptionEditorComponent {
  readonly description = model('');
  readonly responsibilities = model<string[]>([]);
  readonly requirements = model<string[]>([]);
  readonly benefits = model<string[]>([]);
  readonly disabled = input(false);
  readonly preview = signal(false);
}
