import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Rotas da retaguarda: sem sessão, vai para o login. Se não deu para perguntar ao servidor (API subindo,
 * sem rede), vai para a tela de nova tentativa, que volta ao destino quando a API responder.
 * Com a senha provisória (story 1-4, RN-1.8), o usuário fica preso na troca de senha.
 */
export const autenticadoGuard: CanActivateFn = async (_rota, estado) => {
  const router = inject(Router);
  try {
    const sessao = await inject(AuthService).garantirSessao();
    if (!sessao) return router.createUrlTree(['/login']);
    return sessao.trocaDeSenhaObrigatoria ? router.createUrlTree(['/trocar-senha']) : true;
  } catch {
    return router.createUrlTree(['/indisponivel'], { queryParams: { volta: estado.url } });
  }
};

/**
 * Tela de troca obrigatória de senha: só com sessão e com a troca pendente. Sem sessão, vai ao login;
 * já trocada, volta ao início.
 */
export const trocaDeSenhaGuard: CanActivateFn = async (_rota, estado) => {
  const router = inject(Router);
  try {
    const sessao = await inject(AuthService).garantirSessao();
    if (!sessao) return router.createUrlTree(['/login']);
    return sessao.trocaDeSenhaObrigatoria ? true : router.createUrlTree(['/']);
  } catch {
    return router.createUrlTree(['/indisponivel'], { queryParams: { volta: estado.url } });
  }
};

/**
 * Rota com `data.permissao`: sem a permissão, volta ao início. É só conforto de navegação;
 * quem protege os dados é o servidor (RN-1.10).
 */
export const permissaoGuard: CanActivateFn = (rota) => {
  const permissao = rota.data['permissao'] as string | undefined;
  return !permissao || inject(AuthService).temPermissao(permissao) ? true : inject(Router).createUrlTree(['/']);
};
