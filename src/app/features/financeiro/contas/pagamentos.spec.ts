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

function conta(
  valor: number,
  baixas: Baixa[] = [],
  descricao = 'Aluguel novembro',
  id = 'k1',
): Conta {
  const pago = baixas.filter((b) => !b.estornada).reduce((s, b) => s + b.valor, 0);
  const saldo = Math.round((valor - pago) * 100) / 100;
  return {
    id,
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

  afterEach(() => {
    // Antes do verify: se ele falhar, o Date falso não vaza para os testes seguintes.
    vi.useRealTimers();
    http.verify();
  });

  const parte = (el: Element | null, nome: string) => texto(el?.querySelector(`[${nome}]`) ?? null);

  it('cenário 23.2: "Pagar" sugere o saldo, registra R$ 200,00 via Pix e a conta fica parcialmente paga', async () => {
    // Relógio fixo em 05/11/2026, 23:30 (hora local): a data padrão é a de hoje no fuso do navegador.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 5, 23, 30));
    const { fixture, el } = await abrir([conta(500)]);
    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Sem pagamento · saldo R$ 500,00');

    await abrirPagamento(fixture, el);
    expect(campo(el, 'valorPago')!.value).toBe('500,00');
    expect(campo(el, 'dataPagamento')!.value).toBe('2026-11-05');
    expect(
      Array.from(campo<HTMLSelectElement>(el, 'forma')!.options).map((o) => o.textContent!.trim()),
    ).toEqual(['', 'Boleto', 'Pix']);

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
    const linha = el.querySelector('[data-baixa]');
    expect([
      parte(linha, 'data-baixa-data'),
      parte(linha, 'data-baixa-forma'),
      parte(linha, 'data-baixa-valor'),
    ]).toEqual(['05/11/2026', 'Pix', 'R$ 200,00']);
    expect(texto(el.querySelector('[data-conta]'))).toContain(
      'Parcialmente paga · saldo R$ 300,00',
    );
  });

  it('cenário 23.2: paga R$ 500,00 via Pix e a conta fica "paga", sem "Pagar"', async () => {
    const { fixture, el } = await abrir([conta(500)]);
    await abrirPagamento(fixture, el);
    preencher(el, 'dataPagamento', '2026-11-05');
    preencher(el, 'forma', PIX.id);
    botao(el, 'confirmar-pagamento')!.click();

    const pedido = http.expectOne(
      (r) => r.url === '/api/financeiro/contas/k1/baixas' && r.method === 'POST',
    );
    expect(pedido.request.body).toEqual({
      data: '2026-11-05',
      valor: 500,
      formaDePagamentoId: 'fp2',
    });
    // Enquanto a resposta não chega, o "Pagar" continua (a conta ainda não está paga).
    await esperar(fixture);
    expect(el.querySelector('[data-form-pagamento]')).not.toBeNull();

    pedido.flush(conta(500, [baixa(500)]));
    await esperar(fixture);

    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Paga · saldo R$ 0,00');
    expect(texto(el.querySelector('[role="status"]'))).toBe('Conta paga');
    expect(botao(el, 'pagar')).toBeNull();
    expect(el.querySelector('[data-form-pagamento]')).toBeNull();
    expect(texto(el.querySelector('[data-conta] [data-selo]'))).toBe('Paga');
  });

  it('409 ao pagar: recarrega a conta e mostra o saldo atual com a mensagem', async () => {
    const { fixture, el } = await abrir([conta(500)]);
    await abrirPagamento(fixture, el);
    preencher(el, 'forma', PIX.id);
    botao(el, 'confirmar-pagamento')!.click();

    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1/baixas')
      .flush(
        { mensagem: 'A conta foi alterada em outra operação. Atualize e tente de novo' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);
    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1' && r.method === 'GET')
      .flush(conta(500, [baixa(300)]));
    await esperar(fixture);

    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Parcialmente paga · saldo R$ 200,00');
    expect(el.querySelectorAll('[data-baixa]').length).toBe(1);
    expect(texto(el.querySelector('[role="alert"]'))).toBe(
      'A conta foi alterada em outra operação. Atualize e tente de novo',
    );
    expect(texto(el.querySelector('[data-conta]'))).toContain(
      'Parcialmente paga · saldo R$ 200,00',
    );
  });

  it('409 ao estornar ("já foi estornado"): recarrega a conta e o "Estornar" some', async () => {
    const { fixture, el } = await abrir([conta(350, [baixa(350)], 'Energia outubro')]);
    botao(el, 'estornar')!.click();
    await esperar(fixture);
    preencher(el, 'motivo', 'Duplicado');
    botao(el, 'confirmar-estorno')!.click();

    http
      .expectOne((r) => r.url === '/api/financeiro/baixas/b1/estorno')
      .flush(
        { mensagem: 'Este pagamento já foi estornado' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);
    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1' && r.method === 'GET')
      .flush(conta(350, [baixa(350, { motivo: 'Outra sessão' })], 'Energia outubro'));
    await esperar(fixture);

    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Sem pagamento · saldo R$ 350,00');
    expect(botao(el, 'estornar')).toBeNull();
    expect(texto(el.querySelector('[data-estorno]'))).toContain('por admin: Outra sessão');
    expect(texto(el.querySelector('[role="alert"]'))).toBe('Este pagamento já foi estornado');
  });

  it('404 ao estornar: a conta foi excluída em outra sessão, sai da lista e o editor fecha', async () => {
    const { fixture, el } = await abrir([conta(350, [baixa(350)], 'Energia outubro')]);
    botao(el, 'estornar')!.click();
    await esperar(fixture);
    preencher(el, 'motivo', 'Errado');
    botao(el, 'confirmar-estorno')!.click();

    http
      .expectOne((r) => r.url === '/api/financeiro/baixas/b1/estorno')
      .flush({ mensagem: 'Pagamento não encontrado' }, { status: 404, statusText: 'Not Found' });
    await esperar(fixture);

    expect(el.querySelector('[data-conta]')).toBeNull();
    expect(el.querySelector('[data-pagamentos]')).toBeNull();
    expect(texto(el.querySelector('[role="alert"]'))).toBe('Pagamento não encontrado');
  });

  it('RN-23.7: descrição e observação alteradas e não salvas continuam depois de pagar', async () => {
    const { fixture, el } = await abrir([conta(500)]);
    preencher(el, 'descricao', 'Aluguel nov/26');
    preencher(el, 'observacao', 'Combinar recibo');
    await abrirPagamento(fixture, el);
    preencher(el, 'valorPago', '200,00');
    preencher(el, 'forma', PIX.id);
    botao(el, 'confirmar-pagamento')!.click();

    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1/baixas')
      .flush(conta(500, [baixa(200)]));
    await esperar(fixture);

    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Parcialmente paga · saldo R$ 300,00');
    expect(campo(el, 'descricao')!.value).toBe('Aluguel nov/26');
    expect(campo<HTMLTextAreaElement>(el, 'observacao')!.value).toBe('Combinar recibo');
    expect(campo(el, 'valor')!.disabled).toBe(true);

    // Salvar manda a descrição e a observação editadas, com os campos travados como estão.
    botao(el, 'salvar')!.click();
    const salvar = http.expectOne(
      (r) => r.url === '/api/financeiro/contas/k1' && r.method === 'PUT',
    );
    expect([salvar.request.body.descricao, salvar.request.body.observacao]).toEqual([
      'Aluguel nov/26',
      'Combinar recibo',
    ]);
    salvar.flush({
      ...conta(500, [baixa(200)]),
      descricao: 'Aluguel nov/26',
      observacao: 'Combinar recibo',
    });
    await esperar(fixture);
  });

  it('RN-23.7: descrição e observação alteradas e não salvas continuam depois de estornar', async () => {
    const { fixture, el } = await abrir([conta(350, [baixa(350)], 'Energia outubro')]);
    preencher(el, 'descricao', 'Energia out/26');
    preencher(el, 'observacao', 'Conferir fatura');
    botao(el, 'estornar')!.click();
    await esperar(fixture);
    preencher(el, 'motivo', 'Pagamento lançado na conta errada');
    botao(el, 'confirmar-estorno')!.click();

    http
      .expectOne((r) => r.url === '/api/financeiro/baixas/b1/estorno')
      .flush(
        conta(
          350,
          [baixa(350, { motivo: 'Pagamento lançado na conta errada' })],
          'Energia outubro',
        ),
      );
    await esperar(fixture);

    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Sem pagamento · saldo R$ 350,00');
    expect(campo(el, 'descricao')!.value).toBe('Energia out/26');
    expect(campo<HTMLTextAreaElement>(el, 'observacao')!.value).toBe('Conferir fatura');
    // Sem pagamento, os campos voltam a ser editáveis.
    expect(campo(el, 'valor')!.disabled).toBe(false);
  });

  // ---- Outra conta aberta enquanto a resposta não chega (R13) ----

  async function pagarEAbrirOutra(fixture: { detectChanges(): void }, el: HTMLElement) {
    preencher(el, 'descricao', 'Aluguel nov/26'); // edição não salva da k1
    await abrirPagamento(fixture, el);
    preencher(el, 'valorPago', '200,00');
    preencher(el, 'forma', PIX.id);
    botao(el, 'confirmar-pagamento')!.click();
    const pedido = http.expectOne((r) => r.url === '/api/financeiro/contas/k1/baixas');
    // A lista continua clicável: o usuário abre a outra conta antes da resposta.
    el.querySelectorAll<HTMLButtonElement>('[data-conta]')[1].click();
    await esperar(fixture);
    expect(campo(el, 'descricao')!.value).toBe('Internet novembro');
    return pedido;
  }

  it('resposta do pagamento com outra conta aberta: só a lista muda, o editor da outra fica', async () => {
    const outra = conta(120, [], 'Internet novembro', 'k2');
    const { fixture, el } = await abrir([conta(500), outra]);
    const pedido = await pagarEAbrirOutra(fixture, el);

    pedido.flush(conta(500, [baixa(200)]));
    await esperar(fixture);

    // O editor continua na k2, sem a edição da k1 nem o aviso do pagamento dela.
    expect(texto(el.querySelector('.editor h2'))).toBe('Internet novembro');
    expect(campo(el, 'descricao')!.value).toBe('Internet novembro');
    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Sem pagamento · saldo R$ 120,00');
    expect(el.querySelector('[role="status"]')).toBeNull();
    // A lista mostra a k1 parcialmente paga.
    expect(texto(el.querySelectorAll('[data-conta]')[0])).toContain(
      'Parcialmente paga · saldo R$ 300,00',
    );
  });

  it('409 → recarga 404 com outra conta aberta: a conta excluída sai da lista e o editor da outra fica', async () => {
    const outra = conta(120, [], 'Internet novembro', 'k2');
    const { fixture, el } = await abrir([conta(500), outra]);
    const pedido = await pagarEAbrirOutra(fixture, el);

    pedido.flush(
      { mensagem: 'A conta foi alterada em outra operação. Atualize e tente de novo' },
      { status: 409, statusText: 'Conflict' },
    );
    await esperar(fixture);
    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1' && r.method === 'GET')
      .flush({ mensagem: 'Conta não encontrada' }, { status: 404, statusText: 'Not Found' });
    await esperar(fixture);

    expect(el.querySelectorAll('[data-conta]').length).toBe(1);
    expect(texto(el.querySelector('.editor h2'))).toBe('Internet novembro');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  // ---- Ramos do recusado() (R18) ----

  it('409 ao pagar e a recarga dá 404: a conta sai da lista, o editor fecha e fica a mensagem do 409', async () => {
    const { fixture, el } = await abrir([conta(500)]);
    await abrirPagamento(fixture, el);
    preencher(el, 'forma', PIX.id);
    botao(el, 'confirmar-pagamento')!.click();

    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1/baixas')
      .flush(
        { mensagem: 'A conta foi alterada em outra operação. Atualize e tente de novo' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);
    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1' && r.method === 'GET')
      .flush({ mensagem: 'Conta não encontrada' }, { status: 404, statusText: 'Not Found' });
    await esperar(fixture);

    expect(el.querySelector('[data-conta]')).toBeNull();
    expect(el.querySelector('[data-pagamentos]')).toBeNull();
    expect(texto(el.querySelector('[role="alert"]'))).toBe(
      'A conta foi alterada em outra operação. Atualize e tente de novo',
    );
  });

  it('409 ao pagar e a recarga é recusada com outro erro: a conta continua e fica a mensagem do 409', async () => {
    const { fixture, el } = await abrir([conta(500)]);
    await abrirPagamento(fixture, el);
    preencher(el, 'forma', PIX.id);
    botao(el, 'confirmar-pagamento')!.click();

    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1/baixas')
      .flush(
        { mensagem: 'A conta foi alterada em outra operação. Atualize e tente de novo' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);
    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1' && r.method === 'GET')
      .flush({ mensagem: 'Sem permissão' }, { status: 403, statusText: 'Forbidden' });
    await esperar(fixture);

    expect(el.querySelectorAll('[data-conta]').length).toBe(1);
    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Sem pagamento · saldo R$ 500,00');
    expect(texto(el.querySelector('[role="alert"]'))).toBe(
      'A conta foi alterada em outra operação. Atualize e tente de novo',
    );
  });

  // ---- 409 de salvar e excluir (R12) ----

  it('409 ao salvar (concorrência): recarrega a conta, trava os campos e mantém a mensagem', async () => {
    const { fixture, el } = await abrir([conta(500)]);
    preencher(el, 'observacao', 'Combinar recibo');
    botao(el, 'salvar')!.click();

    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1' && r.method === 'PUT')
      .flush(
        { mensagem: 'A conta foi alterada em outra operação. Atualize e tente de novo' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);
    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1' && r.method === 'GET')
      .flush(conta(500, [baixa(200)]));
    await esperar(fixture);

    expect(texto(el.querySelector('[data-pagamento]'))).toBe('Parcialmente paga · saldo R$ 300,00');
    expect(campo(el, 'valor')!.disabled).toBe(true);
    expect(botao(el, 'excluir')).toBeNull();
    // A observação editada (campo editável com pagamento) continua no formulário.
    expect(campo<HTMLTextAreaElement>(el, 'observacao')!.value).toBe('Combinar recibo');
    expect(texto(el.querySelector('[role="alert"]'))).toBe(
      'A conta foi alterada em outra operação. Atualize e tente de novo',
    );
  });

  it.each([
    'Conta com pagamento não pode ser excluída. Estorne os pagamentos antes',
    'A conta foi alterada em outra operação. Atualize e tente de novo',
  ])(
    '409 ao excluir ("%s"): recarrega a conta, o "Excluir" some e fica a mensagem',
    async (mensagem) => {
      const { fixture, el } = await abrir([conta(500)]);
      botao(el, 'excluir')!.click();
      await esperar(fixture);
      botao(el, 'excluir')!.click(); // "Confirmar exclusão"

      http
        .expectOne((r) => r.url === '/api/financeiro/contas/k1' && r.method === 'DELETE')
        .flush({ mensagem }, { status: 409, statusText: 'Conflict' });
      await esperar(fixture);
      http
        .expectOne((r) => r.url === '/api/financeiro/contas/k1' && r.method === 'GET')
        .flush(conta(500, [baixa(500)]));
      await esperar(fixture);

      expect(texto(el.querySelector('[data-pagamento]'))).toBe('Paga · saldo R$ 0,00');
      expect(botao(el, 'excluir')).toBeNull();
      expect(el.querySelectorAll('[data-baixa]').length).toBe(1);
      expect(texto(el.querySelector('[role="alert"]'))).toBe(mensagem);
    },
  );

  // ---- Forma excluída na gravação (R14) ----

  it('400 "Forma de pagamento não encontrada": recarrega as formas e limpa a escolhida', async () => {
    const { fixture, el } = await abrir([conta(500)]);
    await abrirPagamento(fixture, el);
    preencher(el, 'forma', PIX.id);
    botao(el, 'confirmar-pagamento')!.click();

    http
      .expectOne((r) => r.url === '/api/financeiro/contas/k1/baixas')
      .flush(
        { errors: { FormaDePagamentoId: ['Forma de pagamento não encontrada'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await esperar(fixture);
    http
      .expectOne((r) => r.url === '/api/financeiro/formas-pagamento' && r.method === 'GET')
      .flush([BOLETO]);
    await esperar(fixture);

    const select = campo<HTMLSelectElement>(el, 'forma')!;
    expect(Array.from(select.options).map((o) => o.textContent!.trim())).toEqual(['', 'Boleto']);
    expect(select.value).toBe('');
    expect(el.querySelector('[data-form-pagamento]')).not.toBeNull();
    expect(texto(el.querySelector('[role="alert"]'))).toBe('Forma de pagamento não encontrada');
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
