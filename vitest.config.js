import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'tests/helpers.js'],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
      },
    },
  },
});
