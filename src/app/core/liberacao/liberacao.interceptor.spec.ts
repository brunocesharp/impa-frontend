import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, of } from 'rxjs';
import { CABECALHO_LIBERACAO, MENSAGEM_LIBERACAO_RECUSADA, URL_LIBERACOES } from './liberacao';
import { liberacaoInterceptor } from './liberacao.interceptor';

const CANCELAR = '/api/vendas/1/cancelar';
const LIBERAVEL = {
  codigo: 'permissao_requerida',
  permissao: 'vendas.cancelar-concluida',
  liberavel: true,
};
const PROIBIDO = { status: 403, statusText: 'Forbidden' };

describe('liberacaoInterceptor', () => {
  let http: HttpTestingController;
  let cliente: HttpClient;
  let tokenDoDialogo: string | undefined;
  let abrir: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tokenDoDialogo = 'token-da-carla';
    abrir = vi.fn(() => ({ afterClosed: () => of(tokenDoDialogo) }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([liberacaoInterceptor])),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: abrir } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    cliente = TestBed.inject(HttpClient);
  });

  afterEach(() => http.verify());

  it('403 liberável abre o diálogo e refaz a requisição com o token no X-Liberacao', async () => {
    const chamada = firstValueFrom(cliente.post(CANCELAR, { motivo: 'erro' }));
    http.expectOne(CANCELAR).flush(LIBERAVEL, PROIBIDO);
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled()); // o diálogo é carregado sob demanda

    const refeita = http.expectOne(CANCELAR);
    expect(refeita.request.headers.get(CABECALHO_LIBERACAO)).toBe('token-da-carla');
    expect(refeita.request.body).toEqual({ motivo: 'erro' });
    refeita.flush({ ok: true });

    await expect(chamada).resolves.toEqual({ ok: true });
    expect(abrir).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { permissao: 'vendas.cancelar-concluida' } }),
    );
  });

  it('diálogo cancelado devolve o 403 original a quem chamou', async () => {
    tokenDoDialogo = undefined;
    const chamada = firstValueFrom(cliente.post(CANCELAR, null));
    http.expectOne(CANCELAR).flush(LIBERAVEL, PROIBIDO);

    await expect(chamada).rejects.toMatchObject({ status: 403, error: LIBERAVEL });
  });

  it('token recusado na requisição refeita segue com a mensagem de liberação recusada', async () => {
    const chamada = firstValueFrom(cliente.post(CANCELAR, null));
    http.expectOne(CANCELAR).flush(LIBERAVEL, PROIBIDO);
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    http.expectOne(CANCELAR).flush(LIBERAVEL, PROIBIDO);

    const erro = (await chamada.catch((e: unknown) => e)) as HttpErrorResponse;
    expect(erro.status).toBe(403);
    expect(erro.error.mensagem).toBe(MENSAGEM_LIBERACAO_RECUSADA);
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('403 que não é liberável não abre o diálogo', async () => {
    const chamada = firstValueFrom(cliente.get('/api/configuracao/empresa'));
    http.expectOne('/api/configuracao/empresa').flush({ ...LIBERAVEL, liberavel: false }, PROIBIDO);

    await expect(chamada).rejects.toMatchObject({ status: 403 });
    expect(abrir).not.toHaveBeenCalled();
  });

  it('erro da própria liberação não abre outro diálogo', async () => {
    const chamada = firstValueFrom(cliente.post(URL_LIBERACOES, {}));
    http.expectOne(URL_LIBERACOES).flush(LIBERAVEL, PROIBIDO);

    await expect(chamada).rejects.toMatchObject({ status: 403 });
    expect(abrir).not.toHaveBeenCalled();
  });
});
