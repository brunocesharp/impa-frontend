import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * 401 em qualquer chamada da API (sessão expirou nas 12 h ou foi encerrada) leva ao login.
 * As rotas de /api/auth tratam o 401 elas mesmas (credencial inválida, sem sessão ao abrir).
 */
export const sessaoExpiradaInterceptor: HttpInterceptorFn = (requisicao, proximo) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return proximo(requisicao).pipe(
    catchError((erro: unknown) => {
      if (erro instanceof HttpErrorResponse && erro.status === 401 && !requisicao.url.startsWith('/api/auth/')) {
        auth.encerrarLocalmente();
        void router.navigateByUrl('/login');
      }
      return throwError(() => erro);
    }),
  );
};
