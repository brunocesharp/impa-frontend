import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Perfis } from './perfis';
import { Perfil, PermissaoInfo } from './perfis.service';

const CATALOGO: PermissaoInfo[] = [
  { codigo: 'pdv.vender', grupo: 'Vendas e caixa', descricao: 'Vender no PDV' },
  { codigo: 'caixa.fechar', grupo: 'Vendas e caixa', descricao: 'Fechar caixa' },
  { codigo: 'catalogo.custo.ver', grupo: 'Catálogo', descricao: 'Ver custo dos itens' },
];

const PERFIS: Perfil[] = [
  {
    id: 'a',
    nome: 'Administrador',
    protegido: true,
    permissoes: ['caixa.fechar', 'catalogo.custo.ver', 'pdv.vender'],
    usuarios: 1,
  },
  { id: 'o', nome: 'Operador de caixa', protegido: false, permissoes: ['pdv.vender'], usuarios: 2 },
];

/** Zoneless: deixa as promises do componente (HTTP já respondido) terminarem e atualiza a tela. */
async function esperar(fixture: { detectChanges(): void }) {
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
}

describe('Perfis', () => {
  let http: HttpTestingController;

  async function abrir() {
    TestBed.configureTestingModule({
      imports: [Perfis],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Perfis);
    fixture.detectChanges();
    http.expectOne('/api/perfis').flush(PERFIS);
    http.expectOne('/api/perfis/permissoes').flush(CATALOGO);
    await esperar(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const caixas = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLInputElement>('[data-permissao] input[type=checkbox]'));
  const botao = (el: HTMLElement, texto: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    )!;

  afterEach(() => http.verify());

  it('lista os perfis com o Administrador marcado como protegido', async () => {
    const { el } = await abrir();

    const itens = Array.from(el.querySelectorAll('[data-perfil]')).map((i) => i.textContent ?? '');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toContain('Administrador');
    expect(itens[0]).toContain('Protegido');
  });

  it('Administrador: permissões em grupos, todas marcadas e sem edição', async () => {
    const { el } = await abrir();

    expect(
      Array.from(el.querySelectorAll('[data-grupo] h3')).map((h) => h.textContent?.trim()),
    ).toEqual(['Vendas e caixa', 'Catálogo']);
    expect(caixas(el).every((c) => c.checked && c.disabled)).toBe(true);
    expect(el.textContent).toContain('não pode ser alterado nem excluído');
    expect(botao(el, 'Salvar')).toBeUndefined();
    expect(botao(el, 'Excluir')).toBeUndefined();
  });

  it('editar o Operador de caixa envia as permissões marcadas', async () => {
    const { fixture, el } = await abrir();
    el.querySelectorAll<HTMLElement>('[data-perfil]')[1].click();
    fixture.detectChanges();

    const [vender, fechar] = caixas(el);
    expect(vender.checked).toBe(true);
    expect(fechar.checked).toBe(false);
    fechar.click();
    fixture.detectChanges();
    botao(el, 'Salvar').click();

    const put = http.expectOne('/api/perfis/o');
    expect(put.request.body).toEqual({
      nome: 'Operador de caixa',
      permissoes: ['caixa.fechar', 'pdv.vender'],
    });
    put.flush({ ...PERFIS[1], permissoes: ['caixa.fechar', 'pdv.vender'] });
    await esperar(fixture);
    expect(el.textContent).toContain('Perfil salvo');
  });

  it('novo perfil: cria com nome e permissões e mostra a recusa do servidor', async () => {
    const { fixture, el } = await abrir();
    botao(el, 'Novo perfil').click();
    fixture.detectChanges();

    const nome = el.querySelector<HTMLInputElement>('input[data-campo=nome]')!;
    nome.value = 'Operador de caixa';
    nome.dispatchEvent(new Event('input'));
    caixas(el)[0].click();
    fixture.detectChanges();
    botao(el, 'Salvar').click();

    http
      .expectOne('/api/perfis')
      .flush(
        { mensagem: 'Já existe um perfil com esse nome' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);
    expect(el.querySelector('[role=alert]')?.textContent).toContain(
      'Já existe um perfil com esse nome',
    );
  });

  it('excluir pede confirmação antes de chamar a API', async () => {
    const { fixture, el } = await abrir();
    el.querySelectorAll<HTMLElement>('[data-perfil]')[1].click();
    fixture.detectChanges();

    botao(el, 'Excluir').click();
    fixture.detectChanges();
    http.expectNone('/api/perfis/o');
    botao(el, 'Confirmar exclusão').click();

    http
      .expectOne('/api/perfis/o')
      .flush(
        { mensagem: 'O perfil tem usuários. Troque o perfil deles antes de excluir' },
        { status: 409, statusText: 'Conflict' },
      );
    await esperar(fixture);
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Troque o perfil deles');
  });
});
