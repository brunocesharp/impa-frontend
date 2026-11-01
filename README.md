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
    └── features/              # login (com a cena espacial), shell, início, em construção
public/brand/                  # logotipos e símbolo (de docs/impa/direcao-arte/assets)
e2e/                           # testes ponta a ponta (Playwright)
```

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
