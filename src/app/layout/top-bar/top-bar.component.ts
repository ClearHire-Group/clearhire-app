import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';
import { Notification } from '../../core/models';
import { NotificationsPanelComponent } from '../notifications-panel/notifications-panel.component';

/** Slim, fully generic bar above the routed content — search, notifications, avatar. No page-specific inputs. */
@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, NotificationsPanelComponent],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  private api = inject(DataApi);
  private elementRef = inject(ElementRef<HTMLElement>);

  private refreshTrigger = signal(0);
  readonly notificationsState = toLoadable(
    toObservable(this.refreshTrigger).pipe(switchMap(() => this.api.getNotifications())),
  );

  readonly isPanelOpen = signal(false);
  readonly unreadCount = computed(() => (this.notificationsState.data() ?? []).filter((n) => !n.read).length);

  togglePanel(): void {
    this.isPanelOpen.update((open) => !open);
  }

  onNotificationSelected(notification: Notification): void {
    this.isPanelOpen.set(false);
    if (notification.read) return;
    this.api.markNotificationRead(notification.id).subscribe(() => {
      this.refreshTrigger.update((n) => n + 1);
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isPanelOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isPanelOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isPanelOpen.set(false);
  }
}
