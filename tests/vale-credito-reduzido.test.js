import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// O relatório da operadora não credita o valor cheio para todo mundo: quem teve
// falta ou advertência vem com valor menor. Esse desconto já está aplicado no
// crédito — registrar de novo como desconto cobraria a mesma falta duas vezes.
// Daí o terceiro tipo de lançamento, `no_credito`: dá motivo à diferença e
// alimenta o gráfico, sem mexer no saldo.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const pedaco = (de, ate, desde = 0) => {
  const i = html.indexOf(de, desde);
  return html.slice(i, html.indexOf(ate, i));
};

function montar({ colaboradores, cotas = {}, lancamentos = [], saldoIni = {} } = {}) {
  const pagina = pedaco('<!-- Créditos abaixo', '</section>');
  const modal  = pedaco('<div id="modal-vale-justificar"', '<!-- ════════════');

  const dom = new JSDOM(`<body>
    <select id="vale-mes"><option value="2026-08" selected>Ago/2026</option></select>
    <input id="vale-search"><select id="vale-filter-setor"></select>
    <div id="vale-stat-base"></div><div id="vale-stat-perdido"></div>
    <div id="vale-stat-adicionado"></div><div id="vale-stat-utilizado"></div>
    <div id="vale-stat-saldo"></div>
    ${pagina}${modal}
  </body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  return { dom, doc: dom.window.document, colaboradores, cotas, lancamentos, saldoIni };
}

async function criar(cfg) {
  const ctx = montar(cfg);
  const gravado = [];
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
    VALE_USO_MES: {},
    VALE_SALDO_INI: ctx.saldoIni,
    VALE_DESCONTOS: ctx.lancamentos,
    CONFIG: { vale_combustivel_valor_padrao: '150' },
    CHART_COLORS: { grid: '#eee' },
    Auth: { sessaoAtual: async () => ({ user: 'x' }) },
    ValeDescontos: {
      criar: async (p) => { const r = { id: 100 + gravado.length, ...p }; gravado.push(r); return r; },
      atualizar: async (id, p) => { const r = { id, ...p }; gravado.push(r); return r; },
    },
    showToast: (m, t) => { ctx.toast = [m, t]; },
  });
  return { mod, doc: ctx.doc, gravado, ctx };
}

const PESSOAS = [
  { id: 1, nome: 'Cheio',    setor: 'Produção', status: 'ativo' },
  { id: 2, nome: 'Reduzido', setor: 'Produção', status: 'ativo' },
];
// Agosto fechado: 1 recebeu os 150, 2 recebeu 105 (faltam 45).
const COTAS = { '1|2026-08': 150, '2|2026-08': 105 };
const base = { colaboradores: PESSOAS, cotas: COTAS, saldoIni: { '1|2026-08': 0, '2|2026-08': 0 } };

const justificativa = (over = {}) => ({
  id: 7, colaborador_id: 2, mes: 8, ano: 2026,
  tipo: 'no_credito', motivo: 'falta', valor: 45, observacoes: 'faltou dia 12', ...over,
});

describe('identificar quem recebeu abaixo do valor cheio', () => {
  it('marca a diferença até o valor padrão', async () => {
    const { mod } = await criar(base);
    const r = mod._resumoDoMes('2026-08').find(x => x.colab.id === 2);
    expect(r.abaixo).toBe(true);
    expect(r.faltando).toBe(45);
  });

  it('quem recebeu o valor cheio não entra na lista', async () => {
    const { mod } = await criar(base);
    expect(mod._resumoDoMes('2026-08').find(x => x.colab.id === 1).abaixo).toBe(false);
  });

  it('quem não recebeu nada não é "abaixo" — é sem benefício', async () => {
    // Zero não é desconto parcial: é gente que não está no relatório.
    const { mod } = await criar({ ...base, cotas: { '1|2026-08': 150, '2|2026-08': 0 } });
    expect(mod._resumoDoMes('2026-08').find(x => x.colab.id === 2).abaixo).toBe(false);
  });

  it('a competência ainda aberta não acusa ninguém', async () => {
    // Sem valores gravados todo mundo herda o padrão — nada a justificar.
    const { mod } = await criar({ colaboradores: PESSOAS });
    expect(mod._semJustificativa('2026-08')).toHaveLength(0);
  });

  it('sai da lista de pendentes quando tem motivo registrado', async () => {
    const { mod } = await criar({ ...base, lancamentos: [justificativa()] });
    expect(mod._semJustificativa('2026-08')).toHaveLength(0);
  });
});

describe('o alerta na tela', () => {
  it('aparece com a contagem e a diferença total', async () => {
    const { mod, doc } = await criar(base);
    mod.render();
    const txt = doc.querySelector('#vale-alerta-justificar').textContent;
    expect(txt).toContain('1 colaborador(es)');
    expect(txt).toContain('45.00');
  });

  it('some quando tudo está justificado', async () => {
    const { mod, doc } = await criar({ ...base, lancamentos: [justificativa()] });
    mod.render();
    expect(doc.querySelector('#vale-alerta-justificar').innerHTML).toBe('');
  });

  it('a linha pendente ganha selo e vai para o topo da tabela', async () => {
    const { mod, doc } = await criar(base);
    mod.render();
    const linhas = [...doc.querySelectorAll('#tb-vale-resumo tr')];
    expect(linhas[0].textContent).toContain('Reduzido');
    expect(linhas[0].textContent).toContain('Falta justificar');
  });

  it('depois de justificado o selo passa a mostrar o motivo', async () => {
    const { mod, doc } = await criar({ ...base, lancamentos: [justificativa()] });
    mod.render();
    const linha = [...doc.querySelectorAll('#tb-vale-resumo tr')]
      .find(tr => tr.textContent.includes('Reduzido'));
    expect(linha.textContent).toContain('Falta');
    expect(linha.textContent).not.toContain('Falta justificar');
  });
});

describe('o saldo não é cobrado duas vezes', () => {
  it('a justificativa não tira nada do saldo', async () => {
    // O crédito já veio 105: descontar 45 de novo cobraria a mesma falta duas
    // vezes e deixaria a pessoa com 60.
    const { mod } = await criar({ ...base, lancamentos: [justificativa()] });
    const r = mod._resumoDoMes('2026-08').find(x => x.colab.id === 2);
    expect(r.perdido).toBe(0);
    expect(r.saldo).toBe(105);
  });

  it('desconto lançado à mão continua tirando do saldo', async () => {
    const { mod } = await criar({ ...base, lancamentos: [
      justificativa(),
      { id: 8, colaborador_id: 2, mes: 8, ano: 2026, tipo: 'desconto', motivo: 'atraso', valor: 20 },
    ] });
    const r = mod._resumoDoMes('2026-08').find(x => x.colab.id === 2);
    expect(r.perdido).toBe(20);
    expect(r.saldo).toBe(85);
  });

  it('a justificativa não vira saldo anterior do mês seguinte', async () => {
    const { mod } = await criar({
      colaboradores: PESSOAS,
      cotas: { '2|2026-07': 105, '2|2026-08': 150 },
      saldoIni: { '2|2026-07': 0 },
      lancamentos: [justificativa({ mes: 7 })],
    });
    expect(mod._saldoAnterior(2, '2026-08')).toBe(105);
  });
});

describe('o gráfico conta a perda que já veio no crédito', () => {
  it('a perda entra no card de perdido do mês', async () => {
    const { mod, doc } = await criar({ ...base, lancamentos: [justificativa()] });
    mod.render();
    expect(doc.querySelector('#vale-stat-perdido').textContent).toBe('45.00');
  });

  it('soma na mesma barra do desconto lançado à mão', async () => {
    const { mod, doc } = await criar({ ...base, lancamentos: [
      justificativa(),                                                                 // 45 de falta
      { id: 8, colaborador_id: 1, mes: 8, ano: 2026, tipo: 'desconto', motivo: 'falta', valor: 30 },
    ] });
    mod.render();
    expect(doc.querySelector('#vale-stat-perdido').textContent).toBe('75.00');
  });

  it('motivo que não é penalidade fica de fora da perda', async () => {
    // Quem foi admitido no dia 10 recebe proporcional; chamar isso de perda
    // seria mentir no gráfico.
    const { mod, doc } = await criar({
      ...base, lancamentos: [justificativa({ motivo: 'admissao' })],
    });
    mod.render();
    expect(doc.querySelector('#vale-stat-perdido').textContent).toBe('0.00');
  });

  it('adição continua fora do gráfico de perdas', async () => {
    const { mod, doc } = await criar({ ...base, lancamentos: [
      { id: 9, colaborador_id: 1, mes: 8, ano: 2026, tipo: 'adicao', motivo: 'viagem', valor: 80 },
    ] });
    mod.render();
    expect(doc.querySelector('#vale-stat-perdido').textContent).toBe('0.00');
  });
});

describe('modal de justificativa em lote', () => {
  it('lista quem recebeu abaixo, com crédito e diferença', async () => {
    const { mod, doc } = await criar(base);
    mod.abrirModalJustificar();
    const linhas = [...doc.querySelectorAll('#tb-vale-justificar tr[data-colab]')];
    expect(linhas).toHaveLength(1);
    expect(linhas[0].textContent).toContain('105.00');
    expect(linhas[0].textContent).toContain('45.00');
  });

  it('não lista quem recebeu o valor cheio', async () => {
    const { mod, doc } = await criar(base);
    mod.abrirModalJustificar();
    expect(doc.querySelector('#tb-vale-justificar').textContent).not.toContain('Cheio');
  });

  it('grava motivo e observação com o valor da diferença', async () => {
    const { mod, doc, gravado } = await criar(base);
    mod.abrirModalJustificar();
    doc.querySelector('[data-just-motivo="2"]').value = 'falta';
    doc.querySelector('[data-just-obs="2"]').value = 'faltou dia 12';
    await mod.salvarJustificativas();
    expect(gravado).toHaveLength(1);
    expect(gravado[0]).toMatchObject({
      colaborador_id: 2, mes: 8, ano: 2026,
      tipo: 'no_credito', motivo: 'falta', valor: 45, observacoes: 'faltou dia 12',
    });
  });

  it('linha sem motivo continua pendente em vez de virar justificada', async () => {
    const { mod, gravado, ctx } = await criar(base);
    mod.abrirModalJustificar();
    await mod.salvarJustificativas();
    expect(gravado).toHaveLength(0);
    expect(ctx.toast[1]).toBe('err');
  });

  it('reabrir traz o motivo e a observação já gravados', async () => {
    const { mod, doc } = await criar({ ...base, lancamentos: [justificativa()] });
    mod.abrirModalJustificar();
    expect(doc.querySelector('[data-just-motivo="2"]').value).toBe('falta');
    expect(doc.querySelector('[data-just-obs="2"]').value).toBe('faltou dia 12');
  });

  it('editar uma justificativa atualiza em vez de duplicar', async () => {
    const { mod, doc, gravado } = await criar({ ...base, lancamentos: [justificativa()] });
    mod.abrirModalJustificar();
    doc.querySelector('[data-just-motivo="2"]').value = 'advertencia';
    await mod.salvarJustificativas();
    expect(gravado).toHaveLength(1);
    expect(gravado[0].id).toBe(7);
    expect(gravado[0].motivo).toBe('advertencia');
  });

  it('avisa quando não há nada a justificar na competência', async () => {
    const { mod, doc } = await criar({ colaboradores: PESSOAS });
    mod.abrirModalJustificar();
    expect(doc.querySelector('#tb-vale-justificar').textContent).toMatch(/Ninguém recebeu abaixo/);
  });
});
