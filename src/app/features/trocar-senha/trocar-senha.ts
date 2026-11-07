import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SENHA_MINIMA } from '../../core/auth/sessao';

/**
 * Troca obrigatória de senha (story 1-4, cenário 1.7, RN-1.8): depois de entrar com a senha provisória, o usuário
 * define a própria senha antes de acessar qualquer função. O guard o prende aqui; o servidor também recusa o resto.
 */
@Component({
  selector: 'app-trocar-senha',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  template: `
    <main class="pagina">
      <mat-card appearance="outlined">
        <h1>Defina uma nova senha</h1>
        <p class="explicacao">
          Olá, {{ auth.sessao()?.nome }}. Você entrou com uma senha provisória. Para continuar,
          escolha uma senha sua, com pelo menos {{ minima }} caracteres.
        </p>

        <form [formGroup]="formulario" (ngSubmit)="trocar()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label>Senha provisória</mat-label>
            <input
              matInput
              type="password"
              data-campo="senhaAtual"
              formControlName="senhaAtual"
              autocomplete="current-password"
            />
            @if (formulario.controls.senhaAtual.hasError('required')) {
              <mat-error>Informe a senha provisória</mat-error>
            } @else if (formulario.controls.senhaAtual.hasError('servidor')) {
              <mat-error>{{ formulario.controls.senhaAtual.getError('servidor') }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Nova senha</mat-label>
            <input
              matInput
              type="password"
              data-campo="novaSenha"
              formControlName="novaSenha"
              autocomplete="new-password"
            />
            <mat-hint>Pelo menos {{ minima }} caracteres</mat-hint>
            @if (
              formulario.controls.novaSenha.hasError('required') ||
              formulario.controls.novaSenha.hasError('minlength')
            ) {
              <mat-error>A senha precisa ter pelo menos {{ minima }} caracteres</mat-error>
            } @else if (formulario.controls.novaSenha.hasError('igual')) {
              <mat-error>A nova senha precisa ser diferente da provisória</mat-error>
            } @else if (formulario.controls.novaSenha.hasError('servidor')) {
              <mat-error>{{ formulario.controls.novaSenha.getError('servidor') }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Repita a nova senha</mat-label>
            <input
              matInput
              type="password"
              data-campo="confirmacao"
              formControlName="confirmacao"
              autocomplete="new-password"
            />
            @if (formulario.controls.confirmacao.hasError('diferente')) {
              <mat-error>As senhas não conferem</mat-error>
            }
          </mat-form-field>

          @if (erro()) {
            <p class="erro" role="alert">{{ erro() }}</p>
          }

          <div class="acoes">
            <button mat-button type="button" (click)="sair()">Sair</button>
            <span class="espaco"></span>
            <button mat-flat-button type="submit" [disabled]="enviando()">Salvar nova senha</button>
          </div>
        </form>
      </mat-card>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: var(--impa-fundo);
    }
    .pagina {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: 16px;
      box-sizing: border-box;
    }
    mat-card {
      width: min(100%, 440px);
      padding: 24px;
      background: var(--impa-superficie);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 24px;
    }
    .explicacao {
      margin: 0 0 16px;
      color: var(--impa-texto-secundario);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .erro {
      margin: 0 0 8px;
      color: var(--mat-sys-error);
    }
    .acoes {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .espaco {
      flex: 1;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrocarSenha {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly minima = SENHA_MINIMA;
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly formulario = inject(NonNullableFormBuilder).group(
    {
      senhaAtual: ['', Validators.required],
      novaSenha: ['', [Validators.required, Validators.minLength(SENHA_MINIMA)]],
      confirmacao: [''],
    },
    { validators: regrasDaTroca },
  );

  protected async trocar(): Promise<void> {
    if (this.formulario.invalid || this.enviando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    try {
      const { senhaAtual, novaSenha } = this.formulario.getRawValue();
      const resultado = await this.auth.trocarSenha(senhaAtual, novaSenha);
      if (resultado.ok) {
        await this.router.navigateByUrl('/');
      } else if (resultado.campos) {
        for (const [campo, mensagem] of Object.entries(resultado.campos)) {
          const controle = this.formulario.controls[campo as keyof typeof this.formulario.controls];
          controle.setErrors({ servidor: mensagem });
          controle.markAsTouched();
        }
      } else {
        this.erro.set(resultado.mensagem);
      }
    } catch {
      this.erro.set('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      this.enviando.set(false);
    }
  }

  protected async sair(): Promise<void> {
    try {
      await this.auth.sair();
    } catch {
      this.erro.set('Não foi possível sair. Tente de novo.');
      return;
    }
    await this.router.navigateByUrl('/login');
  }
}

/** Nova senha diferente da provisória e igual à confirmação (o servidor também confere as duas primeiras). */
function regrasDaTroca(grupo: AbstractControl): ValidationErrors | null {
  const atual = grupo.get('senhaAtual')!;
  const nova = grupo.get('novaSenha')!;
  const confirmacao = grupo.get('confirmacao')!;

  marcar(nova, 'igual', !!nova.value && nova.value === atual.value);
  marcar(confirmacao, 'diferente', confirmacao.value !== nova.value);
  return null;
}

function marcar(controle: AbstractControl, erro: string, ligado: boolean): void {
  const erros = { ...(controle.errors ?? {}) };
  if (ligado) erros[erro] = true;
  else delete erros[erro];
  controle.setErrors(Object.keys(erros).length ? erros : null, { emitEvent: false });
}
