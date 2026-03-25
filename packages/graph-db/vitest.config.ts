import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@odyssage/graph-database': path.join(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.{ts,mts}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    pool: 'forks',
    maxWorkers: 4,
    testTimeout: 30000,
    maxConcurrency: 4,
  },
});
