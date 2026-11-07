import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CODIGO_BLOQUEADO,
  ErroApi,
  MENSAGEM_BLOQUEADO,
  MENSAGEM_CREDENCIAL_INVALIDA,
  MENSAGEM_MUITAS_TENTATIVAS,
  Sessao,
} from './sessao';

export type CampoLogin = 'usuario' | 'senha';

/**
 * Resultado do login. Recusa: `mensagem` geral (credencial, token XSRF) ou, na validação do servidor,
 * `campos` com a mensagem de cada campo e `mensagem` nula.
 */
export type ResultadoEntrar =
  | { ok: true }
  | { ok: false; mensagem: string; campos?: undefined }
  | { ok: false; mensagem: null; campos: Partial<Record<CampoLogin, string>> };

/**
 * Sessão do usuário. Quem decide é o servidor (cookie HttpOnly, ADR-006): aqui só se guarda
 * o que `GET /api/auth/me` respondeu, para a tela e o menu.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _sessao = signal<Sessao | null>(null);
  private readonly _aviso = signal<string | null>(null);
  private consultada = false;

  readonly sessao = this._sessao.asReadonly();
  /** Aviso para a tela de login, como "Sua sessão foi encerrada"; some na próxima tentativa de entrar. */
  readonly aviso = this._aviso.asReadonly();
  readonly autenticado = computed(() => this._sessao() !== null);
  readonly permissoes = computed<ReadonlySet<string>>(() => new Set(this._sessao()?.permissoes ?? []));

  temPermissao(permissao: string): boolean {
    return this.permissoes().has(permissao);
  }

  /** Consulta a sessão no servidor. Também entrega o cookie XSRF-TOKEN, exigido pelo login. */
  async carregarSessao(): Promise<Sessao | null> {
    try {
      this._sessao.set(await firstValueFrom(this.http.get<Sessao>('/api/auth/me')));
    } catch (erro) {
      if (!(erro instanceof HttpErrorResponse) || erro.status !== 401) throw erro;
      this._sessao.set(null);
    }
    this.consultada = true;
    return this._sessao();
  }

  /** Sessão já conhecida ou, na primeira vez, consultada no servidor. */
  garantirSessao(): Promise<Sessao | null> {
    return this.consultada ? Promise.resolve(this._sessao()) : this.carregarSessao();
  }

  async entrar(usuario: string, senha: string): Promise<ResultadoEntrar> {
    this._aviso.set(null); // nova tentativa: o aviso de sessão encerrada já foi visto
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/login', { usuario, senha }));
    } catch (erro) {
      if (!(erro instanceof HttpErrorResponse)) throw erro;
      if (erro.status === 401) {
        const padrao = codigoDe(erro) === CODIGO_BLOQUEADO ? MENSAGEM_BLOQUEADO : MENSAGEM_CREDENCIAL_INVALIDA;
        return { ok: false, mensagem: mensagemDe(erro) ?? padrao };
      }
      // Limite de tentativas por IP (story 1-10): recusa como o 401, não "sem conexão".
      if (erro.status === 429) return { ok: false, mensagem: mensagemDe(erro) ?? MENSAGEM_MUITAS_TENTATIVAS };
      if (erro.status === 400) {
        // Validação (ValidationProblem): mensagem por campo. Senão, token XSRF ausente/vencido (aba antiga).
        const campos = camposDe(erro);
        if (campos) return { ok: false, mensagem: null, campos };
        return { ok: false, mensagem: mensagemDe(erro) ?? 'Não foi possível entrar. Recarregue a página.' };
      }
      throw erro;
    }

    await this.carregarSessao();
    return { ok: true };
  }

  /**
   * Encerra a sessão no servidor e, depois, aqui. Se a sessão já tinha acabado (12 h, logout em outra aba:
   * 400/401), só resta esquecer o usuário. Qualquer outro erro (sem rede, 5xx) é propagado e o usuário
   * continua na sessão: o cookie pode seguir válido, e o próximo a abrir o login entraria como ele.
   */
  async sair(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/logout', null));
    } catch (erro) {
      const sessaoJaEncerrada = erro instanceof HttpErrorResponse && (erro.status === 400 || erro.status === 401);
      if (!sessaoJaEncerrada) throw erro;
    }
    this.encerrarLocalmente();
  }

  /**
   * A sessão acabou no servidor (401 em qualquer chamada): esquece o usuário. `aviso` fica para a tela de login
   * mostrar (ex.: "Sua sessão foi encerrada"). Sem aviso, o anterior continua: um segundo 401 da mesma
   * revogação não o apaga (R1); ele só some na próxima tentativa de entrar.
   */
  encerrarLocalmente(aviso: string | null = null): void {
    this._sessao.set(null);
    if (aviso) this._aviso.set(aviso);
    this.consultada = true;
  }
}

function codigoDe(erro: HttpErrorResponse): string | null {
  const codigo = (erro.error as Partial<ErroApi> | null)?.codigo;
  return typeof codigo === 'string' ? codigo : null;
}

function mensagemDe(erro: HttpErrorResponse): string | null {
  const mensagem = (erro.error as Partial<ErroApi> | null)?.mensagem;
  return typeof mensagem === 'string' && mensagem ? mensagem : null;
}

/** `errors` de um ValidationProblem do ASP.NET Core (`{ "Usuario": ["..."] }`), por campo do formulário. */
function camposDe(erro: HttpErrorResponse): Partial<Record<CampoLogin, string>> | null {
  const errors = (erro.error as { errors?: Record<string, string[]> } | null)?.errors;
  if (!errors || typeof errors !== 'object') return null;

  const campos: Partial<Record<CampoLogin, string>> = {};
  for (const [chave, mensagens] of Object.entries(errors)) {
    const campo = chave.toLowerCase();
    if ((campo === 'usuario' || campo === 'senha') && mensagens?.length) campos[campo] = mensagens[0];
  }
  return Object.keys(campos).length ? campos : null;
}
