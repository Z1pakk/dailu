import { Routes } from '@angular/router';

export const userProfileRoutes: Routes = [
  {
    path: 'profile',
    title: 'Dailu - My Profile',
    loadComponent: () =>
      import('./pages/profile-container/profile-container').then(
        (m) => m.ProfileContainer,
      ),
    children: [
      {
        path: '',
        title: 'Dailu - My Profile',
        redirectTo: 'main',
        pathMatch: 'full',
      },
      {
        path: 'main',
        title: 'Dailu - My Profile',
        loadComponent: () =>
          import('./pages/profile-main/profile-main').then(
            (m) => m.ProfileMain,
          ),
      },
    ],
  },
];
