/**
 * Commit do git que gerou este build. Fica "dev" no repositório; o build de homologação
 * (deploy/Dockerfile.web do impa-backend) o sobrescreve com `node scripts/gravar-versao.mjs {commit}`.
 */
export const COMMIT_WEB = 'dev';
