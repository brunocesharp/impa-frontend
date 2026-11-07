import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { AuthService } from '../../../core/auth/auth.service';
import { Fornecedor, PessoasService } from '../../pessoas/pessoas.service';
import { Categoria, Conta, DadosConta, FinanceiroService } from '../financeiro.service';
import {
  PARCELAS_MAXIMO,
  calcularParcelas,
  formatarData,
  formatarMoeda,
  lerValor,
} from '../parcelamento';

const NOVA = 'nova';

/** RN-23.2: valor obrigatório e maior que zero, em reais com até dois decimais. */
function valorDaConta(controle: AbstractControl<string>): ValidationErrors | null {
  if (!controle.value?.trim()) return { required: true };
  const valor = lerValor(controle.value);
  if (valor === null) return { formato: true };
  return valor > 0 ? null : { positivo: true };
}

/** Formulário da conta (RN-23.2). `parcelas` só vale no lançamento (RN-23.3). */
export function formularioDeConta(fb: NonNullableFormBuilder) {
  return fb.group({
    descricao: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    categoriaId: ['', Validators.required],
    valor: ['', valorDaConta],
    vencimento: ['', Validators.required],
    parcelas: [
      1,
      [
        Validators.required,
        Validators.min(1),
        Validators.max(PARCELAS_MAXIMO),
        Validators.pattern(/^\d+$/),
      ],
    ],
    fornecedor: ['', Validators.maxLength(18)],
    numeroDocumento: ['', Validators.maxLength(60)],
    observacao: ['', Validators.maxLength(1000)],
  });
}

/**
 * Contas → Contas a pagar (story 11-1): lista das contas (uma linha por parcela), lançamento com prévia das parcelas
 * antes de salvar (cenário 23.1, RN-23.3), alteração e exclusão de uma parcela. Consultar com `financeiro.ver`;
 * lançar, alterar e excluir com `financeiro.editar`. O fornecedor vem do cadastro de Pessoas: com
 * `fornecedores.gerenciar`, escolhido na lista; sem ela, pelo CNPJ/CPF.
 */
