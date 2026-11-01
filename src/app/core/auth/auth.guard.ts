import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Rotas da retaguarda: sem sessão, vai para o login. */
export const autenticadoGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await inject(AuthService).garantirSessao()) ? true : router.createUrlTree(['/login']);
};

/**
 * Rota com `data.permissao`: sem a permissão, volta ao início. É só conforto de navegação;
 * quem protege os dados é o servidor (RN-1.10).
 */
export const permissaoGuard: CanActivateFn = (rota) => {
  const permissao = rota.data['permissao'] as string | undefined;
  return !permissao || inject(AuthService).temPermissao(permissao) ? true : inject(Router).createUrlTree(['/']);
};
