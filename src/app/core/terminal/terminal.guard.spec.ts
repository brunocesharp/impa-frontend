import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { terminalGuard } from './terminal.guard';
import {
  CODIGO_TERMINAL_NAO_REGISTRADO,
  MENSAGEM_TERMINAL_NAO_REGISTRADO,
} from './terminal.service';

describe('terminalGuard (story 1-6, CA-1)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function decidir(responder: (r: ReturnType<HttpTestingController['expectOne']>) => void) {
    const resultado = TestBed.runInInjectionContext(() =>
      terminalGuard({} as never, { url: '/vendas' } as never),
    ) as Promise<boolean | UrlTree>;
    await Promise.resolve();
    responder(http.expectOne('/api/terminais/atual'));
    const decisao = await resultado;
    return decisao === true ? true : TestBed.inject(Router).serializeUrl(decisao as UrlTree);
  }

  it('dispositivo registrado como terminal entra no PDV', async () => {
    expect(await decidir((r) => r.flush({ id: 't1', nome: 'Balcão 1' }))).toBe(true);
  });

  it('dispositivo não registrado vai para a tela de terminal não registrado', async () => {
    const destino = await decidir((r) =>
      r.flush(
        { mensagem: MENSAGEM_TERMINAL_NAO_REGISTRADO, codigo: CODIGO_TERMINAL_NAO_REGISTRADO },
        { status: 403, statusText: 'Forbidden' },
      ),
    );

    expect(destino).toBe('/terminal-nao-registrado');
  });

  it('sem resposta do servidor vai para a tela de nova tentativa', async () => {
    const destino = await decidir((r) => r.error(new ProgressEvent('error'), { status: 0 }));

    expect(destino).toBe('/indisponivel?volta=%2Fvendas');
  });

  it('a mensagem é a do cenário 11.6', () => {
    expect(MENSAGEM_TERMINAL_NAO_REGISTRADO).toBe(
      'Este computador não está registrado como terminal. Peça ao administrador',
    );
  });
});
