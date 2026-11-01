import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Shell } from './shell';

const PERMISSOES_OPERADOR = ['pdv.vender', 'caixa.operar', 'caixa.fechar', 'catalogo.ver', 'clientes.ver', 'clientes.editar'];

describe('Shell', () => {
  async function renderizarCom(permissoes: string[]): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    const carregando = TestBed.inject(AuthService).carregarSessao();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/me')
      .flush({ usuario: 'ana', nome: 'Ana', perfil: 'Operador de caixa', permissoes });
    await carregando;

    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function itensDoMenu(elemento: HTMLElement): string[] {
    return Array.from(elemento.querySelectorAll('nav [data-item-menu] span')).map((s) => s.textContent!.trim());
  }

  it('menu do Operador de caixa não mostra Configuração, Contas a pagar nem Importação', async () => {
    const itens = itensDoMenu(await renderizarCom(PERMISSOES_OPERADOR));

    expect(itens).toEqual(['Início', 'Vendas', 'Estoque', 'Caixa']);
  });

  it('menu do Administrador mostra todas as funções', async () => {
    const itens = itensDoMenu(
      await renderizarCom([...PERMISSOES_OPERADOR, 'financeiro.ver', 'importacao.executar', 'configuracao.ver']),
    );

    expect(itens).toEqual(['Início', 'Vendas', 'Estoque', 'Caixa', 'Contas', 'Importação', 'Configuração']);
  });

  it('mostra o nome do usuário na barra superior', async () => {
    const elemento = await renderizarCom(PERMISSOES_OPERADOR);

    expect(elemento.querySelector('[data-usuario]')?.textContent).toContain('Ana');
  });
});
