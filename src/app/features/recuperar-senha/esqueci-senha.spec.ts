import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { EsqueciSenha } from './esqueci-senha';
import { MENSAGEM_MUITOS_PEDIDOS, MENSAGEM_PEDIDO_RECEBIDO } from './recuperar-senha.service';

describe('EsqueciSenha (story 1-8)', () => {
  let http: HttpTestingController;

  function abrirTela() {
    TestBed.configureTestingModule({
      imports: [EsqueciSenha],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EsqueciSenha);
    fixture.detectChanges();
    return fixture;
  }

  function preencherEEnviar(elemento: HTMLElement, valor: string) {
    const campo = elemento.querySelector<HTMLInputElement>(
      'input[formControlName="usuarioOuEmail"]',
    )!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  }

  /** O envio consulta a sessão (token XSRF) antes do pedido. */
  async function responderSessao() {
    (await vi.waitFor(() => http.expectOne('/api/auth/me'))).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
  }

  afterEach(() => http.verify());

  // Esquema do cenário 1.10: a tela mostra a mesma mensagem, exista ou não o usuário (o servidor responde 204 igual).
  for (const informado of ['ana', 'joana', 'bruno', 'carlos']) {
    it(`pedido para "${informado}" mostra a mensagem fixa`, async () => {
      const fixture = abrirTela();
      const elemento = fixture.nativeElement as HTMLElement;

      preencherEEnviar(elemento, `  ${informado} `);
      await responderSessao();
      const pedido = await vi.waitFor(() => http.expectOne('/api/auth/esqueci-senha'));
      expect(pedido.request.method).toBe('POST');
      expect(pedido.request.body).toEqual({ usuarioOuEmail: informado });
      pedido.flush(null, { status: 204, statusText: 'No Content' });

      await vi.waitFor(async () => {
        await fixture.whenStable();
        expect(elemento.querySelector('[role="status"]')?.textContent).toContain(
          MENSAGEM_PEDIDO_RECEBIDO,
        );
      });
      expect(MENSAGEM_PEDIDO_RECEBIDO).toBe(
        'Se houver um usuário com esses dados, enviaremos um link para o e-mail cadastrado',
      );
      expect(elemento.querySelector('form')).toBeNull();
    });
  }

  it('não envia vazio', async () => {
    const fixture = abrirTela();
    const elemento = fixture.nativeElement as HTMLElement;

    preencherEEnviar(elemento, '   ');
    await fixture.whenStable();

    expect(elemento.textContent).toContain('Informe o usuário ou o e-mail');
    http.expectNone('/api/auth/me');
  });

  it('limite de tentativas (429) mostra a mensagem do servidor', async () => {
    const fixture = abrirTela();
    const elemento = fixture.nativeElement as HTMLElement;

    preencherEEnviar(elemento, 'ana');
    await responderSessao();
    // Corpo real do limite-de-recuperacao (LimiteDeLogin.MensagemMuitosPedidos no backend).
    (await vi.waitFor(() => http.expectOne('/api/auth/esqueci-senha'))).flush(
      { mensagem: 'Muitas tentativas. Aguarde um minuto e tente novamente' },
      { status: 429, statusText: 'Too Many Requests' },
    );

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
        'Muitas tentativas. Aguarde um minuto e tente novamente',
      );
    });
  });

  it('429 sem corpo mostra a mensagem neutra, sem "de entrar"', async () => {
    const fixture = abrirTela();
    const elemento = fixture.nativeElement as HTMLElement;

    preencherEEnviar(elemento, 'ana');
    await responderSessao();
    (await vi.waitFor(() => http.expectOne('/api/auth/esqueci-senha'))).flush(null, {
      status: 429,
      statusText: 'Too Many Requests',
    });

    await vi.waitFor(async () => {
      await fixture.whenStable();
      const alerta = elemento.querySelector('[role="alert"]')?.textContent ?? '';
      expect(alerta).toContain(MENSAGEM_MUITOS_PEDIDOS);
      expect(alerta).not.toContain('de entrar');
    });
    expect(MENSAGEM_MUITOS_PEDIDOS).toBe('Muitas tentativas. Aguarde um minuto e tente novamente');
  });

  it('tem o caminho de volta ao login', () => {
    const fixture = abrirTela();
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/login"]')).not.toBeNull();
  });
});
