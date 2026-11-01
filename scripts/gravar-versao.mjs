// Grava o commit do build em src/app/core/versao/commit.ts (exibido no rodapé do sistema).
// Uso: node scripts/gravar-versao.mjs [commit]   (sem argumento: git rev-parse --short HEAD, ou "dev")
// Roda no build de homologação (deploy/Dockerfile.web do impa-backend), onde não há .git.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

function commitDoGit() {
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const informado = (process.argv[2] ?? '').trim();
const commit = /^[0-9a-f]{7,40}$/i.test(informado) ? informado.slice(0, 7).toLowerCase() : commitDoGit() || 'dev';

const arquivo = new URL('../src/app/core/versao/commit.ts', import.meta.url);
writeFileSync(
  arquivo,
  `/** Commit do git que gerou este build (gravado por scripts/gravar-versao.mjs). */\nexport const COMMIT_WEB = '${commit}';\n`,
);
console.log(`Versão do front: commit ${commit}`);
