import { Routes } from '@angular/router';

export const habitEntryRoutes: Routes = [
  {
    title: 'Dailu - My Entries',
    path: 'entries',
    loadComponent: () =>
      import('./pages/habit-entry-list/habit-entry-list').then((m) => m.HabitEntryList),
  },
];