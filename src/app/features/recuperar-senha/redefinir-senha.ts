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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SENHA_MINIMA } from '../../core/auth/sessao';
import { TemaService } from '../../core/tema/tema.service';
import { MENSAGEM_LINK_INVALIDO, RecuperarSenhaService } from './recuperar-senha.service';

/**
 * Nova senha a partir do link do e-mail (story 1-8, cenário 1.9): `/redefinir-senha#token=...`. O token vem no
 * fragmento (não vai ao servidor nos logs de acesso nem no Referer) e sai da barra de endereço assim que é lido.
 * Link vencido, já usado ou adulterado: "Link inválido ou expirado", com o caminho para pedir outro.
 */
@Component({
  selector: 'app-redefinir-senha',
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
        <h1>Nova senha</h1>

        @if (linkInvalido()) {
          <p class="erro" role="alert">
            <mat-icon aria-hidden="true">link_off</mat-icon>
            <span>{{ mensagemLinkInvalido }}</span>
          </p>
          <p class="explicacao">
            O link vale por 30 minutos e só pode ser usado uma vez. Peça um novo link.
          </p>
          <div class="acoes">
            <a mat-button routerLink="/login">Voltar ao login</a>
            <span class="espaco"></span>
            <a mat-flat-button routerLink="/esqueci-senha">Pedir novo link</a>
          </div>
        } @else {
          <p class="explicacao">
            Escolha uma senha com pelo menos {{ minima }} caracteres. As sessões abertas com a senha
            antiga serão encerradas.
          </p>

          <form [formGroup]="formulario" (ngSubmit)="salvar()" novalidate>
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
              } @else if (formulario.controls.novaSenha.getError('servidor'); as mensagem) {
                <mat-error>{{ mensagem }}</mat-error>
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

            @if (erro(); as mensagem) {
              <p class="erro" role="alert">
                <mat-icon aria-hidden="true">cancel</mat-icon>
                <span>{{ mensagem }}</span>
              </p>
            }

            <div class="acoes">
              <a mat-button routerLink="/login">Cancelar</a>
              <span class="espaco"></span>
              <button mat-flat-button type="submit" [disabled]="enviando()">
                {{ enviando() ? 'Salvando…' : 'Salvar nova senha' }}
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
export class RedefinirSenha {
  private readonly recuperacao = inject(RecuperarSenhaService);
  private readonly router = inject(Router);
  protected readonly tema = inject(TemaService);

  protected readonly minima = SENHA_MINIMA;
  protected readonly mensagemLinkInvalido = MENSAGEM_LINK_INVALIDO;
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  /** Token lido do fragmento; vazio = link sem token (já recusado sem chamar o servidor). */
  private readonly token = tokenDoFragmento(inject(ActivatedRoute).snapshot.fragment);
  protected readonly linkInvalido = signal(!this.token);

  protected readonly formulario = inject(NonNullableFormBuilder).group(
    {
      novaSenha: ['', [Validators.required, Validators.minLength(SENHA_MINIMA)]],
      confirmacao: [''],
    },
    { validators: confirmacaoIgual },
  );

  constructor() {
    // Tira o token da barra de endereço e do histórico: fica só na memória desta tela.
    if (this.token) void this.router.navigate([], { fragment: undefined, replaceUrl: true });
  }

  protected async salvar(): Promise<void> {
    if (this.formulario.invalid || this.enviando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    try {
      const resultado = await this.recuperacao.redefinir(
        this.token,
        this.formulario.getRawValue().novaSenha,
      );
      if (resultado.ok) {
        await this.router.navigateByUrl('/login');
      } else if (resultado.linkInvalido) {
        this.linkInvalido.set(true);
      } else if (resultado.novaSenha) {
        const controle = this.formulario.controls.novaSenha;
        controle.setErrors({ servidor: resultado.novaSenha });
        controle.markAsTouched();
      } else {
        this.erro.set(resultado.mensagem ?? 'Não foi possível salvar. Tente de novo.');
      }
    } catch {
      this.erro.set('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      this.enviando.set(false);
    }
  }
}

/** `token=...` do fragmento da URL (`#token=abc`). */
export function tokenDoFragmento(fragmento: string | null): string {
  if (!fragmento) return '';
  return new URLSearchParams(fragmento).get('token')?.trim() ?? '';
}

function confirmacaoIgual(grupo: AbstractControl): ValidationErrors | null {
  const nova = grupo.get('novaSenha')!;
  const confirmacao = grupo.get('confirmacao')!;
  const erros = { ...(confirmacao.errors ?? {}) };
  if (confirmacao.value !== nova.value) erros['diferente'] = true;
  else delete erros['diferente'];
  confirmacao.setErrors(Object.keys(erros).length ? erros : null, { emitEvent: false });
  return null;
}
