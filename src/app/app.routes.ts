import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ActivityComponent } from './pages/activity/activity.component';
import { CampaignsComponent } from './pages/campaigns/campaigns.component';
import { TalentBankComponent } from './pages/talent-bank/talent-bank.component';
import { TalentProfileComponent } from './pages/talent-profile/talent-profile.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { NewCampaignComponent } from './pages/new-campaign/new-campaign.component';
import { CampaignDetailComponent } from './pages/campaign-detail/campaign-detail.component';
import { CandidateProfileComponent } from './pages/candidate-profile/candidate-profile.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'registro', component: RegisterComponent, canActivate: [guestGuard] },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'dashboard/atividade', component: ActivityComponent },
      { path: 'campanhas', component: CampaignsComponent },
      { path: 'candidatos', redirectTo: 'banco-de-talentos' },
      { path: 'banco-de-talentos', component: TalentBankComponent },
      { path: 'banco-de-talentos/:talentId', component: TalentProfileComponent },
      { path: 'relatorios', component: ReportsComponent },
      { path: 'campanhas/nova', component: NewCampaignComponent },
      { path: 'campanhas/:campaignId/candidatos/:candidateId', component: CandidateProfileComponent },
      { path: 'campanhas/:campaignId', component: CampaignDetailComponent },
      { path: 'configuracoes', component: SettingsComponent },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
