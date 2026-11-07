import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ErroApi } from '../../../core/auth/sessao';

/** Perfil de `GET /api/perfis` (story 1-3). O Administrador vem `protegido` (RN-1.6). */
export interface Perfil {
  id: string;
  nome: string;
  protegido: boolean;
  permissoes: string[];
  usuarios: number;
}

/** Item do catálogo de `GET /api/perfis/permissoes`, na ordem e nos grupos da tela. */
export interface PermissaoInfo {
  codigo: string;
  grupo: string;
  descricao: string;
}

export interface DadosPerfil {
  nome: string;
  permissoes: string[];
}

export type Resultado<T = void> =
  ({ ok: true } & (T extends void ? unknown : { perfil: T })) | { ok: false; mensagem: string };

/** Chamadas de `/api/perfis`. Recusas do servidor (400, 404, 409) voltam como `mensagem`; o resto é propagado. */
@Injectable({ providedIn: 'root' })
export class PerfisService {
  private readonly http = inject(HttpClient);

  listar(): Promise<Perfil[]> {
    return firstValueFrom(this.http.get<Perfil[]>('/api/perfis'));
  }

  catalogo(): Promise<PermissaoInfo[]> {
    return firstValueFrom(this.http.get<PermissaoInfo[]>('/api/perfis/permissoes'));
  }

  /** `id` nulo cria (POST); senão altera (PUT). */
  async salvar(id: string | null, dados: DadosPerfil): Promise<Resultado<Perfil>> {
    try {
      const pedido = id
        ? this.http.put<Perfil>(`/api/perfis/${id}`, dados)
        : this.http.post<Perfil>('/api/perfis', dados);
      return { ok: true, perfil: await firstValueFrom(pedido) };
    } catch (erro) {
      return recusa(erro);
    }
  }

  async excluir(id: string): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.delete<void>(`/api/perfis/${id}`));
      return { ok: true };
    } catch (erro) {
      return recusa(erro);
    }
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
        ? 'Você não tem permissão para gerenciar perfis'
        : 'Não foi possível salvar o perfil'),
  };
}
