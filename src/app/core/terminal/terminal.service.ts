import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ErroApi } from '../auth/sessao';

/** `codigo` do 403 de PDV e caixa em dispositivo que não é terminal registrado (story 1-6, RN-11.1). */
export const CODIGO_TERMINAL_NAO_REGISTRADO = 'terminal_nao_registrado';

/** Cenário 11.6: mensagem mostrada no PDV e no caixa de um dispositivo não registrado. */
export const MENSAGEM_TERMINAL_NAO_REGISTRADO =
  'Este computador não está registrado como terminal. Peça ao administrador';

/** Terminal deste dispositivo, de `GET /api/terminais/atual`. */
export interface TerminalAtual {
  id: string;
  nome: string;
}

/** É o 403 `terminal_nao_registrado` da API. */
export function ehTerminalNaoRegistrado(erro: unknown): boolean {
  return (
    erro instanceof HttpErrorResponse &&
    erro.status === 403 &&
    (erro.error as Partial<ErroApi> | null)?.codigo === CODIGO_TERMINAL_NAO_REGISTRADO
  );
}

/**
 * Terminal deste dispositivo. O token fica num cookie HttpOnly (a SPA não o vê): quem diz se o dispositivo é
 * terminal é o servidor.
 */
@Injectable({ providedIn: 'root' })
export class TerminalService {
  private readonly http = inject(HttpClient);

  /** Terminal válido deste dispositivo; `null` se não for terminal (ou foi revogado). Outros erros propagam. */
  async atual(): Promise<TerminalAtual | null> {
    try {
      return await firstValueFrom(this.http.get<TerminalAtual>('/api/terminais/atual'));
    } catch (erro) {
      if (ehTerminalNaoRegistrado(erro)) return null;
      throw erro;
    }
  }
}
