import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../core/auth/auth.service';
import { FinanceiroService, FormaDePagamento } from '../financeiro.service';

const NOVA = 'nova';

type Confirmando = 'inativar' | 'excluir' | null;

/**
 * Contas → Formas de pagamento (story 11-2, RN-23.4): cadastro das formas de pagamento financeiras (separadas das do
 * PDV). Forma com pagamentos não é excluída (o servidor recusa e a tela mostra a mensagem), só inativada. Sem
 * `financeiro.editar`, só consulta.
 */
@Component({
  selector: 'app-formas-pagamento',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './formas-pagamento.html',
  styleUrl: '../../pessoas/cadastro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormasPagamento {
  private readonly servico = inject(FinanceiroService);
  private readonly auth = inject(AuthService);

  protected readonly podeEditar = computed(() => this.auth.temPermissao('financeiro.editar'));
  protected readonly formas = signal<FormaDePagamento[]>([]);
  protected readonly carregando = signal(true);
  protected readonly selecionada = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly confirmando = signal<Confirmando>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly incluirInativas = new FormControl(false, { nonNullable: true });
  protected readonly nome = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(60)],
  });

  protected readonly atual = computed(
    () => this.formas().find((c) => c.id === this.selecionada()) ?? null,
  );
  protected readonly nova = computed(() => this.selecionada() === NOVA);

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      this.formas.set(await this.servico.listarFormasDePagamento(this.incluirInativas.value));
      this.erro.set(null);
    } catch {
      this.erro.set('Não foi possível carregar as formas de pagamento. Tente de novo.');
    } finally {
      this.carregando.set(false);
    }
  }

  protected selecionar(forma: FormaDePagamento): void {
    this.selecionada.set(forma.id);
    this.prepararEdicao();
    this.nome.reset(forma.nome);
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
        ? await this.servico.criarFormaDePagamento(nome)
        : await this.servico.alterarFormaDePagamento(this.selecionada()!, nome);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      const salva = resultado.valor;
      this.formas.update((lista) =>
        (lista.some((c) => c.id === salva.id)
          ? lista.map((c) => (c.id === salva.id ? salva : c))
          : [...lista, salva]
        ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      );
      this.selecionar(salva);
      this.aviso.set(eraNova ? 'Forma de pagamento cadastrada' : 'Forma de pagamento salva');
    });
  }

  protected async alternarSituacao(): Promise<void> {
    const forma = this.atual();
    if (!forma || this.salvando()) return;
    if (forma.ativa && this.confirmando() !== 'inativar') {
      this.confirmando.set('inativar');
      return;
    }

    await this.executar(async () => {
      const resultado = forma.ativa
        ? await this.servico.inativarFormaDePagamento(forma.id)
        : await this.servico.reativarFormaDePagamento(forma.id);
      this.confirmando.set(null);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      const atualizada = { ...forma, ativa: !forma.ativa };
      this.formas.update((lista) => lista.map((c) => (c.id === forma.id ? atualizada : c)));
      this.selecionar(atualizada);
      this.aviso.set(forma.ativa ? 'Forma de pagamento inativada' : 'Forma de pagamento reativada');
    });
  }

  protected async excluir(): Promise<void> {
    const forma = this.atual();
    if (!forma || this.salvando()) return;
    if (this.confirmando() !== 'excluir') {
      this.confirmando.set('excluir');
      return;
    }

    await this.executar(async () => {
      const resultado = await this.servico.excluirFormaDePagamento(forma.id);
      this.confirmando.set(null);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      this.formas.update((lista) => lista.filter((c) => c.id !== forma.id));
      this.selecionada.set(null);
      this.aviso.set('Forma de pagamento excluída');
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
