import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { EMPTY, Subscription, catchError, firstValueFrom, interval, startWith, switchMap } from 'rxjs';

/** Item de `GET /api/notificacoes` (story 4-2). `lida` é a leitura do usuário da sessão. */
export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  texto: string;
  referenciaDaOrigem: string | null;
  criadaEm: string;
  lida: boolean;
}

export interface PaginaDeNotificacoes {
  itens: Notificacao[];
  pagina: number;
  tamanhoDaPagina: number;
  total: number;
}

/**
 * Intervalo da consulta do contador (v1 por consulta periódica, sem tempo real). Decisão em aberto da story 4-2,
 * seguindo a recomendação: 60 s, e na hora ao abrir o painel.
 */
export const INTERVALO_DA_CONSULTA_MS = 60_000;

/** Itens do painel: a primeira página, mais recentes primeiro. */
export const TAMANHO_DO_PAINEL = 20;

/**
 * Central de notificações do usuário da sessão (`/api/notificacoes`, exige `notificacoes.receber`). Cada usuário
 * marca as próprias como lidas (RN-2.3): o contador aqui é só o desta sessão.
 */
@Injectable({ providedIn: 'root' })
export class NotificacoesService {
  private readonly http = inject(HttpClient);
  private consulta?: Subscription;

  private readonly _naoLidas = signal(0);
  private readonly _itens = signal<Notificacao[]>([]);

  /** Contador do sino. */
  readonly naoLidas = this._naoLidas.asReadonly();
  /** Itens do painel (carregados ao abrir). */
  readonly itens = this._itens.asReadonly();

  /** Consulta o contador agora e a cada {@link INTERVALO_DA_CONSULTA_MS}. Chamar de novo não duplica. */
  iniciar(): void {
    if (this.consulta) return;
    this.consulta = interval(INTERVALO_DA_CONSULTA_MS)
      .pipe(startWith(0), switchMap(() => this.http.get<{ naoLidas: number }>('/api/notificacoes/nao-lidas/contagem').pipe(
        catchError(() => EMPTY), // sem rede ou API fora: fica o último valor
      )))
      .subscribe((r) => this._naoLidas.set(r.naoLidas));
  }

  /** Para a consulta e esquece o que havia (fim da sessão, perdeu a permissão). */
  parar(): void {
    this.consulta?.unsubscribe();
    this.consulta = undefined;
    this._naoLidas.set(0);
    this._itens.set([]);
  }

  /** Ao abrir o painel: a lista e o contador, na hora. */
  async carregarLista(): Promise<void> {
    const params = new HttpParams().set('pagina', 1).set('tamanho', TAMANHO_DO_PAINEL);
    const [pagina] = await Promise.all([
      firstValueFrom(this.http.get<PaginaDeNotificacoes>('/api/notificacoes', { params })),
      this.atualizarContagem(),
    ]);
    this._itens.set(pagina.itens);
  }

  async atualizarContagem(): Promise<void> {
    const r = await firstValueFrom(this.http.get<{ naoLidas: number }>('/api/notificacoes/nao-lidas/contagem'));
    this._naoLidas.set(r.naoLidas);
  }

  /** Marca só para o usuário da sessão; o contador baixa se ela ainda não estava lida. */
  async marcarComoLida(id: string): Promise<void> {
    await firstValueFrom(this.http.post<void>(`/api/notificacoes/${encodeURIComponent(id)}/lida`, null));
    const estavaNaoLida = this._itens().some((n) => n.id === id && !n.lida);
    this._itens.update((itens) => itens.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    if (estavaNaoLida) this._naoLidas.update((n) => Math.max(0, n - 1));
  }

  async marcarTodas(): Promise<void> {
    await firstValueFrom(this.http.post<void>('/api/notificacoes/lidas', null));
    this._itens.update((itens) => itens.map((n) => ({ ...n, lida: true })));
    this._naoLidas.set(0);
  }
}
