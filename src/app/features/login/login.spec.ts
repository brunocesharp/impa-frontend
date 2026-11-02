import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Login } from './login';

describe('Login', () => {
  let http: HttpTestingController;

  function criarTela() {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return fixture;
  }

  async function abrirTela() {
    const fixture = criarTela();
    // Ao abrir, a tela consulta a sessão (o que também entrega o token XSRF).
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    return fixture;
  }

  /** O envio espera a consulta inicial da sessão (token XSRF): a requisição sai depois de algumas microtarefas. */
  const requisicao = (url: string) => vi.waitFor(() => http.expectOne(url));

  const textoDoCampo = (elemento: HTMLElement, nome: string) =>
    elemento.querySelector(`input[formControlName="${nome}"]`)!.closest('mat-form-field')!.textContent ?? '';

  function preencherEEntrar(elemento: HTMLElement, usuario: string, senha: string) {
    const campo = (nome: string) => elemento.querySelector<HTMLInputElement>(`input[formControlName="${nome}"]`)!;
    campo('usuario').value = usuario;
    campo('usuario').dispatchEvent(new Event('input'));
    campo('senha').value = senha;
    campo('senha').dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  }

  afterEach(() => http.verify());

  it('erro 401 do login mostra "Usuário ou senha inválidos"', async () => {
    const fixture = await abrirTela();
    const elemento = fixture.nativeElement as HTMLElement;

    preencherEEntrar(elemento, 'ana', 'errada123');
    const login = await requisicao('/api/auth/login');
    expect(login.request.body).toEqual({ usuario: 'ana', senha: 'errada123' });
    login.flush({ mensagem: 'Usuário ou senha inválidos' }, { status: 401, statusText: 'Unauthorized' });

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(elemento.querySelector('[role="alert"]')?.textContent).toContain('Usuário ou senha inválidos');
    });
  });

  it('login correto carrega a sessão e vai para o início', async () => {
    const fixture = await abrirTela();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    preencherEEntrar(fixture.nativeElement, 'admin', 'admin-homolog-2026');
    (await requisicao('/api/auth/login')).flush(null, { status: 204, statusText: 'No Content' });
    (await requisicao('/api/auth/me'))
      .flush({ usuario: 'admin', nome: 'Administrador', perfil: 'Administrador', permissoes: [] });

    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/'));
  });

  it('não envia o formulário sem usuário e senha', async () => {
    const fixture = await abrirTela();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();

    http.expectNone('/api/auth/login');
  });

  it('Entrar antes da resposta do /me inicial aguarda o token XSRF e só então envia', async () => {
    const fixture = criarTela();
    const elemento = fixture.nativeElement as HTMLElement;
    const meInicial = http.expectOne('/api/auth/me');

    preencherEEntrar(elemento, 'ana', 'balcao2026');
    // Esgota as microtarefas e a fila de tarefas: um envio que não espera o /me já teria saído.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectNone('/api/auth/login');

    meInicial.flush(null, { status: 401, statusText: 'Unauthorized' });
    (await requisicao('/api/auth/login')).flush({ mensagem: 'x' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('se o /me inicial falhou, tenta de novo antes de enviar o login', async () => {
    const fixture = criarTela();
    http.expectOne('/api/auth/me').flush(null, { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();

    preencherEEntrar(fixture.nativeElement, 'ana', 'balcao2026');
    (await requisicao('/api/auth/me')).flush(null, { status: 401, statusText: 'Unauthorized' });
    (await requisicao('/api/auth/login')).flush(null, { status: 204, statusText: 'No Content' });
    (await requisicao('/api/auth/me')).flush(null, { status: 401, statusText: 'Unauthorized' });
  });

  it('401 mostra a mensagem que o servidor mandou', async () => {
    const fixture = await abrirTela();
    const elemento = fixture.nativeElement as HTMLElement;

    preencherEEntrar(elemento, 'ana', 'errada123');
    (await requisicao('/api/auth/login')).flush({ mensagem: 'Mensagem do servidor' }, { status: 401, statusText: 'Unauthorized' });

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(elemento.querySelector('[role="alert"]')?.textContent).toContain('Mensagem do servidor');
    });
  });

  it('400 de validação mostra a mensagem no campo, sem "Recarregue a página"', async () => {
    const fixture = await abrirTela();
    const elemento = fixture.nativeElement as HTMLElement;

    preencherEEntrar(elemento, 'ana', 'balcao2026');
    (await requisicao('/api/auth/login')).flush(
      { status: 400, errors: { Usuario: ['Informe o usuário'] } },
      { status: 400, statusText: 'Bad Request' },
    );
    await vi.waitFor(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      expect(textoDoCampo(elemento, 'usuario')).toContain('Informe o usuário');
    });
    expect(elemento.textContent).not.toContain('Recarregue');
  });

  it('usuário só com espaços não é enviado e acusa o campo', async () => {
    const fixture = await abrirTela();
    const elemento = fixture.nativeElement as HTMLElement;

    preencherEEntrar(elemento, '   ', 'balcao2026');
    await fixture.whenStable();
    fixture.detectChanges();

    http.expectNone('/api/auth/login');
    expect(textoDoCampo(elemento, 'usuario')).toContain('Informe o usuário');
  });
});
