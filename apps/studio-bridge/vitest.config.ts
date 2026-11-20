import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-utils/studio-home.ts'],
    testTimeout: 30000,
  },
});
