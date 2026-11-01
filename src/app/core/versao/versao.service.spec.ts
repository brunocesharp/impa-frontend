import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VersaoService } from './versao.service';

describe('VersaoService', () => {
  let http: HttpTestingController;
  let servico: VersaoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    servico = TestBed.inject(VersaoService);
  });

  afterEach(() => http.verify());

  it('consulta a versão da API uma vez só', async () => {
    const primeira = servico.carregarApi();
    const segunda = servico.carregarApi();
    http.expectOne('/api/versao').flush({ versao: '0.1.0', commit: '1f55d46' });
    await Promise.all([primeira, segunda]);

    expect(servico.api()).toEqual({ versao: '0.1.0', commit: '1f55d46' });
  });

  it('API sem resposta: fica nula e não propaga o erro', async () => {
    const carregando = servico.carregarApi();
    http.expectOne('/api/versao').flush(null, { status: 503, statusText: 'Service Unavailable' });

    await expect(carregando).resolves.toBeUndefined();
    expect(servico.api()).toBeNull();
  });
});
