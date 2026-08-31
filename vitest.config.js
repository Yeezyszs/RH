import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      // Mede TODO o código de produção. O número fica baixo enquanto os
      // módulos não têm teste — é o retrato honesto, e o alvo é subi-lo aos
      // poucos (ver thresholds abaixo).
      include: ['src/**'],
      // Cola de UI/DOM: dependem de window/document/Chart e não são
      // exercitáveis por teste unitário sem um browser.
      exclude: [
        'src/utils/relatorio.js',
        'src/dashboard.js',
        'src/auth.js',
        'src/app.js',
        'src/data-store.js',
        'src/constants.js',
      ],
      reporter: ['text', 'html'],
      // Trava de regressão, não meta de qualidade: os números são o piso do
      // que já está coberto hoje. Ao cobrir mais código, suba o piso junto —
      // é assim que a cobertura cresce sem nunca voltar atrás.
      thresholds: {
        // Núcleo puro (mappers, rede, formatação, diagnóstico de carga):
        // exigimos alto, porque não há desculpa de DOM aqui.
        'src/utils/**': { lines: 95, functions: 95, branches: 85 },
        // Total do código de produção. Baixo e honesto: os módulos ainda são
        // majoritariamente não testados.
        lines: 6,
        functions: 45,
      },
    },
  },
});
