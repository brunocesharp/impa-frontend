import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MENSAGEM_LINK_INVALIDO, MENSAGEM_SENHA_REDEFINIDA } from './recuperar-senha.service';
import { RedefinirSenha, tokenDoFragmento } from './redefinir-senha';

describe('RedefinirSenha (story 1-8)', () => {
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.fn>;

  function abrirTela(fragmento: string | null) {
    TestBed.configureTestingModule({
      imports: [RedefinirSenha],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { fragment: fragmento } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true) as unknown as ReturnType<
      typeof vi.fn
    >;
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RedefinirSenha);
    fixture.detectChanges();
    return fixture;
  }

  function preencherESalvar(elemento: HTMLElement, senha: string, confirmacao = senha) {
    const campo = (nome: string) =>
      elemento.querySelector<HTMLInputElement>(`input[data-campo="${nome}"]`)!;
    campo('novaSenha').value = senha;
    campo('novaSenha').dispatchEvent(new Event('input'));
    campo('confirmacao').value = confirmacao;
    campo('confirmacao').dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  }

  async function redefinicao() {
    (await vi.waitFor(() => http.expectOne('/api/auth/me'))).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    return vi.waitFor(() => http.expectOne('/api/auth/redefinir-senha'));
  }

  afterEach(() => http?.verify());

  it('lê o token do fragmento', () => {
    expect(tokenDoFragmento('token=abc-123_X')).toBe('abc-123_X');
    expect(tokenDoFragmento(null)).toBe('');
    expect(tokenDoFragmento('outro=1')).toBe('');
  });

  it('cenário 1.9: define "novasenha26" pelo link e volta ao login com aviso', async () => {
    const fixture = abrirTela('token=abc-123');
    const elemento = fixture.nativeElement as HTMLElement;

    preencherESalvar(elemento, 'novasenha26');
    const requisicao = await redefinicao();
    expect(requisicao.request.body).toEqual({ token: 'abc-123', novaSenha: 'novasenha26' });
    requisicao.flush(null, { status: 204, statusText: 'No Content' });

    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/login'));
    expect(TestBed.inject(AuthService).aviso()).toBe(MENSAGEM_SENHA_REDEFINIDA);
  });

  it('tira o token da barra de endereço ao abrir', () => {
    abrirTela('token=abc-123');
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([], {
      fragment: undefined,
      replaceUrl: true,
    });
  });

  it('cenário 1.9: link já usado ou vencido mostra "Link inválido ou expirado"', async () => {
    const fixture = abrirTela('token=usado');
    const elemento = fixture.nativeElement as HTMLElement;

    preencherESalvar(elemento, 'novasenha26');
    (await redefinicao()).flush(
      { errors: { Token: [MENSAGEM_LINK_INVALIDO] } },
      { status: 400, statusText: 'Bad Request' },
    );

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
        'Link inválido ou expirado',
      );
    });
    expect(elemento.querySelector('a[href="/esqueci-senha"]')).not.toBeNull();
    expect(elemento.querySelector('form')).toBeNull();
  });

  it('sem token no link já mostra "Link inválido ou expirado"', () => {
    const elemento = abrirTela(null).nativeElement as HTMLElement;

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(MENSAGEM_LINK_INVALIDO);
  });

  it('senha recusada pelo servidor vai para o campo, e o formulário continua', async () => {
    const fixture = abrirTela('token=abc');
    const elemento = fixture.nativeElement as HTMLElement;

    preencherESalvar(elemento, 'senhafraca1');
    (await redefinicao()).flush(
      { errors: { NovaSenha: ['Senha recusada pelo servidor'] } },
      { status: 400, statusText: 'Bad Request' },
    );

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(elemento.textContent).toContain('Senha recusada pelo servidor');
    });
    expect(elemento.querySelector('form')).not.toBeNull();
  });

  it('não envia senha curta nem confirmação diferente', async () => {
    const fixture = abrirTela('token=abc');
    const elemento = fixture.nativeElement as HTMLElement;

    preencherESalvar(elemento, 'curta');
    await fixture.whenStable();
    expect(elemento.textContent).toContain('A senha precisa ter pelo menos 8 caracteres');

    preencherESalvar(elemento, 'novasenha26', 'outrasenha');
    await fixture.whenStable();
    expect(elemento.textContent).toContain('As senhas não conferem');
    http.expectNone('/api/auth/me');
  });
});
