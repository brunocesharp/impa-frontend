import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { descricaoDaPermissao } from './liberacao';
import { LiberacaoService } from './liberacao.service';

export interface DadosLiberacao {
  permissao: string;
}

/**
 * Liberação por administrador (story 1-5, cenário 1.8): no terminal do operador, quem pode liberar informa usuário e
 * senha. Fecha com o token de uso único; cancelar fecha sem valor e a operação segue recusada.
 */
@Component({
  selector: 'app-liberacao-dialogo',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Liberação necessária</h2>
    <form [formGroup]="formulario" (ngSubmit)="liberar()" novalidate>
      <mat-dialog-content>
        <p class="explicacao">
          Seu perfil não permite <strong>{{ descricao }}</strong
          >. Um administrador pode liberar esta operação informando usuário e senha.
        </p>

        <mat-form-field appearance="outline">
          <mat-label>Usuário do administrador</mat-label>
          <input
            matInput
            formControlName="usuario"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
          />
          @if (formulario.controls.usuario.hasError('required')) {
            <mat-error>Informe o usuário</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Senha</mat-label>
          <!-- autocomplete="off": a senha é do administrador, não do operador deste navegador. -->
          <input matInput type="password" formControlName="senha" autocomplete="off" />
          @if (formulario.controls.senha.hasError('required')) {
            <mat-error>Informe a senha</mat-error>
          }
        </mat-form-field>

        @if (erro(); as mensagem) {
          <p class="erro" role="alert">
            <mat-icon aria-hidden="true">cancel</mat-icon>
            <span>{{ mensagem }}</span>
          </p>
        }
      </mat-dialog-content>
      <mat-dialog-actions>
        <button mat-button type="button" (click)="cancelar()" [disabled]="enviando()">
          Cancelar
        </button>
        <button mat-flat-button type="submit" [disabled]="enviando()">Liberar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .explicacao {
      margin: 0 0 16px;
    }
    mat-form-field {
      display: block;
    }
    .erro {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 0;
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiberacaoDialogo {
  private readonly dados = inject<DadosLiberacao>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<LiberacaoDialogo, string>>(MatDialogRef);
  private readonly servico = inject(LiberacaoService);

  protected readonly descricao = descricaoDaPermissao(this.dados.permissao).toLowerCase();

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    usuario: ['', Validators.required],
    senha: ['', Validators.required],
  });

  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected async liberar(): Promise<void> {
    if (this.formulario.invalid || this.enviando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    try {
      const { usuario, senha } = this.formulario.getRawValue();
      const resultado = await this.servico.liberar(usuario.trim(), senha, this.dados.permissao);
      if (resultado.ok) {
        this.ref.close(resultado.token);
        return;
      }
      this.erro.set(resultado.mensagem);
      this.formulario.controls.senha.reset();
    } catch {
      this.erro.set('Não foi possível liberar a operação. Tente novamente');
    } finally {
      this.enviando.set(false);
    }
  }

  protected cancelar(): void {
    this.ref.close();
  }
}
