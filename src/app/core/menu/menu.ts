/** Item do menu da retaguarda. Sem `permissao`: aparece para qualquer usuário na sessão. */
export interface ItemMenu {
  rota: string;
  rotulo: string;
  icone: string;
  permissao?: string;
}

/** Menu do shell (item → permissão), na ordem da story 1-1. */
export const MENU: readonly ItemMenu[] = [
  { rota: '', rotulo: 'Início', icone: 'space_dashboard' },
  { rota: 'vendas', rotulo: 'Vendas', icone: 'shopping_bag', permissao: 'pdv.vender' },
  { rota: 'estoque', rotulo: 'Estoque', icone: 'inventory_2', permissao: 'catalogo.ver' },
  { rota: 'caixa', rotulo: 'Caixa', icone: 'point_of_sale', permissao: 'caixa.operar' },
  { rota: 'contas', rotulo: 'Contas', icone: 'payments', permissao: 'financeiro.ver' },
  { rota: 'importacao', rotulo: 'Importação', icone: 'upload_file', permissao: 'importacao.executar' },
  { rota: 'configuracao', rotulo: 'Configuração', icone: 'settings', permissao: 'configuracao.ver' },
];

export function itensVisiveis(permissoes: ReadonlySet<string>): ItemMenu[] {
  return MENU.filter((item) => !item.permissao || permissoes.has(item.permissao));
}
