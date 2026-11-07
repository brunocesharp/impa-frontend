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

  it('403 de troca de senha obrigatória (senha redefinida com a sessão aberta) leva à troca de senha', async () => {
    const chamada = firstValueFrom(cliente.get('/api/teste/pdv'));
    http
      .expectOne('/api/teste/pdv')
      .flush({ mensagem: 'Defina uma nova senha para continuar', codigo: 'troca_de_senha_obrigatoria' }, { status: 403, statusText: 'Forbidden' });
    await expect(chamada).rejects.toMatchObject({ status: 403 });

    http.expectOne('/api/auth/me').flush({
      usuario: 'ana', nome: 'Ana', perfil: 'Operador de caixa', permissoes: [], trocaDeSenhaObrigatoria: true,
    });
    await new Promise((r) => setTimeout(r));

    expect(TestBed.inject(AuthService).trocaDeSenhaObrigatoria()).toBe(true);
    expect(navegar).toHaveBeenCalledWith('/trocar-senha');
  });

  it('403 comum (sem a permissão) não navega', async () => {
    await responder('/api/perfis', 403, 'Forbidden');

    expect(navegar).not.toHaveBeenCalled();
  });

  it('401 fora de /api/auth/* (sessão vencida) esquece o usuário e vai para o login', async () => {
    await responder('/api/configuracao/empresa', 401, 'Unauthorized');

    expect(navegar).toHaveBeenCalledWith('/login');
    expect(TestBed.inject(AuthService).sessao()).toBeNull();
  });

  it('401 com a sessão aberta (revogada ou vencida nas 12 h) deixa o aviso "Sua sessão foi encerrada"', async () => {
    await responder('/api/configuracao/empresa', 401, 'Unauthorized');

    expect(TestBed.inject(AuthService).aviso()).toBe('Sua sessão foi encerrada');
  });

  it('401 do /api/auth/me com a sessão aberta também encerra, com o aviso', async () => {
    await responder('/api/auth/me', 401, 'Unauthorized');

    expect(navegar).toHaveBeenCalledWith('/login');
    expect(TestBed.inject(AuthService).aviso()).toBe('Sua sessão foi encerrada');
  });

  it('R1: dois 401 simultâneos depois da revogação mantêm o aviso "Sua sessão foi encerrada"', async () => {
    const primeira = firstValueFrom(cliente.get('/api/configuracao/empresa'));
    const segunda = firstValueFrom(cliente.get('/api/outra'));
    http.expectOne('/api/configuracao/empresa').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/outra').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(primeira).rejects.toMatchObject({ status: 401 });
    await expect(segunda).rejects.toMatchObject({ status: 401 });

    expect(TestBed.inject(AuthService).aviso()).toBe('Sua sessão foi encerrada');
  });

  it('401 sem sessão aberta não deixa aviso', async () => {
    TestBed.inject(AuthService).encerrarLocalmente();

    await responder('/api/configuracao/empresa', 401, 'Unauthorized');

    expect(navegar).toHaveBeenCalledWith('/login');
    expect(TestBed.inject(AuthService).aviso()).toBeNull();
  });

  for (const url of ['/api/auth/login', '/api/auth/logout']) {
    it(`401 em ${url} é tratado pela própria tela: não navega`, async () => {
      const chamada = firstValueFrom(cliente.post(url, null));
      http.expectOne(url).flush(null, { status: 401, statusText: 'Unauthorized' });
      await expect(chamada).rejects.toMatchObject({ status: 401 });

      expect(navegar).not.toHaveBeenCalled();
      expect(TestBed.inject(AuthService).aviso()).toBeNull();
    });
  }

  it('401 do /api/auth/me sem sessão aberta (abrir o app) não navega', async () => {
    TestBed.inject(AuthService).encerrarLocalmente();

    await responder('/api/auth/me', 401, 'Unauthorized');

    expect(navegar).not.toHaveBeenCalled();
  });

  it('403 (sem permissão) não encerra a sessão nem navega', async () => {
    await responder('/api/configuracao/empresa', 403, 'Forbidden');

    expect(navegar).not.toHaveBeenCalled();
    expect(TestBed.inject(AuthService).sessao()).not.toBeNull();
  });
});