@Component({
  selector: 'app-contas',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './contas.html',
  styleUrls: ['../../pessoas/cadastro.scss', './contas.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Contas {
  private readonly servico = inject(FinanceiroService);
  private readonly pessoas = inject(PessoasService);
  private readonly auth = inject(AuthService);

  protected readonly podeEditar = computed(() => this.auth.temPermissao('financeiro.editar'));
  protected readonly escolheFornecedor = computed(() =>
    this.auth.temPermissao('fornecedores.gerenciar'),
  );

  protected readonly contas = signal<Conta[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly fornecedores = signal<Fornecedor[]>([]);
  protected readonly carregando = signal(true);
  protected readonly selecionada = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly confirmandoExclusao = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly formulario = formularioDeConta(inject(NonNullableFormBuilder));
  private readonly alteracoes = signal(0);

  protected readonly moeda = formatarMoeda;
  protected readonly data = formatarData;
  protected readonly parcelasMaximo = PARCELAS_MAXIMO;

  protected readonly atual = computed(
    () => this.contas().find((c) => c.id === this.selecionada()) ?? null,
  );
  protected readonly nova = computed(() => this.selecionada() === NOVA);

  /** Categorias ativas, mais a da conta aberta se ela estiver inativa (a API aceita manter a atual). */
  protected readonly opcoesDeCategoria = computed(() => {
    const conta = this.atual();
    const ativas = this.categorias();
    return conta && !ativas.some((c) => c.id === conta.categoriaId)
      ? [...ativas, { id: conta.categoriaId, nome: `${conta.categoria} (inativa)`, ativa: false }]
      : ativas;
  });

  /** Fornecedores ativos (valor = documento), mais o da conta aberta se não estiver na lista. */
  protected readonly opcoesDeFornecedor = computed(() => {
    const lista = this.fornecedores().map((f) => ({ documento: f.documento, nome: f.razaoSocial }));
    const daConta = this.atual()?.fornecedor;
    return daConta && !lista.some((f) => f.documento === daConta.documento)
      ? [...lista, { documento: daConta.documento, nome: daConta.razaoSocial }]
      : lista;
  });

  /** Prévia do lançamento (RN-23.3), recalculada a cada alteração do formulário. */
  protected readonly previa = computed(() => {
    this.alteracoes();
    if (!this.nova()) return [];
    const v = this.formulario.getRawValue();
    return calcularParcelas(lerValor(v.valor), Number(v.parcelas), v.vencimento);
  });

  protected readonly totalDaPrevia = computed(
    () => this.previa().reduce((soma, p) => soma + Math.round(p.valor * 100), 0) / 100,
  );

  constructor() {
    this.formulario.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.alteracoes.update((n) => n + 1));
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    const fornecedores = this.escolheFornecedor()
      ? this.pessoas.listarFornecedores('', false).catch(() => [] as Fornecedor[])
      : Promise.resolve([] as Fornecedor[]);
    try {
      const [contas, categorias] = await Promise.all([
        this.servico.listarContas(),
        this.servico.listarCategorias(false),
      ]);
      this.contas.set(contas);
      this.categorias.set(categorias);
      this.erro.set(null);
    } catch {
      this.erro.set('Não foi possível carregar as contas. Tente de novo.');
    } finally {
      this.carregando.set(false);
    }
    this.fornecedores.set(await fornecedores);
  }

  protected selecionar(conta: Conta): void {
    this.selecionada.set(conta.id);
    this.prepararEdicao();
    this.formulario.reset({
      descricao: conta.descricao,
      categoriaId: conta.categoriaId,
      valor: conta.valor.toFixed(2).replace('.', ','),
      vencimento: conta.vencimento,
      parcelas: 1,
      fornecedor: conta.fornecedor?.documento ?? '',
      numeroDocumento: conta.numeroDocumento ?? '',
      observacao: conta.observacao ?? '',
    });
  }

  protected criarNova(): void {
    this.selecionada.set(NOVA);
    this.prepararEdicao();
    this.formulario.reset();
  }

  private prepararEdicao(): void {
    this.confirmandoExclusao.set(false);
    this.erro.set(null);
    this.aviso.set(null);
    if (this.podeEditar()) this.formulario.enable();
    else this.formulario.disable();
  }

  protected async salvar(): Promise<void> {
    if (this.salvando() || !this.podeEditar()) return;
    if (!this.nova()) this.formulario.controls.parcelas.setValue(1);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const v = this.formulario.getRawValue();
    const dados: DadosConta = {
      descricao: v.descricao.trim(),
      categoriaId: v.categoriaId,
      valor: lerValor(v.valor)!,
      vencimento: v.vencimento,
      fornecedorDocumento: v.fornecedor.trim() || null,
      numeroDocumento: v.numeroDocumento.trim() || null,
      observacao: v.observacao.trim() || null,
    };

    await this.executar(async () => {
      if (this.nova()) {
        const resultado = await this.servico.lancarConta({
          ...dados,
          parcelas: Number(v.parcelas),
        });
        if (!resultado.ok) return this.erro.set(resultado.mensagem);

        const lancadas = resultado.valor;
        this.contas.update((lista) => ordenar([...lista, ...lancadas]));
        this.selecionada.set(null);
        this.aviso.set(
          lancadas.length === 1 ? 'Conta lançada' : `${lancadas.length} parcelas lançadas`,
        );
        return;
      }

      const resultado = await this.servico.alterarConta(this.selecionada()!, dados);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      const salva = resultado.valor;
      this.contas.update((lista) => ordenar(lista.map((c) => (c.id === salva.id ? salva : c))));
      this.selecionar(salva);
      this.aviso.set('Conta salva');
    });
  }

  protected async excluir(): Promise<void> {
    const conta = this.atual();
    if (!conta || this.salvando()) return;
    if (!this.confirmandoExclusao()) {
      this.confirmandoExclusao.set(true);
      return;
    }

    await this.executar(async () => {
      const resultado = await this.servico.excluirConta(conta.id);
      this.confirmandoExclusao.set(false);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      this.contas.update((lista) => lista.filter((c) => c.id !== conta.id));
      this.selecionada.set(null);
      this.aviso.set('Conta excluída');
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

/** Mesma ordem da API: vencimento, descrição, parcela. */
function ordenar(contas: Conta[]): Conta[] {
  return [...contas].sort(
    (a, b) =>
      a.vencimento.localeCompare(b.vencimento) ||
      a.descricao.localeCompare(b.descricao, 'pt-BR') ||
      a.parcela - b.parcela,
  );
}
