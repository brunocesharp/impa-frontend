import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { routes } from '../../app.routes';
import { terminalGuard } from '../../core/terminal/terminal.guard';
import { Configuracao } from './configuracao';

describe('Configuracao', () => {
  function abrir(permissoes: string[]) {
    TestBed.configureTestingModule({
      imports: [Configuracao],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const auth = TestBed.inject(AuthService);
    vi.spyOn(auth, 'permissoes').mockReturnValue(new Set(permissoes));
    const fixture = TestBed.createComponent(Configuracao);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra Perfis para quem tem perfis.gerenciar', () => {
    const el = abrir(['configuracao.ver', 'perfis.gerenciar']);

    expect(el.querySelector('[data-secao]')?.textContent).toContain('Perfis');
  });

  it('mostra Terminais para quem tem terminais.gerenciar (story 1-6)', () => {
    const el = abrir(['configuracao.ver', 'terminais.gerenciar']);

    const secoes = Array.from(el.querySelectorAll('[data-secao]'));
    expect(secoes).toHaveLength(1);
    expect(secoes[0].textContent).toContain('Terminais');
    expect(secoes[0].getAttribute('href')).toBe('/terminais');
  });

  it('sem perfis.gerenciar, não mostra Perfis', () => {
    const el = abrir(['configuracao.ver']);

    expect(el.querySelector('[data-secao]')).toBeNull();
    expect(el.textContent).toContain('Nenhuma seção');
  });
});

describe('rotas de Configuração', () => {
  const filhas = routes.find((r) => r.path === '')!.children!;

  it('Configuração → Perfis exige perfis.gerenciar', () => {
    const perfis = filhas.find((r) => r.path === 'configuracao/perfis')!;

    expect(perfis.data).toEqual(expect.objectContaining({ permissao: 'perfis.gerenciar' }));
    expect(perfis.canActivate).toHaveLength(1);
  });

  it('Configuração → Terminais exige terminais.gerenciar (story 1-6)', () => {
    const terminais = filhas.find((r) => r.path === 'configuracao/terminais')!;

    expect(terminais.data).toEqual(expect.objectContaining({ permissao: 'terminais.gerenciar' }));
    expect(terminais.canActivate).toHaveLength(1);
  });

  it('PDV (Vendas) e Caixa exigem terminal registrado; as demais funções não (story 1-6, RN-11.1)', () => {
    const guards = (rota: string) => filhas.find((r) => r.path === rota)!.canActivate!;

    expect(guards('vendas')).toContain(terminalGuard);
    expect(guards('caixa')).toContain(terminalGuard);
    for (const rota of [
      'estoque',
      'contas',
      'importacao',
      'configuracao',
      'configuracao/terminais',
    ])
      expect(guards(rota)).not.toContain(terminalGuard);
    expect(filhas.some((r) => r.path === 'terminal-nao-registrado')).toBe(true);
  });

  it('Configuração continua exigindo configuracao.ver e não é mais "em construção"', () => {
    const configuracao = filhas.filter((r) => r.path === 'configuracao');

    expect(configuracao).toHaveLength(1);
    expect(configuracao[0].data).toEqual(
      expect.objectContaining({ permissao: 'configuracao.ver' }),
    );
  });
});
