import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./estimations.component').then(m => m.EstimationsComponent),
    data: {
      title: $localize`Estimations`
    }
  },
  {
    path: 'work-details/:fileNo',
    loadComponent: () => import('./work-details/work-details.component').then(m => m.WorkDetailsComponent),
    data: {
      title: $localize`Work Details`
    }
  }
];
