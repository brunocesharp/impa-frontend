import { ApplicationRef } from '@angular/core';
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

    expect(itens).toEqual(['Início', 'Vendas', 'Estoque', 'Caixa', 'Pessoas']);
  });

  it('menu do Administrador mostra todas as funções', async () => {
    const itens = itensDoMenu(
      await renderizarCom([...PERMISSOES_OPERADOR, 'financeiro.ver', 'importacao.executar', 'configuracao.ver']),
    );

    expect(itens).toEqual(['Início', 'Vendas', 'Estoque', 'Caixa', 'Pessoas', 'Contas', 'Importação', 'Configuração']);
  });

  it('mostra o nome do usuário na barra superior', async () => {
    const elemento = await renderizarCom(PERMISSOES_OPERADOR);

    expect(elemento.querySelector('[data-usuario]')?.textContent).toContain('Ana');
  });

  for (const [caso, status, statusText, corpo] of [
    ['logout aceito (204)', 204, 'No Content', null],
    ['sessão já vencida (400, CA-4)', 400, 'Bad Request', { mensagem: 'Recarregue a página.' }],
    ['sessão encerrada em outra aba (401)', 401, 'Unauthorized', { mensagem: 'Não autenticado.' }],
  ] as const) {
    it(`sair com ${caso} volta ao login e esquece o usuário`, async () => {
      const elemento = await renderizarCom(PERMISSOES_OPERADOR);
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      Array.from(elemento.querySelectorAll('button')).find((b) => b.textContent?.includes('Sair'))!.click();
      TestBed.inject(HttpTestingController).expectOne('/api/auth/logout').flush(corpo, { status, statusText });
      await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/login'));

      expect(TestBed.inject(AuthService).sessao()).toBeNull();
    });
  }

  for (const [status, statusText] of [
    [0, 'Unknown Error'],
    [503, 'Service Unavailable'],
  ] as const) {
    it(`sair com a API fora (${status}) mantém o usuário e avisa, sem ir ao login`, async () => {
      const elemento = await renderizarCom(PERMISSOES_OPERADOR);
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      Array.from(elemento.querySelectorAll('button')).find((b) => b.textContent?.includes('Sair'))!.click();
      TestBed.inject(HttpTestingController).expectOne('/api/auth/logout').flush(null, { status, statusText });

      await vi.waitFor(() => expect(document.body.textContent).toContain('Não foi possível sair. Tente de novo.'));
      expect(navegar).not.toHaveBeenCalled();
      expect(TestBed.inject(AuthService).sessao()?.usuario).toBe('ana');
    });
  }

  describe('sino de notificações (story 4-2)', () => {
    const CONTAGEM = '/api/notificacoes/nao-lidas/contagem';
    const PERMISSOES_ADMIN = [...PERMISSOES_OPERADOR, 'configuracao.ver', 'notificacoes.receber'];

    function sino(elemento: HTMLElement): HTMLButtonElement | null {
      return elemento.querySelector<HTMLButtonElement>('[data-sino]');
    }

    async function comContagem(elemento: HTMLElement, naoLidas: number): Promise<void> {
      TestBed.inject(HttpTestingController).expectOne(CONTAGEM).flush({ naoLidas });
      TestBed.inject(ApplicationRef).tick();
      await vi.waitFor(() => expect(sino(elemento)).not.toBeNull());
    }

    it('não aparece para quem não tem notificacoes.receber, e o contador não é consultado', async () => {
      const elemento = await renderizarCom(PERMISSOES_OPERADOR);

      expect(sino(elemento)).toBeNull();
      TestBed.inject(HttpTestingController).expectNone(CONTAGEM);
    });

    it('aparece com notificacoes.receber e mostra o contador de não lidas', async () => {
      const elemento = await renderizarCom(PERMISSOES_ADMIN);
      await comContagem(elemento, 1);

      await vi.waitFor(() => expect(elemento.querySelector('[data-contador]')?.textContent?.trim()).toBe('1'));
      expect(sino(elemento)!.getAttribute('aria-label')).toBe('Notificações: 1 não lida');
    });

    it('sem não lidas, o sino fica sem contador', async () => {
      const elemento = await renderizarCom(PERMISSOES_ADMIN);
      await comContagem(elemento, 0);

      expect(elemento.querySelector('[data-contador]')).toBeNull();
    });

    it('abrir o painel lista as notificações; marcar como lida e marcar todas atualizam o contador', async () => {
      const elemento = await renderizarCom(PERMISSOES_ADMIN);
      const http = TestBed.inject(HttpTestingController);
      await comContagem(elemento, 2);

      sino(elemento)!.click();
      http.expectOne((r) => r.url === '/api/notificacoes').flush({
        itens: [
          { id: 'a', tipo: 't', titulo: 'Saldo negativo', texto: 'Caneta azul 0.7 ficou com saldo -1', referenciaDaOrigem: null, criadaEm: '2026-11-07T10:00:00Z', lida: false },
          { id: 'b', tipo: 't', titulo: 'Saldo negativo', texto: 'Borracha ficou com saldo -2', referenciaDaOrigem: null, criadaEm: '2026-11-07T09:00:00Z', lida: false },
        ],
        pagina: 1,
        tamanhoDaPagina: 20,
        total: 2,
      });
      http.expectOne(CONTAGEM).flush({ naoLidas: 2 });
      await vi.waitFor(() => expect(document.querySelectorAll('[data-notificacao]').length).toBe(2));
      expect(document.body.textContent).toContain('Caneta azul 0.7 ficou com saldo -1');

      document.querySelector<HTMLButtonElement>('[data-notificacao] [data-marcar-lida]')!.click();
      http.expectOne('/api/notificacoes/a/lida').flush(null, { status: 204, statusText: 'No Content' });
      await vi.waitFor(() => expect(elemento.querySelector('[data-contador]')?.textContent?.trim()).toBe('1'));
      expect(document.querySelectorAll('[data-marcar-lida]').length).toBe(1);

      document.querySelector<HTMLButtonElement>('[data-marcar-todas]')!.click();
      http.expectOne('/api/notificacoes/lidas').flush(null, { status: 204, statusText: 'No Content' });
      await vi.waitFor(() => expect(elemento.querySelector('[data-contador]')).toBeNull());
      expect(document.querySelectorAll('[data-marcar-lida]').length).toBe(0);
    });
  });

  it('rodapé mostra a versão do front e a da API', async () => {
    const elemento = await renderizarCom(PERMISSOES_OPERADOR);
    const rodape = () => elemento.querySelector('footer[data-versao]')?.textContent ?? '';

    await vi.waitFor(() => expect(rodape()).toContain('API 0.1.0 (1f55d46)'));
    expect(rodape()).toContain(`Web ${VERSAO_WEB.versao} (${VERSAO_WEB.commit})`);
  });
});
