import { Routes } from '@angular/router';
import { autenticadoGuard, permissaoGuard } from './core/auth/auth.guard';
import { MENU } from './core/menu/menu';

/** Itens do menu que já têm tela própria (os demais levam a "Em construção"). */
const COM_TELA = new Set(['configuracao']);

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar · IMPA',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: 'indisponivel',
    title: 'Sem conexão · IMPA',
    loadComponent: () => import('./features/indisponivel/indisponivel').then((m) => m.Indisponivel),
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
      {
        path: 'configuracao',
        pathMatch: 'full',
        title: 'Configuração · IMPA',
        canActivate: [permissaoGuard],
        data: { titulo: 'Configuração', permissao: 'configuracao.ver' },
        loadComponent: () =>
          import('./features/configuracao/configuracao').then((m) => m.Configuracao),
      },
      {
        path: 'configuracao/perfis',
        title: 'Perfis · IMPA',
        canActivate: [permissaoGuard],
        data: { titulo: 'Perfis', permissao: 'perfis.gerenciar' },
        loadComponent: () => import('./features/configuracao/perfis/perfis').then((m) => m.Perfis),
      },
      // Telas ainda não construídas: cada item do menu leva a "Em construção".
      ...MENU.filter((item) => item.rota !== '' && !COM_TELA.has(item.rota)).map((item) => ({
        path: item.rota,
        title: `${item.rotulo} · IMPA`,
        canActivate: [permissaoGuard],
        data: { titulo: item.rotulo, permissao: item.permissao },
        loadComponent: () =>
          import('./features/em-construcao/em-construcao').then((m) => m.EmConstrucao),
      })),
    ],
  },
  { path: '**', redirectTo: '' },
];
