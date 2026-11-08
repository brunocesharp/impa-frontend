import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Auditoria, antesEDepois } from './auditoria';
import { PaginaDeAuditoria, RegistroDeAuditoria } from './auditoria.service';

const CUSTO: RegistroDeAuditoria = {
  id: 'a1',
  ocorreuEm: '2026-11-07T13:30:00Z',
  usuarioId: 'u1',
  usuarioNome: 'Carla',
  modulo: 'Catalogo',
  entidade: 'Item',
  entidadeId: '42',
  operacao: 'custo.alterado',
  campos: [{ campo: 'Custo', antes: '10,00', depois: '12,50', omitido: false }],
};
const FISCAL: RegistroDeAuditoria = {
  ...CUSTO,
  id: 'a2',
  modulo: 'Fiscal',
  entidade: 'ConfiguracaoFiscal',
  operacao: 'configuracao-fiscal.alterada',
  campos: [
    { campo: 'Ambiente', antes: 'Homologação', depois: 'Produção', omitido: false },
    { campo: 'Csc', antes: null, depois: null, omitido: true },
  ],
};

const pagina = (
  itens: RegistroDeAuditoria[],
  total = itens.length,
  numero = 1,
): PaginaDeAuditoria => ({
  itens,
  pagina: numero,
  tamanhoDaPagina: 20,
  total,
});

async function esperar(fixture: { detectChanges(): void }) {
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
}

describe('antesEDepois', () => {
  it('mostra "antes → depois", traço quando não havia valor e esconde o sensível', () => {
    expect(antesEDepois({ campo: 'Custo', antes: '10,00', depois: '12,50', omitido: false })).toBe(
      '10,00 → 12,50',
    );
    expect(antesEDepois({ campo: 'Cfop', antes: null, depois: '5102', omitido: false })).toBe(
      '— → 5102',
    );
    expect(antesEDepois({ campo: 'Csc', antes: null, depois: null, omitido: true })).toBe(
      'valor protegido',
    );
  });
});

describe('Auditoria (story 4.4, T6)', () => {
  let http: HttpTestingController;

  const consulta = (): TestRequest => http.expectOne((r) => r.url === '/api/auditoria');

  async function abrir(primeira: PaginaDeAuditoria) {
    TestBed.configureTestingModule({
      imports: [Auditoria],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Auditoria);
    fixture.detectChanges();
    const pedido = consulta();
    expect(pedido.request.params.keys().sort()).toEqual(['pagina', 'tamanho']);
    pedido.flush(primeira);
    await esperar(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function preencher(el: HTMLElement, filtro: string, valor: string) {
    const input = el.querySelector<HTMLInputElement>(`[data-filtro="${filtro}"]`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  const clicar = (el: HTMLElement, acao: string) =>
    el.querySelector<HTMLButtonElement>(`[data-acao="${acao}"]`)!.click();

  afterEach(() => http.verify());

  it('lista usuário, data, operação e "antes → depois" de cada campo', async () => {
    const { el } = await abrir(pagina([FISCAL, CUSTO]));

    const registros = Array.from(el.querySelectorAll('[data-registro]'));
    expect(registros).toHaveLength(2);
    const custo = registros[1];
    expect(custo.querySelector('[data-usuario]')?.textContent).toContain('Carla');
    expect(custo.querySelector('[data-data]')?.textContent).toMatch(/07\/11\/2026 \d{2}:30/);
    expect(custo.querySelector('[data-operacao]')?.textContent).toContain('custo.alterado');
    expect(custo.querySelector('[data-campo]')?.textContent).toContain('Custo: 10,00 → 12,50');

    const campos = Array.from(registros[0].querySelectorAll('[data-campo]')).map((c) =>
      c.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(campos).toEqual(['Ambiente: Homologação → Produção', 'Csc: valor protegido']);
    expect(el.querySelector('[data-total]')?.textContent).toContain('2 registros');
  });

  it('filtra por período, usuário, módulo e entidade', async () => {
    const { fixture, el } = await abrir(pagina([FISCAL, CUSTO]));

    preencher(el, 'de', '2026-11-01');
    preencher(el, 'ate', '2026-11-07');
    preencher(el, 'usuario', ' carla ');
    preencher(el, 'modulo', 'Catalogo');
    preencher(el, 'entidade', 'Item');
    clicar(el, 'filtrar');

    const pedido = consulta();
    const params = pedido.request.params;
    expect(params.get('de')).toBe(new Date(2026, 10, 1).toISOString());
    expect(params.get('ate')).toBe(new Date(2026, 10, 8).toISOString());
    expect(params.get('usuario')).toBe('carla');
    expect(params.get('modulo')).toBe('Catalogo');
    expect(params.get('entidade')).toBe('Item');
    expect(params.get('pagina')).toBe('1');
    pedido.flush(pagina([CUSTO]));
    await esperar(fixture);

    expect(el.querySelectorAll('[data-registro]')).toHaveLength(1);
  });

  it('limpar volta a consultar sem filtros', async () => {
    const { fixture, el } = await abrir(pagina([CUSTO]));
    preencher(el, 'usuario', 'carla');
    clicar(el, 'filtrar');
    consulta().flush(pagina([CUSTO]));
    await esperar(fixture);

    clicar(el, 'limpar');

    const pedido = consulta();
    expect(pedido.request.params.keys().sort()).toEqual(['pagina', 'tamanho']);
    pedido.flush(pagina([]));
    await esperar(fixture);
    expect(el.textContent).toContain('Nenhuma operação encontrada');
  });

  it('a próxima página mantém os filtros aplicados, não o que ainda está sendo digitado', async () => {
    const { fixture, el } = await abrir(pagina([CUSTO]));
    preencher(el, 'modulo', 'Fiscal');
    clicar(el, 'filtrar');
    consulta().flush(pagina([FISCAL], 45));
    await esperar(fixture);
    expect(el.querySelector('[data-pagina]')?.textContent).toContain('Página 1 de 3');

    preencher(el, 'modulo', 'Estoque'); // digitado, mas não filtrado
    clicar(el, 'proxima');

    const pedido = consulta();
    expect(pedido.request.params.get('modulo')).toBe('Fiscal');
    expect(pedido.request.params.get('pagina')).toBe('2');
    pedido.flush(pagina([FISCAL], 45, 2));
  });

  it('erro na consulta mostra a mensagem', async () => {
    const { fixture, el } = await abrir(pagina([]));
    clicar(el, 'filtrar');

    consulta().flush(null, { status: 400, statusText: 'Bad Request' });
    await esperar(fixture);

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível consultar');
  });
});
