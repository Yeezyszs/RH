import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// Cabeçalho e corpo da tabela vivem em arquivos diferentes: os <th> no
// index.html e os <td> no template do módulo. Mexer num e esquecer o outro
// desalinha as colunas silenciosamente — os valores aparecem sob os rótulos
// errados, sem nenhum erro. Este teste renderiza a tabela de verdade e compara.

let doc, mod;

beforeAll(async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ini = html.indexOf('<!-- Tabela resumo -->', html.indexOf('page-vale-combustivel'));
  const fim = html.indexOf('</section>', ini);

  const dom = new JSDOM(`<body>
    <select id="vale-mes"><option value="2026-08">Ago/2026</option></select>
    <input id="vale-search"><select id="vale-filter-setor"></select>
    <canvas id="chart-vale-evolucao"></canvas>
    ${html.slice(ini, fim)}
  </body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  doc = dom.window.document;

  const { ValeCombustivelModule } = await import('../src/modules/vale-combustivel.js');
  mod = new ValeCombustivelModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (s) => s,
    fmtBRL: (v) => `R$ ${v}`,
    mesChave: (i) => i?.slice(0, 7),
    mesLabel: (c) => c,
    COLABORADORES: [
      { id: 1, nome: 'Fulano', setor: 'Produção', status: 'ativo' },
      { id: 2, nome: 'Ciclano', setor: 'Logística', status: 'ativo' },
    ],
    VALE_COTAS: {},
    VALE_COTAS_MES: { '1|2026-08': 150, '2|2026-08': 150 },
    VALE_USO_MES: { '1|2026-08': 40 },
    VALE_SALDO_INI: { '1|2026-08': 0, '2|2026-08': 0 },
    VALE_DESCONTOS: [{ id: 9, colaborador_id: 2, mes: 8, ano: 2026, motivo: 'falta', valor: 50 }],
    CONFIG: { vale_combustivel_valor_padrao: '150' },
    CHART_COLORS: { grid: '#eee' },
    showToast: () => {},
  });
  mod.render();
});

const cabecalhos = () => [...doc.querySelectorAll('thead th')].map(t => t.textContent.trim());
const primeiraLinha = () => [...doc.querySelectorAll('#tb-vale-resumo tr:first-child td')];

describe('tabela do vale combustível', () => {
  it('tem exatamente as colunas pedidas', () => {
    expect(cabecalhos()).toEqual([
      'Colaborador', 'Saldo anterior', 'Crédito', 'Status',
    ]);
  });

  it('as colunas removidas não voltaram', () => {
    const titulos = cabecalhos();
    expect(titulos).not.toContain('Utilizado');
    expect(titulos).not.toContain('Descontos');
    expect(titulos).not.toContain('Ações');
    expect(titulos).not.toContain('Saldo acumulado');
  });

  it('o corpo tem o mesmo número de células que o cabeçalho', () => {
    expect(primeiraLinha()).toHaveLength(cabecalhos().length);
  });

  it('renderiza uma linha por colaborador', () => {
    expect(doc.querySelectorAll('#tb-vale-resumo tr')).toHaveLength(2);
  });
});

describe('os valores continuam corretos sem as colunas', () => {
  // Nenhum destes aparece mais como coluna, mas todos seguem no cálculo: o
  // saldo acumulado é o que passa para o mês seguinte e alimenta a coluna
  // "Saldo anterior" da competência seguinte, além do card de estatística.
  it('o consumo segue descontado do saldo, mesmo sem coluna própria', () => {
    // Fulano: crédito 150, utilizou 40 → saldo 110.
    const r = mod._resumoDoMes('2026-08').find(x => x.colab.id === 1);
    expect(r.utilizado).toBe(40);
    expect(r.saldo).toBe(110);
  });

  it('o desconto segue reduzindo o saldo, mesmo sem coluna própria', () => {
    // Ciclano: crédito 150, desconto de falta 50 → saldo 100.
    const r = mod._resumoDoMes('2026-08').find(x => x.colab.id === 2);
    expect(r.perdido).toBe(50);
    expect(r.saldo).toBe(100);
  });

  it('o status ainda reflete o desconto', () => {
    const linhas = [...doc.querySelectorAll('#tb-vale-resumo tr')];
    const textos = linhas.map(l => l.textContent);
    expect(textos.some(t => t.includes('Parcial'))).toBe(true);
  });
});
