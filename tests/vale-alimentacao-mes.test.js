import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// A tela de vale alimentação tinha seletor de mês, mas ele não escolhia nada:
// os 12 meses anteriores apareciam na lista existissem ou não, e qualquer um
// que o RH escolhesse mostrava a configuração de HOJE. O mês só servia para
// contar os dias úteis.
//
// Agora a competência manda: a lista traz os meses que têm lançamento, e cada
// um mostra o que foi lançado nele.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const PAGINA = (() => {
  const ini = html.indexOf('<div class="toolbar">', html.indexOf('page-vale-alimentacao'));
  return html.slice(ini, html.indexOf('</section>', ini));
})();

const PESSOAS = [
  { id: 1, nome: 'Adão Ribeiro',  setor: 'Produção', status: 'ativo' },
  { id: 2, nome: 'Beatriz Nunes', setor: 'Produção', status: 'ativo' },
];

async function criar({ porMes = {}, vigente = {} } = {}) {
  const dom = new JSDOM(`<body><div id="page-vale-alimentacao">${PAGINA}</div></body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  const doc = dom.window.document;
  global.Chart = class { constructor() {} destroy() {} };

  const { ValeAlimentacaoModule } = await import('../src/modules/vale-alimentacao.js');
  const mod = new ValeAlimentacaoModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (d) => d || '—',
    fmtBRL: (v) => Number(v || 0).toFixed(2),
    mesLabel: (c) => c,
    // A `mesChave` de verdade do projeto: recebe ISO e corta. Usar um dublê
    // que devolve a competência pronta escondia que o módulo a chamava com um
    // objeto Date — o que só apareceu abrindo a tela no navegador.
    mesChave: (iso) => (iso ? iso.slice(0, 7) : ''),
    COLABORADORES: PESSOAS,
    VA_BENEFICIOS: vigente,
    VA_POR_MES: porMes,
    CHART_COLORS: { grid: '#eee', phthaloLight: '#2E7AB8', phthaloBright: '#4A9FD6' },
    Auth: { sessaoAtual: async () => null },
    ValeAlimentacao: null,
    showToast: () => {},
  });
  return { mod, doc };
}

// Relógio fixo: o mês corrente entra na lista do seletor, então sem isto a
// suíte passaria hoje e quebraria sozinha na virada do mês.
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-17T12:00:00')); });
afterEach(() => vi.useRealTimers());

const fixo = (valor) => ({ tipo: 'fixo', valor, dias_uteis: null, observacoes: '' });

const POR_MES = {
  '1|2026-08': fixo(360),
  '2|2026-08': fixo(360),
  '1|2026-06': fixo(330),
};
const VIGENTE = { 1: fixo(400), 2: fixo(400) };

const opcoes = (doc) => [...doc.querySelectorAll('#va-mes option')].map(o => o.value);
const linhaDe = (doc, nome) =>
  [...doc.querySelectorAll('#tb-vale-alimentacao tr')].find(tr => tr.textContent.includes(nome));

describe('seletor de competência', () => {
  it('lista os meses que têm lançamento, mais o corrente', async () => {
    const { mod, doc } = await criar({ porMes: POR_MES, vigente: VIGENTE });
    mod.render();
    expect(opcoes(doc)).toEqual(['2026-11', '2026-08', '2026-06']);
  });

  it('não inventa meses sem lançamento', async () => {
    // Antes a lista tinha os 12 meses anteriores, existissem ou não.
    const { mod, doc } = await criar({ porMes: POR_MES, vigente: VIGENTE });
    mod.render();
    expect(opcoes(doc)).not.toContain('2026-07');
    expect(opcoes(doc)).toHaveLength(3);
  });

  it('sem nenhum lançamento, resta o mês corrente', async () => {
    const { mod, doc } = await criar({ porMes: {}, vigente: VIGENTE });
    mod.render();
    expect(opcoes(doc)).toEqual(['2026-11']);
  });

  it('mantém o mês escolhido quando a tela re-renderiza', async () => {
    const { mod, doc } = await criar({ porMes: POR_MES, vigente: VIGENTE });
    mod.render();
    doc.querySelector('#va-mes').value = '2026-06';
    mod.render();
    expect(doc.querySelector('#va-mes').value).toBe('2026-06');
  });
});

describe('os valores seguem a competência escolhida', () => {
  const escolher = (mod, doc, mes) => {
    mod.render();
    doc.querySelector('#va-mes').value = mes;
    mod.render();
  };

  it('agosto mostra o que foi lançado em agosto, não o cadastro de hoje', async () => {
    const { mod, doc } = await criar({ porMes: POR_MES, vigente: VIGENTE });
    escolher(mod, doc, '2026-08');
    expect(linhaDe(doc, 'Adão').textContent).toContain('360.00');
    expect(linhaDe(doc, 'Adão').textContent).not.toContain('400.00');
  });

  it('junho mostra só quem teve lançamento em junho', async () => {
    // Em junho só o Adão teve lançamento (330). A Beatriz não aparece: a
    // competência veio do relatório da operadora, e o relatório é a lista de
    // quem recebeu. Completá-la com o cadastro de hoje inventava crédito —
    // era assim que gente admitida em agosto aparecia na tabela de janeiro.
    const { mod, doc } = await criar({ porMes: POR_MES, vigente: VIGENTE });
    escolher(mod, doc, '2026-06');
    expect(linhaDe(doc, 'Adão').textContent).toContain('330.00');
    expect(linhaDe(doc, 'Beatriz')).toBeUndefined();
  });

  it('o mês corrente, sem lançamento, mostra o cadastro vigente', async () => {
    const { mod, doc } = await criar({ porMes: POR_MES, vigente: VIGENTE });
    escolher(mod, doc, '2026-11');
    expect(linhaDe(doc, 'Adão').textContent).toContain('400.00');
  });

  it('o total do mês acompanha a competência', async () => {
    const { mod, doc } = await criar({ porMes: POR_MES, vigente: VIGENTE });
    escolher(mod, doc, '2026-08');
    const agosto = doc.querySelector('#tb-vale-alimentacao').textContent;
    escolher(mod, doc, '2026-11');
    const novembro = doc.querySelector('#tb-vale-alimentacao').textContent;
    expect(agosto).not.toBe(novembro);
  });

  it('sem cadastro e sem lançamento, a pessoa aparece como sem cadastro', async () => {
    const { mod, doc } = await criar({ porMes: {}, vigente: { 1: fixo(400) } });
    mod.render();
    expect(linhaDe(doc, 'Beatriz').textContent).toContain('Sem cadastro');
  });
});

describe('benefício por dia útil', () => {
  it('o cálculo usa os dias úteis da competência escolhida', async () => {
    // Fevereiro de 2026 tem 20 dias úteis; agosto, 21. O mesmo valor por dia
    // tem de dar totais diferentes — é para isso que o mês entra na conta.
    const porDia = { tipo: 'dia_util', valor: 10, dias_uteis: null, observacoes: '' };
    const { mod, doc } = await criar({
      porMes: { '1|2026-02': porDia, '1|2026-08': porDia },
      vigente: { 1: porDia },
    });
    mod.render();
    doc.querySelector('#va-mes').value = '2026-02';
    mod.render();
    const fev = linhaDe(doc, 'Adão').textContent;
    doc.querySelector('#va-mes').value = '2026-08';
    mod.render();
    const ago = linhaDe(doc, 'Adão').textContent;
    expect(fev).not.toBe(ago);
  });

  it('dias úteis gravados no lançamento mandam sobre o cálculo do mês', async () => {
    const { mod, doc } = await criar({
      porMes: { '1|2026-08': { tipo: 'dia_util', valor: 10, dias_uteis: 15 } },
      vigente: {},
    });
    mod.render();
    doc.querySelector('#va-mes').value = '2026-08';
    mod.render();
    expect(linhaDe(doc, 'Adão').textContent).toContain('150.00');
  });
});

// ─── A competência importada é a lista da operadora ─────────────────────────
//
// A tela partia sempre de todo mundo que está na casa HOJE e, na falta de
// lançamento, caía no cadastro vigente. Em janeiro apareciam pessoas admitidas
// em agosto, com o valor de hoje, como se tivessem recebido — e o gráfico de
// evolução repetia o mesmo total em todos os meses, porque só olhava o
// cadastro.

const ADMITIDA_EM_AGOSTO = { id: 3, nome: 'Larissa Marques', setor: 'Produção', status: 'ativo', data_admissao: '2026-08-18' };
const DESLIGADO = { id: 4, nome: 'Oswaldo Saiu', setor: 'Produção', status: 'inativo', data_admissao: '2020-01-02', data_desligamento: '2026-09-30' };

async function criarCom(pessoas, { porMes = {}, vigente = {} } = {}) {
  const dom = new JSDOM(`<body><div id="page-vale-alimentacao">${PAGINA}</div></body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  const doc = dom.window.document;
  global.Chart = class { constructor() {} destroy() {} };
  const { ValeAlimentacaoModule } = await import('../src/modules/vale-alimentacao.js');
  const mod = new ValeAlimentacaoModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (d) => d || '—',
    fmtBRL: (v) => Number(v || 0).toFixed(2),
    mesLabel: (c) => c,
    mesChave: (iso) => (iso ? iso.slice(0, 7) : ''),
    COLABORADORES: pessoas,
    VA_BENEFICIOS: vigente,
    VA_POR_MES: porMes,
    CHART_COLORS: { grid: '#eee', phthaloLight: '#2E7AB8', phthaloBright: '#4A9FD6' },
    Auth: { sessaoAtual: async () => null },
    ValeAlimentacao: null,
    showToast: () => {},
  });
  return { mod, doc };
}

