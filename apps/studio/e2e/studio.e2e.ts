import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const WORKSPACE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.e2e-workspace');
const PORT = process.env.E2E_PORT ?? '4399';
const TOKEN = 'e2e-token-0123456789abcdef';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sdd-studio:lang', 'en'));
});

test('pairs, chats with subagents, approves a tool, sees sdd-bot and runs /validate', async ({ page }) => {
  await page.goto(`/w/#bridge=${PORT}&token=${TOKEN}`);
  await expect(page.getByText('studio fixture').first()).toBeVisible();
  await expect(page).toHaveURL(/\/w\/$/);

  await page.getByPlaceholder('Type a message… (/ for commands)').fill('hola #sub #tool');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Chronos started working')).toBeVisible();
  await expect(page.getByTestId('thread-scroller').getByText('planned')).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Approved')).toBeVisible();
  await expect(page.getByTestId('thread-scroller').getByText('echo: hola #sub #tool')).toBeVisible();

  const tasks = path.join(WORKSPACE, 'sdd/specs/spec-dev-001-pagos/cycles/cycle-01/tasks.json');
  const json = JSON.parse(await readFile(tasks, 'utf8'));
  json.tasks[1].status = 'done';
  await writeFile(tasks, JSON.stringify(json));
  await page.getByRole('button', { name: /^spec-dev-001-pagos , / }).click();
  await expect(page.getByText(/TASK-BE-002 “Tests de pagos”: pending → done/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('2/2 tasks').first()).toBeVisible();

  await page.getByPlaceholder('Type a message… (/ for commands)').fill('/validate');
  await page.keyboard.press('Enter');
  await expect(page.getByText('validate ok')).toBeVisible();
  await expect(page.getByText('exited with code 0')).toBeVisible();
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

const COMPOSER = 'Type a message… (/ for commands)';
const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('sends an image and a text file, sees them in the timeline and after reload, and the engine receives them', async ({ page }) => {
  await page.goto(`/w/#bridge=${PORT}&token=${TOKEN}`);
  await expect(page.getByText('studio fixture').first()).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles([
    { name: 'pixel.png', mimeType: 'image/png', buffer: PIXEL_PNG },
    { name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('contenido de la nota') },
  ]);
  await expect(page.getByText('2/5 attachments')).toBeVisible();
  await page.getByPlaceholder(COMPOSER).fill('mirá esto');
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('thread-scroller').getByText('echo: mirá esto [attachments: pixel.png, nota.txt]')).toBeVisible();
  await expect(page.getByRole('img', { name: 'pixel.png' }).last()).toBeVisible();
  await expect(page.getByText('nota.txt', { exact: true }).last()).toBeVisible();

  await page.reload();
  await page.getByText('mirá esto').first().click();
  await expect(page.getByRole('img', { name: 'pixel.png' }).last()).toBeVisible();
});

test('@ lists workspace files and agents, and a mentioned agent reaches the engine as a ref', async ({ page }) => {
  await page.goto(`/w/#bridge=${PORT}&token=${TOKEN}`);
  await expect(page.getByText('studio fixture').first()).toBeVisible();
  const box = page.getByPlaceholder(COMPOSER);

  await box.fill('mirá @pagos');
  await expect(page.getByRole('option', { name: /spec-dev-001-pagos\.spec\.md/ })).toBeVisible();
  await box.press('Escape');

  await box.fill('@sdd-pl');
  await expect(page.getByRole('option', { name: /@sdd-planner/ })).toBeVisible();
  await box.press('Enter');
  await expect(box).toHaveValue('@sdd-planner ');
  await box.type('revisá esto');
  await box.press('Enter');
  await expect(page.getByTestId('thread-scroller').getByText('echo: @sdd-planner revisá esto [refs: @sdd-planner]')).toBeVisible();
});

test('a skill created while the bridge runs shows up in the / menu and travels as a ref', async ({ page }) => {
  await page.goto(`/w/#bridge=${PORT}&token=${TOKEN}`);
  await expect(page.getByText('studio fixture').first()).toBeVisible();
  const skillDir = path.join(WORKSPACE, '.claude/skills/checklist');
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: checklist\ndescription: Lista de control\n---\ncuerpo\n');
  const box = page.getByPlaceholder(COMPOSER);
  await expect(async () => {
    await box.fill('/checkl');
    await expect(page.getByRole('option', { name: /\/checklist/ })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await box.press('Tab');
  await box.type('el cambio');
  await box.press('Enter');
  await expect(page.getByTestId('thread-scroller').getByText('echo: el cambio [refs: /checklist]')).toBeVisible();
});
