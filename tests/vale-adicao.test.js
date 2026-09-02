import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// O vale só registrava o que TIRAVA do benefício. Passou a registrar também o
// que acrescenta — viagem, plantão, reembolso —, na mesma tabela, com um campo
// `tipo` definindo o sinal. Estes testes cobrem o cálculo e a tela.

function montar({ colaboradores, cotas = {}, uso = {}, saldoIni = {}, lancamentos = [] } = {}) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ini = html.indexOf('<!-- Tabela resumo -->', html.indexOf('page-vale-combustivel'));
  const fim = html.indexOf('</section>', ini);
  const modIni = html.indexOf('<div id="modal-vale-desconto"');
  const modFim = html.indexOf('<!-- ════════════', modIni);

  const dom = new JSDOM(`<body>
    <select id="vale-mes"><option value="2026-08">Ago/2026</option></select>
    <input id="vale-search"><select id="vale-filter-setor"></select>
    <canvas id="chart-vale-evolucao"></canvas>
    <div id="vale-stat-base"></div><div id="vale-stat-perdido"></div>
    <div id="vale-stat-adicionado"></div><div id="vale-stat-utilizado"></div>
    <div id="vale-stat-saldo"></div>
    ${html.slice(ini, fim)}${html.slice(modIni, modFim)}
  </body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  global.FormData = dom.window.FormData;
  return { dom, doc: dom.window.document, colaboradores, cotas, uso, saldoIni, lancamentos };
}

async function criar(cfg) {
  const ctx = montar(cfg);
  const { ValeCombustivelModule } = await import('../src/modules/vale-combustivel.js');
  const mod = new ValeCombustivelModule({
    $: (s) => ctx.doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (s) => s,
    fmtBRL: (v) => Number(v).toFixed(2),
    mesChave: (i) => i?.slice(0, 7),
    mesLabel: (c) => c,
    COLABORADORES: ctx.colaboradores,
    VALE_COTAS: {},
    VALE_COTAS_MES: ctx.cotas,
    VALE_USO_MES: ctx.uso,
    VALE_SALDO_INI: ctx.saldoIni,
    VALE_DESCONTOS: ctx.lancamentos,
    CONFIG: { vale_combustivel_valor_padrao: '150' },
    CHART_COLORS: { grid: '#eee' },
    showToast: () => {},
  });
  return { mod, doc: ctx.doc };
}

const PESSOA = { id: 1, nome: 'Fulano', setor: 'Produção', status: 'ativo' };
const lanc = (over) => ({
  id: 1, colaborador_id: 1, mes: 8, ano: 2026,
  tipo: 'desconto', motivo: 'falta', valor: 50, ...over,
});

describe('adição soma ao saldo', () => {
  const base = { colaboradores: [PESSOA], cotas: { '1|2026-08': 150 }, saldoIni: { '1|2026-08': 0 } };

  it('crédito 150 + adição 80 dá saldo 230', async () => {
    const { mod } = await criar({ ...base, lancamentos: [lanc({ tipo: 'adicao', motivo: 'viagem', valor: 80 })] });
    const r = mod._resumoDoMes('2026-08')[0];
    expect(r.adicionado).toBe(80);
    expect(r.saldo).toBe(230);
  });

  it('adição e desconto convivem na mesma competência', async () => {
    const { mod } = await criar({ ...base, lancamentos: [
      lanc({ id: 1, tipo: 'adicao',   motivo: 'viagem', valor: 80 }),
      lanc({ id: 2, tipo: 'desconto', motivo: 'falta',  valor: 50 }),
    ] });
    const r = mod._resumoDoMes('2026-08')[0];
    expect(r.adicionado).toBe(80);
    expect(r.perdido).toBe(50);
    expect(r.saldo).toBe(180);   // 150 + 80 − 50
  });

  it('a adição também cobre o consumo do mês', async () => {
    const { mod } = await criar({
      ...base, uso: { '1|2026-08': 200 },
      lancamentos: [lanc({ tipo: 'adicao', motivo: 'plantao', valor: 100 })],
    });
    // 150 + 100 − 200 = 50
    expect(mod._resumoDoMes('2026-08')[0].saldo).toBe(50);
  });

  it('lançamento sem tipo gravado conta como desconto', async () => {
    // Compatibilidade: os registros criados antes da coluna existir.
    const semTipo = { id: 9, colaborador_id: 1, mes: 8, ano: 2026, motivo: 'falta', valor: 40 };
    const { mod } = await criar({ ...base, lancamentos: [semTipo] });
    const r = mod._resumoDoMes('2026-08')[0];
    expect(r.perdido).toBe(40);
    expect(r.adicionado).toBe(0);
    expect(r.saldo).toBe(110);
  });
});

describe('adição entra no acúmulo entre competências', () => {
  it('a adição de um mês vira saldo anterior do seguinte', async () => {
    const { mod } = await criar({
      colaboradores: [PESSOA],
      cotas: { '1|2026-07': 150, '1|2026-08': 150 },
      saldoIni: { '1|2026-07': 0 },
      lancamentos: [lanc({ mes: 7, tipo: 'adicao', motivo: 'viagem', valor: 100 })],
    });
    // Julho fecha com 150 + 100 = 250, que abre agosto.
    expect(mod._saldoAnterior(1, '2026-08')).toBe(250);
    expect(mod._resumoDoMes('2026-08')[0].saldo).toBe(400);
  });

  it('saldo de abertura gravado ignora a adição anterior', async () => {
    const { mod } = await criar({
      colaboradores: [PESSOA],
      cotas: { '1|2026-07': 150, '1|2026-08': 150 },
      saldoIni: { '1|2026-07': 0, '1|2026-08': 0 },
      lancamentos: [lanc({ mes: 7, tipo: 'adicao', motivo: 'viagem', valor: 100 })],
    });
    expect(mod._saldoAnterior(1, '2026-08')).toBe(0);
  });
});

describe('modal de lançamento serve aos dois tipos', () => {
  let mod, doc;
  beforeEach(async () => {
    ({ mod, doc } = await criar({
      colaboradores: [PESSOA], cotas: { '1|2026-08': 150 }, saldoIni: { '1|2026-08': 0 },
    }));
  });

  it('abre como desconto e oferece os motivos de desconto', () => {
    mod.abrirModalDesconto(null, 1, 'desconto');
    const motivos = [...doc.querySelectorAll('#form-vale-desconto [name="motivo"] option')].map(o => o.value);
    expect(motivos).toContain('advertencia');
    expect(motivos).not.toContain('viagem');
    expect(doc.querySelector('#modal-vale-desconto-title').textContent).toBe('Lançar desconto');
  });

  it('abre como adição e troca a lista de motivos', () => {
    mod.abrirModalDesconto(null, 1, 'adicao');
    const motivos = [...doc.querySelectorAll('#form-vale-desconto [name="motivo"] option')].map(o => o.value);
    expect(motivos).toContain('viagem');
    expect(motivos).toContain('reembolso');
    // "Advertência" não faz sentido como motivo para acrescentar valor.
    expect(motivos).not.toContain('advertencia');
    expect(doc.querySelector('#modal-vale-desconto-title').textContent).toBe('Lançar adição');
  });

  it('o rótulo do valor muda conforme o tipo', () => {
    mod.abrirModalDesconto(null, 1, 'adicao');
    expect(doc.querySelector('#vdesc-lbl-valor').textContent).toContain('acrescentar');
    mod.abrirModalDesconto(null, 1, 'desconto');
    expect(doc.querySelector('#vdesc-lbl-valor').textContent).toContain('descontado');
  });

  it('trocar o tipo no formulário reconfigura os motivos', () => {
    mod.abrirModalDesconto(null, 1, 'desconto');
    const form = doc.querySelector('#form-vale-desconto');
    form.elements['tipo'].value = 'adicao';
    mod.atualizarCamposLancamento();
    const motivos = [...form.elements['motivo'].options].map(o => o.value);
    expect(motivos).toContain('viagem');
  });

  it('ao editar, respeita o tipo do registro em vez do pedido', async () => {
    ({ mod, doc } = await criar({
      colaboradores: [PESSOA], cotas: { '1|2026-08': 150 }, saldoIni: { '1|2026-08': 0 },
      lancamentos: [lanc({ id: 7, tipo: 'adicao', motivo: 'viagem', valor: 80 })],
    }));
    mod.abrirModalDesconto(7, null, 'desconto');   // pedido errado de propósito
    expect(doc.querySelector('#modal-vale-desconto-title').textContent).toBe('Editar adição');
    expect(doc.querySelector('#form-vale-desconto').elements['motivo'].value).toBe('viagem');
  });
});

describe('a tela mostra a adição', () => {
  it('a célula de crédito traz a adição como complemento', async () => {
    const { mod, doc } = await criar({
      colaboradores: [PESSOA], cotas: { '1|2026-08': 150 }, saldoIni: { '1|2026-08': 0 },
      lancamentos: [lanc({ tipo: 'adicao', motivo: 'viagem', valor: 80 })],
    });
    mod.render();
    expect(doc.querySelector('#tb-vale-resumo tr').textContent).toContain('80.00');
  });

  it('o card de adições soma a competência', async () => {
    const { mod, doc } = await criar({
      colaboradores: [PESSOA], cotas: { '1|2026-08': 150 }, saldoIni: { '1|2026-08': 0 },
      lancamentos: [
        lanc({ id: 1, tipo: 'adicao', motivo: 'viagem', valor: 80 }),
        lanc({ id: 2, tipo: 'adicao', motivo: 'bonus',  valor: 20 }),
      ],
    });
    mod.render();
    expect(doc.querySelector('#vale-stat-adicionado').textContent).toBe('100.00');
  });
});
