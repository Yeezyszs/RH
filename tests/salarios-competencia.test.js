import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// `salario_atual` guarda um valor só por pessoa — o de hoje. Importar outubro
// por cima de setembro apagava setembro. O histórico por competência guarda o
// que cada folha disse, e é dele que sai o seletor de mês da tela de Salários.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const PAGINA = (() => {
  const ini = html.indexOf('<div class="toolbar">', html.indexOf('page-salarios'));
  return html.slice(ini, html.indexOf('</section>', ini));
})();

const PESSOAS = [
  { id: 1, nome: 'Adão Ribeiro',   matricula: '23', setor: 'Produção', status: 'ativo' },
  { id: 2, nome: 'Beatriz Nunes',  matricula: '24', setor: 'Produção', status: 'ativo' },
  { id: 3, nome: 'Carlos Saiu',    matricula: '25', setor: 'Admin',    status: 'inativo' },
];

const FAIXAS = [
  { short: 'até 2k' }, { short: '2–3,5k' }, { short: '3,5–5k' }, { short: '5–7,5k' }, { short: '7,5k+' },
];

async function criar({ salarios = {}, hist = [] } = {}) {
  const dom = new JSDOM(`<body><div id="page-salarios">${PAGINA}</div></body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  const doc = dom.window.document;

  const { SalariosModule } = await import('../src/modules/salarios.js');
  const mod = new SalariosModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (s) => s || '—',
    fmtBRL: (v) => Number(v).toFixed(2),
    mesLabel: (c) => c,
    faixaIdx: (v) => (v < 2000 ? 0 : v < 3500 ? 1 : v < 5000 ? 2 : v < 7500 ? 3 : 4),
    COLABORADORES: PESSOAS,
    SALARIOS: salarios,
    FOLHA_HIST: hist,
    FAIXAS,
    CHART_COLORS: { grid: '#eee' },
    Auth: { sessaoAtual: async () => null },
    Salarios: null,
  });
  return { mod, doc };
}

const HIST = [
  { colaborador_id: 1, competencia: '2026-09', salario_base: 3674.64, liquido: 2120.63 },
  { colaborador_id: 2, competencia: '2026-09', salario_base: 2800,    liquido: 1936.23 },
  { colaborador_id: 3, competencia: '2026-09', salario_base: 2000,    liquido: 1500 },
  { colaborador_id: 1, competencia: '2026-08', salario_base: 3500,    liquido: 2000 },
  { colaborador_id: 2, competencia: '2026-08', salario_base: 2800,    liquido: 1900 },
];

// A tela precisa ter renderizado uma vez para o seletor ter as opções — é o
// que acontece de verdade: o usuário abre Salários e só então escolhe o mês.
function escolher(mod, doc, competencia) {
  mod.render();
  doc.querySelector('#sal-competencia').value = competencia;
  mod.render();
}

const nomes  = (doc) => [...doc.querySelectorAll('#tb-salarios .cell-person-name')].map(e => e.textContent);
const opcoes = (doc) => [...doc.querySelectorAll('#sal-competencia option')].map(o => o.value);

describe('o seletor de competências', () => {
  it('fica escondido enquanto não há folha importada', async () => {
    const { mod, doc } = await criar();
    mod.render();
    expect(doc.querySelector('#sal-competencia').style.display).toBe('none');
  });

  it('aparece com as competências importadas, da mais nova para a mais antiga', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    mod.render();
    expect(doc.querySelector('#sal-competencia').style.display).not.toBe('none');
    expect(opcoes(doc)).toEqual(['', '2026-09', '2026-08']);
  });

  it('começa no salário atual do cadastro', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    mod.render();
    expect(doc.querySelector('#sal-competencia').value).toBe('');
  });

  it('mantém a competência escolhida entre renders', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    mod.render();
    escolher(mod, doc, '2026-08');
    expect(doc.querySelector('#sal-competencia').value).toBe('2026-08');
  });
});

describe('vendo o salário atual (cadastro)', () => {
  it('mostra o valor do cadastro e só quem está no efetivo', async () => {
    const { mod, doc } = await criar({ salarios: { 1: { valor: 4000 } }, hist: HIST });
    mod.render();
    expect(nomes(doc).sort()).toEqual(['Adão Ribeiro', 'Beatriz Nunes']);
    expect(doc.querySelector('#tb-salarios').textContent).toContain('4000.00');
  });

  it('a linha abre o modal de edição', async () => {
    const { mod, doc } = await criar({ salarios: { 1: { valor: 4000 } } });
    mod.render();
    const linha = [...doc.querySelectorAll('#tb-salarios tr')][0];
    expect(linha.getAttribute('onclick')).toContain('abrirModalSalario');
  });
});

describe('vendo uma competência passada', () => {
  it('mostra o salário daquela folha, não o de hoje', async () => {
    const { mod, doc } = await criar({ salarios: { 1: { valor: 9999 } }, hist: HIST });
    escolher(mod, doc, '2026-08');
    const txt = doc.querySelector('#tb-salarios').textContent;
    expect(txt).toContain('3500.00');
    expect(txt).not.toContain('9999');
  });

  it('inclui quem saiu depois — a folha daquele mês tinha essa pessoa', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-09');
    expect(nomes(doc)).toContain('Carlos Saiu');
  });

  it('não inclui quem não estava naquela folha', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-08');
    expect(nomes(doc)).not.toContain('Carlos Saiu');
  });

  it('os totais são os daquela competência', async () => {
    const { mod, doc } = await criar({ salarios: { 1: { valor: 9999 } }, hist: HIST });
    escolher(mod, doc, '2026-08');
    expect(doc.querySelector('#sal-stat-total').textContent).toBe('6300.00');
  });

  it('a última coluna passa a ser o líquido do mês', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-09');
    expect(doc.querySelector('#sal-th-ultima').textContent).toBe('Líquido do mês');
    expect(doc.querySelector('#tb-salarios').textContent).toContain('2120.63');
  });

  it('não dá para editar o passado', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-09');
    const linhas = [...doc.querySelectorAll('#tb-salarios tr')];
    expect(linhas.every(l => !l.getAttribute('onclick'))).toBe(true);
    expect(doc.querySelector('#tb-salarios button')).toBeNull();
  });

  it('avisa, em texto, que a tela está no passado e soma o líquido pago', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-09');
    const aviso = doc.querySelector('#sal-aviso-historico');
    expect(aviso.style.display).not.toBe('none');
    expect(aviso.textContent).toContain('2026-09');
    expect(aviso.textContent).toContain('5556.86');   // 2120,63 + 1936,23 + 1500
  });

  it('o aviso some ao voltar para o salário atual', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-09');
    doc.querySelector('#sal-competencia').value = '';
    mod.render();
    expect(doc.querySelector('#sal-aviso-historico').style.display).toBe('none');
  });

  it('o card de "sem salário" vira a contagem de quem estava na folha', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-09');
    expect(doc.querySelector('#sal-stat-sem-label').textContent).toBe('Pessoas na folha');
    expect(doc.querySelector('#sal-stat-sem').textContent).toBe('3');
  });

  it('a busca continua valendo dentro da competência', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    doc.querySelector('#sal-competencia').value = '2026-09';
    doc.querySelector('#sal-search').value = 'beatriz';
    mod.render();
    expect(nomes(doc)).toEqual(['Beatriz Nunes']);
  });
});
