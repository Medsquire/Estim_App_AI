import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'loa',
    pathMatch: 'full'
  },
  {
    path: 'loa',
    loadChildren: () => import('../upload-loa/routes').then((m) => m.routes),
    data: {
      title: 'Upload LOA'
    }
  },
  {
    path: 'sor',
    loadChildren: () => import('../upload-sor/routes').then((m) => m.routes),
    data: {
      title: 'Upload SOR'
    }
  }
];