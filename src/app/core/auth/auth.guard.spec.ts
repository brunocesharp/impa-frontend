import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { autenticadoGuard } from './auth.guard';

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
    const resultado = TestBed.runInInjectionContext(() => autenticadoGuard({} as never, {} as never));
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
});
