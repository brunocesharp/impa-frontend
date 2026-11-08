import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { FormaDePagamento } from '../financeiro.service';
import { FormasPagamento } from './formas-pagamento';

const PIX: FormaDePagamento = { id: 'c1', nome: 'Pix', ativa: true };
const BOLETO: FormaDePagamento = { id: 'c2', nome: 'Boleto', ativa: true };

async function esperar(fixture: { detectChanges(): void }) {
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
}

describe('Formas de pagamento financeiras (story 11-2, RN-23.4)', () => {
  let http: HttpTestingController;

  async function abrir(
    formas: FormaDePagamento[] = [BOLETO, PIX],
    permissoes = ['financeiro.ver', 'financeiro.editar'],
  ) {
    TestBed.configureTestingModule({
      imports: [FormasPagamento],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const sessao = TestBed.inject(AuthService).carregarSessao();
    http.expectOne('/api/auth/me').flush({ usuario: 'u', nome: 'U', perfil: 'P', permissoes });
    await sessao;

    const fixture = TestBed.createComponent(FormasPagamento);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/financeiro/formas-pagamento' && r.method === 'GET')
      .flush(formas);
    await esperar(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const botao = (el: HTMLElement, acao: string) =>
    el.querySelector<HTMLButtonElement>(`[data-acao="${acao}"]`);

  function preencher(el: HTMLElement, campo: string, valor: string) {
    const input = el.querySelector<HTMLInputElement>(`[data-campo="${campo}"]`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  afterEach(() => http.verify());

  it('lista as formas de pagamento', async () => {
    const { el } = await abrir();
    expect(
      Array.from(el.querySelectorAll('[data-forma]')).map((c) => c.textContent!.trim()),
    ).toEqual(['Boleto', 'Pix']);
  });

  it('cadastra uma forma de pagamento nova', async () => {
    const { fixture, el } = await abrir();
    botao(el, 'novo')!.click();
    await esperar(fixture);
    preencher(el, 'nome', 'Cartão corporativo');
    botao(el, 'salvar')!.click();

    const pedido = http.expectOne(
      (r) => r.url === '/api/financeiro/formas-pagamento' && r.method === 'POST',
    );
    expect(pedido.request.body).toEqual({ nome: 'Cartão corporativo' });
    pedido.flush({ id: 'c9', nome: 'Cartão corporativo', ativa: true });
    await esperar(fixture);

    expect(el.textContent).toContain('Forma de pagamento cadastrada');
    expect(el.querySelectorAll('[data-forma]').length).toBe(3);
  });

  it('forma com pagamentos: mostra a recusa do servidor e permite inativar', async () => {
    const { fixture, el } = await abrir();
    el.querySelector<HTMLButtonElement>('[data-forma]')!.click();
    await esperar(fixture);

    botao(el, 'excluir')!.click();
    await esperar(fixture);
    expect(botao(el, 'excluir')!.textContent).toContain('Confirmar exclusão');
    botao(el, 'excluir')!.click();
    http
      .expectOne((r) => r.url === '/api/financeiro/formas-pagamento/c2' && r.method === 'DELETE')
      .flush(
        { mensagem: 'Esta forma de pagamento tem pagamentos. Você pode inativá-la' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);
    expect(el.querySelector('[role="alert"]')!.textContent).toContain(
      'Esta forma de pagamento tem pagamentos. Você pode inativá-la',
    );

    botao(el, 'situacao')!.click();
    await esperar(fixture);
    botao(el, 'situacao')!.click();
    http
      .expectOne(
        (r) => r.url === '/api/financeiro/formas-pagamento/c2/inativar' && r.method === 'POST',
      )
      .flush(null, { status: 204, statusText: 'No Content' });
    await esperar(fixture);

    expect(el.querySelector('[data-situacao]')!.textContent).toContain('Inativa');
    expect(el.textContent).toContain('Forma de pagamento inativada');
  });

  it('sem financeiro.editar: só consulta', async () => {
    const { fixture, el } = await abrir([PIX], ['financeiro.ver']);
    expect(botao(el, 'novo')).toBeNull();

    el.querySelector<HTMLButtonElement>('[data-forma]')!.click();
    await esperar(fixture);
    expect(botao(el, 'salvar')).toBeNull();
    expect(botao(el, 'excluir')).toBeNull();
    expect(el.querySelector<HTMLInputElement>('[data-campo="nome"]')!.disabled).toBe(true);
  });
});
