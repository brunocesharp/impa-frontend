import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { autenticadoGuard, trocaDeSenhaGuard } from './auth.guard';

describe('trocaDeSenhaGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function decidir(sessao: object | null): Promise<string | true> {
    const resultado = TestBed.runInInjectionContext(() =>
      trocaDeSenhaGuard({} as never, { url: '/trocar-senha' } as never),
    ) as Promise<boolean | UrlTree>;
    await Promise.resolve();
    const me = http.expectOne('/api/auth/me');
    if (sessao) me.flush(sessao);
    else me.flush(null, { status: 401, statusText: 'Unauthorized' });
    const decisao = await resultado;
    return decisao === true ? true : TestBed.inject(Router).serializeUrl(decisao as UrlTree);
  }

  const ana = { usuario: 'ana', nome: 'Ana', perfil: 'Operador de caixa', permissoes: [] };

  it('deixa ficar na troca enquanto a senha for provisória', async () => {
    expect(await decidir({ ...ana, trocaDeSenhaObrigatoria: true })).toBe(true);
  });

  it('senha já trocada volta ao início', async () => {
    expect(await decidir({ ...ana, trocaDeSenhaObrigatoria: false })).toBe('/');
  });

  it('sem sessão vai ao login', async () => {
    expect(await decidir(null)).toBe('/login');
  });
});

describe('autenticadoGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function executarGuard(): Promise<boolean | UrlTree> {
    const resultado = TestBed.runInInjectionContext(() =>
      autenticadoGuard({} as never, { url: '/caixa' } as never),
    );
    // O guard consulta a sessão no servidor antes de decidir.
    await Promise.resolve();
    return resultado as Promise<boolean | UrlTree>;
  }

  it('sem sessão redireciona ao login', async () => {
    const decisao = executarGuard();
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    const resultado = await decisao;

    expect(resultado instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/login');
  });

  it('com sessão deixa entrar', async () => {
    const decisao = executarGuard();
    http
      .expectOne('/api/auth/me')
      .flush({ usuario: 'admin', nome: 'Administrador', perfil: 'Administrador', permissoes: [] });

    expect(await decisao).toBe(true);
  });

  it('com a senha provisória prende o usuário na troca de senha (story 1-4, CA-1)', async () => {
    const decisao = executarGuard();
    http.expectOne('/api/auth/me').flush({
      usuario: 'ana',
      nome: 'Ana',
      perfil: 'Operador de caixa',
      permissoes: ['pdv.vender'],
      trocaDeSenhaObrigatoria: true,
    });

    const resultado = await decisao;

    expect(resultado instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/trocar-senha');
  });

  it('API indisponível (erro diferente de 401) leva à tela de nova tentativa, lembrando o destino', async () => {
    const decisao = executarGuard();
    http.expectOne('/api/auth/me').flush(null, { status: 503, statusText: 'Service Unavailable' });

    const resultado = await decisao;

    expect(resultado instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/indisponivel?volta=%2Fcaixa');
  });

  it('sem rede (status 0) também leva à tela de nova tentativa', async () => {
    const decisao = executarGuard();
    http.expectOne('/api/auth/me').error(new ProgressEvent('error'));

    const resultado = await decisao;

    expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/indisponivel?volta=%2Fcaixa');
  });
});
