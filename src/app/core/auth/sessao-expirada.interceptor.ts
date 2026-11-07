import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { CODIGO_TROCA_DE_SENHA_OBRIGATORIA, ErroApi, MENSAGEM_SESSAO_ENCERRADA } from './sessao';

/** Login e logout tratam o próprio 401 (credencial inválida, bloqueio, sessão já encerrada). */
const TRATAM_O_PROPRIO_401 = ['/api/auth/login', '/api/auth/logout'];

/**
 * 401 numa chamada da API leva ao login. Com a sessão aberta na SPA, a sessão acabou no servidor — usuário
 * desativado, logout em outro lugar ou as 12 h (story 1-2, CA-2) — e o login mostra "Sua sessão foi encerrada".
 * O 401 do `/api/auth/me` sem sessão aberta é só "ninguém entrou ainda" e fica com quem chamou.
 */
export const sessaoExpiradaInterceptor: HttpInterceptorFn = (requisicao, proximo) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return proximo(requisicao).pipe(
    catchError((erro: unknown) => {
      if (erro instanceof HttpErrorResponse && erro.status === 401 && !TRATAM_O_PROPRIO_401.includes(requisicao.url)) {
        const tinhaSessao = auth.autenticado();
        if (tinhaSessao || !requisicao.url.startsWith('/api/auth/')) {
          auth.encerrarLocalmente(tinhaSessao ? MENSAGEM_SESSAO_ENCERRADA : null);
          void router.navigateByUrl('/login');
        }
      }
      // A senha foi redefinida com a sessão aberta (story 1-4): recarrega a sessão e leva à troca de senha.
      if (
        erro instanceof HttpErrorResponse &&
        erro.status === 403 &&
        (erro.error as Partial<ErroApi> | null)?.codigo === CODIGO_TROCA_DE_SENHA_OBRIGATORIA
      ) {
        void auth.carregarSessao().then(
          () => router.navigateByUrl('/trocar-senha'),
          () => undefined,
        );
      }
      return throwError(() => erro);
    }),
  );
};
