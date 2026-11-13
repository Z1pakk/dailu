import { Routes } from '@angular/router';

export const userProfileRoutes: Routes = [
  {
    path: 'profile',
    title: 'Dailu - My Profile',
    loadComponent: () =>
      import('./pages/profile-main/profile-main').then((m) => m.ProfileMain),
  },
];
