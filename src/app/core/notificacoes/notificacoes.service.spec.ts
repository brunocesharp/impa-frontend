import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { INTERVALO_DA_CONSULTA_MS, Notificacao, NotificacoesService } from './notificacoes.service';

const CONTAGEM = '/api/notificacoes/nao-lidas/contagem';

function notificacao(id: string, texto: string, lida = false): Notificacao {
  return {
    id,
    tipo: 'estoque.saldo-negativo',
    titulo: 'Saldo negativo',
    texto,
    referenciaDaOrigem: null,
    criadaEm: '2026-11-07T10:00:00Z',
    lida,
  };
}

describe('NotificacoesService', () => {
  let http: HttpTestingController;
  let servico: NotificacoesService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    servico = TestBed.inject(NotificacoesService);
  });

  afterEach(() => {
    servico.parar();
    vi.useRealTimers();
    http.verify();
  });

  async function abrirPainelCom(itens: Notificacao[], naoLidas: number): Promise<void> {
    const carregando = servico.carregarLista();
    http.expectOne((r) => r.url === '/api/notificacoes').flush({ itens, pagina: 1, tamanhoDaPagina: 20, total: itens.length });
    http.expectOne(CONTAGEM).flush({ naoLidas });
    await carregando;
  }

  it('contador é consultado ao iniciar e de novo a cada 60 s', async () => {
    vi.useFakeTimers();
    servico.iniciar();

    http.expectOne(CONTAGEM).flush({ naoLidas: 1 });
    expect(servico.naoLidas()).toBe(1);

    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONSULTA_MS - 1);
    http.expectNone(CONTAGEM);

    await vi.advanceTimersByTimeAsync(1);
    http.expectOne(CONTAGEM).flush({ naoLidas: 3 });
    expect(servico.naoLidas()).toBe(3);
    expect(INTERVALO_DA_CONSULTA_MS).toBe(60_000);
  });

  it('parar encerra a consulta periódica e zera o contador', async () => {
    vi.useFakeTimers();
    servico.iniciar();
    http.expectOne(CONTAGEM).flush({ naoLidas: 2 });

    servico.parar();
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONSULTA_MS * 2);

    http.expectNone(CONTAGEM);
    expect(servico.naoLidas()).toBe(0);
  });

  it('falha na consulta mantém o último contador', async () => {
    vi.useFakeTimers();
    servico.iniciar();
    http.expectOne(CONTAGEM).flush({ naoLidas: 2 });

    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONSULTA_MS);
    http.expectOne(CONTAGEM).flush(null, { status: 503, statusText: 'Service Unavailable' });

    expect(servico.naoLidas()).toBe(2);
  });

  it('abrir o painel lista as notificações e atualiza o contador na hora', async () => {
    await abrirPainelCom([notificacao('a', 'Caneta azul 0.7 ficou com saldo -1')], 1);

    expect(servico.itens().map((n) => n.texto)).toEqual(['Caneta azul 0.7 ficou com saldo -1']);
    expect(servico.naoLidas()).toBe(1);
  });

  it('cenário 2.5: marcar como lida chama a API e baixa o contador só desta sessão', async () => {
    await abrirPainelCom([notificacao('a', 'Caneta azul 0.7 ficou com saldo -1'), notificacao('b', 'Borracha', true)], 1);

    const marcando = servico.marcarComoLida('a');
    const post = http.expectOne('/api/notificacoes/a/lida');
    expect(post.request.method).toBe('POST');
    post.flush(null, { status: 204, statusText: 'No Content' });
    await marcando;

    expect(servico.naoLidas()).toBe(0);
    expect(servico.itens().map((n) => n.lida)).toEqual([true, true]);
  });

  it('marcar como lida uma que já estava lida não baixa o contador', async () => {
    await abrirPainelCom([notificacao('a', 'Caneta', true), notificacao('b', 'Borracha')], 1);

    const marcando = servico.marcarComoLida('a');
    http.expectOne('/api/notificacoes/a/lida').flush(null, { status: 204, statusText: 'No Content' });
    await marcando;

    expect(servico.naoLidas()).toBe(1);
  });

  it('marcar todas chama a API e zera o contador', async () => {
    await abrirPainelCom([notificacao('a', 'Caneta'), notificacao('b', 'Borracha')], 2);

    const marcando = servico.marcarTodas();
    const post = http.expectOne('/api/notificacoes/lidas');
    expect(post.request.method).toBe('POST');
    post.flush(null, { status: 204, statusText: 'No Content' });
    await marcando;

    expect(servico.naoLidas()).toBe(0);
    expect(servico.itens().every((n) => n.lida)).toBe(true);
  });
});
