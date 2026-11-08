import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ErroApi } from '../../core/auth/sessao';

/** Categoria de `/api/financeiro/categorias` (story 11-1, RN-23.1). */
export interface Categoria {
  id: string;
  nome: string;
  ativa: boolean;
}

/** Conta (uma parcela) de `/api/financeiro/contas`. `vencimento` em `AAAA-MM-DD`; documento do fornecedor com máscara. */
export interface Conta {
  id: string;
  descricao: string;
  categoriaId: string;
  categoria: string;
  valor: number;
  vencimento: string;
  fornecedor: { id: string; razaoSocial: string; documento: string } | null;
  numeroDocumento: string | null;
  observacao: string | null;
  parcela: number;
  totalDeParcelas: number;
  parcelamentoId: string | null;
}

/** Campos de alterar uma conta. `fornecedorDocumento`: CNPJ/CPF de um fornecedor cadastrado, ou nulo. */
export interface DadosConta {
  descricao: string;
  categoriaId: string;
  valor: number;
  vencimento: string;
  fornecedorDocumento: string | null;
  numeroDocumento: string | null;
  observacao: string | null;
}

/** Lançar: `valor` é o total e `vencimento` o primeiro vencimento (RN-23.3). */
export interface DadosLancamento extends DadosConta {
  parcelas: number;
}

/** Recusa: `status` é o HTTP (ex.: 404 quando a conta foi excluída em outra sessão). */
export type Resultado<T = void> =
  | ({ ok: true } & (T extends void ? unknown : { valor: T }))
  | { ok: false; mensagem: string; status: number };

const CATEGORIAS = '/api/financeiro/categorias';
const CONTAS = '/api/financeiro/contas';

/**
 * Chamadas de `/api/financeiro` (story 11-1). Recusas do servidor (400, 403, 404, 409) voltam como `mensagem` — ex.:
 * "Esta categoria tem contas. Você pode inativá-la"; o resto é propagado.
 */
@Injectable({ providedIn: 'root' })
export class FinanceiroService {
  private readonly http = inject(HttpClient);

  listarCategorias(incluirInativas: boolean): Promise<Categoria[]> {
    const params = incluirInativas ? new HttpParams().set('incluirInativas', 'true') : undefined;
    return firstValueFrom(this.http.get<Categoria[]>(CATEGORIAS, { params }));
  }

  criarCategoria(nome: string): Promise<Resultado<Categoria>> {
    return valor(this.http.post<Categoria>(CATEGORIAS, { nome }));
  }

  alterarCategoria(id: string, nome: string): Promise<Resultado<Categoria>> {
    return valor(this.http.put<Categoria>(`${CATEGORIAS}/${id}`, { nome }));
  }

  inativarCategoria(id: string): Promise<Resultado> {
    return vazio(this.http.post<void>(`${CATEGORIAS}/${id}/inativar`, null));
  }

  reativarCategoria(id: string): Promise<Resultado> {
    return vazio(this.http.post<void>(`${CATEGORIAS}/${id}/reativar`, null));
  }

  /** Com contas, o servidor recusa (RN-23.1): só inativar. */
  excluirCategoria(id: string): Promise<Resultado> {
    return vazio(this.http.delete<void>(`${CATEGORIAS}/${id}`));
  }

  listarContas(): Promise<Conta[]> {
    return firstValueFrom(this.http.get<Conta[]>(CONTAS));
  }

  /** Devolve as parcelas criadas (cenário 23.1). */
  lancarConta(dados: DadosLancamento): Promise<Resultado<Conta[]>> {
    return valor(this.http.post<Conta[]>(CONTAS, dados));
  }

  alterarConta(id: string, dados: DadosConta): Promise<Resultado<Conta>> {
    return valor(this.http.put<Conta>(`${CONTAS}/${id}`, dados));
  }

  excluirConta(id: string): Promise<Resultado> {
    return vazio(this.http.delete<void>(`${CONTAS}/${id}`));
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

function recusa(erro: unknown): { ok: false; mensagem: string; status: number } {
  if (!(erro instanceof HttpErrorResponse) || ![400, 403, 404, 409].includes(erro.status))
    throw erro;

  const corpo = erro.error as (Partial<ErroApi> & { errors?: Record<string, string[]> }) | null;
  const validacao = corpo?.errors ? Object.values(corpo.errors).flat()[0] : undefined;
  const mensagem = (typeof corpo?.mensagem === 'string' && corpo.mensagem) || validacao;
  return {
    ok: false,
    status: erro.status,
    mensagem:
      mensagem ||
      (erro.status === 403
        ? 'Você não tem permissão para esta operação'
        : 'Não foi possível salvar'),
  };
}
