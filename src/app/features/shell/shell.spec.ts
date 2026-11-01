import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Shell } from './shell';
import { VERSAO_WEB } from '../../core/versao/versao';

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
    // O rodapé consulta a versão da API ao abrir o shell.
    TestBed.inject(HttpTestingController)
      .match('/api/versao')
      .forEach((r) => r.flush({ versao: '0.1.0', commit: '1f55d46' }));
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

  it('sair com a sessão já vencida (CA-4) volta ao login', async () => {
    const elemento = await renderizarCom(PERMISSOES_OPERADOR);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    Array.from(elemento.querySelectorAll('button')).find((b) => b.textContent?.includes('Sair'))!.click();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/logout')
      .flush({ mensagem: 'Recarregue a página.' }, { status: 400, statusText: 'Bad Request' });
    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/login'));

    expect(TestBed.inject(AuthService).sessao()).toBeNull();
  });

  it('rodapé mostra a versão do front e a da API', async () => {
    const elemento = await renderizarCom(PERMISSOES_OPERADOR);
    const rodape = () => elemento.querySelector('footer[data-versao]')?.textContent ?? '';

    await vi.waitFor(() => expect(rodape()).toContain('API 0.1.0 (1f55d46)'));
    expect(rodape()).toContain(`Web ${VERSAO_WEB.versao} (${VERSAO_WEB.commit})`);
  });
});
