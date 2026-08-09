import { Routes } from '@angular/router';

export const tagRoutes: Routes = [
  {
    title: 'Dailu - My Tags',
    path: 'tags',
    loadComponent: () =>
      import('./pages/tag-list/tag-list').then((m) => m.TagList),
  },
];
