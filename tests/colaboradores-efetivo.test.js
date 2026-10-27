import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { statusCasa } from './helpers-efetivo.js';

// O card de cabeçalho da tela de Colaboradores é o número que sai como
// "quantos funcionários a empresa tem" no relatório impresso. Ele contava só
// status = 'ativo', então saía menor do que é: afastado tem contrato suspenso,
// não encerrado, e continua sendo funcionário. Férias, pela mesma razão.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const STATS = (() => {
  const ini = html.indexOf('<!-- Stats -->', html.indexOf('page-colaboradores'));
  return html.slice(ini, html.indexOf('<!-- Tabela -->', ini));
})();

async function criar(pessoas) {
  const dom = new JSDOM(`<body>
    ${STATS}
    <table><tbody id="tb-colaboradores"></tbody></table>
    <div id="col-pagination-bar"></div>
  </body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  const doc = dom.window.document;

  const { ColaboradoresModule } = await import('../src/modules/colaboradores.js');
  const mod = new ColaboradoresModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (s) => s || '—',
    COLABORADORES: pessoas,
    STATUS_LABEL: {
      ativo:    { t: 'Ativo',    cls: 'ok' },
      ferias:   { t: 'Férias',   cls: 'info' },
      afastado: { t: 'Afastado', cls: 'warn' },
      inativo:  { t: 'Inativo',  cls: 'neutral' },
    },
    statusCasa,
    Auth: { sessaoAtual: async () => null },
    Colaboradores: null,
    Departamentos: null,
    showToast: () => {},
  });
  return { mod, doc };
}

const hoje = new Date();
const esteMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-05`;

const PESSOAS = [
  { id: 1, nome: 'Ativo Um',   matricula: '000001', setor: 'Produção', status: 'ativo',    admissao: '2020-01-10' },
  { id: 2, nome: 'Ativo Dois', matricula: '000002', setor: 'Produção', status: 'ativo',    admissao: esteMes },
  { id: 3, nome: 'De Férias',  matricula: '000003', setor: 'Produção', status: 'ferias',   admissao: '2019-03-01' },
  { id: 4, nome: 'Afastado',   matricula: '000004', setor: 'Admin',    status: 'afastado', admissao: '2018-06-01' },
  { id: 5, nome: 'Afastada',   matricula: '000005', setor: 'Admin',    status: 'afastado', admissao: '2021-02-01' },
  { id: 6, nome: 'Desligado',  matricula: '000006', setor: 'Admin',    status: 'inativo',  admissao: '2017-01-01' },
];

const valor = (doc, id) => doc.querySelector('#' + id).textContent;

describe('o efetivo inclui os afastados', () => {
  it('conta ativos, férias e afastados — e só eles', async () => {
    // 2 ativos + 1 férias + 2 afastados = 5. O desligado fica fora.
    const { mod, doc } = await criar(PESSOAS);
    mod._updateStats(PESSOAS);
    expect(valor(doc, 'stat-efetivo')).toBe('5');
  });

  it('férias e afastados continuam com número próprio', async () => {
    const { mod, doc } = await criar(PESSOAS);
    mod._updateStats(PESSOAS);
    expect(valor(doc, 'stat-ferias')).toBe('1');
    expect(valor(doc, 'stat-afastados')).toBe('2');
  });

  it('o efetivo não deixa o desligado entrar', async () => {
    const { mod, doc } = await criar(PESSOAS);
    mod._updateStats([...PESSOAS,
      { id: 7, nome: 'Outro desligado', matricula: '7', setor: 'X', status: 'inativo', admissao: '2016-01-01' }]);
    expect(valor(doc, 'stat-efetivo')).toBe('5');
  });

  it('status desconhecido não entra no efetivo por acidente', async () => {
    const { mod, doc } = await criar(PESSOAS);
    mod._updateStats([...PESSOAS,
      { id: 8, nome: 'Aposentado', matricula: '8', setor: 'X', status: 'aposentado', admissao: '2015-01-01' }]);
    expect(valor(doc, 'stat-efetivo')).toBe('5');
  });

  it('empresa só de afastados ainda tem efetivo', async () => {
    const { mod, doc } = await criar(PESSOAS);
    mod._updateStats([PESSOAS[3], PESSOAS[4]]);
    expect(valor(doc, 'stat-efetivo')).toBe('2');
  });

  it('admitidos no mês segue contando só o mês corrente', async () => {
    const { mod, doc } = await criar(PESSOAS);
    mod._updateStats(PESSOAS);
    expect(valor(doc, 'stat-admitidos')).toBe('1');
  });
});

describe('o card diz o que está contando', () => {
  it('o rótulo é Efetivo, não Ativos', async () => {
    // Chamar de "Ativos" um número que inclui afastados seria mentir no papel.
    const { doc } = await criar(PESSOAS);
    expect(doc.querySelector('#stat-efetivo').closest('.stat').textContent)
      .toContain('Efetivo');
    expect(doc.querySelector('#stat-ativos')).toBeNull();
  });

  it('explica a composição embaixo do número', async () => {
    const { doc } = await criar(PESSOAS);
    expect(doc.querySelector('#stat-efetivo').closest('.stat').textContent)
      .toContain('ativos, em férias e afastados');
  });

  it('marca férias e afastados como recorte do efetivo', async () => {
    const { doc } = await criar(PESSOAS);
    expect(doc.querySelector('#stat-ferias').closest('.stat').textContent).toContain('do efetivo');
    expect(doc.querySelector('#stat-afastados').closest('.stat').textContent).toContain('do efetivo');
  });
});

describe('a lista continua mostrando o afastado', () => {
  it('a linha sai com o selo do status dele', async () => {
    const { mod, doc } = await criar(PESSOAS);
    doc.querySelector('#tb-colaboradores').innerHTML = mod._renderLinhas(PESSOAS);
    const linha = [...doc.querySelectorAll('#tb-colaboradores tr')]
      .find(tr => tr.textContent.includes('Afastado'));
    expect(linha).toBeDefined();
    expect(linha.querySelector('.badge').textContent).toBe('Afastado');
  });
});

describe('a data de nascimento na lista e no relatório', () => {
  const COM_NASCIMENTO = PESSOAS.map((p, i) => ({
    ...p, nascimento: i === 0 ? '1985-03-14' : '1990-07-02',
  }));

  it('cada linha traz a data de nascimento', async () => {
    const { mod, doc } = await criar(COM_NASCIMENTO);
    doc.querySelector('#tb-colaboradores').innerHTML = mod._renderLinhas(COM_NASCIMENTO);
    const linha = [...doc.querySelectorAll('#tb-colaboradores tr')][0];
    expect(linha.textContent).toContain('1985-03-14');
  });

  it('a coluna fica entre o setor e a admissão', async () => {
    // A ordem importa: o relatório impresso sai com as colunas desta ordem.
    const { mod, doc } = await criar(COM_NASCIMENTO);
    doc.querySelector('#tb-colaboradores').innerHTML = mod._renderLinhas([COM_NASCIMENTO[0]]);
    const celulas = [...doc.querySelectorAll('#tb-colaboradores tr td')].map(td => td.textContent.trim());
    expect(celulas[2]).toBe('1985-03-14');
    expect(celulas[3]).toBe('2020-01-10');
  });

  it('quem não tem nascimento cadastrado sai com travessão, não em branco', async () => {
    const { mod, doc } = await criar(PESSOAS);
    doc.querySelector('#tb-colaboradores').innerHTML = mod._renderLinhas([{ ...PESSOAS[0], nascimento: '' }]);
    const celulas = [...doc.querySelectorAll('#tb-colaboradores tr td')].map(td => td.textContent.trim());
    expect(celulas[2]).toBe('—');
  });

  it('o cabeçalho da tabela tem a coluna Nascimento', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const ini = html.indexOf('<tbody id="tb-colaboradores">');
    const cab = html.slice(html.lastIndexOf('<thead>', ini), ini);
    const ths = [...cab.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(m => m[1].trim());
    expect(ths).toEqual(['Colaborador', 'Setor / Área', 'Nascimento', 'Admissão', 'Status', 'Ações']);
  });

  it('o número de colunas do cabeçalho bate com o das linhas', async () => {
    // Cabeçalho e linha fora de sincronia desalinham o relatório inteiro.
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const ini = html.indexOf('<tbody id="tb-colaboradores">');
    const cab = html.slice(html.lastIndexOf('<thead>', ini), ini);
    // `<th[^>]*>` também casaria com `<thead>` — daí o lookahead.
    const nTh = [...cab.matchAll(/<th(?=[\s>])[^>]*>/g)].length;

    const { mod, doc } = await criar(COM_NASCIMENTO);
    doc.querySelector('#tb-colaboradores').innerHTML = mod._renderLinhas([COM_NASCIMENTO[0]]);
    expect(doc.querySelectorAll('#tb-colaboradores tr td')).toHaveLength(nTh);
  });

  it('a linha vazia ocupa a largura toda da tabela', async () => {
    const { mod, doc } = await criar(PESSOAS);
    doc.querySelector('#tb-colaboradores').innerHTML =
      `<tr><td colspan="6" class="empty">${mod._mensagemVazia('', '', '')}</td></tr>`;
    expect(doc.querySelector('#tb-colaboradores td').getAttribute('colspan')).toBe('6');
  });
});
