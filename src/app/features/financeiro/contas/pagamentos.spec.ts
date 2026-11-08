import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Baixa, Categoria, Conta, FormaDePagamento } from '../financeiro.service';
import { Contas } from './contas';

const ALUGUEL: Categoria = { id: 'cat2', nome: 'Aluguel', ativa: true };
const PIX: FormaDePagamento = { id: 'fp2', nome: 'Pix', ativa: true };
const BOLETO: FormaDePagamento = { id: 'fp3', nome: 'Boleto', ativa: true };

function conta(valor: number, baixas: Baixa[] = [], descricao = 'Aluguel novembro'): Conta {
  const pago = baixas.filter((b) => !b.estornada).reduce((s, b) => s + b.valor, 0);
  const saldo = Math.round((valor - pago) * 100) / 100;
  return {
    id: 'k1',
    descricao,
    categoriaId: ALUGUEL.id,
    categoria: ALUGUEL.nome,
    valor,
    vencimento: '2026-11-10',
    fornecedor: null,
    numeroDocumento: 'Recibo 11',
    observacao: null,
    parcela: 1,
    totalDeParcelas: 1,
    parcelamentoId: null,
    valorPago: pago,
    saldo,
    situacaoDoPagamento: pago === 0 ? 'sem-pagamento' : saldo === 0 ? 'paga' : 'parcialmente-paga',
    baixas,
  };
}

function baixa(valor: number, estorno?: { motivo: string }): Baixa {
  return {
    id: 'b1',
    data: '2026-11-05',
    valor,
    formaDePagamentoId: PIX.id,
    formaDePagamento: PIX.nome,
    registradaEm: '2026-11-05T12:00:00Z',
    estornada: !!estorno,
    estornadaEm: estorno ? '2026-11-06T10:00:00Z' : null,
    estornadaPor: estorno ? 'admin' : null,
    motivoDoEstorno: estorno?.motivo ?? null,
  };
}

const texto = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

async function esperar(fixture: { detectChanges(): void }) {
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
}

