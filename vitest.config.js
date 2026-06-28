import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'tests/helpers.js'],
      // relatorio.js é cola de UI/DOM (window, document, window.open) — não é
      // testável por unidade, assim como dashboard.js e os módulos (fora do escopo).
      exclude: ['src/utils/relatorio.js'],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
      },
    },
  },
});
