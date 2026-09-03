import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// O relatório de pró-labore imprime a página como ela está na tela. Então o
// filtro de tipo não é enfeite: é o que decide se sai o documento do
// pró-labore, o do Cooper, ou os dois juntos.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const TOOLBAR = (() => {
  const ini = html.indexOf('<div class="toolbar">', html.indexOf('page-prolabore'));
  return html.slice(ini, html.indexOf('</div>', html.indexOf('data-action="abrirModalProlabore"')));
})();

async function criar(lancamentos) {
  const dom = new JSDOM(`<body>
    ${TOOLBAR}</div>
    <div id="prolab-stat-socios"></div>
    <div id="prolab-stat-lancamentos"></div>
    <div id="prolab-stat-liquido"></div>
    <div id="prolab-grid"></div>
  </body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  global.FormData = dom.window.FormData;
  const doc = dom.window.document;

  const { ProlaboreModule } = await import('../src/modules/prolabore.js');
  const mod = new ProlaboreModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    fmtBRL: (v) => Number(v).toFixed(2),
    PROLABORE: lancamentos,
    Auth: { sessaoAtual: async () => null },
    ProlaboreSocios: null,
    showToast: () => {},
  });
  // O seletor de competências só existe depois do primeiro render; a partir
  // daí a tela fica na competência dos lançamentos do teste.
  mod.render();
  const sel = doc.querySelector('#prolab-competencia');
  if (sel && [...sel.options].some(o => o.value === '2026-08')) sel.value = '2026-08';
  mod.render();
  return { mod, doc };
}

const LANCAMENTOS = [
  { id: 1, socio: 'Ana',   competencia: '2026-08', tipo: 'prolabore', valor_base: 10000, inss: 1000, unimed: 500, adiantamento: 0, itens: [] },
  { id: 2, socio: 'Ana',   competencia: '2026-08', tipo: 'cooper',    valor_base: 2000, itens: [{ descricao: 'Unimed', valor: 300 }] },
  { id: 3, socio: 'Bruno', competencia: '2026-08', tipo: 'prolabore', valor_base: 8000, inss: 800, unimed: 0, adiantamento: 0, itens: [] },
  { id: 4, socio: 'Bruno', competencia: '2026-08', tipo: 'cooper',    valor_base: 1500, itens: [] },
];

const cartoes = (doc) => [...doc.querySelectorAll('#prolab-grid .widget')];

describe('filtro por tipo de lançamento', () => {
  it('sem filtro mostra pró-labore e Cooper', async () => {
    const { mod, doc } = await criar(LANCAMENTOS);
    mod.render();
    expect(cartoes(doc)).toHaveLength(4);
  });

  it('somente pró-labore deixa só os cartões de pró-labore', async () => {
    const { mod, doc } = await criar(LANCAMENTOS);
    doc.querySelector('#prolab-filter-tipo').value = 'prolabore';
    mod.render();
    const textos = cartoes(doc).map(c => c.textContent);
    expect(textos).toHaveLength(2);
    expect(textos.every(t => t.includes('Pró-labore'))).toBe(true);
    expect(textos.some(t => t.includes('Cooper'))).toBe(false);
  });

  it('somente Cooper deixa só os cartões do Cooper', async () => {
    const { mod, doc } = await criar(LANCAMENTOS);
    doc.querySelector('#prolab-filter-tipo').value = 'cooper';
    mod.render();
    const textos = cartoes(doc).map(c => c.textContent);
    expect(textos).toHaveLength(2);
    expect(textos.every(t => t.includes('Cooper'))).toBe(true);
  });

  it('combina com o filtro de sócio', async () => {
    const { mod, doc } = await criar(LANCAMENTOS);
    mod.render();                                   // popula o seletor de sócios
    doc.querySelector('#prolab-filter-socio').value = 'Ana';
    doc.querySelector('#prolab-filter-tipo').value  = 'cooper';
    mod.render();
    expect(cartoes(doc)).toHaveLength(1);
    expect(cartoes(doc)[0].textContent).toContain('Ana');
  });

  it('os totais acompanham o filtro — é o que vai no relatório', async () => {
    const { mod, doc } = await criar(LANCAMENTOS);
    doc.querySelector('#prolab-filter-tipo').value = 'cooper';
    mod.render();
    expect(doc.querySelector('#prolab-stat-lancamentos').textContent).toBe('2');
    expect(doc.querySelector('#prolab-stat-socios').textContent).toBe('2');
    // Cooper da Ana: 2000 − 300 = 1700. Do Bruno: 1500 sem itens.
    expect(doc.querySelector('#prolab-stat-liquido').textContent).toBe('3200.00');
  });

  it('explica o vazio dizendo qual tipo foi filtrado', async () => {
    const { mod, doc } = await criar([LANCAMENTOS[0]]);
    doc.querySelector('#prolab-filter-tipo').value = 'cooper';
    mod.render();
    expect(doc.querySelector('#prolab-grid').textContent).toContain('Nenhum lançamento de Cooper');
  });

  it('o filtro de sócio não derruba o de tipo', async () => {
    // O seletor de sócios é repopulado a cada render; o de tipo é fixo e
    // precisa sobreviver a isso.
    const { mod, doc } = await criar(LANCAMENTOS);
    doc.querySelector('#prolab-filter-tipo').value = 'cooper';
    mod.render();
    mod.render();
    expect(doc.querySelector('#prolab-filter-tipo').value).toBe('cooper');
    expect(cartoes(doc)).toHaveLength(2);
  });
});

describe('o lançamento salvo não some atrás do filtro', () => {
  it('salvar um Cooper com a tela filtrada em pró-labore limpa o filtro', async () => {
    const { mod, doc } = await criar([...LANCAMENTOS]);
    mod.render();
    doc.querySelector('#prolab-filter-tipo').value = 'prolabore';

    const form = doc.createElement('form');
    form.innerHTML = `
      <input name="id"><input name="socio" value="Ana">
      <input name="competencia" value="2026-08"><input name="tipo" value="cooper">
      <input name="valor_base" value="900"><input name="inss"><input name="unimed">
      <input name="adiantamento"><textarea name="observacoes"></textarea>`;
    form.id = 'form-prolabore';
    doc.body.appendChild(form);
    doc.body.insertAdjacentHTML('beforeend', '<div id="modal-prolabore"></div>');

    await mod.salvar({ preventDefault() {} });
    expect(doc.querySelector('#prolab-filter-tipo').value).toBe('');
  });
});
