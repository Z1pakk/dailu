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
      {
        path: 'integrations',
        title: 'Dailu - My Integrations',
        loadComponent: () =>
          import('./pages/profile-integrations/profile-integrations').then(
            (m) => m.ProfileIntegrations,
          ),
        children: [
          {
            path: '',
            redirectTo: 'github',
            pathMatch: 'full',
          },
          {
            path: 'github',
            title: 'Dailu - GitHub Integration',
            loadComponent: () =>
              import('./pages/profile-integrations/github/profile-github-integration').then(
                (m) => m.ProfileGithubIntegration,
              ),
          },
          {
            path: 'strava',
            title: 'Dailu - Strava Integration',
            loadComponent: () =>
              import('./pages/profile-integrations/strava/profile-strava-integration').then(
                (m) => m.ProfileStravaIntegration,
              ),
          },
          {
            path: 'google-health',
            title: 'Dailu - Google Health Integration',
            loadComponent: () =>
              import('./pages/profile-integrations/google-health/profile-google-health-integration').then(
                (m) => m.ProfileGoogleHealthIntegration,
              ),
          },
        ],
      },
    ],
  },
];
