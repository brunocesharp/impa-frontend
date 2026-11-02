import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { MENSAGEM_CREDENCIAL_INVALIDA } from './sessao';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function comSessao(): Promise<void> {
    const carregando = auth.carregarSessao();
    http.expectOne('/api/auth/me').flush({ usuario: 'ana', nome: 'Ana', perfil: 'Operador de caixa', permissoes: [] });
    await carregando;
  }

  describe('sair (CA-4: sessão vencida ou encerrada em outra aba)', () => {
    for (const [status, statusText] of [
      [400, 'Bad Request'], // token XSRF de uma sessão que já acabou
      [401, 'Unauthorized'], // logout feito em outra aba
    ] as const) {
      it(`não propaga o erro ${status} e esquece o usuário`, async () => {
        await comSessao();

        const saindo = auth.sair();
        http.expectOne('/api/auth/logout').flush(null, { status, statusText });

        await expect(saindo).resolves.toBeUndefined();
        expect(auth.sessao()).toBeNull();
      });
    }

    for (const [status, statusText] of [
      [0, 'Unknown Error'], // sem rede
      [500, 'Internal Server Error'],
      [502, 'Bad Gateway'], // API fora, Caddy no ar
    ] as const) {
      it(`com erro ${status} propaga o erro e mantém o usuário (o cookie pode continuar válido)`, async () => {
        await comSessao();

        const saindo = auth.sair();
        http.expectOne('/api/auth/logout').flush(null, { status, statusText });

        await expect(saindo).rejects.toMatchObject({ status });
        expect(auth.sessao()?.usuario).toBe('ana');
      });
    }

    it('logout aceito esquece o usuário', async () => {
      await comSessao();

      const saindo = auth.sair();
      http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });

      await expect(saindo).resolves.toBeUndefined();
      expect(auth.sessao()).toBeNull();
    });
  });

  describe('entrar', () => {
    it('401 usa a mensagem do servidor', async () => {
      const entrando = auth.entrar('ana', 'errada123');
      http.expectOne('/api/auth/login').flush({ mensagem: 'Mensagem do servidor' }, { status: 401, statusText: 'Unauthorized' });

      expect(await entrando).toEqual({ ok: false, mensagem: 'Mensagem do servidor' });
    });

    it('401 sem corpo usa a mensagem padrão', async () => {
      const entrando = auth.entrar('ana', 'errada123');
      http.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(await entrando).toEqual({ ok: false, mensagem: MENSAGEM_CREDENCIAL_INVALIDA });
    });

    it('400 de validação devolve a mensagem de cada campo', async () => {
      const entrando = auth.entrar('   ', 'x');
      http.expectOne('/api/auth/login').flush(
        { title: 'One or more validation errors occurred.', status: 400, errors: { Usuario: ['Informe o usuário'] } },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(await entrando).toEqual({
        ok: false,
        mensagem: null,
        campos: { usuario: 'Informe o usuário' },
      });
    });

    it('400 do token XSRF devolve a mensagem da API', async () => {
      const entrando = auth.entrar('ana', 'balcao2026');
      http.expectOne('/api/auth/login').flush({ mensagem: 'Recarregue a página.' }, { status: 400, statusText: 'Bad Request' });

      expect(await entrando).toEqual({ ok: false, mensagem: 'Recarregue a página.' });
    });
  });
});
