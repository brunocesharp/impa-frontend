import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Indisponivel } from './indisponivel';

describe('Indisponivel', () => {
  let http: HttpTestingController;

  async function abrir(volta: string) {
    TestBed.configureTestingModule({
      imports: [Indisponivel],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Indisponivel);
    fixture.componentRef.setInput('volta', volta);
    await fixture.whenStable();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const botao = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!;
    return { fixture, navegar, botao };
  }

  afterEach(() => http.verify());

  it('com a API de volta e sessão aberta, volta ao destino', async () => {
    const { navegar, botao } = await abrir('/caixa');

    botao.click();
    http.expectOne('/api/auth/me').flush({ usuario: 'ana', nome: 'Ana', perfil: 'Operador de caixa', permissoes: [] });

    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/caixa'));
  });

  it('com a API de volta e sem sessão, vai para o login', async () => {
    const { navegar, botao } = await abrir('/caixa');

    botao.click();
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/login'));
  });

  it('ainda indisponível, fica na tela', async () => {
    const { navegar, botao, fixture } = await abrir('/caixa');

    botao.click();
    fixture.detectChanges();
    expect(botao.disabled).toBe(true); // tentando

    http.expectOne('/api/auth/me').flush(null, { status: 502, statusText: 'Bad Gateway' });

    // O erro foi tratado: o botão volta a ficar disponível para outra tentativa.
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(botao.disabled).toBe(false);
    });
    expect(botao.textContent).toContain('Tentar de novo');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('ignora destino externo', async () => {
    const { navegar, botao } = await abrir('//exemplo.com');

    botao.click();
    http.expectOne('/api/auth/me').flush({ usuario: 'ana', nome: 'Ana', perfil: 'Operador de caixa', permissoes: [] });

    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/'));
  });
});
