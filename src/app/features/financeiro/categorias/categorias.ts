import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../core/auth/auth.service';
import { Categoria, FinanceiroService } from '../financeiro.service';

const NOVA = 'nova';

type Confirmando = 'inativar' | 'excluir' | null;

/**
 * Contas → Categorias (story 11-1, RN-23.1): cadastro das categorias financeiras. Categoria com contas não é excluída
 * (o servidor recusa e a tela mostra a mensagem), só inativada. Sem `financeiro.editar`, só consulta.
 */
@Component({
  selector: 'app-categorias',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './categorias.html',
  styleUrl: '../../pessoas/cadastro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Categorias {
  private readonly servico = inject(FinanceiroService);
  private readonly auth = inject(AuthService);

  protected readonly podeEditar = computed(() => this.auth.temPermissao('financeiro.editar'));
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly carregando = signal(true);
  protected readonly selecionada = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly confirmando = signal<Confirmando>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly incluirInativas = new FormControl(false, { nonNullable: true });
  protected readonly nome = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100)],
  });

  protected readonly atual = computed(
    () => this.categorias().find((c) => c.id === this.selecionada()) ?? null,
  );
  protected readonly nova = computed(() => this.selecionada() === NOVA);

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      this.categorias.set(await this.servico.listarCategorias(this.incluirInativas.value));
      this.erro.set(null);
    } catch {
      this.erro.set('Não foi possível carregar as categorias. Tente de novo.');
    } finally {
      this.carregando.set(false);
    }
  }

  protected selecionar(categoria: Categoria): void {
    this.selecionada.set(categoria.id);
    this.prepararEdicao();
    this.nome.reset(categoria.nome);
  }

  protected criarNova(): void {
    this.selecionada.set(NOVA);
    this.prepararEdicao();
    this.nome.reset('');
  }

  private prepararEdicao(): void {
    this.confirmando.set(null);
    this.erro.set(null);
    this.aviso.set(null);
    if (this.podeEditar()) this.nome.enable();
    else this.nome.disable();
  }

  protected async salvar(): Promise<void> {
    if (this.salvando() || !this.podeEditar()) return;
    if (this.nome.invalid || !this.nome.value.trim()) {
      this.nome.markAsTouched();
      this.nome.setErrors({ required: true });
      return;
    }

    const nome = this.nome.value.trim();
    await this.executar(async () => {
      const eraNova = this.nova();
      const resultado = eraNova
        ? await this.servico.criarCategoria(nome)
        : await this.servico.alterarCategoria(this.selecionada()!, nome);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      const salva = resultado.valor;
      this.categorias.update((lista) =>
        (lista.some((c) => c.id === salva.id)
          ? lista.map((c) => (c.id === salva.id ? salva : c))
          : [...lista, salva]
        ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      );
      this.selecionar(salva);
      this.aviso.set(eraNova ? 'Categoria cadastrada' : 'Categoria salva');
    });
  }

  protected async alternarSituacao(): Promise<void> {
    const categoria = this.atual();
    if (!categoria || this.salvando()) return;
    if (categoria.ativa && this.confirmando() !== 'inativar') {
      this.confirmando.set('inativar');
      return;
    }

    await this.executar(async () => {
      const resultado = categoria.ativa
        ? await this.servico.inativarCategoria(categoria.id)
        : await this.servico.reativarCategoria(categoria.id);
      this.confirmando.set(null);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      const atualizada = { ...categoria, ativa: !categoria.ativa };
      this.categorias.update((lista) => lista.map((c) => (c.id === categoria.id ? atualizada : c)));
      this.selecionar(atualizada);
      this.aviso.set(categoria.ativa ? 'Categoria inativada' : 'Categoria reativada');
    });
  }

  protected async excluir(): Promise<void> {
    const categoria = this.atual();
    if (!categoria || this.salvando()) return;
    if (this.confirmando() !== 'excluir') {
      this.confirmando.set('excluir');
      return;
    }

    await this.executar(async () => {
      const resultado = await this.servico.excluirCategoria(categoria.id);
      this.confirmando.set(null);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      this.categorias.update((lista) => lista.filter((c) => c.id !== categoria.id));
      this.selecionada.set(null);
      this.aviso.set('Categoria excluída');
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
}
