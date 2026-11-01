# IMPA — Web (impa-frontend)

SPA do IMPA: Angular 22 (standalone, rotas lazy, signals), Angular Material 3 com o tema da marca e PWA
(service worker só para os arquivos do app; nada da API fica em cache, ADR-010).

Requer **Node 24.15 ou mais**.

## Estrutura

```
src/
├── styles/theme.scss          # tema M3 + tokens da direção de arte (claro e escuro)
└── app/
    ├── core/auth/             # AuthService (sessão de /api/auth/me), guards, interceptor de 401
    ├── core/menu/             # itens do menu e a permissão de cada um
    ├── core/tema/             # TemaService: claro / escuro / do sistema
    └── features/              # login (com a cena espacial), shell, início, em construção, indisponível
public/brand/                  # logotipos e símbolo (de docs/impa/direcao-arte/assets)
public/icons/, favicon.ico     # ícones do PWA a partir do símbolo (scripts/gerar-icones.py)
e2e/                           # testes ponta a ponta (Playwright)
```

### Convenção de pastas (desvio das skills `angular-*`)

As skills `angular-core-layer`/`angular-feature-layer` organizam o `core/` por **tipo de artefato**
(`services/`, `interceptors/`, `guards/`, `models/`...). Aqui o `core/` é organizado por **assunto**
(`core/auth/` com service, guards, interceptor e modelo juntos; `core/menu/`; `core/tema/`), e cada tela fica em
`features/{tela}/`, sem NgRx nem SignalR. Motivo: na story 1-1 cada assunto tem poucos arquivos, e juntá-los
deixa o padrão de ponta a ponta mais fácil de seguir. Registrado na story 1-1 (revisão 1, R11); rever quando
o `core/` crescer ou quando entrar estado global.

## Ícones

Os ícones do PWA (`any` e `maskable`), o `apple-touch-icon` e o `favicon.ico` são gerados a partir de
`public/brand/simbolo.png` (cometa sobre o fundo Espaço `#121318`):

```bash
python scripts/gerar-icones.py public    # requer Pillow
```

## Versão

O rodapé do shell mostra **Web {versão} ({commit})** e **API {versão} ({commit})** (`GET /api/versao`).
A versão do front é a `version` do `package.json`; o commit fica `dev` no repositório
(`src/app/core/versao/commit.ts`) e é gravado no build de homologação por `node scripts/gravar-versao.mjs {commit}`
(chamado pelo `Dockerfile.web` do impa-backend, com o commit vindo de `deploy/subir.sh`).

## Rodar localmente

API no perfil https (`dotnet run --project src/Host/Impa.Host --launch-profile https` no impa-backend) e:

```bash
npm ci
npm start          # http://localhost:4200, /api encaminhado para https://localhost:7065 (proxy.conf.json)
```

A sessão é por cookie HttpOnly. A proteção CSRF usa o cookie `XSRF-TOKEN`, que o Angular devolve no cabeçalho
`X-XSRF-TOKEN` (`withXsrfConfiguration`). A tela de login consulta `/api/auth/me` ao abrir para receber o token.

## Testes

```bash
npm run test:ci    # unitários (Vitest)
npm run e2e        # ponta a ponta (Playwright) contra o docker compose local
```

Os testes ponta a ponta rodam contra o ambiente de homologação local (ver `impa-backend/deploy/README.md`, com
`DOMINIO=localhost`). Variáveis: `IMPA_E2E_URL` (padrão `https://localhost:8443`), `IMPA_E2E_USUARIO`,
`IMPA_E2E_SENHA` e `IMPA_E2E_NOME` (o administrador do `.env`). Na primeira vez: `npx playwright install chromium`.

## Build

```bash
npm run build      # dist/impa-frontend/browser, copiado para a imagem do Caddy pelo Dockerfile.web
```
