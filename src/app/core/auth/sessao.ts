/** Resposta de `GET /api/auth/me` (contrato da story 1-1). */
export interface Sessao {
  usuario: string;
  nome: string;
  perfil: string;
  permissoes: string[];
}

/** Corpo de erro da API: `{ "mensagem": "..." }`. */
export interface ErroApi {
  mensagem: string;
}

export const MENSAGEM_CREDENCIAL_INVALIDA = 'Usuário ou senha inválidos';