describe('Pagar e estornar (story 11-2)', () => {
  let http: HttpTestingController;

  async function abrir(contas: Conta[], permissoes = ['financeiro.ver', 'financeiro.editar']) {
    TestBed.configureTestingModule({
      imports: [Contas],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const sessao = TestBed.inject(AuthService).carregarSessao();
    http.expectOne('/api/auth/me').flush({ usuario: 'u', nome: 'U', perfil: 'P', permissoes });
    await sessao;

    const fixture = TestBed.createComponent(Contas);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/financeiro/contas' && r.method === 'GET').flush(contas);
    http
      .expectOne((r) => r.url === '/api/financeiro/categorias' && r.method === 'GET')
      .flush([ALUGUEL]);
    await esperar(fixture);
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('[data-conta]')!.click();
    await esperar(fixture);
    return { fixture, el };
  }

  const botao = (el: HTMLElement, acao: string) =>
    el.querySelector<HTMLButtonElement>(`[data-acao="${acao}"]`);
  const campo = <T extends HTMLElement = HTMLInputElement>(el: HTMLElement, nome: string) =>
    el.querySelector<T>(`[data-campo="${nome}"]`);

  function preencher(el: HTMLElement, nome: string, valor: string) {
    const input = campo<HTMLInputElement | HTMLSelectElement>(el, nome)!;
    input.value = valor;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
  }

  async function abrirPagamento(fixture: { detectChanges(): void }, el: HTMLElement) {
    botao(el, 'pagar')!.click();
    await esperar(fixture);
    http
      .expectOne((r) => r.url === '/api/financeiro/formas-pagamento' && r.method === 'GET')
      .flush([BOLETO, PIX]);
    await esperar(fixture);
  }

  afterEach(() => http.verify());

  it('cenário 23.2: "Pagar" sugere o saldo, registra R$ 200,00 via Pix e a conta fica parcialmente paga', async () => {
    const { fixture, el } = await abrir([conta(500)]);
    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Sem pagamento · saldo R$ 500,00');

    await abrirPagamento(fixture, el);
    expect(campo(el, 'valorPago')!.value).toBe('500,00');
    expect(campo(el, 'dataPagamento')!.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      Array.from(campo<HTMLSelectElement>(el, 'forma')!.options).map((o) => o.textContent!.trim()),
    ).toEqual(['', 'Boleto', 'Pix']);

    preencher(el, 'dataPagamento', '2026-11-05');
    preencher(el, 'valorPago', '200,00');
    preencher(el, 'forma', PIX.id);
    botao(el, 'confirmar-pagamento')!.click();

    const pedido = http.expectOne(
      (r) => r.url === '/api/financeiro/contas/k1/baixas' && r.method === 'POST',
    );
    expect(pedido.request.body).toEqual({
      data: '2026-11-05',
      valor: 200,
      formaDePagamentoId: 'fp2',
    });
    pedido.flush(conta(500, [baixa(200)]));
    await esperar(fixture);

    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Parcialmente paga · saldo R$ 300,00');
    expect(el.textContent).toContain('Pagamento registrado');
    expect(texto(el.querySelector('[data-baixa] .baixa-linha'))).toBe('05/11/2026 · PixR$ 200,00');
    expect(texto(el.querySelector('[data-conta]'))).toContain(
      'Parcialmente paga · saldo R$ 300,00',
    );
  });

  it('cenário 23.2: R$ 600,00 numa conta de R$ 500,00 mostra a recusa do servidor', async () => {
    const { fixture, el } = await abrir([conta(500)]);
    await abrirPagamento(fixture, el);
    preencher(el, 'valorPago', '600,00');
    preencher(el, 'forma', PIX.id);
    botao(el, 'confirmar-pagamento')!.click();

    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1/baixas')
      .flush(
        { errors: { Valor: ['Valor maior que o saldo da conta (R$ 500,00)'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await esperar(fixture);

    expect(texto(el.querySelector('[role="alert"]'))).toBe(
      'Valor maior que o saldo da conta (R$ 500,00)',
    );
    expect(el.querySelector('[data-form-pagamento]')).not.toBeNull();
  });

  it('pagamento sem forma não é enviado', async () => {
    const { fixture, el } = await abrir([conta(500)]);
    await abrirPagamento(fixture, el);
    botao(el, 'confirmar-pagamento')!.click();
    await esperar(fixture);

    expect(el.textContent).toContain('Informe a forma de pagamento');
  });

  it('conta paga não oferece "Pagar"', async () => {
    const { el } = await abrir([conta(500, [baixa(500)])]);

    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Paga · saldo R$ 0,00');
    expect(botao(el, 'pagar')).toBeNull();
  });

  it('cenário 23.5: estorna a baixa com o motivo e o saldo volta', async () => {
    const { fixture, el } = await abrir([conta(350, [baixa(350)], 'Energia outubro')]);

    botao(el, 'estornar')!.click();
    await esperar(fixture);
    botao(el, 'confirmar-estorno')!.click();
    await esperar(fixture);
    expect(el.textContent).toContain('Informe o motivo do estorno'); // sem motivo, não envia

    preencher(el, 'motivo', 'Pagamento lançado na conta errada');
    botao(el, 'confirmar-estorno')!.click();
    const pedido = http.expectOne(
      (r) => r.url === '/api/financeiro/baixas/b1/estorno' && r.method === 'POST',
    );
    expect(pedido.request.body).toEqual({ motivo: 'Pagamento lançado na conta errada' });
    pedido.flush(
      conta(350, [baixa(350, { motivo: 'Pagamento lançado na conta errada' })], 'Energia outubro'),
    );
    await esperar(fixture);

    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Sem pagamento · saldo R$ 350,00');
    expect(el.textContent).toContain('Pagamento estornado');
    const estorno = texto(el.querySelector('[data-estorno]'));
    expect(estorno).toContain('por admin: Pagamento lançado na conta errada');
    expect(estorno).toContain('06/11/2026');
    expect(botao(el, 'estornar')).toBeNull();
    expect(el.querySelector('[data-baixa]')!.classList.contains('estornada')).toBe(true);
  });

  it('RN-23.7: com pagamento, só descrição e observação ficam editáveis e não há "Excluir"', async () => {
    const { fixture, el } = await abrir([conta(500, [baixa(200)])]);

    expect(el.querySelector('[data-travada]')).not.toBeNull();
    expect(botao(el, 'excluir')).toBeNull();
    for (const nome of ['categoria', 'valor', 'vencimento', 'fornecedor', 'numeroDocumento'])
      expect([nome, campo<HTMLInputElement>(el, nome)!.disabled]).toEqual([nome, true]);
    expect(campo(el, 'descricao')!.disabled).toBe(false);
    expect(campo<HTMLTextAreaElement>(el, 'observacao')!.disabled).toBe(false);

    preencher(el, 'descricao', 'Aluguel nov/26');
    preencher(el, 'observacao', 'Entrada paga');
    botao(el, 'salvar')!.click();
    const pedido = http.expectOne(
      (r) => r.url === '/api/financeiro/contas/k1' && r.method === 'PUT',
    );
    expect(pedido.request.body).toEqual({
      descricao: 'Aluguel nov/26',
      categoriaId: 'cat2',
      valor: 500,
      vencimento: '2026-11-10',
      fornecedorDocumento: null,
      numeroDocumento: 'Recibo 11',
      observacao: 'Entrada paga',
    });
    pedido.flush({
      ...conta(500, [baixa(200)]),
      descricao: 'Aluguel nov/26',
      observacao: 'Entrada paga',
    });
    await esperar(fixture);
    expect(el.textContent).toContain('Conta salva');
  });

  it('sem pagamento, a conta continua editável e com "Excluir"', async () => {
    const { el } = await abrir([conta(500, [baixa(500, { motivo: 'Errado' })])]);

    expect(el.querySelector('[data-travada]')).toBeNull();
    expect(botao(el, 'excluir')).not.toBeNull();
    expect(campo(el, 'valor')!.disabled).toBe(false);
  });

  it('sem financeiro.editar: vê o histórico, mas não paga nem estorna', async () => {
    const { el } = await abrir([conta(500, [baixa(200)])], ['financeiro.ver']);

    expect(el.querySelectorAll('[data-baixa]').length).toBe(1);
    expect(botao(el, 'pagar')).toBeNull();
    expect(botao(el, 'estornar')).toBeNull();
  });
});
