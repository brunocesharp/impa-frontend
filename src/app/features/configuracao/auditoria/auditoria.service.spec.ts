import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuditoriaService, FILTROS_VAZIOS, parametrosDaConsulta } from './auditoria.service';

describe('parametrosDaConsulta (story 4.4, filtros da auditoria)', () => {
  it('sem filtros, manda só a página e o tamanho', () => {
    expect(parametrosDaConsulta(FILTROS_VAZIOS, 1, 20)).toEqual({ pagina: '1', tamanho: '20' });
  });

  it('período: de = início do dia local, ate = início do dia seguinte (o servidor trata ate como exclusive)', () => {
    const params = parametrosDaConsulta(
      { ...FILTROS_VAZIOS, de: '2026-11-01', ate: '2026-11-07' },
      1,
      20,
    );

    expect(params['de']).toBe(new Date(2026, 10, 1).toISOString());
    expect(params['ate']).toBe(new Date(2026, 10, 8).toISOString());
  });

  it('usuário, módulo e entidade vão sem espaços nas pontas; vazios ficam de fora', () => {
    const params = parametrosDaConsulta(
      { ...FILTROS_VAZIOS, usuario: '  Carla ', modulo: 'Catalogo', entidade: '   ' },
      3,
      50,
    );

    expect(params).toEqual({ usuario: 'Carla', modulo: 'Catalogo', pagina: '3', tamanho: '50' });
  });

  it('data inválida é ignorada', () => {
    expect(parametrosDaConsulta({ ...FILTROS_VAZIOS, de: 'ontem' }, 1, 20)).toEqual({
      pagina: '1',
      tamanho: '20',
    });
  });
});

describe('AuditoriaService', () => {
  let http: HttpTestingController;
  let servico: AuditoriaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    servico = TestBed.inject(AuditoriaService);
  });

  afterEach(() => http.verify());

  it('consulta GET /api/auditoria com os filtros na query', async () => {
    const pagina = servico.consultar(
      { ...FILTROS_VAZIOS, usuario: 'carla', modulo: 'Fiscal' },
      2,
      20,
    );
    const pedido = http.expectOne((r) => r.url === '/api/auditoria');

    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.params.get('usuario')).toBe('carla');
    expect(pedido.request.params.get('modulo')).toBe('Fiscal');
    expect(pedido.request.params.get('entidade')).toBeNull();
    expect(pedido.request.params.get('pagina')).toBe('2');
    pedido.flush({ itens: [], pagina: 2, tamanhoDaPagina: 20, total: 21 });

    expect((await pagina).total).toBe(21);
  });
});
