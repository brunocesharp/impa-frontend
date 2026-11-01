import { expect, test } from '@playwright/test';

// Administrador criado pelo seed a partir de IMPA_ADMIN_* do .env do compose.
const ADMIN_USUARIO = process.env['IMPA_E2E_USUARIO'] ?? 'admin';
const ADMIN_SENHA = process.env['IMPA_E2E_SENHA'] ?? 'admin-local-2026';
const ADMIN_NOME = process.env['IMPA_E2E_NOME'] ?? 'Administrador Local';

test.describe('Login (cenários 1.1 e 1.2)', () => {
  test('Administrador entra e o shell abre com todas as funções', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Usuário').fill(ADMIN_USUARIO);
    await page.getByLabel('Senha').fill(ADMIN_SENHA);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: `Bem-vindo, ${ADMIN_NOME}` })).toBeVisible();

    if (isMobile) await page.getByRole('button', { name: 'Abrir o menu' }).click();
    const menu = page.getByRole('navigation', { name: 'Menu principal' });
    for (const item of ['Início', 'Vendas', 'Estoque', 'Caixa', 'Contas', 'Importação', 'Configuração'])
      await expect(menu.getByRole('link', { name: item })).toBeVisible();
  });

  test('senha errada mostra "Usuário ou senha inválidos" e continua no login', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Usuário').fill(ADMIN_USUARIO);
    await page.getByLabel('Senha').fill('senha-errada-123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('alert')).toHaveText(/Usuário ou senha inválidos/);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sair encerra a sessão e volta ao login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Usuário').fill(ADMIN_USUARIO);
    await page.getByLabel('Senha').fill(ADMIN_SENHA);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole('button', { name: 'Sair' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
});
