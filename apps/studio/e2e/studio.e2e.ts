import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const WORKSPACE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.e2e-workspace');
const PORT = process.env.E2E_PORT ?? '4399';
const TOKEN = 'e2e-token-0123456789abcdef';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sdd-studio:lang', 'es'));
});

test('pairs, chats with subagents, approves a tool, sees sdd-bot and runs /validate', async ({ page }) => {
  await page.goto(`/w/#bridge=${PORT}&token=${TOKEN}`);
  await expect(page.getByText('studio fixture').first()).toBeVisible();
  await expect(page).toHaveURL(/\/w\/$/);

  await page.getByPlaceholder('Escribí un mensaje… (/ para comandos)').fill('hola #sub #tool');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Planner empezó a trabajar')).toBeVisible();
  await expect(page.getByText('planned')).toBeVisible();
  await page.getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByText('Aprobado')).toBeVisible();
  await expect(page.getByText('echo: hola #sub #tool')).toBeVisible();

  const tasks = path.join(WORKSPACE, 'sdd/specs/spec-dev-001-pagos/cycles/cycle-01/tasks.json');
  const json = JSON.parse(await readFile(tasks, 'utf8'));
  json.tasks[1].status = 'done';
  await writeFile(tasks, JSON.stringify(json));
  await page.getByRole('button', { name: /# spec-dev-001-pagos/ }).click();
  await expect(page.getByText(/TASK-BE-002 «Tests de pagos»: pending → done/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('2/2 tasks').first()).toBeVisible();

  await page.getByPlaceholder('Escribí un mensaje… (/ para comandos)').fill('/validate');
  await page.keyboard.press('Enter');
  await expect(page.getByText('validate ok')).toBeVisible();
  await expect(page.getByText('terminó con código 0')).toBeVisible();
});

test('reloading keeps the pairing from sessionStorage', async ({ page }) => {
  await page.goto(`/w/#bridge=${PORT}&token=${TOKEN}`);
  await expect(page.getByText('studio fixture').first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('studio fixture').first()).toBeVisible();
});

test('a wrong token shows the pairing error', async ({ page }) => {
  await page.goto(`/w/#bridge=${PORT}&token=wrong-token-0000000000`);
  await expect(page.locator('p[role="alert"]')).toHaveText(/token/i);
});
