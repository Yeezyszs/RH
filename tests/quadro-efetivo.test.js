import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { statusCasa } from './helpers-efetivo.js';

// O quadro de funcionários é o efetivo da empresa, e afastado continua sendo
// funcionário — contrato suspenso, não encerrado. Antes ele era escondido do
// quadro, então o relatório impresso saía com o efetivo menor do que é.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const TOOLBAR = (() => {
  const ini = html.indexOf('<div class="toolbar">', html.indexOf('page-quadro'));
  return html.slice(ini, html.indexOf('</div>\n\n      <!-- Stats -->', ini));
})();

async function criar(pessoas) {
  const dom = new JSDOM(`<body>
    ${TOOLBAR}</div>
    <div id="quad-stat-total"></div>
    <div id="quad-stat-setores"></div>
    <div id="quad-stat-maior"></div>
    <div class="setor-grid" id="setor-grid"></div>
  </body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  const doc = dom.window.document;

  const { QuadroModule } = await import('../src/modules/quadro.js');
  const mod = new QuadroModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    COLABORADORES: pessoas,
    STATUS_LABEL: {
      ativo:    { t: 'Ativo' },
      ferias:   { t: 'Férias' },
      afastado: { t: 'Afastado' },
      inativo:  { t: 'Inativo' },
    },
    statusCasa,
    SETOR_ICON: {},
  });
  return { mod, doc };
}

const PESSOAS = [
  { id: 1, nome: 'Ativo Um',   setor: 'Produção',      area: 'Forno',    status: 'ativo' },
  { id: 2, nome: 'Ativo Dois', setor: 'Produção',      area: 'Forno',    status: 'ativo' },
  { id: 3, nome: 'De Férias',  setor: 'Produção',      area: 'Forno',    status: 'ferias' },
  { id: 4, nome: 'Afastado',   setor: 'Administrativo', area: 'Financeiro', status: 'afastado' },
  { id: 5, nome: 'Desligado',  setor: 'Administrativo', area: 'Financeiro', status: 'inativo' },
];

const nomes = (doc) => [...doc.querySelectorAll('.func-mini-name')].map(el => el.textContent);
const total = (doc) => doc.querySelector('#quad-stat-total').textContent;

describe('o afastado faz parte do efetivo', () => {
  it('aparece no quadro sem nenhum filtro', async () => {
    const { mod, doc } = await criar(PESSOAS);
    mod.renderQuadro();
    expect(nomes(doc)).toContain('Afastado');
  });

  it('entra na contagem total', async () => {
    // Ativo Um, Ativo Dois, De Férias e Afastado — o desligado fica fora.
    const { mod, doc } = await criar(PESSOAS);
    mod.renderQuadro();
    expect(total(doc)).toBe('4');
  });

  it('conta no total do setor dele', async () => {
    const { mod, doc } = await criar(PESSOAS);
    mod.renderQuadro();
    const card = [...doc.querySelectorAll('.setor-card')]
      .find(el => el.textContent.includes('Administrativo'));
    expect(card.querySelector('.setor-count').textContent).toBe('1');
  });

  it('mantém o setor no quadro quando só tem afastado', async () => {
    // Antes o setor inteiro desaparecia do relatório.
    const { mod, doc } = await criar([PESSOAS[3]]);
    mod.renderQuadro();
    expect(doc.querySelector('#quad-stat-setores').textContent).toBe('1');
    expect(doc.querySelector('#setor-grid').textContent).toContain('Administrativo');
  });

  it('sai marcado com o status, não como ativo', async () => {
    // O relatório precisa continuar dizendo quem está afastado.
    const { mod, doc } = await criar(PESSOAS);
    mod.renderQuadro();
    const linha = [...doc.querySelectorAll('.func-mini')]
      .find(el => el.textContent.includes('Afastado'));
    expect(linha.querySelector('.func-mini-status').className).toContain('afastado');
  });
});

describe('o desligado continua fora', () => {
  it('não aparece sem filtro', async () => {
    const { mod, doc } = await criar(PESSOAS);
    mod.renderQuadro();
    expect(nomes(doc)).not.toContain('Desligado');
  });

  it('aparece quando o status é escolhido de propósito', async () => {
    const { mod, doc } = await criar(PESSOAS);
    doc.querySelector('#quad-filter-status').value = 'inativo';
    mod.renderQuadro();
    expect(nomes(doc)).toEqual(['Desligado']);
  });
});

describe('filtro de status', () => {
  it('oferece afastado como opção', async () => {
    const { doc } = await criar(PESSOAS);
    const valores = [...doc.querySelectorAll('#quad-filter-status option')].map(o => o.value);
    expect(valores).toContain('afastado');
  });

  it('isola só os afastados quando escolhido', async () => {
    const { mod, doc } = await criar(PESSOAS);
    doc.querySelector('#quad-filter-status').value = 'afastado';
    mod.renderQuadro();
    expect(nomes(doc)).toEqual(['Afastado']);
    expect(total(doc)).toBe('1');
  });

  it('filtrar por ativo não traz férias nem afastado', async () => {
    const { mod, doc } = await criar(PESSOAS);
    doc.querySelector('#quad-filter-status').value = 'ativo';
    mod.renderQuadro();
    expect(nomes(doc).sort()).toEqual(['Ativo Dois', 'Ativo Um']);
  });

  it('a busca por nome continua valendo junto', async () => {
    const { mod, doc } = await criar(PESSOAS);
    doc.querySelector('#quad-search').value = 'afast';
    mod.renderQuadro();
    expect(nomes(doc)).toEqual(['Afastado']);
  });

  it('status desconhecido não entra no efetivo por acidente', async () => {
    // Se um dia surgir outro status, ele não deve virar efetivo sem decisão.
    const { mod, doc } = await criar([...PESSOAS, { id: 9, nome: 'Estranho', setor: 'X', area: 'Y', status: 'aposentado' }]);
    mod.renderQuadro();
    expect(nomes(doc)).not.toContain('Estranho');
  });
});
