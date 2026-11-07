import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ErroApi } from '../../../core/auth/sessao';

/** Usuário de `GET /api/usuarios` (story 1-4). */
export interface Usuario {
  id: string;
  usuario: string;
  nome: string;
  email: string | null;
  perfilId: string | null;
  perfil: string;
  ativo: boolean;
  /** Ainda está com a senha provisória (não trocou desde a criação ou a redefinição). */
  trocaDeSenhaObrigatoria: boolean;
}

/**
 * Perfil para escolher na tela Usuários, de `GET /api/usuarios/perfis` (revisão 1, R3): exige só
 * `usuarios.gerenciar`, ao contrário de `/api/perfis` (que exige `perfis.gerenciar`).
 */
export interface PerfilResumo {
  id: string;
  nome: string;
  protegido: boolean;
}

/** Resposta de criar usuário e redefinir senha: a senha provisória, mostrada uma única vez (RN-1.8). */
export interface SenhaProvisoria {
  id: string;
  senhaProvisoria: string;
}

export interface NovoUsuario {
  usuario: string;
  nome: string;
  email: string | null;
  perfilId: string;
  /** Sem senha, o sistema gera a provisória. */
  senha: string | null;
}

export interface DadosUsuario {
  nome: string;
  email: string | null;
  perfilId: string;
}

export type Resultado<T = void> =
  ({ ok: true } & (T extends void ? unknown : { valor: T })) | { ok: false; mensagem: string };

/** Chamadas de `/api/usuarios`. Recusas do servidor (400, 403, 404, 409) voltam como `mensagem`; o resto é propagado. */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);

  listar(): Promise<Usuario[]> {
    return firstValueFrom(this.http.get<Usuario[]>('/api/usuarios'));
  }

  listarPerfis(): Promise<PerfilResumo[]> {
    return firstValueFrom(this.http.get<PerfilResumo[]>('/api/usuarios/perfis'));
  }

  criar(dados: NovoUsuario): Promise<Resultado<SenhaProvisoria>> {
    return valor(this.http.post<SenhaProvisoria>('/api/usuarios', dados));
  }

  alterar(id: string, dados: DadosUsuario): Promise<Resultado<Usuario>> {
    return valor(this.http.put<Usuario>(`/api/usuarios/${id}`, dados));
  }

  async desativar(id: string): Promise<Resultado> {
    return vazio(this.http.post<void>(`/api/usuarios/${id}/desativar`, null));
  }

  async reativar(id: string): Promise<Resultado> {
    return vazio(this.http.post<void>(`/api/usuarios/${id}/reativar`, null));
  }

  /** Sem senha informada, o sistema gera a provisória. */
  redefinirSenha(id: string, senha: string | null = null): Promise<Resultado<SenhaProvisoria>> {
    return valor(
      this.http.post<SenhaProvisoria>(
        `/api/usuarios/${id}/redefinir-senha`,
        senha ? { senha } : null,
      ),
    );
  }
}

async function valor<T>(pedido: Observable<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, valor: await firstValueFrom(pedido) } as Resultado<T>;
  } catch (erro) {
    return recusa(erro);
  }
}

async function vazio(pedido: Observable<void>): Promise<Resultado> {
  try {
    await firstValueFrom(pedido);
    return { ok: true };
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
        ? 'Você não tem permissão para gerenciar usuários'
        : 'Não foi possível salvar o usuário'),
  };
}
