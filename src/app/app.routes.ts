import { Routes } from '@angular/router';
import { autenticadoGuard, permissaoGuard, trocaDeSenhaGuard } from './core/auth/auth.guard';
import { MENU } from './core/menu/menu';

/** Itens do menu que já têm tela própria (os demais levam a "Em construção"). */
const COM_TELA = new Set(['configuracao', 'pessoas']);

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar · IMPA',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: 'trocar-senha',
    title: 'Nova senha · IMPA',
    canActivate: [trocaDeSenhaGuard],
    loadComponent: () => import('./features/trocar-senha/trocar-senha').then((m) => m.TrocarSenha),
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
      {
        path: 'configuracao/usuarios',
        title: 'Usuários · IMPA',
        canActivate: [permissaoGuard],
        data: { titulo: 'Usuários', permissao: 'usuarios.gerenciar' },
        loadComponent: () =>
          import('./features/configuracao/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        // Story 3-7: abas Clientes e Fornecedores (decisão de 07/11/2026).
        path: 'pessoas',
        canActivate: [permissaoGuard],
        data: { titulo: 'Pessoas', permissao: 'clientes.ver' },
        loadComponent: () => import('./features/pessoas/pessoas').then((m) => m.Pessoas),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'clientes' },
          {
            path: 'clientes',
            title: 'Clientes · IMPA',
            data: { titulo: 'Clientes' },
            loadComponent: () =>
              import('./features/pessoas/clientes/clientes').then((m) => m.Clientes),
          },
          {
            path: 'fornecedores',
            title: 'Fornecedores · IMPA',
            canActivate: [permissaoGuard],
            data: { titulo: 'Fornecedores', permissao: 'fornecedores.gerenciar' },
            loadComponent: () =>
              import('./features/pessoas/fornecedores/fornecedores').then((m) => m.Fornecedores),
          },
        ],
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
