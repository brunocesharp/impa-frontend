import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { routes } from '../../app.routes';
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

  it('Configuração continua exigindo configuracao.ver e não é mais "em construção"', () => {
    const configuracao = filhas.filter((r) => r.path === 'configuracao');

    expect(configuracao).toHaveLength(1);
    expect(configuracao[0].data).toEqual(
      expect.objectContaining({ permissao: 'configuracao.ver' }),
    );
  });
});
