import { defineConfig, devices } from '@playwright/test';

/**
 * Ponta a ponta contra o ambiente do docker compose (impa-backend/deploy), com HTTPS do Caddy.
 * Localmente o certificado é interno: o navegador de teste aceita (ignoreHTTPSErrors).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env['IMPA_E2E_URL'] ?? 'https://localhost:8443',
    ignoreHTTPSErrors: true,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
});
