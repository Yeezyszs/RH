import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Os módulos importam os utilitários com `?v=dev` — o marcador que o deploy
  // troca pelo hash do commit para furar o cache do navegador. Para o Vite,
  // `clima.js` e `clima.js?v=dev` são dois módulos, e o mesmo arquivo acaba
  // instrumentado duas vezes: a cobertura some com funções que O TESTE CHAMA,
  // só que pela outra cópia. Foi o que derrubou o CI com 92,63% de funções
  // enquanto o arquivo, medido sozinho, estava em 100%.
  //
  // Aqui o sufixo é removido na resolução, então teste e módulo falam com o
  // mesmo arquivo — e o número volta a medir o que de fato foi exercitado.
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
        'src/utils/**': { lines: 98, functions: 100, branches: 88 },
        // Total do código de produção. Baixo e honesto: os módulos ainda são
        // majoritariamente não testados.
        // Nota sobre `functions`: cobrir o primeiro método de um módulo grande
        // traz dezenas de métodos novos para o denominador e derruba o
        // percentual, mesmo o teste sendo um ganho. Quando isso acontecer,
        // ajuste o piso para o novo valor — o de `lines` é o indicador que
        // sobe de forma monotônica.
        lines: 35,
        functions: 60,
      },
    },
  },
});
