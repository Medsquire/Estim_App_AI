import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./upload-sor.component').then(m => m.UploadSorComponent),
    data: {
      title: 'Upload SOR'
    }
  }
];
