import { Routes } from '@angular/router';

export const habitEntryRoutes: Routes = [
  {
    title: 'Dailo - My Entries',
    path: 'entries',
    loadComponent: () =>
      import('./pages/habit-entry-list/habit-entry-list').then((m) => m.HabitEntryList),
  },
];