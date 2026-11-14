import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ErroApi, MENSAGEM_MUITAS_TENTATIVAS } from '../auth/sessao';
import { Liberacao, URL_LIBERACOES } from './liberacao';

export type ResultadoLiberacao = { ok: true; token: string } | { ok: false; mensagem: string };

/**
 * `POST /api/acesso/liberacoes` (story 1-5): o administrador informa usuário e senha no terminal do operador. Recusas
 * (credencial inválida, bloqueio, sem permissão para liberar) voltam como 403 `{ mensagem }` — não 401: a sessão do
 * operador continua. O limite por IP do login também vale aqui (429 `{ mensagem }`).
 */
@Injectable({ providedIn: 'root' })
export class LiberacaoService {
  private readonly http = inject(HttpClient);

  async liberar(usuario: string, senha: string, permissao: string): Promise<ResultadoLiberacao> {
    try {
      const liberacao = await firstValueFrom(
        this.http.post<Liberacao>(URL_LIBERACOES, { usuario, senha, permissao }),
      );
      return { ok: true, token: liberacao.token };
    } catch (erro) {
      // 429: limite por IP do login, que a liberação também usa (revisão 1, R1).
      if (!(erro instanceof HttpErrorResponse) || ![400, 403, 429].includes(erro.status))
        throw erro;

      const corpo = erro.error as (Partial<ErroApi> & { errors?: Record<string, string[]> }) | null;
      const validacao = corpo?.errors ? Object.values(corpo.errors).flat()[0] : undefined;
      const mensagem = (typeof corpo?.mensagem === 'string' && corpo.mensagem) || validacao;
      return {
        ok: false,
        mensagem:
          mensagem ||
          (erro.status === 429
            ? MENSAGEM_MUITAS_TENTATIVAS
            : 'Não foi possível liberar a operação'),
      };
    }
  }
}
