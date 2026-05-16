import { Routes } from '@angular/router';
import { authRoutes } from '@auth/auth.routes';
import { landingRoutes } from '../modules/landing/landing.routes';
import { authGuard } from '@auth/auth-guard';
import { habitRoutes } from '@habits/habit.routes';
import { notAuthGuard } from '@auth/not-auth.guard';
import { dashboardRoutes } from '@dashboard/dashboard.routes';
import { tagRoutes } from '@tags/tag.routes';
import { habitEntryRoutes } from '@habit-entries/habit-entry.routes';
import { userProfileRoutes } from '../modules/user-profile/user-profile.routes';

export const routes: Routes = [
  {
    path: '',
    canActivate: [],
    loadComponent: () =>
      import('@layout/landing-layout/landing-layout').then(
        (m) => m.LandingLayout,
      ),
    children: [...landingRoutes],
  },
  {
    path: '',
    canActivate: [notAuthGuard],
    loadComponent: () =>
      import('@layout/auth-layout/auth-layout').then((m) => m.AuthLayout),
    children: [...authRoutes],
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      ...dashboardRoutes,
      ...habitRoutes,
      ...tagRoutes,
      ...habitEntryRoutes,
      ...userProfileRoutes,
    ],
  },

  // otherwise redirect to home
  { path: '**', redirectTo: '/' },
];
