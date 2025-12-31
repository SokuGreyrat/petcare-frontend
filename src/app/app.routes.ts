import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Registro } from './pages/registro/registro';
import { Dashboard } from './pages/dashboard/dashboard';
import { MisMascotas } from './pages/mis-mascotas/mis-mascotas';
import { AdopcionesComponent } from './pages/adopciones/adopciones';
import { Finanzas } from './pages/finanzas/finanzas';
import { RedVecinal } from './pages/red-vecinal/red-vecinal';
import { Perfil } from './pages/perfil/perfil';
import { Shell } from './components/shell/shell';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'registro', component: Registro, canActivate: [guestGuard] },

  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'mis-mascotas', component: MisMascotas },
      { path: 'adopciones', component: AdopcionesComponent },
      { path: 'finanzas', component: Finanzas },
      { path: 'red-vecinal', component: RedVecinal },
      { path: 'perfil', component: Perfil },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: '' },
];
