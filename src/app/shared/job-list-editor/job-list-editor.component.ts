import { afterNextRender, Component, computed, ElementRef, inject, Injector, input, model, viewChild, viewChildren } from '@angular/core';
import { JOB_SECTION_MAX_LENGTH, parseJobItems, serializeJobItems } from '../../core/job-description';

@Component({
  selector: 'app-job-list-editor',
  standalone: true,
  templateUrl: './job-list-editor.component.html',
  styleUrl: './job-list-editor.component.scss',
})
export class JobListEditorComponent {
  private readonly injector = inject(Injector);
  private readonly fields = viewChildren<ElementRef<HTMLTextAreaElement>>('itemField');
  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');

  readonly sectionId = input.required<string>();
  readonly label = input.required<string>();
  readonly hint = input.required<string>();
  readonly placeholder = input.required<string>();
  readonly addLabel = input.required<string>();
  readonly items = model<string[]>([]);
  readonly disabled = input(false);
  readonly maxLength = JOB_SECTION_MAX_LENGTH;
  readonly count = computed(() => this.items().filter((item) => item.trim()).length);
  readonly length = computed(() => serializeJobItems(this.items()).length);
  readonly overLimit = computed(() => this.length() > this.maxLength);

  updateItem(index: number, value: string): void {
    this.items.update((items) => items.map((item, i) => i === index ? value : item));
  }

  addItem(afterIndex = this.items().length - 1): void {
    if (this.disabled()) return;
    // Reuse an empty field instead of accumulating blank rows.
    const emptyIndex = this.items().findIndex((item) => !item.trim());
    if (emptyIndex !== -1) {
      this.focusItem(emptyIndex);
      return;
    }
    const next = [...this.items()];
    next.splice(afterIndex + 1, 0, '');
    this.items.set(next);
    this.focusItem(afterIndex + 1);
  }

  removeItem(index: number): void {
    if (this.disabled()) return;
    this.items.update((items) => items.filter((_, i) => i !== index));
    this.focusItem(Math.min(index, this.items().length - 1));
  }

  moveItem(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (this.disabled() || target < 0 || target >= this.items().length) return;
    const next = [...this.items()];
    [next[index], next[target]] = [next[target], next[index]];
    this.items.set(next);
    this.focusItem(target);
  }

  onEnter(event: Event, index: number): void {
    if ((event as KeyboardEvent).isComposing) return;
    event.preventDefault();
    this.addItem(index);
  }

  onPaste(event: ClipboardEvent, index: number): void {
    const text = event.clipboardData?.getData('text/plain');
    if (this.disabled() || !text || !/[\r\n]/.test(text)) return;
    event.preventDefault();
    const field = event.target as HTMLTextAreaElement;
    const combined = field.value.slice(0, field.selectionStart) + text + field.value.slice(field.selectionEnd);
    const pasted = parseJobItems(combined);
    const next = [...this.items()];
    next.splice(index, 1, ...(pasted.length ? pasted : ['']));
    this.items.set(next);
    this.focusItem(index + Math.max(pasted.length - 1, 0));
  }

  private focusItem(index: number): void {
    afterNextRender(() => {
      const field = this.fields()[index]?.nativeElement;
      if (field) field.focus();
      else this.addButton()?.nativeElement.focus();
    }, { injector: this.injector });
  }
}
