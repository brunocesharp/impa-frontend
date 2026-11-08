import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Categoria } from '../financeiro.service';
import { Categorias } from './categorias';

const ALUGUEL: Categoria = { id: 'c1', nome: 'Aluguel', ativa: true };
const ENERGIA: Categoria = { id: 'c2', nome: 'Energia', ativa: true };

async function esperar(fixture: { detectChanges(): void }) {
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
}

describe('Categorias financeiras (story 11-1, RN-23.1)', () => {
  let http: HttpTestingController;

  async function abrir(
    categorias: Categoria[] = [ALUGUEL, ENERGIA],
    permissoes = ['financeiro.ver', 'financeiro.editar'],
  ) {
    TestBed.configureTestingModule({
      imports: [Categorias],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const sessao = TestBed.inject(AuthService).carregarSessao();
    http.expectOne('/api/auth/me').flush({ usuario: 'u', nome: 'U', perfil: 'P', permissoes });
    await sessao;

    const fixture = TestBed.createComponent(Categorias);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/financeiro/categorias' && r.method === 'GET')
      .flush(categorias);
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

  it('lista as categorias', async () => {
    const { el } = await abrir();
    expect(
      Array.from(el.querySelectorAll('[data-categoria]')).map((c) => c.textContent!.trim()),
    ).toEqual(['Aluguel', 'Energia']);
  });

  it('cadastra uma categoria nova', async () => {
    const { fixture, el } = await abrir();
    botao(el, 'novo')!.click();
    await esperar(fixture);
    preencher(el, 'nome', 'Manutenção');
    botao(el, 'salvar')!.click();

    const pedido = http.expectOne(
      (r) => r.url === '/api/financeiro/categorias' && r.method === 'POST',
    );
    expect(pedido.request.body).toEqual({ nome: 'Manutenção' });
    pedido.flush({ id: 'c9', nome: 'Manutenção', ativa: true });
    await esperar(fixture);

    expect(el.textContent).toContain('Categoria cadastrada');
    expect(el.querySelectorAll('[data-categoria]').length).toBe(3);
  });

  it('categoria com contas: mostra a recusa do servidor e permite inativar', async () => {
    const { fixture, el } = await abrir();
    el.querySelector<HTMLButtonElement>('[data-categoria]')!.click();
    await esperar(fixture);

    botao(el, 'excluir')!.click();
    await esperar(fixture);
    expect(botao(el, 'excluir')!.textContent).toContain('Confirmar exclusão');
    botao(el, 'excluir')!.click();
    http
      .expectOne((r) => r.url === '/api/financeiro/categorias/c1' && r.method === 'DELETE')
      .flush(
        { mensagem: 'Esta categoria tem contas. Você pode inativá-la' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);
    expect(el.querySelector('[role="alert"]')!.textContent).toContain(
      'Esta categoria tem contas. Você pode inativá-la',
    );

    botao(el, 'situacao')!.click();
    await esperar(fixture);
    botao(el, 'situacao')!.click();
    http
      .expectOne((r) => r.url === '/api/financeiro/categorias/c1/inativar' && r.method === 'POST')
      .flush(null, { status: 204, statusText: 'No Content' });
    await esperar(fixture);

    expect(el.querySelector('[data-situacao]')!.textContent).toContain('Inativa');
    expect(el.textContent).toContain('Categoria inativada');
  });

  it('sem financeiro.editar: só consulta', async () => {
    const { fixture, el } = await abrir([ALUGUEL], ['financeiro.ver']);
    expect(botao(el, 'novo')).toBeNull();

    el.querySelector<HTMLButtonElement>('[data-categoria]')!.click();
    await esperar(fixture);
    expect(botao(el, 'salvar')).toBeNull();
    expect(botao(el, 'excluir')).toBeNull();
    expect(el.querySelector<HTMLInputElement>('[data-campo="nome"]')!.disabled).toBe(true);
  });
});
