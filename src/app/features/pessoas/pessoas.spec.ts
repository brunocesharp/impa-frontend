import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { itensVisiveis } from '../../core/menu/menu';
import { Pessoas } from './pessoas';

describe('Pessoas (story 3-7, decisão de 07/11/2026)', () => {
  async function abasCom(permissoes: string[]): Promise<string[]> {
    TestBed.configureTestingModule({
      imports: [Pessoas],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const sessao = TestBed.inject(AuthService).carregarSessao();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/me')
      .flush({ usuario: 'u', nome: 'U', perfil: 'P', permissoes });
    await sessao;

    const fixture = TestBed.createComponent(Pessoas);
    await fixture.whenStable();
    fixture.detectChanges();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-aba]')).map(
      (a) => a.textContent!.trim(),
    );
  }

  it('o item "Pessoas" do menu aparece com clientes.ver', () => {
    expect(itensVisiveis(new Set(['clientes.ver'])).map((i) => i.rotulo)).toContain('Pessoas');
    expect(itensVisiveis(new Set(['fornecedores.gerenciar'])).map((i) => i.rotulo)).not.toContain(
      'Pessoas',
    );
  });

  it('operador de caixa vê só a aba Clientes', async () => {
    expect(await abasCom(['clientes.ver', 'clientes.editar'])).toEqual(['Clientes']);
  });

  it('com fornecedores.gerenciar aparece a aba Fornecedores', async () => {
    expect(await abasCom(['clientes.ver', 'fornecedores.gerenciar'])).toEqual([
      'Clientes',
      'Fornecedores',
    ]);
  });
});
