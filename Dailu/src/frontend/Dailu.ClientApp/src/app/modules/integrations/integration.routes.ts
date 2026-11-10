import { Routes } from '@angular/router';

const loadPage = () => import('./pages/integrations/integrations-page').then((m) => m.IntegrationsPage);

export const integrationRoutes: Routes = [
  {
    path: 'integrations',
    title: 'Dailu - Integrations',
    loadComponent: loadPage,
  },
  {
    // The backend's OAuth callback (`FrontendCallbackUrl`) opens this in the popup.
    path: 'integrations/:provider',
    title: 'Dailu - Integrations',
    loadComponent: loadPage,
  },
  // Integrations used to live under Profile. Old links redirect; the old OAuth callback URL
  // (still set in deployments that haven't updated `FrontendCallbackUrl`) loads the page
  // directly, so its query string reaches the popup handler untouched.
  { path: 'profile/integrations', redirectTo: 'integrations', pathMatch: 'full' },
  { path: 'profile/integrations/:provider', loadComponent: loadPage },
];
