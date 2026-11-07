import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Fornecedor } from '../pessoas.service';
import { Fornecedores } from './fornecedores';

const ALFA: Fornecedor = {
  id: 'f1',
  razaoSocial: 'Distribuidora Alfa Ltda',
  nomeFantasia: 'Alfa',
  documento: '11.222.333/0001-81',
  telefone: null,
  email: null,
  contato: null,
  ativo: true,
};

async function esperar(fixture: { detectChanges(): void }) {
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
}

describe('Fornecedores (story 3-7, T8)', () => {
  let http: HttpTestingController;

  async function abrir(fornecedores: Fornecedor[] = [ALFA]) {
    TestBed.configureTestingModule({
      imports: [Fornecedores],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Fornecedores);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/pessoas/fornecedores' && r.method === 'GET')
      .flush(fornecedores);
    await esperar(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const botao = (el: HTMLElement, acao: string) =>
    el.querySelector<HTMLButtonElement>(`[data-acao="${acao}"]`)!;

  function preencher(el: HTMLElement, campo: string, valor: string) {
    const input = el.querySelector<HTMLInputElement>(`[data-campo="${campo}"]`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  afterEach(() => http.verify());

  it('lista razão social, nome fantasia e CNPJ', async () => {
    const { el } = await abrir();
    const item = el.querySelector('[data-fornecedor]')!.textContent!;
    expect(item).toContain('Distribuidora Alfa Ltda');
    expect(item).toContain('Alfa');
    expect(item).toContain('11.222.333/0001-81');
  });

  it('cenário 14.2: fornecedor sem documento é recusado no formulário', async () => {
    const { fixture, el } = await abrir([]);
    botao(el, 'novo').click();
    await esperar(fixture);

    preencher(el, 'razaoSocial', 'Distribuidora Alfa');
    botao(el, 'salvar').click();
    await esperar(fixture);

    expect(el.querySelector('[data-erro="documento"]')!.textContent).toContain(
      'Informe o CNPJ ou CPF do fornecedor',
    );
    http.expectNone((r) => r.method === 'POST');
  });

  it('cadastra com CNPJ e mostra o CNPJ repetido recusado pelo servidor', async () => {
    const { fixture, el } = await abrir([]);
    botao(el, 'novo').click();
    await esperar(fixture);

    preencher(el, 'razaoSocial', 'Beta');
    preencher(el, 'documento', '11.222.333/0001-81');
    botao(el, 'salvar').click();
    await esperar(fixture);

    const pedido = http.expectOne(
      (r) => r.method === 'POST' && r.url === '/api/pessoas/fornecedores',
    );
    expect(pedido.request.body).toEqual({
      razaoSocial: 'Beta',
      documento: '11.222.333/0001-81',
      nomeFantasia: null,
      telefone: null,
      email: null,
      contato: null,
    });
    pedido.flush(
      { mensagem: 'CNPJ já cadastrado para o fornecedor Distribuidora Alfa' },
      { status: 409, statusText: 'Conflict' },
    );
    await esperar(fixture);
    expect(el.querySelector('[role="alert"]')!.textContent).toContain(
      'CNPJ já cadastrado para o fornecedor Distribuidora Alfa',
    );
  });

  it('exclui o fornecedor sem histórico com confirmação', async () => {
    const { fixture, el } = await abrir();
    el.querySelector<HTMLButtonElement>('[data-fornecedor]')!.click();
    await esperar(fixture);

    botao(el, 'excluir').click();
    await esperar(fixture);
    botao(el, 'excluir').click();
    await esperar(fixture);

    http
      .expectOne((r) => r.method === 'DELETE' && r.url === '/api/pessoas/fornecedores/f1')
      .flush(null);
    await esperar(fixture);
    expect(el.querySelectorAll('[data-fornecedor]')).toHaveLength(0);
    expect(el.textContent).toContain('Fornecedor excluído');
  });
});
