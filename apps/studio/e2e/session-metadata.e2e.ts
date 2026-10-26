import { expect, test } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '4399';
const TOKEN = 'e2e-token-0123456789abcdef';
const COMPOSER = 'Type a message… (/ for commands)';
const DOCUMENT = 'fake-bash-doc.md';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sdd-studio:lang', 'en'));
  await page.goto(`/w/#bridge=${PORT}&token=${TOKEN}`);
  await expect(page.getByText('studio fixture').first()).toBeVisible();
});

test('a document written through Bash shows up in the conversation as recorded by the bridge', async ({ page }) => {
  await page.getByPlaceholder(COMPOSER).fill('crea el doc #bash-doc');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('thread-scroller').getByText('echo: crea el doc #bash-doc')).toBeVisible();

  const documents = page.getByTestId('related-documents');
  await expect(documents.getByRole('button', { name: new RegExp(DOCUMENT.replace('.', '\\.')) })).toBeVisible({ timeout: 10_000 });
  await expect(documents.getByRole('button', { name: new RegExp(DOCUMENT.replace('.', '\\.')) })).toHaveCount(1);
  await expect(documents.getByTestId('document-op-created')).toBeVisible();
  await expect(documents.getByTestId('related-documents-source')).toHaveText(/recorded by the bridge/i);
  await expect(page.getByTestId('capability-notice')).toHaveCount(0);
});

test('a thread that changes no document lists none', async ({ page }) => {
  await page.getByPlaceholder(COMPOSER).fill('solo conversacion');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('thread-scroller').getByText('echo: solo conversacion')).toBeVisible();

  const documents = page.getByTestId('related-documents');
  await expect(documents).toBeVisible();
  await expect(documents.getByRole('button', { name: new RegExp(DOCUMENT.replace('.', '\\.')) })).toHaveCount(0);
  await expect(documents.getByTestId('document-op-created')).toHaveCount(0);
});
