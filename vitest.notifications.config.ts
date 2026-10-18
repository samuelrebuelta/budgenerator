import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve('src') } },
  test: {
    environment: 'node',
    include: [
      'functions/tests/notificationPreferences.integration.test.ts',
      'functions/tests/leadNotificationJobs.integration.test.ts',
    ],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
