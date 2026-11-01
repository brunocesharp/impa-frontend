import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/**
 * A API não respondeu ao abrir o app (logo depois de uma atualização, sem rede): em vez de tela em branco,
 * explica e deixa tentar de novo, voltando ao destino original.
 */
@Component({
  selector: 'app-indisponivel',
  imports: [MatCardModule, MatIconModule, MatButtonModule],
  template: `
    <main class="pagina">
      <mat-card appearance="outlined" class="vazio">
        <mat-icon aria-hidden="true">cloud_off</mat-icon>
        <h1>Sem conexão com o IMPA</h1>
        <p role="alert">Não foi possível falar com o servidor. Confira a internet ou aguarde um instante.</p>
        <button mat-flat-button type="button" (click)="tentarDeNovo()" [disabled]="tentando()">
          {{ tentando() ? 'Tentando…' : 'Tentar de novo' }}
        </button>
      </mat-card>
    </main>
  `,
  styles: `
    .pagina { min-height: 100dvh; display: grid; place-items: center; padding: 16px; background: var(--impa-fundo); }
    .vazio {
      display: grid;
      justify-items: center;
      gap: 12px;
      max-width: 440px;
      padding: 48px 24px;
      text-align: center;
      background: var(--impa-superficie);
    }
    mat-icon { font-size: 36px; width: 36px; height: 36px; color: var(--impa-texto-secundario); }
    h1 { margin: 0; font-size: 32px; }
    p { margin: 0; color: var(--impa-texto-secundario); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Indisponivel {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Rota que o usuário tentava abrir (query `volta`, via withComponentInputBinding). */
  readonly volta = input<string | undefined>();

  protected readonly tentando = signal(false);

  protected async tentarDeNovo(): Promise<void> {
    this.tentando.set(true);
    try {
      const sessao = await this.auth.carregarSessao();
      await this.router.navigateByUrl(sessao ? destinoSeguro(this.volta()) : '/login');
    } catch {
      // Continua indisponível: a mensagem já está na tela.
    } finally {
      this.tentando.set(false);
    }
  }
}

/** Só caminhos internos do app (evita redirecionamento aberto por `?volta=https://...`). */
function destinoSeguro(volta: string | undefined): string {
  return volta?.startsWith('/') && !volta.startsWith('//') && !volta.startsWith('/indisponivel') ? volta : '/';
}
