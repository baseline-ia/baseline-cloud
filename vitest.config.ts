import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        // Run tests serially: they share a postgres DB
        singleFork: true,
      },
    },
    sequence: {
      // Run setup/teardown hooks around the whole file for DB lifecycle
      hooks: 'all',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'tests/**',
        '**/*.eta',
        'src/db/migrations/**',
      ],
    },
  },
});
