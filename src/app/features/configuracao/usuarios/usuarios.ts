import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { SENHA_MINIMA } from '../../../core/auth/sessao';
import { DadosSenhaProvisoria, SenhaProvisoriaDialogo } from './senha-provisoria-dialogo';
import { PerfilResumo, Usuario, UsuariosService } from './usuarios.service';

/** Novo usuário ainda não salvo. */
const NOVO = 'novo';

/** Login: os caracteres que o servidor aceita (os do Identity), sem espaço. */
const LOGIN = /^[a-zA-Z0-9._@+-]+$/;

/** Ação de confirmar em dois cliques (desativar, redefinir senha). */
type Confirmando = 'desativar' | 'redefinir' | null;

/**
 * Configuração → Usuários (story 1-4, T4): lista com perfil e situação; criar, editar, desativar/reativar e
 * redefinir a senha. A senha provisória (criação e redefinição) aparece num diálogo, uma única vez (RN-1.8).
 * Quem decide é o servidor (`usuarios.gerenciar`).
 */
@Component({
  selector: 'app-usuarios',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Usuarios {
  private readonly servico = inject(UsuariosService);
  private readonly dialogo = inject(MatDialog);

  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly perfis = signal<PerfilResumo[]>([]);
  protected readonly carregando = signal(true);
  protected readonly selecionado = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly confirmando = signal<Confirmando>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly senhaMinima = SENHA_MINIMA;

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    usuario: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(LOGIN)]],
    nome: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.email, Validators.maxLength(256)]],
    perfilId: ['', Validators.required],
    senha: ['', Validators.minLength(SENHA_MINIMA)],
  });

  protected readonly atual = computed(
    () => this.usuarios().find((u) => u.id === this.selecionado()) ?? null,
  );
  protected readonly novo = computed(() => this.selecionado() === NOVO);

  constructor() {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    try {
      const [usuarios, perfis] = await Promise.all([
        this.servico.listar(),
        this.servico.listarPerfis(), // só `usuarios.gerenciar` (R3); `/api/perfis` exige `perfis.gerenciar`
      ]);
      this.usuarios.set(usuarios);
      this.perfis.set(perfis);
      if (usuarios.length) this.selecionar(usuarios[0]);
    } catch {
      this.erro.set('Não foi possível carregar os usuários. Tente de novo.');
    } finally {
      this.carregando.set(false);
    }
  }

  protected selecionar(usuario: Usuario): void {
    this.selecionado.set(usuario.id);
    this.prepararEdicao();
    this.formulario.reset({
      usuario: usuario.usuario,
      nome: usuario.nome,
      email: usuario.email ?? '',
      perfilId: usuario.perfilId ?? '',
      senha: '',
    });
    // O login não muda depois de criado; a senha só se define na criação ou na redefinição.
    this.formulario.controls.usuario.disable();
    this.formulario.controls.senha.disable();
  }

  protected criarNovo(): void {
    this.selecionado.set(NOVO);
    this.prepararEdicao();
    const operador = this.perfis().find((p) => !p.protegido);
    this.formulario.reset({
      usuario: '',
      nome: '',
      email: '',
      perfilId: operador?.id ?? '',
      senha: '',
    });
    this.formulario.controls.usuario.enable();
    this.formulario.controls.senha.enable();
  }

  private prepararEdicao(): void {
    this.confirmando.set(null);
    this.erro.set(null);
    this.aviso.set(null);
  }

  protected async salvar(): Promise<void> {
    if (this.salvando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { usuario, nome, email, perfilId, senha } = this.formulario.getRawValue();
    const dados = { nome: nome.trim(), email: email.trim() || null, perfilId };

    await this.executar(async () => {
      if (this.novo()) {
        const resultado = await this.servico.criar({
          ...dados,
          usuario: usuario.trim(),
          senha: senha || null,
        });
        if (!resultado.ok) return this.erro.set(resultado.mensagem);

        // A senha aparece antes de recarregar a lista: ela é mostrada uma única vez (R1).
        this.mostrarSenha({ nome: dados.nome, senha: resultado.valor.senhaProvisoria, novo: true });
        this.aviso.set('Usuário criado');
        if (!(await this.recarregarSemFalhar(resultado.valor.id)))
          this.aviso.set('Usuário criado. A lista não foi atualizada: recarregue a página.');
      } else {
        const id = this.selecionado()!;
        const resultado = await this.servico.alterar(id, dados);
        if (!resultado.ok) return this.erro.set(resultado.mensagem);

        this.usuarios.update((lista) => lista.map((u) => (u.id === id ? resultado.valor : u)));
        this.selecionar(resultado.valor);
        this.aviso.set('Usuário salvo');
      }
    });
  }

  protected async alternarSituacao(): Promise<void> {
    const usuario = this.atual();
    if (!usuario || this.salvando()) return;

    if (usuario.ativo && this.confirmando() !== 'desativar') {
      this.confirmando.set('desativar');
      return;
    }

    await this.executar(async () => {
      const resultado = usuario.ativo
        ? await this.servico.desativar(usuario.id)
        : await this.servico.reativar(usuario.id);
      this.confirmando.set(null);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      await this.recarregar(usuario.id);
      this.aviso.set(usuario.ativo ? 'Usuário desativado' : 'Usuário reativado');
    });
  }

  protected async redefinirSenha(): Promise<void> {
    const usuario = this.atual();
    if (!usuario || this.salvando()) return;
    if (this.confirmando() !== 'redefinir') {
      this.confirmando.set('redefinir');
      return;
    }

    await this.executar(async () => {
      const resultado = await this.servico.redefinirSenha(usuario.id);
      this.confirmando.set(null);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      // A senha aparece antes de recarregar a lista: ela é mostrada uma única vez (R1).
      this.mostrarSenha({
        nome: usuario.nome,
        senha: resultado.valor.senhaProvisoria,
        novo: false,
      });
      await this.recarregarSemFalhar(usuario.id);
    });
  }

  private async executar(acao: () => Promise<void>): Promise<void> {
    this.salvando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      await acao();
    } catch {
      this.erro.set('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      this.salvando.set(false);
    }
  }

  /** Lista de novo (situação, perfil, marca de senha provisória) e seleciona `id`. */
  private async recarregar(id: string): Promise<void> {
    const usuarios = await this.servico.listar();
    this.usuarios.set(usuarios);
    const usuario = usuarios.find((u) => u.id === id);
    if (usuario) this.selecionar(usuario);
  }

  /**
   * `recarregar` depois de uma operação que já deu certo: se a lista não vier, a operação não é dada como
   * falha (a tela não diz "não foi possível"). Devolve se a lista veio.
   */
  private async recarregarSemFalhar(id: string): Promise<boolean> {
    try {
      await this.recarregar(id);
      return true;
    } catch {
      return false;
    }
  }

  private mostrarSenha(dados: DadosSenhaProvisoria): void {
    this.dialogo.open(SenhaProvisoriaDialogo, {
      data: dados,
      width: 'min(440px, calc(100vw - 32px))',
    });
  }
}
