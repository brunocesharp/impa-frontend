import { ClipboardModule } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface DadosSenhaProvisoria {
  nome: string;
  senha: string;
  /** `true` na criação do usuário; `false` na redefinição. */
  novo: boolean;
}

/**
 * Mostra a senha provisória uma única vez (story 1-4, T2): o servidor não a guarda em texto, e ela não aparece
 * de novo depois que o diálogo fecha.
 */
@Component({
  selector: 'app-senha-provisoria-dialogo',
  imports: [ClipboardModule, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ dados.novo ? 'Usuário criado' : 'Senha redefinida' }}</h2>
    <mat-dialog-content>
      <p>
        Senha provisória de <strong>{{ dados.nome }}</strong
        >:
      </p>
      <p class="senha" data-senha-provisoria>{{ dados.senha }}</p>
      <p class="nota">
        Anote e entregue a {{ dados.nome }}. Ela não será mostrada de novo. No próximo acesso, será
        preciso definir uma nova senha.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button
        mat-button
        type="button"
        [cdkCopyToClipboard]="dados.senha"
        (cdkCopyToClipboardCopied)="copiada.set($event)"
      >
        <mat-icon>{{ copiada() ? 'check' : 'content_copy' }}</mat-icon>
        {{ copiada() ? 'Copiada' : 'Copiar' }}
      </button>
      <button mat-flat-button type="button" mat-dialog-close>Fechar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .senha {
      margin: 8px 0 16px;
      font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: 0.04em;
      user-select: all;
    }
    .nota {
      margin: 0;
      color: var(--impa-texto-secundario);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SenhaProvisoriaDialogo {
  protected readonly dados = inject<DadosSenhaProvisoria>(MAT_DIALOG_DATA);
  protected readonly copiada = signal(false);
}
