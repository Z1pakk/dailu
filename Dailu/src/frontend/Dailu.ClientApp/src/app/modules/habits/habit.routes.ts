import { Routes } from '@angular/router';

export const habitRoutes: Routes = [
  {
    title: 'Dailu - My Habits',
    path: 'habits',
    loadComponent: () =>
      import('./pages/habit-list/habit-list').then((m) => m.HabitList),
  },
];
