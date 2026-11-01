import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Login } from './login';

describe('Login', () => {
  let http: HttpTestingController;

  async function abrirTela() {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    // Ao abrir, a tela consulta a sessão (o que também entrega o token XSRF).
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    return fixture;
  }

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
    const login = http.expectOne('/api/auth/login');
    expect(login.request.body).toEqual({ usuario: 'ana', senha: 'errada123' });
    login.flush({ mensagem: 'Usuário ou senha inválidos' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain('Usuário ou senha inválidos');
  });

  it('login correto carrega a sessão e vai para o início', async () => {
    const fixture = await abrirTela();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    preencherEEntrar(fixture.nativeElement, 'admin', 'admin-homolog-2026');
    http.expectOne('/api/auth/login').flush(null, { status: 204, statusText: 'No Content' });
    await Promise.resolve();
    http
      .expectOne('/api/auth/me')
      .flush({ usuario: 'admin', nome: 'Administrador', perfil: 'Administrador', permissoes: [] });
    await fixture.whenStable();

    expect(navegar).toHaveBeenCalledWith('/');
  });

  it('não envia o formulário sem usuário e senha', async () => {
    const fixture = await abrirTela();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();

    http.expectNone('/api/auth/login');
  });
});
