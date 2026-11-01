import { itensVisiveis } from './menu';

describe('itensVisiveis', () => {
  it('Início aparece para qualquer usuário autenticado', () => {
    expect(itensVisiveis(new Set()).map((i) => i.rotulo)).toEqual(['Início']);
  });

  it('cada item depende da sua permissão', () => {
    const rotulos = itensVisiveis(new Set(['caixa.operar', 'configuracao.ver'])).map((i) => i.rotulo);

    expect(rotulos).toEqual(['Início', 'Caixa', 'Configuração']);
  });
});
