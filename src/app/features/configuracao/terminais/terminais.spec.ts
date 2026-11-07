import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Terminais } from './terminais';
import { Terminal } from './terminais.service';

const BALCAO: Terminal = {
  id: 't1',
  nome: 'Balcão 1',
  criadoPor: 'Administrador IMPA',
  criadoEm: '2026-11-07T10:00:00Z',
  revogadoEm: null,
  atual: false,
};
const CELULAR: Terminal = { ...BALCAO, id: 't2', nome: 'Celular Loja' };
const VELHO: Terminal = {
  ...BALCAO,
  id: 't3',
  nome: 'Notebook antigo',
  revogadoEm: '2026-11-07T11:00:00Z',
};

async function esperar(fixture: { detectChanges(): void }) {
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
}

describe('Terminais (story 1-6, T4)', () => {
  let http: HttpTestingController;

  async function abrir(lista: Terminal[]) {
    TestBed.configureTestingModule({
      imports: [Terminais],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Terminais);
    fixture.detectChanges();
    http.expectOne('/api/terminais').flush(lista);
    await esperar(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const botao = (el: HTMLElement, texto: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    );

  function preencher(el: HTMLElement, campo: string, valor: string) {
    const input = el.querySelector<HTMLInputElement>(`[data-campo="${campo}"]`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  afterEach(() => http.verify());

  it('lista os terminais, marca o deste dispositivo e os revogados', async () => {
    const { el } = await abrir([{ ...BALCAO, atual: true }, CELULAR, VELHO]);

    const itens = Array.from(el.querySelectorAll('[data-terminal]')).map(
      (i) => i.textContent ?? '',
    );
    expect(itens).toHaveLength(3);
    expect(itens[0]).toContain('Balcão 1');
    expect(itens[0]).toContain('Este dispositivo');
    expect(itens[1]).not.toContain('Este dispositivo');
    expect(itens[2]).toContain('Revogado');
    // Este dispositivo já é terminal: não oferece registrar de novo.
    expect(el.querySelector('[data-registrar]')).toBeNull();
    expect(el.textContent).toContain('Este dispositivo está registrado como');
  });

  it('registra este dispositivo com um nome', async () => {
    const { fixture, el } = await abrir([CELULAR]);
    expect(el.textContent).toContain('Este dispositivo não está registrado');

    preencher(el, 'novo-nome', '  Balcão 1  ');
    botao(el, 'Registrar este dispositivo')!.click();
    await esperar(fixture);

    const pedido = http.expectOne({ method: 'POST', url: '/api/terminais' });
    expect(pedido.request.body).toEqual({ nome: 'Balcão 1' });
    pedido.flush({ ...BALCAO, atual: true }, { status: 201, statusText: 'Created' });
    await esperar(fixture);
    http.expectOne('/api/terminais').flush([{ ...BALCAO, atual: true }, CELULAR]);
    await esperar(fixture);

    expect(el.textContent).toContain('Este dispositivo está registrado como');
    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      'Dispositivo registrado como terminal',
    );
  });

  it('nome repetido: mostra a recusa do servidor', async () => {
    const { fixture, el } = await abrir([CELULAR]);

    preencher(el, 'novo-nome', 'Celular Loja');
    botao(el, 'Registrar este dispositivo')!.click();
    await esperar(fixture);
    http
      .expectOne({ method: 'POST', url: '/api/terminais' })
      .flush(
        { mensagem: 'Já existe um terminal com esse nome' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Já existe um terminal com esse nome',
    );
  });

  it('nome vazio não chama o servidor', async () => {
    const { fixture, el } = await abrir([]);

    botao(el, 'Registrar este dispositivo')!.click();
    await esperar(fixture);

    http.expectNone({ method: 'POST', url: '/api/terminais' });
    expect(el.textContent).toContain('Informe o nome do terminal');
  });

  it('renomeia o terminal selecionado', async () => {
    const { fixture, el } = await abrir([BALCAO]);

    (el.querySelector('[data-terminal]') as HTMLButtonElement).click();
    await esperar(fixture);
    preencher(el, 'nome', 'Caixa da frente');
    botao(el, 'Salvar')!.click();
    await esperar(fixture);

    const pedido = http.expectOne({ method: 'PUT', url: '/api/terminais/t1' });
    expect(pedido.request.body).toEqual({ nome: 'Caixa da frente' });
    pedido.flush({ ...BALCAO, nome: 'Caixa da frente' });
    await esperar(fixture);

    expect(el.querySelector('[data-terminal]')?.textContent).toContain('Caixa da frente');
  });

  it('revoga com confirmação', async () => {
    const { fixture, el } = await abrir([BALCAO]);
    (el.querySelector('[data-terminal]') as HTMLButtonElement).click();
    await esperar(fixture);

    botao(el, 'Revogar')!.click();
    await esperar(fixture);
    http.expectNone({ method: 'POST', url: '/api/terminais/t1/revogar' });

    botao(el, 'Confirmar revogação')!.click();
    await esperar(fixture);
    http
      .expectOne({ method: 'POST', url: '/api/terminais/t1/revogar' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await esperar(fixture);
    http.expectOne('/api/terminais').flush([{ ...BALCAO, revogadoEm: '2026-11-07T12:00:00Z' }]);
    await esperar(fixture);

    expect(el.querySelector('[data-terminal]')?.textContent).toContain('Revogado');
    expect(botao(el, 'Revogar')).toBeUndefined(); // revogado não volta e não é editado
  });
});
