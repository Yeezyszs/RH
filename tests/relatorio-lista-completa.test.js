import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { statusCasa } from './helpers-efetivo.js';

// A lista de colaboradores pagina de 50 em 50 e o relatório clona o que está
// na tela. Resultado: quem caía na segunda página não saía no papel — e o
// documento não dizia que era só um pedaço. Com 90+ cadastros isso deixava
// dezenas de nomes de fora, afastados entre eles.
//
// `prepararRelatorio` troca a página visível pela lista inteira do que está
// filtrado. Estes testes cobrem esse ajuste do clone.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const PAGINA = (() => {
  const ini = html.indexOf('<div class="toolbar">', html.indexOf('page-colaboradores'));
  return html.slice(ini, html.indexOf('</section>', ini));
})();

async function criar(pessoas) {
  const dom = new JSDOM(`<body><div id="page-colaboradores">${PAGINA}</div></body>`);
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

// 60 pessoas: mais que o limite de 50 da tela. Os dois afastados ficam no fim
// do alfabeto de propósito — é onde a paginação os escondia.
const PESSOAS = [
  ...Array.from({ length: 58 }, (_, i) => ({
    id: i + 1,
    nome: `Pessoa ${String(i + 1).padStart(2, '0')}`,
    matricula: String(i + 1).padStart(6, '0'),
    setor: 'Produção', departamento_id: 1, status: 'ativo', admissao: '2020-01-10',
  })),
  { id: 90, nome: 'Zeca Afastado', matricula: '000090', setor: 'Admin', departamento_id: 2, status: 'afastado', admissao: '2018-06-01' },
  { id: 91, nome: 'Zulmira Afastada', matricula: '000091', setor: 'Admin', departamento_id: 2, status: 'afastado', admissao: '2019-06-01' },
];

// Simula o que a tela faz: renderiza só a primeira página.
function comPrimeiraPagina(mod, doc, lista = PESSOAS) {
  doc.querySelector('#tb-colaboradores').innerHTML = mod._renderLinhas(lista.slice(0, mod.state.limit));
}

const nomes = (raiz) => [...raiz.querySelectorAll('.cell-person-name')].map(el => el.textContent);

describe('o relatório sai com a lista inteira', () => {
  it('a tela paginada realmente esconde o afastado — é o problema', async () => {
    const { mod, doc } = await criar(PESSOAS);
    comPrimeiraPagina(mod, doc);
    expect(nomes(doc)).not.toContain('Zeca Afastado');
  });

  it('o clone do relatório traz o nome dos afastados', async () => {
    const { mod, doc } = await criar(PESSOAS);
    comPrimeiraPagina(mod, doc);
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    expect(nomes(wrapper)).toContain('Zeca Afastado');
    expect(nomes(wrapper)).toContain('Zulmira Afastada');
  });

  it('traz todo mundo, não só quem estava na página', async () => {
    const { mod, doc } = await criar(PESSOAS);
    comPrimeiraPagina(mod, doc);
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    expect(nomes(wrapper)).toHaveLength(60);
  });

  it('o afastado sai com o selo do status dele', async () => {
    const { mod, doc } = await criar(PESSOAS);
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    const linha = [...wrapper.querySelectorAll('tr')]
      .find(tr => tr.textContent.includes('Zeca Afastado'));
    expect(linha.querySelector('.badge').textContent).toBe('Afastado');
  });

  it('sai em ordem alfabética', async () => {
    const { mod, doc } = await criar(PESSOAS);
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    const lista = nomes(wrapper);
    expect(lista).toEqual([...lista].sort((a, b) => a.localeCompare(b)));
  });

  it('troca a barra de paginação pelo total da relação', async () => {
    const { mod, doc } = await criar(PESSOAS);
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    expect(wrapper.querySelector('.pagination-bar')).toBeNull();
    expect(wrapper.querySelector('.rpt-total-lista').textContent).toBe('60 colaboradores na relação');
  });
});

describe('os filtros da tela continuam valendo', () => {
  it('filtrar por afastado imprime só os afastados', async () => {
    const { mod, doc } = await criar(PESSOAS);
    doc.querySelector('#col-filter-status').value = 'afastado';
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    expect(nomes(wrapper)).toEqual(['Zeca Afastado', 'Zulmira Afastada']);
  });

  it('a busca por nome também vale', async () => {
    const { mod, doc } = await criar(PESSOAS);
    doc.querySelector('#col-search').value = 'zulmira';
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    expect(nomes(wrapper)).toEqual(['Zulmira Afastada']);
  });

  it('o filtro de setor também vale', async () => {
    const { mod, doc } = await criar(PESSOAS);
    doc.querySelector('#col-filter-setor').innerHTML = '<option value="2" selected>Admin</option>';
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    expect(nomes(wrapper)).toEqual(['Zeca Afastado', 'Zulmira Afastada']);
  });

  it('filtro que não casa com ninguém sai explícito, não em branco', async () => {
    const { mod, doc } = await criar(PESSOAS);
    doc.querySelector('#col-search').value = 'ninguem com esse nome';
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    expect(wrapper.querySelector('#tb-colaboradores').textContent)
      .toContain('Nenhum colaborador encontrado');
    expect(wrapper.querySelector('.rpt-total-lista').textContent).toBe('0 colaboradores na relação');
  });

  it('um só na relação sai no singular', async () => {
    const { mod, doc } = await criar([PESSOAS[58]]);
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    expect(wrapper.querySelector('.rpt-total-lista').textContent).toBe('1 colaborador na relação');
  });
});

describe('o ajuste não derruba a impressão quando a página não tem a tabela', () => {
  it('sai sem erro se o clone não tiver a lista', async () => {
    const { mod } = await criar(PESSOAS);
    const vazio = global.document.createElement('div');
    expect(() => mod.prepararRelatorio(vazio)).not.toThrow();
  });
});

describe('o padrão é o efetivo — afastados junto com os ativos', () => {
  const COM_DESLIGADO = [
    ...PESSOAS,
    { id: 99, nome: 'Aaa Desligado', matricula: '000099', setor: 'Admin', departamento_id: 2, status: 'inativo', admissao: '2015-01-01' },
  ];

  it('sem tocar em nada, o relatório sai com ativos e afastados juntos', async () => {
    const { mod, doc } = await criar(COM_DESLIGADO);
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    const lista = nomes(wrapper);
    expect(lista).toContain('Zeca Afastado');
    expect(lista).toContain('Pessoa 01');
    expect(lista).not.toContain('Aaa Desligado');
  });

  it('o afastado sai no meio da lista, na ordem alfabética', async () => {
    // "Juntos com os ativos" é isto: uma relação só, sem seção separada.
    const { mod, doc } = await criar(COM_DESLIGADO);
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    const lista = nomes(wrapper);
    expect(lista.indexOf('Zeca Afastado')).toBeGreaterThan(lista.indexOf('Pessoa 58'));
    expect(lista.indexOf('Zeca Afastado')).toBeLessThan(lista.indexOf('Zulmira Afastada'));
  });

  it('o desligado sai quando escolhido de propósito', async () => {
    const { mod, doc } = await criar(COM_DESLIGADO);
    doc.querySelector('#col-filter-status').value = '';
    const wrapper = doc.querySelector('#page-colaboradores').cloneNode(true);
    mod.prepararRelatorio(wrapper);
    expect(nomes(wrapper)).toContain('Aaa Desligado');
  });

  it('o filtro de status vem em Efetivo por padrão', async () => {
    const { doc } = await criar(PESSOAS);
    expect(doc.querySelector('#col-filter-status').value).toBe('efetivo');
  });
});

describe('procurar quem saiu da empresa não parece cadastro perdido', () => {
  const COM_DESLIGADO = [
    ...PESSOAS,
    { id: 99, nome: 'Joana Desligada', matricula: '000099', setor: 'Admin', departamento_id: 2, status: 'inativo', admissao: '2015-01-01' },
  ];

  it('avisa que há desligado casando com a busca e onde vê-lo', async () => {
    const { mod } = await criar(COM_DESLIGADO);
    const msg = mod._mensagemVazia('joana', 'efetivo', '');
    expect(msg).toContain('1 desligado');
    expect(msg).toContain('Todos, inclusive desligados');
  });

  it('busca sem nenhum resultado em lugar nenhum fica na mensagem simples', async () => {
    const { mod } = await criar(COM_DESLIGADO);
    expect(mod._mensagemVazia('xyz nao existe', 'efetivo', ''))
      .toBe('Nenhum colaborador encontrado');
  });

  it('com outro filtro escolhido não sugere nada — a escolha foi explícita', async () => {
    const { mod } = await criar(COM_DESLIGADO);
    expect(mod._mensagemVazia('joana', 'ativo', '')).toBe('Nenhum colaborador encontrado');
  });
});
