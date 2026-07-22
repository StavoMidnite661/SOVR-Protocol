// vitest configuration for integration tests
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    teardownTimeout: 30_000,
    pool: 'forks', // one test file per fork — server is shared
    poolOptions: { forks: { singleFork: true } },
  },
});
