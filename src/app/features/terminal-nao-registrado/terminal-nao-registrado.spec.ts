import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/auth/auth.service';
import { TerminalNaoRegistrado } from './terminal-nao-registrado';

const MENSAGEM_DO_CENARIO =
  'Este computador não está registrado como terminal. Peça ao administrador';

describe('TerminalNaoRegistrado (story 1-6, CA-1 — cenário 11.6)', () => {
  /** As rotas reais de Vendas (PDV) e da tela de terminal não registrado, sem o shell. */
  const rotasDoPdv: Routes = routes
    .find((r) => r.path === '')!
    .children!.filter((r) => r.path === 'vendas' || r.path === 'terminal-nao-registrado');

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('operador abre o PDV num computador não registrado e vê a mensagem', async () => {
    // Dado que o computador não foi registrado como terminal
    TestBed.configureTestingModule({
      providers: [provideRouter(rotasDoPdv), provideHttpClient(), provideHttpClientTesting()],
    });
    vi.spyOn(TestBed.inject(AuthService), 'permissoes').mockReturnValue(new Set(['pdv.vender']));
    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);

    // Quando o operador acessa o PDV nesse computador
    const navegando = harness.navigateByUrl('/vendas');
    await vi.waitFor(() =>
      http
        .expectOne('/api/terminais/atual')
        .flush(
          { mensagem: MENSAGEM_DO_CENARIO, codigo: 'terminal_nao_registrado' },
          { status: 403, statusText: 'Forbidden' },
        ),
    );
    await navegando;
    harness.detectChanges();

    // Então aparece a mensagem "Este computador não está registrado como terminal. Peça ao administrador"
    expect(TestBed.inject(Router).url).toBe('/terminal-nao-registrado');
    const mensagem = (harness.routeNativeElement as HTMLElement).querySelector('[data-mensagem]');
    expect(mensagem?.textContent?.trim()).toBe(MENSAGEM_DO_CENARIO);
    expect(mensagem?.getAttribute('role')).toBe('alert');
  });

  it('a tela mostra a mensagem do cenário 11.6', async () => {
    TestBed.configureTestingModule({
      imports: [TerminalNaoRegistrado],
      providers: [provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(TerminalNaoRegistrado);
    await fixture.whenStable();

    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.querySelector('[data-mensagem]')?.textContent?.trim()).toBe(
      MENSAGEM_DO_CENARIO,
    );
  });
});
