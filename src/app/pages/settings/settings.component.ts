import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageTabsComponent, SubTab } from '../../layout/page-tabs/page-tabs.component';
import { DataApi } from '../../core/data-api';
import { toLoadable } from '../../core/loadable';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, PageTabsComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  readonly subTabs: SubTab[] = [
    { label: 'Perfil da Empresa', active: true },
    { label: 'Equipe', disabled: true },
    { label: 'Integrações', disabled: true },
  ];

  private api = inject(DataApi);
  readonly companyProfileState = toLoadable(this.api.getCompanyProfile());
}
