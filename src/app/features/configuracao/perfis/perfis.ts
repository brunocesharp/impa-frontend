import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { Perfil, PerfisService, PermissaoInfo } from './perfis.service';

interface Grupo {
  nome: string;
  permissoes: PermissaoInfo[];
}

/** Novo perfil ainda não salvo. */
const NOVO = 'novo';

/**
 * Configuração → Perfis (story 1-3, T7): lista de perfis e edição das permissões em grupos.
 * O Administrador aparece protegido, só leitura (RN-1.6). Quem decide é o servidor (`perfis.gerenciar`).
 */
@Component({
  selector: 'app-perfis',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './perfis.html',
  styleUrl: './perfis.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Perfis {
  private readonly servico = inject(PerfisService);

  protected readonly perfis = signal<Perfil[]>([]);
  protected readonly catalogo = signal<PermissaoInfo[]>([]);
  protected readonly carregando = signal(true);
  protected readonly selecionado = signal<string | null>(null);
  protected readonly marcadas = signal<ReadonlySet<string>>(new Set());
  protected readonly salvando = signal(false);
  protected readonly confirmandoExclusao = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly nome = inject(NonNullableFormBuilder).control('', [
    Validators.required,
    Validators.maxLength(60),
  ]);

  protected readonly grupos = computed<Grupo[]>(() => {
    const grupos: Grupo[] = [];
    for (const permissao of this.catalogo()) {
      const grupo = grupos.find((g) => g.nome === permissao.grupo);
      if (grupo) grupo.permissoes.push(permissao);
      else grupos.push({ nome: permissao.grupo, permissoes: [permissao] });
    }
    return grupos;
  });

  protected readonly atual = computed(
    () => this.perfis().find((p) => p.id === this.selecionado()) ?? null,
  );
  protected readonly novo = computed(() => this.selecionado() === NOVO);
  protected readonly protegido = computed(() => this.atual()?.protegido ?? false);

  constructor() {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    try {
      const [perfis, catalogo] = await Promise.all([
        this.servico.listar(),
        this.servico.catalogo(),
      ]);
      this.perfis.set(perfis);
      this.catalogo.set(catalogo);
      if (perfis.length) this.selecionar(perfis[0]);
    } catch {
      this.erro.set('Não foi possível carregar os perfis. Tente de novo.');
    } finally {
      this.carregando.set(false);
    }
  }

  protected selecionar(perfil: Perfil): void {
    this.selecionado.set(perfil.id);
    this.prepararEdicao(perfil.nome, perfil.permissoes);
    if (perfil.protegido) this.nome.disable();
    else this.nome.enable();
  }

  protected criarNovo(): void {
    this.selecionado.set(NOVO);
    this.prepararEdicao('', []);
    this.nome.enable();
  }

  private prepararEdicao(nome: string, permissoes: string[]): void {
    this.nome.reset(nome);
    this.marcadas.set(new Set(permissoes));
    this.confirmandoExclusao.set(false);
    this.erro.set(null);
    this.aviso.set(null);
  }

  protected alternar(codigo: string, marcada: boolean): void {
    const proximas = new Set(this.marcadas());
    if (marcada) proximas.add(codigo);
    else proximas.delete(codigo);
    this.marcadas.set(proximas);
    this.aviso.set(null);
  }

  protected async salvar(): Promise<void> {
    if (this.protegido() || this.salvando()) return;
    if (this.nome.invalid || !this.nome.value.trim()) {
      this.nome.markAsTouched();
      return;
    }

    this.salvando.set(true);
    this.erro.set(null);
    try {
      const id = this.novo() ? null : this.selecionado();
      // Ordem do catálogo: estável e igual à da tela.
      const permissoes = this.catalogo()
        .map((p) => p.codigo)
        .filter((c) => this.marcadas().has(c))
        .sort();
      const resultado = await this.servico.salvar(id, { nome: this.nome.value.trim(), permissoes });
      if (!resultado.ok) {
        this.erro.set(resultado.mensagem);
        return;
      }

      const salvo = resultado.perfil;
      this.perfis.update((lista) =>
        id ? lista.map((p) => (p.id === id ? salvo : p)) : [...lista, salvo],
      );
      this.selecionar(salvo);
      this.aviso.set('Perfil salvo');
    } catch {
      this.erro.set('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      this.salvando.set(false);
    }
  }

  protected async excluir(): Promise<void> {
    const perfil = this.atual();
    if (!perfil || perfil.protegido || this.salvando()) return;
    if (!this.confirmandoExclusao()) {
      this.confirmandoExclusao.set(true);
      return;
    }

    this.salvando.set(true);
    this.erro.set(null);
    try {
      const resultado = await this.servico.excluir(perfil.id);
      if (!resultado.ok) {
        this.erro.set(resultado.mensagem);
        this.confirmandoExclusao.set(false);
        return;
      }

      this.perfis.update((lista) => lista.filter((p) => p.id !== perfil.id));
      const primeiro = this.perfis()[0];
      if (primeiro) this.selecionar(primeiro);
      else this.selecionado.set(null);
      this.aviso.set('Perfil excluído');
    } catch {
      this.erro.set('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      this.salvando.set(false);
    }
  }
}
