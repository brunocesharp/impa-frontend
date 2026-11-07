import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PerfisService } from './perfis.service';

describe('PerfisService', () => {
  let http: HttpTestingController;
  let servico: PerfisService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    servico = TestBed.inject(PerfisService);
  });

  afterEach(() => http.verify());

  it('lista perfis e o catálogo de permissões', async () => {
    const perfis = servico.listar();
    http
      .expectOne('/api/perfis')
      .flush([{ id: '1', nome: 'Administrador', protegido: true, permissoes: [], usuarios: 1 }]);
    expect((await perfis)[0].protegido).toBe(true);

    const catalogo = servico.catalogo();
    http
      .expectOne('/api/perfis/permissoes')
      .flush([{ codigo: 'pdv.vender', grupo: 'Vendas e caixa', descricao: 'Vender no PDV' }]);
    expect((await catalogo)[0].codigo).toBe('pdv.vender');
  });

  it('cria, altera e exclui pelas rotas do contrato', async () => {
    const criar = servico.salvar(null, { nome: 'Estoquista', permissoes: ['catalogo.ver'] });
    const post = http.expectOne('/api/perfis');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ nome: 'Estoquista', permissoes: ['catalogo.ver'] });
    post.flush({
      id: '9',
      nome: 'Estoquista',
      protegido: false,
      permissoes: ['catalogo.ver'],
      usuarios: 0,
    });
    expect(await criar).toEqual({ ok: true, perfil: expect.objectContaining({ id: '9' }) });

    const alterar = servico.salvar('9', { nome: 'Estoque', permissoes: [] });
    const put = http.expectOne('/api/perfis/9');
    expect(put.request.method).toBe('PUT');
    put.flush({ id: '9', nome: 'Estoque', protegido: false, permissoes: [], usuarios: 0 });
    await alterar;

    const excluir = servico.excluir('9');
    const del = http.expectOne('/api/perfis/9');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    expect(await excluir).toEqual({ ok: true });
  });

  it('recusa do servidor (409) vira a mensagem da API', async () => {
    const excluir = servico.excluir('1');
    http
      .expectOne('/api/perfis/1')
      .flush(
        { mensagem: 'O perfil Administrador não pode ser excluído' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(await excluir).toEqual({
      ok: false,
      mensagem: 'O perfil Administrador não pode ser excluído',
    });
  });

  it('validação (400) traz a primeira mensagem do ValidationProblem', async () => {
    const salvar = servico.salvar(null, { nome: '', permissoes: [] });
    http
      .expectOne('/api/perfis')
      .flush(
        { errors: { Nome: ['Informe o nome do perfil'] } },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(await salvar).toEqual({ ok: false, mensagem: 'Informe o nome do perfil' });
  });
});
