import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// O IRRF é desconto do pró-labore, não do Cooper. Dois riscos concretos:
// o campo sobreviver na troca de tipo e gravar imposto num lançamento de
// Cooper, e o valor não chegar ao payload — caso em que a tela mostraria o
// desconto e o banco não guardaria nada.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const MODAL = (() => {
  const ini = html.indexOf('<div id="modal-prolabore"');
  return html.slice(ini, html.indexOf('</div>\n\n<!-- ════════════ MODAL — ANIVERSARIANTES', ini) + 6);
})();

async function criar(salvos = []) {
  const dom = new JSDOM(`<body>${MODAL}
    <select id="prolab-competencia"></select>
    <div id="prolab-grid"></div></body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  global.FormData = dom.window.FormData;
  global.Event = dom.window.Event;
  const doc = dom.window.document;

  const { ProlaboreModule } = await import('../src/modules/prolabore.js');
  const mod = new ProlaboreModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    fmtBRL: (v) => 'R$ ' + Number(v || 0).toFixed(2),
    PROLABORE: [],
    Auth: { sessaoAtual: async () => ({ user: 1 }) },
    ProlaboreSocios: {
      criar: async (p) => { salvos.push(p); return { id: 1, ...p }; },
      atualizar: async (id, p) => { salvos.push({ id, ...p }); return { id, ...p }; },
    },
    showToast: () => {},
  });
  return { mod, doc };
}

const preencher = (doc, campos) => {
  const form = doc.querySelector('#form-prolabore');
  Object.entries(campos).forEach(([k, v]) => { form.elements[k].value = v; });
  return form;
};

describe('IRRF no pró-labore', () => {
  it('o campo existe no formulário, ao lado dos outros descontos', async () => {
    const { doc } = await criar();
    const form = doc.querySelector('#form-prolabore');
    expect(form.elements['irrf']).toBeTruthy();
    expect(doc.querySelector('#prolab-grp-irrf')).toBeTruthy();
  });

  it('aparece no pró-labore e some no Cooper', async () => {
    const { mod, doc } = await criar();
    const grupo = doc.querySelector('#prolab-grp-irrf');

    doc.querySelector('#form-prolabore').elements['tipo'].value = 'prolabore';
    mod.atualizarCamposTipo();
    expect(grupo.style.display).toBe('');

    doc.querySelector('#form-prolabore').elements['tipo'].value = 'cooper';
    mod.atualizarCamposTipo();
    expect(grupo.style.display).toBe('none');
  });

  it('vai para o payload do pró-labore', async () => {
    const salvos = [];
    const { mod, doc } = await criar(salvos);
    preencher(doc, {
      socio: 'Valdir Mataruco', competencia: '2026-10', tipo: 'prolabore',
      valor_base: '10000', inss: '932.31', irrf: '1325.50', unimed: '0', adiantamento: '0',
    });
    await mod.salvar(new global.Event('submit'));

    expect(salvos[0].irrf).toBe(1325.5);
    expect(salvos[0].inss).toBe(932.31);
  });

  it('é zerado no Cooper, mesmo preenchido antes da troca de tipo', async () => {
    const salvos = [];
    const { mod, doc } = await criar(salvos);
    preencher(doc, {
      socio: 'Valdir Mataruco', competencia: '2026-10', tipo: 'prolabore', irrf: '900',
    });
    // Troca para Cooper com o campo já preenchido: esconder não basta, o valor
    // continua no formulário.
    doc.querySelector('#form-prolabore').elements['tipo'].value = 'cooper';
    mod.atualizarCamposTipo();
    await mod.salvar(new global.Event('submit'));

    expect(salvos[0].tipo).toBe('cooper');
    expect(salvos[0].irrf).toBe(0);
  });

  it('o cartão da tela mostra a linha do IRRF', async () => {
    const { mod, doc } = await criar();
    mod.PROLABORE.push({
      id: 7, socio: 'Valdir Mataruco', competencia: '2026-10', tipo: 'prolabore',
      valor_base: 10000, inss: 932.31, irrf: 1325.5, unimed: 0, adiantamento: 0, itens: [],
    });
    // O seletor de competências só existe depois do primeiro render.
    mod.render();
    doc.querySelector('#prolab-competencia').value = '2026-10';
    mod.render();

    const texto = doc.querySelector('#prolab-grid').textContent;
    expect(texto).toContain('IRRF');
    expect(texto).toContain('1325.50');
    // Líquido = 10000 - 932.31 - 1325.50
    expect(texto).toContain('7742.19');
  });

  it('a consulta ao banco traz a coluna', () => {
    const api = readFileSync(new URL('../src/api/gestao.js', import.meta.url), 'utf8');
    expect(api).toMatch(/select\('id, socio, competencia, tipo, valor_base, inss, irrf,/);
  });
});
