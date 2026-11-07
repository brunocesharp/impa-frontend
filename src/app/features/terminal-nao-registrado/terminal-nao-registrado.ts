import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MENSAGEM_TERMINAL_NAO_REGISTRADO } from '../../core/terminal/terminal.service';

/**
 * PDV ou caixa aberto num dispositivo que não é terminal registrado (story 1-6, cenário 11.6). As demais funções
 * (consultas, cadastro, inventário) continuam no menu, conforme as permissões (RN-11.1).
 */
@Component({
  selector: 'app-terminal-nao-registrado',
  imports: [MatCardModule, MatIconModule],
  template: `
    <mat-card appearance="outlined" class="vazio">
      <mat-icon aria-hidden="true">devices_off</mat-icon>
      <h2>Terminal não registrado</h2>
      <p role="alert" data-mensagem>{{ mensagem }}</p>
    </mat-card>
  `,
  styles: `
    .vazio {
      display: grid;
      justify-items: center;
      gap: 8px;
      padding: 48px 24px;
      text-align: center;
      background: var(--impa-superficie);
    }
    mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: var(--impa-texto-secundario);
    }
    h2 {
      margin: 0;
      font-size: 32px;
    }
    p {
      margin: 0;
      color: var(--impa-texto-secundario);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalNaoRegistrado {
  protected readonly mensagem = MENSAGEM_TERMINAL_NAO_REGISTRADO;
}
