import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve('src') } },
  test: {
    environment: 'node',
    // Web tests plus the workspace packages (@bg/domain…), so `pnpm test` runs everything.
    include: ['tests/**/*.test.ts', 'packages/*/tests/**/*.test.ts'],
    exclude: ['tests/**/*.rules.test.ts'],
    restoreMocks: true,
  },
});
