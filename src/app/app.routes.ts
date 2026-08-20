import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ActivityComponent } from './pages/activity/activity.component';
import { CampaignsComponent } from './pages/campaigns/campaigns.component';
import { CandidatesComponent } from './pages/candidates/candidates.component';
import { NewCampaignComponent } from './pages/new-campaign/new-campaign.component';
import { CampaignDetailComponent } from './pages/campaign-detail/campaign-detail.component';
import { CandidateProfileComponent } from './pages/candidate-profile/candidate-profile.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'dashboard/atividade', component: ActivityComponent },
  { path: 'campanhas', component: CampaignsComponent },
  { path: 'candidatos', component: CandidatesComponent },
  { path: 'campanhas/nova', component: NewCampaignComponent },
  { path: 'campanhas/:campaignId/candidatos/:candidateId', component: CandidateProfileComponent },
  { path: 'campanhas/:campaignId', component: CampaignDetailComponent },
  { path: 'configuracoes', component: SettingsComponent },
  { path: '**', redirectTo: 'dashboard' },
];
