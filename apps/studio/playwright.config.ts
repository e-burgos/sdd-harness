import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '4399';
const LAUNCHER_PORT = process.env.E2E_LAUNCHER_PORT ?? '4417';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/new-project.e2e.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${PORT}` },
    },
    {
      name: 'wizard',
      testMatch: '**/new-project.e2e.ts',
      retries: 0,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${LAUNCHER_PORT}` },
    },
  ],
  webServer: [
    {
      command: 'node e2e/start-bridge.mjs',
      url: `http://127.0.0.1:${PORT}/w/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'node e2e/start-launcher-bridge.mjs',
      url: `http://127.0.0.1:${LAUNCHER_PORT}/w/`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { E2E_LAUNCHER_PORT: LAUNCHER_PORT },
    },
  ],
});
