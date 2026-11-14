import { HttpErrorResponse } from '@angular/common/http';

/** Liberação de operação por administrador (story 1-5, RN-1.9): contrato com a API. */
export const URL_LIBERACOES = '/api/acesso/liberacoes';

/** Cabeçalho com o token de uso único devolvido por `POST /api/acesso/liberacoes`. */
export const CABECALHO_LIBERACAO = 'X-Liberacao';

/** `codigo` do 403 quando falta uma permissão. */
export const CODIGO_PERMISSAO_REQUERIDA = 'permissao_requerida';

/** Corpo do 403 por permissão: `liberavel` = um administrador pode liberar esta operação na hora. */
export interface PermissaoRequerida {
  codigo: typeof CODIGO_PERMISSAO_REQUERIDA;
  permissao: string;
  liberavel: boolean;
}

/** Resposta 201 de `POST /api/acesso/liberacoes`. */
export interface Liberacao {
  token: string;
  expiraEm: string;
}

/** A liberação foi aceita no diálogo, mas a API recusou o token (venceu, ou quem liberou perdeu a permissão). */
export const MENSAGEM_LIBERACAO_RECUSADA = 'A liberação não vale mais. Peça uma nova liberação';

/** Texto das permissões liberáveis no diálogo (o catálogo completo só vem para quem gerencia perfis). */
const DESCRICOES: Record<string, string> = {
  'pdv.desconto.acima-do-limite': 'Dar desconto acima do limite',
  'vendas.cancelar-concluida': 'Cancelar venda concluída',
};

export function descricaoDaPermissao(permissao: string): string {
  return DESCRICOES[permissao] ?? permissao;
}

/** Permissão do 403 `permissao_requerida` liberável; `null` para qualquer outro erro. */
export function permissaoLiberavel(erro: unknown): string | null {
  if (!(erro instanceof HttpErrorResponse) || erro.status !== 403) return null;
  const corpo = erro.error as Partial<PermissaoRequerida> | null;
  return corpo?.codigo === CODIGO_PERMISSAO_REQUERIDA &&
    corpo.liberavel === true &&
    typeof corpo.permissao === 'string'
    ? corpo.permissao
    : null;
}
