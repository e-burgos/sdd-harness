import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    testTimeout: 30000,
    // setup-agents runs setup-rtk.mjs for real in the integration suites: never download
    // the rtk binary from a test (rtk.integration.spec.ts unsets this for its own server).
    env: { SDD_RTK_SKIP_INSTALL: '1' },
  },
});
