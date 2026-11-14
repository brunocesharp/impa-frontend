import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, from, switchMap, throwError } from 'rxjs';
import {
  CABECALHO_LIBERACAO,
  MENSAGEM_LIBERACAO_RECUSADA,
  URL_LIBERACOES,
  permissaoLiberavel,
} from './liberacao';
import type { DadosLiberacao, LiberacaoDialogo } from './liberacao-dialogo';

/**
 * Story 1-5 (cenário 1.8): o 403 `permissao_requerida` liberável abre o diálogo de liberação; com o token, refaz a
 * mesma requisição com o cabeçalho `X-Liberacao` (vale só para ela). Cancelado o diálogo, o 403 original segue para
 * quem chamou. Se a API recusar o token, o erro segue com a mensagem {@link MENSAGEM_LIBERACAO_RECUSADA}.
 */
export const liberacaoInterceptor: HttpInterceptorFn = (requisicao, proximo) => {
  const dialogo = inject(MatDialog);

  return proximo(requisicao).pipe(
    catchError((erro: unknown) => {
      const permissao = permissaoLiberavel(erro);
      if (!permissao || requisicao.url === URL_LIBERACOES) return throwError(() => erro);
      if (requisicao.headers.has(CABECALHO_LIBERACAO))
        return throwError(() => recusada(erro as HttpErrorResponse));

      // O diálogo (formulário e campos do Material) só é carregado quando uma liberação é pedida.
      return from(import('./liberacao-dialogo')).pipe(
        switchMap(({ LiberacaoDialogo: Dialogo }) =>
          dialogo
            .open<LiberacaoDialogo, DadosLiberacao, string>(Dialogo, {
              data: { permissao },
              disableClose: true,
              width: '420px',
              maxWidth: 'calc(100vw - 32px)',
            })
            .afterClosed(),
        ),
        switchMap((token) => {
          if (!token) return throwError(() => erro);
          return proximo(requisicao.clone({ setHeaders: { [CABECALHO_LIBERACAO]: token } })).pipe(
            catchError((novo: unknown) =>
              throwError(() =>
                permissaoLiberavel(novo) ? recusada(novo as HttpErrorResponse) : novo,
              ),
            ),
          );
        }),
      );
    }),
  );
};

/** O mesmo 403, com `mensagem` para a tela mostrar (os serviços das telas usam `corpo.mensagem`). */
function recusada(erro: HttpErrorResponse): HttpErrorResponse {
  return new HttpErrorResponse({
    error: { ...(erro.error as object), mensagem: MENSAGEM_LIBERACAO_RECUSADA },
    headers: erro.headers,
    status: erro.status,
    statusText: erro.statusText,
    url: erro.url ?? undefined,
  });
}
