import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./items.component').then(m => m.ItemsComponent),
    data: {
      title: 'Items'
    },
    children: [
      {
        path: '',
        redirectTo: 'sor-items',
        pathMatch: 'full'
      },
      {
        path: 'sor-items',
        loadComponent: () => import('./sor-items.component').then(m => m.SorItemsComponent),
        data: {
          title: 'SOR Items'
        }
      },
      {
        path: 'loa-items',
        loadComponent: () => import('./loa-items.component').then(m => m.LoaItemsComponent),
        data: {
          title: 'LOA Items'
        }
      }
    ]
  }
];
