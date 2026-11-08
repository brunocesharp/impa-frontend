import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, from, switchMap } from 'rxjs';
import {
  AbstractControl,
  FormControl,
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
import {
  Baixa,
  Categoria,
  Conta,
  DadosConta,
  FinanceiroService,
  FormaDePagamento,
  SituacaoDoPagamento,
} from '../financeiro.service';
import {
  PARCELAS_MAXIMO,
  VALOR_MAXIMO,
  calcularParcelas,
  formatarData,
  formatarMoeda,
  lerValor,
} from '../parcelamento';

const NOVA = 'nova';

/** RN-23.2: valor obrigatório e maior que zero, em reais com até dois decimais e no teto da API. */
function valorDaConta(controle: AbstractControl<string>): ValidationErrors | null {
  if (!controle.value?.trim()) return { required: true };
  const valor = lerValor(controle.value);
  if (valor === null) return { formato: true };
  if (!(valor > 0)) return { positivo: true };
  return valor > VALOR_MAXIMO ? { teto: true } : null;
}

/** RN-23.5: valor pago obrigatório e maior que zero, com até dois decimais (o teto é o saldo, conferido pela API). */
function valorDoPagamento(controle: AbstractControl<string>): ValidationErrors | null {
  if (!controle.value?.trim()) return { required: true };
  const valor = lerValor(controle.value);
  if (valor === null) return { formato: true };
  return valor > 0 ? null : { positivo: true };
}

/** Campos que a RN-23.7 trava numa conta com pagamento (só descrição e observação continuam editáveis). */
const TRAVADOS_PELO_PAGAMENTO = [
  'categoriaId',
  'valor',
  'vencimento',
  'fornecedor',
  'numeroDocumento',
] as const;

const SITUACOES: Record<SituacaoDoPagamento, string> = {
  'sem-pagamento': 'Sem pagamento',
  'parcialmente-paga': 'Parcialmente paga',
  paga: 'Paga',
};

/** Hoje no fuso do navegador, em `AAAA-MM-DD`. */
function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Valor em reais para um campo de texto: 300 → "300,00". */
function paraCampo(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}

/** Fornecedor oferecido no select: o valor do select é o `id`; a API recebe o `documento`. */
interface OpcaoDeFornecedor {
  id: string;
  documento: string;
  nome: string;
}

/** Espera depois da última tecla antes de buscar o fornecedor. */
const ESPERA_DA_BUSCA_MS = 300;

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
    // Id do fornecedor (select) ou CNPJ/CPF digitado (campo de texto, com maxlength no template).
    fornecedor: [''],
    numeroDocumento: ['', Validators.maxLength(60)],
    observacao: ['', Validators.maxLength(1000)],
  });
}

/**
 * Contas → Contas a pagar (stories 11-1 e 11-2): lista das contas (uma linha por parcela), lançamento com prévia das
 * parcelas antes de salvar (cenário 23.1, RN-23.3), alteração e exclusão de uma parcela, pagamento total ou parcial
 * (cenário 23.2, RN-23.5) e histórico das baixas com estorno (cenário 23.5). Com pagamento, só descrição e observação
 * são editáveis e a conta não é excluída (RN-23.7). Consultar com `financeiro.ver`; lançar, alterar, excluir, pagar e
 * estornar com `financeiro.editar`. O fornecedor vem do cadastro de Pessoas: com
 * `fornecedores.gerenciar`, escolhido na lista; sem ela, pelo CNPJ/CPF.
 */
