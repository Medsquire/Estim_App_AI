import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./vendors.component').then(m => m.VendorsComponent),
    data: {
      title: 'Vendors'
    }
  }
];
