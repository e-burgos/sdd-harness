import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '4399';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/start-bridge.mjs',
    url: `http://127.0.0.1:${PORT}/w/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