@Component({
  selector: 'app-contas',
  imports: [
    DatePipe,
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

  /** Pagamento (RN-23.5): data, valor (o saldo sugerido) e forma. */
  protected readonly pagamento = inject(NonNullableFormBuilder).group({
    data: ['', Validators.required],
    valor: ['', valorDoPagamento],
    formaDePagamentoId: ['', Validators.required],
  });
  protected readonly pagando = signal(false);
  protected readonly formas = signal<FormaDePagamento[]>([]);
  private formasCarregadas = false;

  /** Baixa com o estorno aberto (pedindo o motivo). */
  protected readonly estornando = signal<string | null>(null);
  protected readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500), Validators.pattern(/\S/)],
  });

  protected readonly situacao = (s: SituacaoDoPagamento) => SITUACOES[s];

  /** RN-23.7: a conta aberta tem baixa não estornada. */
  protected readonly comPagamento = computed(() => (this.atual()?.valorPago ?? 0) > 0);
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

  /** Fornecedor escolhido no select: continua entre as opções quando a busca muda. */
  private readonly escolhido = signal<OpcaoDeFornecedor | null>(null);

  /**
   * Fornecedores ativos da busca, mais o escolhido e o da conta aberta quando não estão nela. Casados pelo `id`
   * (o CNPJ/CPF pode ter sido corrigido no Pessoas depois do lançamento); a lista do Pessoas vence, com o documento atual.
   */
  protected readonly opcoesDeFornecedor = computed(() => {
    const lista: OpcaoDeFornecedor[] = this.fornecedores().map((f) => ({
      id: f.id,
      documento: f.documento,
      nome: f.razaoSocial,
    }));
    const daConta = this.atual()?.fornecedor;
    const extras: OpcaoDeFornecedor[] = [
      ...(daConta
        ? [{ id: daConta.id, documento: daConta.documento, nome: daConta.razaoSocial }]
        : []),
      ...(this.escolhido() ? [this.escolhido()!] : []),
    ];
    for (const extra of extras) if (!lista.some((f) => f.id === extra.id)) lista.push(extra);
    return lista;
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

  private readonly buscas = new Subject<string>();

  constructor() {
    const destroy = inject(DestroyRef);
    this.formulario.valueChanges
      .pipe(takeUntilDestroyed(destroy))
      .subscribe(() => this.alteracoes.update((n) => n + 1));
    this.formulario.controls.fornecedor.valueChanges
      .pipe(takeUntilDestroyed(destroy))
      .subscribe((id) => {
        if (!this.escolheFornecedor()) return;
        this.escolhido.set(this.opcoesDeFornecedor().find((f) => f.id === id) ?? null);
      });
    // Busca por digitação: alcança qualquer fornecedor, não só os primeiros da lista (o Pessoas corta em 50).
    this.buscas
      .pipe(
        debounceTime(ESPERA_DA_BUSCA_MS),
        distinctUntilChanged(),
        switchMap((busca) =>
          from(this.pessoas.listarFornecedores(busca, false).catch(() => [] as Fornecedor[])),
        ),
        takeUntilDestroyed(destroy),
      )
      .subscribe((lista) => this.fornecedores.set(lista));
    void this.carregar();
  }

  protected buscarFornecedor(busca: string): void {
    this.buscas.next(busca.trim());
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
    this.pagando.set(false);
    this.estornando.set(null);
    this.formulario.reset({
      descricao: conta.descricao,
      categoriaId: conta.categoriaId,
      valor: conta.valor.toFixed(2).replace('.', ','),
      vencimento: conta.vencimento,
      parcelas: 1,
      // Select: o id do fornecedor; campo de texto: o CNPJ/CPF.
      fornecedor:
        (this.escolheFornecedor() ? conta.fornecedor?.id : conta.fornecedor?.documento) ?? '',
      numeroDocumento: conta.numeroDocumento ?? '',
      observacao: conta.observacao ?? '',
    });
    // RN-23.7: com pagamento, só descrição e observação ficam editáveis.
    if (conta.valorPago > 0)
      for (const campo of TRAVADOS_PELO_PAGAMENTO) this.formulario.controls[campo].disable();
  }

  protected criarNova(): void {
    this.selecionada.set(NOVA);
    this.prepararEdicao();
    this.pagando.set(false);
    this.estornando.set(null);
    this.formulario.reset();
  }

  private prepararEdicao(): void {
    this.escolhido.set(null);
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
    const conta = this.atual();
    const dados: DadosConta =
      conta && conta.valorPago > 0
        ? {
            // RN-23.7: os campos travados vão como estão na conta.
            descricao: v.descricao.trim(),
            categoriaId: conta.categoriaId,
            valor: conta.valor,
            vencimento: conta.vencimento,
            fornecedorDocumento: conta.fornecedor?.documento ?? null,
            numeroDocumento: conta.numeroDocumento,
            observacao: v.observacao.trim() || null,
          }
        : {
            descricao: v.descricao.trim(),
            categoriaId: v.categoriaId,
            valor: lerValor(v.valor)!,
            vencimento: v.vencimento,
            fornecedorDocumento: this.documentoDoFornecedor(v.fornecedor),
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

      const id = this.selecionada()!;
      const resultado = await this.servico.alterarConta(id, dados);
      if (!resultado.ok)
        return resultado.status === 404
          ? this.excluidaEmOutraSessao(id, resultado.mensagem)
          : this.erro.set(resultado.mensagem);

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
      if (!resultado.ok)
        return resultado.status === 404
          ? this.excluidaEmOutraSessao(conta.id, resultado.mensagem)
          : this.erro.set(resultado.mensagem);

      this.contas.update((lista) => lista.filter((c) => c.id !== conta.id));
      this.selecionada.set(null);
      this.aviso.set('Conta excluída');
    });
  }

  /** Abre o pagamento com a data de hoje e o saldo sugerido (RN-23.5). */
  protected async abrirPagamento(): Promise<void> {
    const conta = this.atual();
    if (!conta || !this.podeEditar()) return;
    this.estornando.set(null);
    this.erro.set(null);
    this.aviso.set(null);
    this.pagamento.reset({ data: hoje(), valor: paraCampo(conta.saldo), formaDePagamentoId: '' });
    this.pagando.set(true);
    if (this.formasCarregadas) return;
    try {
      this.formas.set(await this.servico.listarFormasDePagamento(false));
      this.formasCarregadas = true;
    } catch {
      this.erro.set('Não foi possível carregar as formas de pagamento. Tente de novo.');
    }
  }

  protected cancelarPagamento(): void {
    this.pagando.set(false);
  }

  /** Registra a baixa; valor maior que o saldo volta recusado com a mensagem do servidor (cenário 23.2). */
  protected async pagar(): Promise<void> {
    const conta = this.atual();
    if (!conta || this.salvando() || !this.podeEditar()) return;
    if (this.pagamento.invalid) {
      this.pagamento.markAllAsTouched();
      return;
    }

    const v = this.pagamento.getRawValue();
    await this.executar(async () => {
      const resultado = await this.servico.pagarConta(conta.id, {
        data: v.data,
        valor: lerValor(v.valor)!,
        formaDePagamentoId: v.formaDePagamentoId,
      });
      if (!resultado.ok)
        return resultado.status === 404
          ? this.excluidaEmOutraSessao(conta.id, resultado.mensagem)
          : this.erro.set(resultado.mensagem);

      this.atualizar(resultado.valor);
      this.aviso.set(resultado.valor.saldo === 0 ? 'Conta paga' : 'Pagamento registrado');
    });
  }

  protected abrirEstorno(baixa: Baixa): void {
    this.pagando.set(false);
    this.erro.set(null);
    this.aviso.set(null);
    this.motivo.reset('');
    this.estornando.set(baixa.id);
  }

  protected cancelarEstorno(): void {
    this.estornando.set(null);
  }

  /** Estorna a baixa com o motivo (cenário 23.5): ela continua no histórico, marcada como estornada. */
  protected async estornar(): Promise<void> {
    const baixa = this.estornando();
    if (!baixa || this.salvando() || !this.podeEditar()) return;
    if (this.motivo.invalid) {
      this.motivo.markAsTouched();
      return;
    }

    await this.executar(async () => {
      const resultado = await this.servico.estornarBaixa(baixa, this.motivo.value.trim());
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      this.atualizar(resultado.valor);
      this.aviso.set('Pagamento estornado');
    });
  }

  /** Conta devolvida pela API depois de pagar ou estornar: entra na lista e o editor reabre com as travas certas. */
  private atualizar(conta: Conta): void {
    this.contas.update((lista) => lista.map((c) => (c.id === conta.id ? conta : c)));
    this.selecionar(conta);
  }

  /** A conta não existe mais (excluída em outra sessão): sai da lista e o editor fecha. */
  private excluidaEmOutraSessao(id: string, mensagem: string): void {
    this.contas.update((lista) => lista.filter((c) => c.id !== id));
    this.selecionada.set(null);
    this.erro.set(mensagem);
  }

  /** Select: o documento do fornecedor escolhido (pelo id); campo de texto: o CNPJ/CPF digitado. */
  private documentoDoFornecedor(valor: string): string | null {
    if (!valor.trim()) return null;
    if (!this.escolheFornecedor()) return valor.trim();
    return this.opcoesDeFornecedor().find((f) => f.id === valor)?.documento ?? null;
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
