import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve('src') } },
  test: {
    environment: 'node',
    // Every Functions integration suite (notifications, account, abuse, retention).
    include: ['functions/tests/**/*.integration.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
