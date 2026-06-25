import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./upload-loa.component').then(m => m.UploadLoaComponent),
        data: {
            title: 'Upload LOA'
        }
    }
];
