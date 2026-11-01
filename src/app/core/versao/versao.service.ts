import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VERSAO_WEB, Versao } from './versao';

/** Versões do front e da API, para o rodapé do sistema. */
@Injectable({ providedIn: 'root' })
export class VersaoService {
  private readonly http = inject(HttpClient);
  private carregando?: Promise<void>;

  readonly web: Versao = VERSAO_WEB;

  private readonly _api = signal<Versao | null>(null);
  /** Versão da API (`GET /api/versao`, exige sessão); nula até responder ou se falhar. */
  readonly api = this._api.asReadonly();

  /** Consulta a versão da API uma vez por carga do app; falha não quebra a tela. */
  carregarApi(): Promise<void> {
    this.carregando ??= firstValueFrom(this.http.get<Versao>('/api/versao')).then(
      (versao) => this._api.set(versao),
      () => {
        this._api.set(null);
        this.carregando = undefined; // tenta de novo na próxima abertura do shell
      },
    );
    return this.carregando;
  }
}
