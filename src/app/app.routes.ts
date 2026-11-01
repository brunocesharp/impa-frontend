import { Routes } from '@angular/router';
import { autenticadoGuard, permissaoGuard } from './core/auth/auth.guard';
import { MENU } from './core/menu/menu';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar · IMPA',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [autenticadoGuard],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Início · IMPA',
        data: { titulo: 'Início' },
        loadComponent: () => import('./features/inicio/inicio').then((m) => m.Inicio),
      },
      // Telas ainda não construídas: cada item do menu leva a "Em construção".
      ...MENU.filter((item) => item.rota !== '').map((item) => ({
        path: item.rota,
        title: `${item.rotulo} · IMPA`,
        canActivate: [permissaoGuard],
        data: { titulo: item.rotulo, permissao: item.permissao },
        loadComponent: () => import('./features/em-construcao/em-construcao').then((m) => m.EmConstrucao),
      })),
    ],
  },
  { path: '**', redirectTo: '' },
];
