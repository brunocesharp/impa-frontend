import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ErroApi } from '../../core/auth/sessao';

/** Cliente de `/api/pessoas/clientes` (story 3-7). `documento` com máscara; `telefone` só dígitos. */
export interface Cliente {
  id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  observacoes: string | null;
  ativo: boolean;
}

export interface DadosCliente {
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  observacoes: string | null;
}

/** Fornecedor de `/api/pessoas/fornecedores` (story 3-7). `documento` com máscara; `telefone` só dígitos. */
export interface Fornecedor {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  documento: string;
  telefone: string | null;
  email: string | null;
  contato: string | null;
  ativo: boolean;
}

export interface DadosFornecedor {
  razaoSocial: string;
  documento: string | null;
  nomeFantasia: string | null;
  telefone: string | null;
  email: string | null;
  contato: string | null;
}

export type Resultado<T = void> =
  ({ ok: true } & (T extends void ? unknown : { valor: T })) | { ok: false; mensagem: string };

const CLIENTES = '/api/pessoas/clientes';
const FORNECEDORES = '/api/pessoas/fornecedores';

/**
 * Chamadas de `/api/pessoas` (clientes e fornecedores). Recusas do servidor (400, 403, 404, 409) voltam como
 * `mensagem` — ex.: "CPF já cadastrado para Maria Souza"; o resto é propagado.
 */
@Injectable({ providedIn: 'root' })
export class PessoasService {
  private readonly http = inject(HttpClient);

  listarClientes(busca: string, incluirInativos: boolean): Promise<Cliente[]> {
    return firstValueFrom(
      this.http.get<Cliente[]>(CLIENTES, { params: filtro(busca, incluirInativos) }),
    );
  }

  cadastrarCliente(dados: DadosCliente): Promise<Resultado<Cliente>> {
    return valor(this.http.post<Cliente>(CLIENTES, dados));
  }

  alterarCliente(id: string, dados: DadosCliente): Promise<Resultado<Cliente>> {
    return valor(this.http.put<Cliente>(`${CLIENTES}/${id}`, dados));
  }

  inativarCliente(id: string): Promise<Resultado> {
    return vazio(this.http.post<void>(`${CLIENTES}/${id}/inativar`, null));
  }

  reativarCliente(id: string): Promise<Resultado> {
    return vazio(this.http.post<void>(`${CLIENTES}/${id}/reativar`, null));
  }

  /** Com histórico (vendas, notas, contas), o servidor recusa: "Este cliente tem histórico. Você pode inativá-lo". */
  excluirCliente(id: string): Promise<Resultado> {
    return vazio(this.http.delete<void>(`${CLIENTES}/${id}`));
  }

  listarFornecedores(busca: string, incluirInativos: boolean): Promise<Fornecedor[]> {
    return firstValueFrom(
      this.http.get<Fornecedor[]>(FORNECEDORES, { params: filtro(busca, incluirInativos) }),
    );
  }

  cadastrarFornecedor(dados: DadosFornecedor): Promise<Resultado<Fornecedor>> {
    return valor(this.http.post<Fornecedor>(FORNECEDORES, dados));
  }

  alterarFornecedor(id: string, dados: DadosFornecedor): Promise<Resultado<Fornecedor>> {
    return valor(this.http.put<Fornecedor>(`${FORNECEDORES}/${id}`, dados));
  }

  inativarFornecedor(id: string): Promise<Resultado> {
    return vazio(this.http.post<void>(`${FORNECEDORES}/${id}/inativar`, null));
  }

  reativarFornecedor(id: string): Promise<Resultado> {
    return vazio(this.http.post<void>(`${FORNECEDORES}/${id}/reativar`, null));
  }

  excluirFornecedor(id: string): Promise<Resultado> {
    return vazio(this.http.delete<void>(`${FORNECEDORES}/${id}`));
  }
}

function filtro(busca: string, incluirInativos: boolean): HttpParams {
  let params = new HttpParams();
  if (busca.trim()) params = params.set('busca', busca.trim());
  if (incluirInativos) params = params.set('incluirInativos', 'true');
  return params;
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
        ? 'Você não tem permissão para esta operação'
        : 'Não foi possível salvar'),
  };
}
