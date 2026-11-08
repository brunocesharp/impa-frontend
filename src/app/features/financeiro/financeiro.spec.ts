import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { itensVisiveis } from '../../core/menu/menu';
import { Financeiro } from './financeiro';

describe('Menu Contas (story 11-1)', () => {
  it('o item "Contas" aparece com financeiro.ver', () => {
    expect(itensVisiveis(new Set(['financeiro.ver'])).map((i) => i.rotulo)).toContain('Contas');
    expect(itensVisiveis(new Set(['clientes.ver'])).map((i) => i.rotulo)).not.toContain('Contas');
  });

  it('a rota contas leva às telas do Financeiro, não a "Em construção"', async () => {
    const contas = routes.find((r) => r.path === '')!.children!.find((r) => r.path === 'contas')!;

    expect(contas.data).toEqual({ titulo: 'Contas', permissao: 'financeiro.ver' });
    expect(await contas.loadComponent!()).toBe(Financeiro);
    expect(contas.children!.map((r) => r.path)).toEqual([
      '',
      'a-pagar',
      'categorias',
      'formas-pagamento',
    ]);
  });

  it('mostra as abas Contas a pagar, Categorias e Formas de pagamento (11-2)', async () => {
    TestBed.configureTestingModule({ imports: [Financeiro], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Financeiro);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-aba]')).map((a) =>
        a.textContent!.trim(),
      ),
    ).toEqual(['Contas a pagar', 'Categorias', 'Formas de pagamento']);
  });
});
