import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ErroApi, MENSAGEM_CREDENCIAL_INVALIDA, Sessao } from './sessao';

export type ResultadoEntrar = { ok: true } | { ok: false; mensagem: string };

/**
 * Sessão do usuário. Quem decide é o servidor (cookie HttpOnly, ADR-006): aqui só se guarda
 * o que `GET /api/auth/me` respondeu, para a tela e o menu.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _sessao = signal<Sessao | null>(null);
  private consultada = false;

  readonly sessao = this._sessao.asReadonly();
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
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/login', { usuario, senha }));
    } catch (erro) {
      if (erro instanceof HttpErrorResponse && erro.status === 401)
        return { ok: false, mensagem: MENSAGEM_CREDENCIAL_INVALIDA };
      // 400: token XSRF ausente/vencido (aba antiga) ou campos vazios; a API explica.
      if (erro instanceof HttpErrorResponse && erro.status === 400)
        return { ok: false, mensagem: (erro.error as ErroApi | null)?.mensagem ?? 'Não foi possível entrar. Recarregue a página.' };
      throw erro;
    }

    await this.carregarSessao();
    return { ok: true };
  }

  async sair(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/logout', null));
    } finally {
      this.encerrarLocalmente();
    }
  }

  /** A sessão acabou no servidor (401 em qualquer chamada): esquece o usuário. */
  encerrarLocalmente(): void {
    this._sessao.set(null);
    this.consultada = true;
  }
}
