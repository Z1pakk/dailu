import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    title: 'Sign In',
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    title: 'Sign Up',
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register').then((m) => m.Register),
  },
];
