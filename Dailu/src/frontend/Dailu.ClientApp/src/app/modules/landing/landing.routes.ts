import { Routes } from '@angular/router';

export const landingRoutes: Routes = [
  {
    title: 'Dailu',
    path: '',
    loadComponent: () =>
      import('./pages/landing-page/landing-page').then((m) => m.LandingPage),
  },
  {
    title: 'Terms & Conditions',
    path: 'terms',
    loadComponent: () =>
      import('@auth/pages/terms/terms').then((m) => m.Terms),
  },
];
