import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ActivityComponent } from './pages/activity/activity.component';
import { CampaignsComponent } from './pages/campaigns/campaigns.component';
import { TalentBankComponent } from './pages/talent-bank/talent-bank.component';
import { TalentProfileComponent } from './pages/talent-profile/talent-profile.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { NewCampaignComponent } from './pages/new-campaign/new-campaign.component';
import { CampaignDetailComponent } from './pages/campaign-detail/campaign-detail.component';
import { CampaignFunnelComponent } from './pages/campaign-funnel/campaign-funnel.component';
import { CampaignCandidatesComponent } from './pages/campaign-candidates/campaign-candidates.component';
import { CampaignOverviewComponent } from './pages/campaign-overview/campaign-overview.component';
import { CampaignSettingsComponent } from './pages/campaign-settings/campaign-settings.component';
import { CandidateProfileComponent } from './pages/candidate-profile/candidate-profile.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { SettingsTeamComponent } from './pages/settings-team/settings-team.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { AcceptInvitationComponent } from './pages/accept-invitation/accept-invitation.component';
import { PublicApplicationComponent } from './pages/public-application/public-application.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'registro', component: RegisterComponent, canActivate: [guestGuard] },
  { path: 'esqueci-senha', component: ForgotPasswordComponent, canActivate: [guestGuard] },
  { path: 'redefinir-senha/:token', component: ResetPasswordComponent, canActivate: [guestGuard] },
  { path: 'aceitar-convite/:token', component: AcceptInvitationComponent, canActivate: [guestGuard] },
  // Sem guard nenhum: candidato anônimo (sem login) e recrutador logado pré-visualizando o
  // próprio link precisam ver a mesma página — guestGuard redirecionaria o segundo pro dashboard.
  { path: 'vagas/:campaignId', component: PublicApplicationComponent },
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
      {
        path: 'campanhas/:campaignId',
        component: CampaignDetailComponent,
        children: [
          { path: '', redirectTo: 'funil', pathMatch: 'full' },
          { path: 'visao-geral', component: CampaignOverviewComponent },
          { path: 'funil', component: CampaignFunnelComponent },
          { path: 'candidatos', component: CampaignCandidatesComponent },
          { path: 'configuracoes', component: CampaignSettingsComponent },
        ],
      },
      { path: 'configuracoes', component: SettingsComponent },
      { path: 'configuracoes/equipe', component: SettingsTeamComponent },
      // Coringa DENTRO do grupo autenticado (não no nível de topo): assim o authGuard do pai
      // roda primeiro — um visitante sem sessão numa URL inválida vai pro /login como qualquer
      // outra rota protegida, em vez de ver a tela 404 (que pressupõe nav/sidebar de usuário
      // logado) antes de ser barrado. Pega tanto uma URL de topo inexistente quanto um sub-path
      // inválido dentro de uma rota válida (ex.: campanhas/:id/rota-que-não-existe).
      { path: '**', component: NotFoundComponent },
    ],
  },
  // Sem coringa de nível de topo: `{ path: '', children: [...] }` já consome 0 segmentos e delega
  // o resto pros filhos — como o último filho é `**`, esse grupo casa com QUALQUER URL que não
  // bata antes numa das rotas públicas acima, então um coringa aqui fora nunca seria alcançado.
];
