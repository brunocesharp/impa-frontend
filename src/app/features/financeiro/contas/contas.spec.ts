import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Fornecedor } from '../../pessoas/pessoas.service';
import { Categoria, Conta } from '../financeiro.service';
import { Contas } from './contas';

const MERCADORIAS: Categoria = { id: 'cat1', nome: 'Compra de mercadorias', ativa: true };
const ALUGUEL: Categoria = { id: 'cat2', nome: 'Aluguel', ativa: true };

const ALFA: Fornecedor = {
  id: 'f1',
  razaoSocial: 'Distribuidora Alfa',
  nomeFantasia: null,
  documento: '11.222.333/0001-81',
  telefone: null,
  email: null,
  contato: null,
  ativo: true,
};

function parcela(numero: number, valor: number, vencimento: string): Conta {
  return {
    id: `p${numero}`,
    descricao: 'Compra de mochilas',
    categoriaId: MERCADORIAS.id,
    categoria: MERCADORIAS.nome,
    valor,
    vencimento,
    fornecedor: { id: ALFA.id, razaoSocial: ALFA.razaoSocial, documento: ALFA.documento },
    numeroDocumento: null,
    observacao: null,
    parcela: numero,
    totalDeParcelas: 3,
    parcelamentoId: 'g1',
    valorPago: 0,
    saldo: valor,
    situacaoDoPagamento: 'sem-pagamento',
    baixas: [],
  };
}

const CENARIO_23_1: Conta[] = [
  parcela(1, 333.34, '2027-01-31'),
  parcela(2, 333.33, '2027-02-28'),
  parcela(3, 333.33, '2027-03-31'),
];

const texto = (el: Element | null) => (el?.textContent ?? '').replace(/ /g, ' ').trim();

async function esperar(fixture: { detectChanges(): void }) {
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
}

