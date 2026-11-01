import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { sessaoExpiradaInterceptor } from './sessao-expirada.interceptor';

describe('sessaoExpiradaInterceptor', () => {
  let http: HttpTestingController;
  let cliente: HttpClient;
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([sessaoExpiradaInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    cliente = TestBed.inject(HttpClient);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    // Usuário com sessão aberta.
    const carregando = TestBed.inject(AuthService).carregarSessao();
    http.expectOne('/api/auth/me').flush({ usuario: 'ana', nome: 'Ana', perfil: 'Operador de caixa', permissoes: [] });
    await carregando;
  });

  afterEach(() => http.verify());

  async function responder(url: string, status: number, statusText: string): Promise<void> {
    const chamada = firstValueFrom(cliente.get(url));
    http.expectOne(url).flush(null, { status, statusText });
    await expect(chamada).rejects.toMatchObject({ status });
  }

  it('401 fora de /api/auth/* (sessão vencida) esquece o usuário e vai para o login', async () => {
    await responder('/api/configuracao/empresa', 401, 'Unauthorized');

    expect(navegar).toHaveBeenCalledWith('/login');
    expect(TestBed.inject(AuthService).sessao()).toBeNull();
  });

  it('401 em /api/auth/* é tratado pela própria tela: não navega', async () => {
    await responder('/api/auth/me', 401, 'Unauthorized');

    expect(navegar).not.toHaveBeenCalled();
  });

  it('403 (sem permissão) não encerra a sessão nem navega', async () => {
    await responder('/api/configuracao/empresa', 403, 'Forbidden');

    expect(navegar).not.toHaveBeenCalled();
    expect(TestBed.inject(AuthService).sessao()).not.toBeNull();
  });
});