describe('a competência importada traz só quem estava no relatório', () => {
  const PESSOAS_COM_LARISSA = [...PESSOAS, ADMITIDA_EM_AGOSTO];
  const JANEIRO = { '1|2026-01': fixo(441.92), '2|2026-01': fixo(300) };
  const VIG = { 1: fixo(400), 2: fixo(400), 3: fixo(360) };

  it('quem foi admitido depois não aparece no mês importado', async () => {
    const { mod, doc } = await criarCom(PESSOAS_COM_LARISSA, { porMes: JANEIRO, vigente: VIG });
    mod.render();
    doc.querySelector('#va-mes').value = '2026-01';
    mod.render();
    expect(linhaDe(doc, 'Adão')).toBeDefined();
    expect(linhaDe(doc, 'Larissa')).toBeUndefined();
  });

  it('a tabela tem exatamente as linhas do relatório', async () => {
    const { mod, doc } = await criarCom(PESSOAS_COM_LARISSA, { porMes: JANEIRO, vigente: VIG });
    mod.render();
    doc.querySelector('#va-mes').value = '2026-01';
    mod.render();
    expect(doc.querySelectorAll('#tb-vale-alimentacao tr')).toHaveLength(2);
    expect(doc.querySelector('#va-stat-benef').textContent).toBe('2');
    expect(doc.querySelector('#va-stat-folha').textContent).toBe('741.92');
  });

  it('quem já foi desligado continua no mês em que recebeu', async () => {
    // O relatório de janeiro é histórico: quem saiu em setembro recebeu em
    // janeiro, e tirá-lo da tabela faria a soma do mês não fechar com o PDF.
    const { mod, doc } = await criarCom([...PESSOAS, DESLIGADO], {
      porMes: { ...JANEIRO, '4|2026-01': fixo(200) }, vigente: VIG,
    });
    mod.render();
    doc.querySelector('#va-mes').value = '2026-01';
    mod.render();
    expect(linhaDe(doc, 'Oswaldo')).toBeDefined();
    expect(doc.querySelector('#va-stat-folha').textContent).toBe('941.92');
  });
});

describe('a competência sem lançamento nenhum segue o cadastro', () => {
  it('mas só para quem já tinha sido admitido', async () => {
    // Novembro ainda não foi creditado: aí a pergunta é mesmo "quanto está
    // combinado". Larissa entrou em agosto, então entra; num mês anterior à
    // admissão dela, não entraria.
    const { mod, doc } = await criarCom([...PESSOAS, ADMITIDA_EM_AGOSTO], {
      porMes: {}, vigente: { 1: fixo(400), 2: fixo(400), 3: fixo(360) },
    });
    mod.render();
    expect(linhaDe(doc, 'Larissa')).toBeDefined();
    expect(doc.querySelector('#va-stat-benef').textContent).toBe('3');
  });

  it('quem foi desligado antes do mês não aparece', async () => {
    const { mod, doc } = await criarCom([...PESSOAS, { ...DESLIGADO, status: 'ativo' }], {
      porMes: {}, vigente: { 1: fixo(400), 2: fixo(400), 4: fixo(400) },
    });
    mod.render();
    expect(linhaDe(doc, 'Oswaldo')).toBeUndefined();
  });
});
