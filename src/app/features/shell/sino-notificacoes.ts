import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificacoesService } from '../../core/notificacoes/notificacoes.service';

/**
 * Sino da barra superior com o contador de não lidas em Impacto (direção de arte, prancha seção 03) e o painel com
 * a lista, "marcar como lida" e "marcar todas" (story 4-2). O shell só o mostra com `notificacoes.receber`.
 */
@Component({
  selector: 'app-sino-notificacoes',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      type="button"
      class="sino"
      data-sino
      [matMenuTriggerFor]="painel"
      (menuOpened)="abrir()"
      [attr.aria-label]="rotulo()"
      [title]="rotulo()"
    >
      <mat-icon>notifications</mat-icon>
      @if (servico.naoLidas() > 0) {
        <span class="contador" data-contador aria-hidden="true">{{ servico.naoLidas() > 99 ? '99+' : servico.naoLidas() }}</span>
      }
    </button>

    <mat-menu #painel="matMenu" class="painel-notificacoes" xPosition="before">
      <div class="cabecalho" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
        <strong>Notificações</strong>
        <button
          mat-button
          type="button"
          data-marcar-todas
          [disabled]="servico.naoLidas() === 0"
          (click)="marcarTodas()"
        >
          Marcar todas
        </button>
      </div>
      <ul class="lista" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
        @for (notificacao of servico.itens(); track notificacao.id) {
          <li data-notificacao [class.nao-lida]="!notificacao.lida">
            <div class="texto">
              <span class="titulo">{{ notificacao.titulo }}</span>
              <span>{{ notificacao.texto }}</span>
              <time [attr.datetime]="notificacao.criadaEm">{{ notificacao.criadaEm | date: 'dd/MM/yyyy HH:mm' }}</time>
            </div>
            @if (!notificacao.lida) {
              <button
                mat-icon-button
                type="button"
                data-marcar-lida
                aria-label="Marcar como lida"
                title="Marcar como lida"
                (click)="marcarComoLida(notificacao.id)"
              >
                <mat-icon>done</mat-icon>
              </button>
            }
          </li>
        } @empty {
          <li class="vazio" data-sem-notificacoes>Nenhuma notificação</li>
        }
      </ul>
    </mat-menu>
  `,
  styles: `
    .sino {
      position: relative;
    }

    .contador {
      position: absolute;
      top: 4px;
      right: 2px;
      min-width: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: var(--impa-impacto);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      line-height: 16px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    }

    .cabecalho {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 8px 4px 16px;
      border-bottom: 1px solid var(--impa-borda);
    }

    .lista {
      margin: 0;
      padding: 0;
      list-style: none;
      max-height: 360px;
      overflow-y: auto;

      li {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 8px 10px 16px;
        border-bottom: 1px solid var(--impa-borda);
        font-size: 13px;
        color: var(--impa-texto-secundario);

        &.nao-lida {
          color: var(--impa-texto);

          .titulo::before {
            content: '';
            display: inline-block;
            width: 6px;
            height: 6px;
            margin-right: 6px;
            border-radius: 50%;
            background: var(--impa-impacto);
            vertical-align: middle;
          }
        }
      }

      .vazio {
        justify-content: center;
        padding: 20px 16px;
      }
    }

    .texto {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
    }

    .titulo {
      font-weight: 600;
    }

    time {
      font-size: 12px;
      color: var(--impa-texto-secundario);
    }
  `,
})
export class SinoNotificacoes {
  protected readonly servico = inject(NotificacoesService);
  private readonly avisos = inject(MatSnackBar);

  protected rotulo(): string {
    const n = this.servico.naoLidas();
    return n === 0 ? 'Notificações' : `Notificações: ${n} não ${n === 1 ? 'lida' : 'lidas'}`;
  }

  protected async abrir(): Promise<void> {
    await this.tentar(() => this.servico.carregarLista(), 'Não foi possível carregar as notificações.');
  }

  protected async marcarComoLida(id: string): Promise<void> {
    await this.tentar(() => this.servico.marcarComoLida(id), 'Não foi possível marcar como lida. Tente de novo.');
  }

  protected async marcarTodas(): Promise<void> {
    await this.tentar(() => this.servico.marcarTodas(), 'Não foi possível marcar todas. Tente de novo.');
  }

  private async tentar(acao: () => Promise<void>, mensagem: string): Promise<void> {
    try {
      await acao();
    } catch {
      this.avisos.open(mensagem, 'OK', { duration: 6000 });
    }
  }
}
