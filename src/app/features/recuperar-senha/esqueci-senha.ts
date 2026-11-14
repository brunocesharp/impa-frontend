import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { TemaService } from '../../core/tema/tema.service';
import { MENSAGEM_PEDIDO_RECEBIDO, RecuperarSenhaService } from './recuperar-senha.service';

/**
 * "Esqueci minha senha" (story 1-8, cenários 1.9 e 1.10): pede o usuário ou o e-mail e, enviado, mostra sempre a
 * mesma mensagem, exista ou não o usuário (RN-1.11). Quem não tem e-mail continua dependendo do administrador.
 */
@Component({
  selector: 'app-esqueci-senha',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  template: `
    <main class="pagina">
      <mat-card appearance="outlined">
        <img
          class="logo"
          [src]="tema.escuro() ? 'brand/logo-horizontal-negativo.png' : 'brand/logo-horizontal.png'"
          alt="Impacto Papelaria &amp; Serviços"
        />
        <h1>Esqueci minha senha</h1>

        @if (enviado()) {
          <p class="aviso" role="status">
            <mat-icon aria-hidden="true">mail</mat-icon>
            <span>{{ mensagemEnviado }}</span>
          </p>
          <p class="explicacao">
            O link vale por 30 minutos. Sem e-mail cadastrado, peça ao administrador para redefinir
            a senha.
          </p>
          <div class="acoes">
            <a mat-flat-button routerLink="/login">Voltar ao login</a>
          </div>
        } @else {
          <p class="explicacao">
            Informe seu usuário ou o e-mail cadastrado. Enviaremos um link para você escolher uma
            nova senha.
          </p>

          <form [formGroup]="formulario" (ngSubmit)="pedir()" novalidate>
            <mat-form-field appearance="outline">
              <mat-label>Usuário ou e-mail</mat-label>
              <input
                matInput
                formControlName="usuarioOuEmail"
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
              />
              @if (formulario.controls.usuarioOuEmail.hasError('required')) {
                <mat-error>Informe o usuário ou o e-mail</mat-error>
              }
            </mat-form-field>

            @if (erro(); as mensagem) {
              <p class="erro" role="alert">
                <mat-icon aria-hidden="true">cancel</mat-icon>
                <span>{{ mensagem }}</span>
              </p>
            }

            <div class="acoes">
              <a mat-button routerLink="/login">Voltar ao login</a>
              <span class="espaco"></span>
              <button mat-flat-button type="submit" [disabled]="enviando()">
                {{ enviando() ? 'Enviando…' : 'Enviar link' }}
              </button>
            </div>
          </form>
        }
      </mat-card>
    </main>
  `,
  styleUrl: './recuperar-senha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EsqueciSenha {
  private readonly recuperacao = inject(RecuperarSenhaService);
  protected readonly tema = inject(TemaService);

  protected readonly mensagemEnviado = MENSAGEM_PEDIDO_RECEBIDO;
  protected readonly enviando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    usuarioOuEmail: ['', naoEmBranco],
  });

  protected async pedir(): Promise<void> {
    if (this.formulario.invalid || this.enviando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    try {
      const resultado = await this.recuperacao.pedir(
        this.formulario.getRawValue().usuarioOuEmail.trim(),
      );
      if (resultado.ok) this.enviado.set(true);
      else this.erro.set(resultado.mensagem);
    } catch {
      this.erro.set('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      this.enviando.set(false);
    }
  }
}

function naoEmBranco(controle: AbstractControl<string>): ValidationErrors | null {
  return controle.value?.trim() ? null : { required: true };
}
