import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Slim, fully generic bar above the routed content — search, notifications, avatar. No page-specific inputs. */
@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {}
