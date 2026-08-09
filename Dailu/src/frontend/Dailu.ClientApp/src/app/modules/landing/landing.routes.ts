import { Routes } from '@angular/router';

export const landingRoutes: Routes = [
  {
    title: 'Dailu',
    path: '',
    loadComponent: () =>
      import('./pages/landing-page/landing-page').then((m) => m.LandingPage),
  },
];
