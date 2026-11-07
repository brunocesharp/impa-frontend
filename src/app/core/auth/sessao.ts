/** Resposta de `GET /api/auth/me` (contrato da story 1-1). */
export interface Sessao {
  usuario: string;
  nome: string;
  perfil: string;
  permissoes: string[];
  /** Senha provisória (story 1-4, RN-1.8): até trocar, a API só aceita a troca de senha. Ausente = `false`. */
  trocaDeSenhaObrigatoria?: boolean;
}

/** `codigo` do 403 de qualquer função enquanto a troca de senha estiver pendente (story 1-4). */
export const CODIGO_TROCA_DE_SENHA_OBRIGATORIA = 'troca_de_senha_obrigatoria';

/** RN-1.1: mínimo de caracteres da senha. */
export const SENHA_MINIMA = 8;

/** Corpo de erro da API: `{ "mensagem": "..." }`; `codigo` só em casos que a tela distingue (ex.: `"bloqueado"`). */
export interface ErroApi {
  mensagem: string;
  codigo?: string;
}

export const MENSAGEM_CREDENCIAL_INVALIDA = 'Usuário ou senha inválidos';

/** `codigo` do 401 do login quando a conta está bloqueada por tentativas (story 1-2, RN-1.2). */
export const CODIGO_BLOQUEADO = 'bloqueado';
export const MENSAGEM_BLOQUEADO = 'Usuário bloqueado temporariamente. Tente novamente em 15 minutos';

/** 429 do login: limite de tentativas por origem (story 1-10); usado quando o corpo vem sem `mensagem`. */
export const MENSAGEM_MUITAS_TENTATIVAS = 'Muitas tentativas de entrar. Aguarde um minuto e tente novamente';

/** Aviso no login quando a sessão acaba no servidor: desativação, logout em outro lugar ou as 12 h (RN-1.3, RN-1.7). */
export const MENSAGEM_SESSAO_ENCERRADA = 'Sua sessão foi encerrada';