describe('Contas a pagar (story 11-1)', () => {
  let http: HttpTestingController;

  async function abrir(
    contas: Conta[] = [],
    permissoes = ['financeiro.ver', 'financeiro.editar', 'fornecedores.gerenciar'],
    fornecedores: Fornecedor[] = [ALFA],
  ) {
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
      .flush([ALUGUEL, MERCADORIAS]);
    if (permissoes.includes('fornecedores.gerenciar'))
      http
        .expectOne((r) => r.url === '/api/pessoas/fornecedores' && r.method === 'GET')
        .flush(fornecedores);
    await esperar(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const botao = (el: HTMLElement, acao: string) =>
    el.querySelector<HTMLButtonElement>(`[data-acao="${acao}"]`);

  function preencher(el: HTMLElement, campo: string, valor: string) {
    const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-campo="${campo}"]`,
    )!;
    input.value = valor;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
  }

  afterEach(() => http.verify());

  it('lista as parcelas com n/total, valor, vencimento, categoria e fornecedor', async () => {
    const { el } = await abrir(CENARIO_23_1);
    const itens = Array.from(el.querySelectorAll('[data-conta]')).map(texto);

    expect(itens.length).toBe(3);
    expect(itens[0]).toContain('Compra de mochilas');
    expect(itens[0]).toContain('1/3');
    expect(itens[0]).toContain('R$ 333,34');
    expect(itens[0]).toContain('31/01/2027');
    expect(itens[0]).toContain('Compra de mercadorias');
    expect(itens[0]).toContain('Distribuidora Alfa');
    expect(itens[1]).toContain('28/02/2027');
  });

  it('cenário 23.1: mostra a prévia das parcelas e lança a conta', async () => {
    const { fixture, el } = await abrir();
    botao(el, 'novo')!.click();
    await esperar(fixture);

    preencher(el, 'descricao', 'Compra de mochilas');
    preencher(el, 'categoria', MERCADORIAS.id);
    preencher(el, 'valor', '1.000,00');
    preencher(el, 'vencimento', '2027-01-31');
    preencher(el, 'parcelas', '3');
    preencher(el, 'fornecedor', ALFA.id);
    await esperar(fixture);

    const previa = Array.from(el.querySelectorAll('[data-previa] tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map(texto),
    );
    expect(previa).toEqual([
      ['1/3', 'R$ 333,34', '31/01/2027'],
      ['2/3', 'R$ 333,33', '28/02/2027'],
      ['3/3', 'R$ 333,33', '31/03/2027'],
    ]);

    botao(el, 'salvar')!.click();
    const pedido = http.expectOne((r) => r.url === '/api/financeiro/contas' && r.method === 'POST');
    expect(pedido.request.body).toEqual({
      descricao: 'Compra de mochilas',
      categoriaId: MERCADORIAS.id,
      valor: 1000,
      vencimento: '2027-01-31',
      parcelas: 3,
      fornecedorDocumento: ALFA.documento,
      numeroDocumento: null,
      observacao: null,
    });
    pedido.flush(CENARIO_23_1, { status: 201, statusText: 'Created' });
    await esperar(fixture);

    expect(el.querySelectorAll('[data-conta]').length).toBe(3);
    expect(texto(el.querySelector('[role="status"]'))).toContain('3 parcelas lançadas');
  });

  it('RN-23.2: descrição, categoria, valor e vencimento obrigatórios', async () => {
    const { fixture, el } = await abrir();
    botao(el, 'novo')!.click();
    await esperar(fixture);
    preencher(el, 'valor', '0');
    botao(el, 'salvar')!.click();
    await esperar(fixture);

    const erros = Array.from(el.querySelectorAll('mat-error')).map(texto);
    expect(erros).toEqual([
      'Informe a descrição',
      'Informe a categoria',
      'O valor precisa ser maior que zero',
      'Informe o vencimento',
    ]);
    http.expectNone((r) => r.method === 'POST');
  });

  it('mostra a recusa do servidor', async () => {
    const { fixture, el } = await abrir();
    botao(el, 'novo')!.click();
    await esperar(fixture);
    preencher(el, 'descricao', 'Aluguel novembro');
    preencher(el, 'categoria', ALUGUEL.id);
    preencher(el, 'valor', '2000');
    preencher(el, 'vencimento', '2026-11-10');
    botao(el, 'salvar')!.click();
    http
      .expectOne((r) => r.url === '/api/financeiro/contas' && r.method === 'POST')
      .flush(
        { errors: { CategoriaId: ['Categoria inativa'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await esperar(fixture);

    expect(texto(el.querySelector('[role="alert"]'))).toBe('Categoria inativa');
  });

  it('altera uma parcela e exclui com confirmação', async () => {
    const { fixture, el } = await abrir(CENARIO_23_1);
    el.querySelectorAll<HTMLButtonElement>('[data-conta]')[1].click();
    await esperar(fixture);

    expect(texto(el.querySelector('[data-parcela]'))).toContain('Parcela 2/3');
    expect(el.querySelector('[data-campo="parcelas"]')).toBeNull();
    preencher(el, 'valor', '340,00');
    botao(el, 'salvar')!.click();
    const put = http.expectOne((r) => r.url === '/api/financeiro/contas/p2' && r.method === 'PUT');
    expect(put.request.body).toEqual({
      descricao: 'Compra de mochilas',
      categoriaId: MERCADORIAS.id,
      valor: 340,
      vencimento: '2027-02-28',
      fornecedorDocumento: ALFA.documento,
      numeroDocumento: null,
      observacao: null,
    });
    put.flush({ ...CENARIO_23_1[1], valor: 340 });
    await esperar(fixture);
    expect(texto(el.querySelectorAll('[data-conta]')[1])).toContain('R$ 340,00');

    botao(el, 'excluir')!.click();
    await esperar(fixture);
    expect(texto(botao(el, 'excluir'))).toContain('Confirmar exclusão');
    botao(el, 'excluir')!.click();
    http
      .expectOne((r) => r.url === '/api/financeiro/contas/p2' && r.method === 'DELETE')
      .flush(null, { status: 204, statusText: 'No Content' });
    await esperar(fixture);

    expect(el.querySelectorAll('[data-conta]').length).toBe(2);
    expect(texto(el.querySelector('[role="status"]'))).toContain('Conta excluída');
  });

  const tabelaDaPrevia = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('[data-previa] tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map(texto),
    );

  it('RN-23.3: a prévia é recalculada ao mudar a quantidade de parcelas ou a data', async () => {
    const { fixture, el } = await abrir();
    botao(el, 'novo')!.click();
    await esperar(fixture);
    preencher(el, 'valor', '1.000,00');
    preencher(el, 'vencimento', '2027-01-31');
    preencher(el, 'parcelas', '3');
    await esperar(fixture);
    expect(tabelaDaPrevia(el).length).toBe(3);

    preencher(el, 'parcelas', '4');
    await esperar(fixture);
    expect(tabelaDaPrevia(el)).toEqual([
      ['1/4', 'R$ 250,00', '31/01/2027'],
      ['2/4', 'R$ 250,00', '28/02/2027'],
      ['3/4', 'R$ 250,00', '31/03/2027'],
      ['4/4', 'R$ 250,00', '30/04/2027'],
    ]);

    preencher(el, 'vencimento', '2027-11-30');
    preencher(el, 'parcelas', '3');
    await esperar(fixture);
    expect(tabelaDaPrevia(el)).toEqual([
      ['1/3', 'R$ 333,34', '30/11/2027'],
      ['2/3', 'R$ 333,33', '30/12/2027'],
      ['3/3', 'R$ 333,33', '30/01/2028'],
    ]);
    expect(texto(el.querySelector('[data-previa] tfoot td'))).toBe('R$ 1.000,00');
  });

  it('RN-23.2: valor acima de R$ 999.999.999.999,99 é recusado na tela', async () => {
    const { fixture, el } = await abrir();
    botao(el, 'novo')!.click();
    await esperar(fixture);
    preencher(el, 'valor', '1.000.000.000.000,00');
    botao(el, 'salvar')!.click();
    await esperar(fixture);

    expect(Array.from(el.querySelectorAll('mat-error')).map(texto)).toContain(
      'O valor pode ser de no máximo R$ 999.999.999.999,99',
    );
    expect(el.querySelector('[data-previa]')).toBeNull();
    http.expectNone((r) => r.method === 'POST');
  });

  it('fornecedor da conta é casado pelo id, mesmo com o CNPJ corrigido no Pessoas', async () => {
    const corrigido: Fornecedor = { ...ALFA, documento: '11.444.777/0001-61' };
    const { fixture, el } = await abrir(CENARIO_23_1, undefined, [corrigido]);
    el.querySelectorAll<HTMLButtonElement>('[data-conta]')[0].click();
    await esperar(fixture);

    const select = el.querySelector<HTMLSelectElement>('[data-campo="fornecedor"]')!;
    const opcoes = Array.from(select.options).map(texto);
    expect(opcoes.filter((o) => o === 'Distribuidora Alfa').length).toBe(1);
    expect(select.value).toBe(ALFA.id);

    preencher(el, 'descricao', 'Mochilas');
    botao(el, 'salvar')!.click();
    const put = http.expectOne((r) => r.url === '/api/financeiro/contas/p1' && r.method === 'PUT');
    expect(put.request.body.fornecedorDocumento).toBe(corrigido.documento);
    put.flush({ ...CENARIO_23_1[0], descricao: 'Mochilas' });
    await esperar(fixture);
  });

  it('busca o fornecedor pelo que é digitado (alcança além dos 50 primeiros)', async () => {
    const zeta: Fornecedor = {
      ...ALFA,
      id: 'f51',
      razaoSocial: 'Zeta Papéis',
      documento: '11.444.777/0001-61',
    };
    const { fixture, el } = await abrir();
    botao(el, 'novo')!.click();
    await esperar(fixture);

    preencher(el, 'buscaFornecedor', 'Zeta');
    await new Promise((r) => setTimeout(r, 350));
    const busca = http.expectOne(
      (r) => r.url === '/api/pessoas/fornecedores' && r.params.get('busca') === 'Zeta',
    );
    busca.flush([zeta]);
    await esperar(fixture);

    preencher(el, 'descricao', 'Resmas');
    preencher(el, 'categoria', MERCADORIAS.id);
    preencher(el, 'valor', '300');
    preencher(el, 'vencimento', '2027-01-10');
    preencher(el, 'fornecedor', zeta.id);
    await esperar(fixture);
    botao(el, 'salvar')!.click();
    const post = http.expectOne((r) => r.url === '/api/financeiro/contas' && r.method === 'POST');
    expect(post.request.body.fornecedorDocumento).toBe(zeta.documento);
    post.flush([], { status: 201, statusText: 'Created' });
    await esperar(fixture);
  });

  it('conta excluída em outra sessão: no 404 do PUT sai da lista e o editor fecha', async () => {
    const { fixture, el } = await abrir(CENARIO_23_1);
    el.querySelectorAll<HTMLButtonElement>('[data-conta]')[1].click();
    await esperar(fixture);
    botao(el, 'salvar')!.click();
    http
      .expectOne((r) => r.url === '/api/financeiro/contas/p2' && r.method === 'PUT')
      .flush({ mensagem: 'Conta não encontrada' }, { status: 404, statusText: 'Not Found' });
    await esperar(fixture);

    expect(el.querySelectorAll('[data-conta]').length).toBe(2);
    expect(el.querySelector('[data-acao="salvar"]')).toBeNull();
    expect(texto(el.querySelector('[role="alert"]'))).toBe('Conta não encontrada');
  });

  it('conta excluída em outra sessão: no 404 do DELETE sai da lista e o editor fecha', async () => {
    const { fixture, el } = await abrir(CENARIO_23_1);
    el.querySelectorAll<HTMLButtonElement>('[data-conta]')[2].click();
    await esperar(fixture);
    botao(el, 'excluir')!.click();
    await esperar(fixture);
    botao(el, 'excluir')!.click();
    http
      .expectOne((r) => r.url === '/api/financeiro/contas/p3' && r.method === 'DELETE')
      .flush({ mensagem: 'Conta não encontrada' }, { status: 404, statusText: 'Not Found' });
    await esperar(fixture);

    expect(el.querySelectorAll('[data-conta]').length).toBe(2);
    expect(el.querySelector('[data-acao="excluir"]')).toBeNull();
    expect(texto(el.querySelector('[role="alert"]'))).toBe('Conta não encontrada');
  });

  it('sem fornecedores.gerenciar, o fornecedor é informado pelo CNPJ/CPF', async () => {
    const { fixture, el } = await abrir([], ['financeiro.ver', 'financeiro.editar']);
    botao(el, 'novo')!.click();
    await esperar(fixture);

    expect(el.querySelector('[data-campo="fornecedor"]')!.tagName).toBe('INPUT');
  });

  it('só com financeiro.ver: consulta sem lançar, alterar nem excluir', async () => {
    const { fixture, el } = await abrir(CENARIO_23_1, ['financeiro.ver']);
    expect(botao(el, 'novo')).toBeNull();

    el.querySelector<HTMLButtonElement>('[data-conta]')!.click();
    await esperar(fixture);
    expect(botao(el, 'salvar')).toBeNull();
    expect(botao(el, 'excluir')).toBeNull();
    expect(el.querySelector<HTMLInputElement>('[data-campo="descricao"]')!.disabled).toBe(true);
  });
});
