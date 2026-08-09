import { Routes } from '@angular/router';

export const dashboardRoutes: Routes = [
  {
    title: 'Dailu - Dashboard',
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
];
