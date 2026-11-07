import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Usuarios } from './usuarios';
import { PerfilResumo, Usuario } from './usuarios.service';

/** `GET /api/usuarios/perfis` (R3): só id, nome e protegido, com `usuarios.gerenciar`. */
const PERFIS: PerfilResumo[] = [
  { id: 'a', nome: 'Administrador', protegido: true },
  { id: 'o', nome: 'Operador de caixa', protegido: false },
];

const USUARIOS: Usuario[] = [
  {
    id: '1',
    usuario: 'admin',
    nome: 'Administrador IMPA',
    email: null,
    perfilId: 'a',
    perfil: 'Administrador',
    ativo: true,
    trocaDeSenhaObrigatoria: false,
  },
  {
    id: '2',
    usuario: 'ana',
    nome: 'Ana',
    email: 'ana@loja.com',
    perfilId: 'o',
    perfil: 'Operador de caixa',
    ativo: false,
    trocaDeSenhaObrigatoria: true,
  },
];

async function esperar(fixture: { detectChanges(): void }) {
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
}

describe('Usuarios (story 1-4, T4)', () => {
  let http: HttpTestingController;

  async function abrir() {
    TestBed.configureTestingModule({
      imports: [Usuarios],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Usuarios);
    fixture.detectChanges();
    http.expectOne('/api/usuarios').flush(USUARIOS);
    http.expectOne('/api/usuarios/perfis').flush(PERFIS);
    http.expectNone('/api/perfis'); // exige perfis.gerenciar, que quem gerencia usuários pode não ter
    await esperar(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const botao = (el: HTMLElement, texto: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    )!;

  function preencher(el: HTMLElement, campo: string, valor: string) {
    const input = el.querySelector<HTMLInputElement>(`[data-campo="${campo}"]`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  afterEach(() => {
    http.verify();
    document.querySelectorAll('.cdk-overlay-container').forEach((o) => (o.innerHTML = ''));
  });

  it('lista os usuários com perfil e situação', async () => {
    const { el } = await abrir();

    const itens = Array.from(el.querySelectorAll('[data-usuario]')).map((i) => i.textContent ?? '');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toContain('Administrador');
    expect(itens[1]).toContain('Operador de caixa');
    expect(itens[1]).toContain('Inativo');
    expect(itens[1]).toContain('Senha provisória');
  });

  it('criar usuário envia os dados e mostra a senha provisória num diálogo', async () => {
    const { fixture, el } = await abrir();
    botao(el, 'Novo usuário').click();
    await esperar(fixture);

    preencher(el, 'usuario', 'bruno');
    preencher(el, 'nome', 'Bruno');
    botao(el, 'Criar usuário').click();

    const criar = http.expectOne({ method: 'POST', url: '/api/usuarios' });
    expect(criar.request.body).toEqual({
      usuario: 'bruno',
      nome: 'Bruno',
      email: null,
      perfilId: 'o',
      senha: null,
    });
    criar.flush({ id: '3', senhaProvisoria: 'temp-4821' });
    await esperar(fixture);
    http.expectOne('/api/usuarios').flush([
      ...USUARIOS,
      {
        id: '3',
        usuario: 'bruno',
        nome: 'Bruno',
        email: null,
        perfilId: 'o',
        perfil: 'Operador de caixa',
        ativo: true,
        trocaDeSenhaObrigatoria: true,
      },
    ]);
    await esperar(fixture);

    expect(document.querySelector('[data-senha-provisoria]')?.textContent).toContain('temp-4821');
  });

  it('redefinir senha pede confirmação e mostra a provisória gerada', async () => {
    const { fixture, el } = await abrir();
    el.querySelectorAll<HTMLElement>('[data-usuario]')[1].click();
    await esperar(fixture);

    botao(el, 'Redefinir senha').click();
    await esperar(fixture);
    http.expectNone('/api/usuarios/2/redefinir-senha');
    botao(el, 'Confirmar redefinição').click();

    http
      .expectOne({ method: 'POST', url: '/api/usuarios/2/redefinir-senha' })
      .flush({ id: '2', senhaProvisoria: 'temp-0042' });
    await esperar(fixture);
    http.expectOne('/api/usuarios').flush(USUARIOS);
    await esperar(fixture);

    expect(document.querySelector('[data-senha-provisoria]')?.textContent).toContain('temp-0042');
  });

  it('reativar usuário inativo e desativar com confirmação', async () => {
    const { fixture, el } = await abrir();
    el.querySelectorAll<HTMLElement>('[data-usuario]')[1].click();
    await esperar(fixture);

    botao(el, 'Reativar').click();
    http
      .expectOne({ method: 'POST', url: '/api/usuarios/2/reativar' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await esperar(fixture);
    http
      .expectOne('/api/usuarios')
      .flush(USUARIOS.map((u) => (u.id === '2' ? { ...u, ativo: true } : u)));
    await esperar(fixture);
    expect(el.textContent).toContain('Usuário reativado');

    botao(el, 'Desativar').click();
    await esperar(fixture);
    botao(el, 'Confirmar desativação').click();
    http
      .expectOne({ method: 'POST', url: '/api/usuarios/2/desativar' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await esperar(fixture);
    http.expectOne('/api/usuarios').flush(USUARIOS);
    await esperar(fixture);
    expect(el.textContent).toContain('Usuário desativado');
  });

  it('recusa do servidor (último administrador) aparece na tela', async () => {
    const { fixture, el } = await abrir();

    botao(el, 'Desativar').click();
    await esperar(fixture);
    botao(el, 'Confirmar desativação').click();
    http
      .expectOne({ method: 'POST', url: '/api/usuarios/1/desativar' })
      .flush(
        { mensagem: 'É preciso manter pelo menos um administrador ativo' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);

    expect(el.querySelector('[role=alert]')?.textContent).toContain(
      'pelo menos um administrador ativo',
    );
  });

  // ---- Correções da revisão 1 ----

  it('R1: criar mostra a senha provisória mesmo se o recarregamento da lista falhar', async () => {
    const { fixture, el } = await abrir();
    botao(el, 'Novo usuário').click();
    await esperar(fixture);
    preencher(el, 'usuario', 'bruno');
    preencher(el, 'nome', 'Bruno');
    botao(el, 'Criar usuário').click();

    http
      .expectOne({ method: 'POST', url: '/api/usuarios' })
      .flush({ id: '3', senhaProvisoria: 'temp-4821' });
    await esperar(fixture);
    // A senha já aparece antes da lista voltar.
    expect(document.querySelector('[data-senha-provisoria]')?.textContent).toContain('temp-4821');

    http
      .expectOne('/api/usuarios')
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    await esperar(fixture);

    expect(document.querySelector('[data-senha-provisoria]')?.textContent).toContain('temp-4821');
    expect(el.querySelector('[role=alert]')).toBeNull();
    expect(el.textContent).not.toContain('Não foi possível falar com o servidor');
    expect(el.querySelector('[role=status]')?.textContent).toContain('Usuário criado');
  });

  it('R1: redefinir mostra a senha provisória mesmo se o recarregamento da lista falhar', async () => {
    const { fixture, el } = await abrir();
    el.querySelectorAll<HTMLElement>('[data-usuario]')[1].click();
    await esperar(fixture);
    botao(el, 'Redefinir senha').click();
    await esperar(fixture);
    botao(el, 'Confirmar redefinição').click();

    http
      .expectOne({ method: 'POST', url: '/api/usuarios/2/redefinir-senha' })
      .flush({ id: '2', senhaProvisoria: 'temp-0042' });
    await esperar(fixture);
    expect(document.querySelector('[data-senha-provisoria]')?.textContent).toContain('temp-0042');

    http
      .expectOne('/api/usuarios')
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    await esperar(fixture);

    expect(document.querySelector('[data-senha-provisoria]')?.textContent).toContain('temp-0042');
    expect(el.querySelector('[role=alert]')).toBeNull();
    expect(el.textContent).not.toContain('Não foi possível falar com o servidor');
  });
});
