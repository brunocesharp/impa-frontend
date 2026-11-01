import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TemaService } from '../../core/tema/tema.service';
import { CenaEspacial } from './cena-espacial';

/** Login (cenários 1.1 e 1.2): painel espacial de um lado, formulário limpo do outro. */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, CenaEspacial],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly tema = inject(TemaService);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    usuario: ['', Validators.required],
    senha: ['', Validators.required],
  });

  /** Erro de campo só depois de tocado (o envio vazio marca todos): não acusa a senha limpa após recusa. */
  protected readonly erroQuandoTocado: ErrorStateMatcher = {
    isErrorState: (controle) => !!controle?.invalid && controle.touched,
  };

  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    // Consulta a sessão ao abrir: entrega o token XSRF que o login exige
    // e leva quem já está na sessão direto para o início.
    void this.auth.carregarSessao().then((sessao) => {
      if (sessao) void this.router.navigateByUrl('/');
    });
  }

  protected async entrar(): Promise<void> {
    if (this.formulario.invalid || this.enviando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    try {
      const { usuario, senha } = this.formulario.getRawValue();
      const resultado = await this.auth.entrar(usuario, senha);
      if (resultado.ok) {
        await this.router.navigateByUrl('/');
      } else {
        this.erro.set(resultado.mensagem);
        // Limpa a senha sem acusar "Informe a senha": o erro a mostrar é o da credencial.
        const senha = this.formulario.controls.senha;
        senha.reset();
        senha.markAsUntouched();
      }
    } catch {
      this.erro.set('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      this.enviando.set(false);
    }
  }
}
