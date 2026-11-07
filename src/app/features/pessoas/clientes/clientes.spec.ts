import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Cliente } from '../pessoas.service';
import { Clientes } from './clientes';

const OPERADOR = ['clientes.ver', 'clientes.editar'];
const ADMINISTRADOR = [...OPERADOR, 'clientes.inativar', 'fornecedores.gerenciar'];

const MARIA: Cliente = {
  id: '1',
  nome: 'Maria Souza',
  documento: '529.982.247-25',
  telefone: '31999990000',
  email: null,
  endereco: null,
  observacoes: null,
  ativo: true,
};

async function esperar(fixture: { detectChanges(): void }) {
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
}

describe('Clientes (story 3-7, T8)', () => {
  let http: HttpTestingController;

  async function abrir(permissoes: string[], clientes: Cliente[] = [MARIA]) {
    TestBed.configureTestingModule({
      imports: [Clientes],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const sessao = TestBed.inject(AuthService).carregarSessao();
    http.expectOne('/api/auth/me').flush({ usuario: 'u', nome: 'U', perfil: 'P', permissoes });
    await sessao;

    const fixture = TestBed.createComponent(Clientes);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/pessoas/clientes' && r.method === 'GET').flush(clientes);
    await esperar(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const botao = (el: HTMLElement, acao: string) =>
    el.querySelector<HTMLButtonElement>(`[data-acao="${acao}"]`);

  function preencher(el: HTMLElement, campo: string, valor: string) {
    const input = el.querySelector<HTMLInputElement>(`[data-campo="${campo}"]`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  afterEach(() => http.verify());

  it('lista os clientes com documento e telefone formatado', async () => {
    const { el } = await abrir(OPERADOR);

    const item = el.querySelector('[data-cliente]')!.textContent!;
    expect(item).toContain('Maria Souza');
    expect(item).toContain('529.982.247-25');
    expect(item).toContain('(31) 99999-0000');
  });

  it('busca pelo texto digitado (nome, CPF ou telefone)', async () => {
    const { fixture, el } = await abrir(OPERADOR);
    preencher(el, 'busca', 'maria');
    el.querySelector<HTMLFormElement>('form.busca')!.dispatchEvent(new Event('submit'));

    http
      .expectOne((r) => r.url === '/api/pessoas/clientes' && r.params.get('busca') === 'maria')
      .flush([MARIA]);
    await esperar(fixture);
    expect(el.querySelectorAll('[data-cliente]')).toHaveLength(1);
  });

  it('cenário 14.1: cadastra o cliente sem documento obrigatório', async () => {
    const { fixture, el } = await abrir(OPERADOR, []);
    botao(el, 'novo')!.click();
    await esperar(fixture);

    preencher(el, 'nome', 'João Lima');
    botao(el, 'salvar')!.click();
    await esperar(fixture);

    const pedido = http.expectOne((r) => r.url === '/api/pessoas/clientes' && r.method === 'POST');
    expect(pedido.request.body).toEqual({
      nome: 'João Lima',
      documento: null,
      telefone: null,
      email: null,
      endereco: null,
      observacoes: null,
    });
    pedido.flush({ ...MARIA, id: '2', nome: 'João Lima', documento: null, telefone: null });
    await esperar(fixture);
    expect(el.textContent).toContain('Cliente cadastrado');
  });

  it('cenário 14.2: CPF inválido é recusado no formulário, sem chamar o servidor', async () => {
    const { fixture, el } = await abrir(OPERADOR, []);
    botao(el, 'novo')!.click();
    await esperar(fixture);

    preencher(el, 'nome', 'João Lima');
    preencher(el, 'documento', '111.111.111-11');
    botao(el, 'salvar')!.click();
    await esperar(fixture);

    expect(el.querySelector('[data-erro="documento"]')!.textContent).toContain('CPF inválido');
    http.expectNone((r) => r.method === 'POST');
  });

  it('cenário 14.2: CPF repetido mostra a mensagem do servidor', async () => {
    const { fixture, el } = await abrir(OPERADOR, []);
    botao(el, 'novo')!.click();
    await esperar(fixture);

    preencher(el, 'nome', 'João Lima');
    preencher(el, 'documento', '529.982.247-25');
    botao(el, 'salvar')!.click();
    await esperar(fixture);

    http
      .expectOne((r) => r.method === 'POST')
      .flush(
        { mensagem: 'CPF já cadastrado para Maria Souza' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);
    expect(el.querySelector('[role="alert"]')!.textContent).toContain(
      'CPF já cadastrado para Maria Souza',
    );
  });

  it('RN-14.5: o operador não vê inativar nem excluir', async () => {
    const { fixture, el } = await abrir(OPERADOR);
    el.querySelector<HTMLButtonElement>('[data-cliente]')!.click();
    await esperar(fixture);

    expect(botao(el, 'salvar')).not.toBeNull();
    expect(botao(el, 'situacao')).toBeNull();
    expect(botao(el, 'excluir')).toBeNull();
  });

  it('sem clientes.editar: só consulta (sem novo nem salvar)', async () => {
    const { fixture, el } = await abrir(['clientes.ver']);
    expect(botao(el, 'novo')).toBeNull();
    el.querySelector<HTMLButtonElement>('[data-cliente]')!.click();
    await esperar(fixture);
    expect(botao(el, 'salvar')).toBeNull();
    expect(el.querySelector<HTMLInputElement>('[data-campo="nome"]')!.disabled).toBe(true);
  });

  it('cenário 14.3: exclusão de cliente com histórico mostra a recusa do servidor', async () => {
    const { fixture, el } = await abrir(ADMINISTRADOR);
    el.querySelector<HTMLButtonElement>('[data-cliente]')!.click();
    await esperar(fixture);

    botao(el, 'excluir')!.click(); // primeiro clique pede confirmação
    await esperar(fixture);
    http.expectNone((r) => r.method === 'DELETE');
    botao(el, 'excluir')!.click();
    await esperar(fixture);

    http
      .expectOne((r) => r.method === 'DELETE' && r.url === '/api/pessoas/clientes/1')
      .flush(
        { mensagem: 'Este cliente tem histórico. Você pode inativá-lo' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);
    expect(el.querySelector('[role="alert"]')!.textContent).toContain(
      'Este cliente tem histórico. Você pode inativá-lo',
    );
  });

  it('administrador inativa o cliente com confirmação', async () => {
    const { fixture, el } = await abrir(ADMINISTRADOR);
    el.querySelector<HTMLButtonElement>('[data-cliente]')!.click();
    await esperar(fixture);

    botao(el, 'situacao')!.click();
    await esperar(fixture);
    expect(botao(el, 'situacao')!.textContent).toContain('Confirmar inativação');
    botao(el, 'situacao')!.click();
    await esperar(fixture);

    http
      .expectOne((r) => r.method === 'POST' && r.url === '/api/pessoas/clientes/1/inativar')
      .flush(null);
    await esperar(fixture);
    expect(el.querySelector('[data-situacao]')!.textContent).toContain('Inativo');
  });
});
