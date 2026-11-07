import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ErroApi } from '../../../core/auth/sessao';

/** Terminal de `GET /api/terminais` (story 1-6). */
export interface Terminal {
  id: string;
  nome: string;
  /** Nome de quem registrou. */
  criadoPor: string;
  criadoEm: string;
  /** Preenchido: o terminal foi revogado e não acessa mais PDV nem caixa. */
  revogadoEm: string | null;
  /** É o terminal deste dispositivo (o cookie do terminal está neste navegador). */
  atual: boolean;
}

export type Resultado<T = void> =
  ({ ok: true } & (T extends void ? unknown : { valor: T })) | { ok: false; mensagem: string };

/**
 * Chamadas de `/api/terminais` (exige `terminais.gerenciar`). Recusas do servidor (400, 403, 404, 409) voltam como
 * `mensagem`; o resto é propagado. Registrar grava o token num cookie HttpOnly deste navegador: a SPA não o vê.
 */
@Injectable({ providedIn: 'root' })
export class TerminaisService {
  private readonly http = inject(HttpClient);

  listar(): Promise<Terminal[]> {
    return firstValueFrom(this.http.get<Terminal[]>('/api/terminais'));
  }

  /** Registra **este dispositivo** como terminal. */
  registrar(nome: string): Promise<Resultado<Terminal>> {
    return valor(this.http.post<Terminal>('/api/terminais', { nome }));
  }

  renomear(id: string, nome: string): Promise<Resultado<Terminal>> {
    return valor(this.http.put<Terminal>(`/api/terminais/${id}`, { nome }));
  }

  async revogar(id: string): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.post<void>(`/api/terminais/${id}/revogar`, null));
      return { ok: true };
    } catch (erro) {
      return recusa(erro);
    }
  }
}

async function valor<T>(pedido: Observable<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, valor: await firstValueFrom(pedido) } as Resultado<T>;
  } catch (erro) {
    return recusa(erro);
  }
}

function recusa(erro: unknown): { ok: false; mensagem: string } {
  if (!(erro instanceof HttpErrorResponse) || ![400, 403, 404, 409].includes(erro.status))
    throw erro;

  const corpo = erro.error as (Partial<ErroApi> & { errors?: Record<string, string[]> }) | null;
  const validacao = corpo?.errors ? Object.values(corpo.errors).flat()[0] : undefined;
  const mensagem = (typeof corpo?.mensagem === 'string' && corpo.mensagem) || validacao;
  return {
    ok: false,
    mensagem:
      mensagem ||
      (erro.status === 403
        ? 'Você não tem permissão para gerenciar terminais'
        : 'Não foi possível salvar o terminal'),
  };
}
