import { defineConfig, defineProject } from 'vitest/config';
import path from 'path';

const alias = { '@': path.resolve(__dirname, '.') };

export default defineConfig({
  test: {
    projects: [
      defineProject({
        resolve: { alias },
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          testTimeout: 30_000,
          hookTimeout: 30_000,
          include: ['lib/__tests__/**/*.test.ts'],
        },
      }),
      defineProject({
        resolve: { alias },
        test: {
          name: 'jsdom',
          globals: true,
          environment: 'jsdom',
          testTimeout: 30_000,
          hookTimeout: 30_000,
          include: ['app/**/*.test.tsx', 'app/**/*.test.ts'],
          setupFiles: ['./vitest.setup.ts'],
        },
      }),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/**', 'dist/**', 'coverage/**', '**/*.eta'],
    },
  },
});
