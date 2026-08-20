import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopNavComponent, SubTab } from '../../layout/top-nav/top-nav.component';
import { DataService } from '../../core/data.service';
import { CompanyProfile } from '../../core/models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, TopNavComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  readonly subTabs: SubTab[] = [
    { label: 'Perfil da Empresa', active: true },
    { label: 'Equipe', disabled: true },
    { label: 'Integrações', disabled: true },
  ];

  readonly companyProfile: CompanyProfile;

  constructor(private data: DataService) {
    this.companyProfile = this.data.getCompanyProfile();
  }
}
