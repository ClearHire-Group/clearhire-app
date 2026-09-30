import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Notification } from '../../core/models';

/** Dropdown de notificações ancorado no sino da top-bar. Puramente apresentacional — o pai busca os dados e trata o clique. */
@Component({
  selector: 'app-notifications-panel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notifications-panel.component.html',
  styleUrl: './notifications-panel.component.scss',
})
export class NotificationsPanelComponent {
  @Input() notifications: Notification[] = [];
  @Input() loading = false;
  @Input() error = false;
  @Output() notificationSelect = new EventEmitter<Notification>();
}
