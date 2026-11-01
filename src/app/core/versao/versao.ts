import { version } from '../../../../package.json';
import { COMMIT_WEB } from './commit';

/** Versão de um lado do sistema, como aparece no rodapé: `{versao} ({commit})`. */
export interface Versao {
  versao: string;
  commit: string;
}

/** Versão do front: `version` do package.json e o commit gravado no build. */
export const VERSAO_WEB: Versao = { versao: version, commit: COMMIT_WEB };
