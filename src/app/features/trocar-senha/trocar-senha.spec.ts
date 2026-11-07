import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { TrocarSenha } from './trocar-senha';

async function esperar(fixture: { detectChanges(): void }) {
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
}

describe('TrocarSenha (story 1-4, cenário 1.7)', () => {
  let http: HttpTestingController;

  function abrir() {
    TestBed.configureTestingModule({
      imports: [TrocarSenha],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TrocarSenha);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function preencher(el: HTMLElement, campo: string, valor: string) {
    const input = el.querySelector<HTMLInputElement>(`[data-campo="${campo}"]`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  const enviar = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();

  afterEach(() => http.verify());

  it('troca a senha, recarrega a sessão e vai ao início', async () => {
    const { fixture, el } = abrir();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    preencher(el, 'senhaAtual', 'temp-4821');
    preencher(el, 'novaSenha', 'nova-senha-2026');
    preencher(el, 'confirmacao', 'nova-senha-2026');
    enviar(el);

    const troca = http.expectOne('/api/auth/trocar-senha');
    expect(troca.request.body).toEqual({ senhaAtual: 'temp-4821', novaSenha: 'nova-senha-2026' });
    troca.flush(null, { status: 204, statusText: 'No Content' });
    await esperar(fixture);
    http.expectOne('/api/auth/me').flush({
      usuario: 'ana',
      nome: 'Ana',
      perfil: 'Operador de caixa',
      permissoes: [],
      trocaDeSenhaObrigatoria: false,
    });
    await esperar(fixture);

    expect(navegar).toHaveBeenCalledWith('/');
  });

  it('não envia nova senha com menos de 8 caracteres, igual à provisória ou sem confirmar', async () => {
    const { fixture, el } = abrir();

    preencher(el, 'senhaAtual', 'temp-4821');
    preencher(el, 'novaSenha', 'curta');
    preencher(el, 'confirmacao', 'curta');
    enviar(el);
    await esperar(fixture);
    expect(el.textContent).toContain('pelo menos 8 caracteres');

    preencher(el, 'novaSenha', 'temp-4821');
    preencher(el, 'confirmacao', 'temp-4821');
    enviar(el);
    await esperar(fixture);
    expect(el.textContent).toContain('diferente da provisória');

    preencher(el, 'novaSenha', 'nova-senha-2026');
    preencher(el, 'confirmacao', 'outra-coisa-2026');
    enviar(el);
    await esperar(fixture);
    expect(el.textContent).toContain('As senhas não conferem');

    http.expectNone('/api/auth/trocar-senha');
  });

  it('senha provisória errada: mostra o erro do servidor no campo', async () => {
    const { fixture, el } = abrir();

    preencher(el, 'senhaAtual', 'errada-123');
    preencher(el, 'novaSenha', 'nova-senha-2026');
    preencher(el, 'confirmacao', 'nova-senha-2026');
    enviar(el);
    http
      .expectOne('/api/auth/trocar-senha')
      .flush(
        { errors: { SenhaAtual: ['Senha atual incorreta'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await esperar(fixture);

    expect(el.textContent).toContain('Senha atual incorreta');
  });
});
