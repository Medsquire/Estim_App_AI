import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./quotations.component').then(m => m.QuotationsComponent),
    data: {
      title: 'Quotations'
    }
  }
];
