import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// A tela de Rescisões é a face financeira do desligamento. Três coisas têm de
// ser verdade, e nenhuma delas é óbvia no código:
//
//  1. o desligamento sem valor lançado APARECE, marcado como pendente — é
//     trabalho do RH a fazer, não linha a esconder;
//  2. o total e a média contam só o que foi lançado, senão a média cai pela
//     metade a cada desligamento novo que entra sem valor;
//  3. o valor gravado vai para `encargos_rescisao`/`data_pagamento`, que são as
//     colunas que já existiam no banco — e é mutado no próprio objeto, porque o
//     array é compartilhado por referência com o módulo de desligamentos.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const PAGINA = (() => {
  const ini = html.indexOf('<section id="page-rescisoes"');
  return html.slice(ini, html.indexOf('</section>', ini) + 10);
})();

const MODAL = (() => {
  const ini = html.indexOf('<div id="modal-rescisao"');
  return html.slice(ini, html.indexOf('<div id="modal-vale-alimentacao"', ini));
})();

async function criar(desligamentos, salvos = []) {
  const dom = new JSDOM(`<body>${PAGINA}${MODAL}</body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  global.FormData = dom.window.FormData;
  global.Event = dom.window.Event;
  const doc = dom.window.document;

  const { RescisoesModule } = await import('../src/modules/rescisoes.js');
  const mod = new RescisoesModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s ?? '').slice(0, 2),
    fmtDate: (d) => String(d ?? ''),
    fmtBRL: (v) => 'R$ ' + Number(v || 0).toFixed(2),
    mesLabel: (c) => c,
    DESLIGAMENTOS: desligamentos,
    CHART_COLORS: { phthaloLight: '#000', grid: '#eee' },
    Auth: { sessaoAtual: async () => ({ user: 1 }) },
    Desligamentos: { atualizar: async (id, p) => { salvos.push({ id, ...p }); } },
    showToast: () => {},
  });
  return { mod, doc };
}

const BASE = [
  { id: 1, nome: 'Ana',   setor: 'Obra',  motivo: 'Sem justa causa',        data: '2026-03-10', valor: 4000, data_rescisao: '2026-03-20' },
  { id: 2, nome: 'Bruno', setor: 'Obra',  motivo: 'Pedido do colaborador',  data: '2026-05-05', valor: 1000, data_rescisao: '2026-05-10' },
  { id: 3, nome: 'Carla', setor: 'Adm',   motivo: 'Justa causa',            data: '2026-05-28', valor: null, data_rescisao: null },
  { id: 4, nome: 'Davi',  setor: 'Adm',   motivo: 'Sem justa causa',        data: '2025-11-03', valor: 9000, data_rescisao: '2025-11-15' },
  { id: 5, nome: 'Elza',  setor: 'Obra',  motivo: 'Justa causa',            data: '2026-03-02', valor: 2000, data_rescisao: '2026-03-08', multa: 800 },
];

const clonar = () => BASE.map(d => ({ ...d }));
const linhas = (doc) => [...doc.querySelectorAll('#tb-rescisoes tr')];
const texto  = (doc) => doc.querySelector('#tb-rescisoes').textContent;

describe('lista de rescisões', () => {
  it('lista o ano corrente e inclui quem não tem valor lançado', async () => {
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '2026';
    mod.render();

    expect(linhas(doc)).toHaveLength(4);
    expect(texto(doc)).toContain('Carla');
    expect(texto(doc)).toContain('Não lançada');
  });

  it('ordena da rescisão mais recente para a mais antiga', async () => {
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '';
    mod.render();

    const nomes = linhas(doc).map(tr => tr.querySelector('.cell-person-name').textContent);
    expect(nomes).toEqual(['Carla', 'Bruno', 'Ana', 'Elza', 'Davi']);
  });

  it('a rescisão sem acerto cai no ano do desligamento', async () => {
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '2026';
    mod.render();
    // Carla não tem data_rescisao; entrou por data: '2026-05-28'.
    expect(texto(doc)).toContain('data do desligamento');
  });

  it('filtra por situação do lançamento', async () => {
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '';

    doc.querySelector('#resc-filter-situacao').value = 'pendente';
    mod.render();
    expect(linhas(doc)).toHaveLength(1);
    expect(texto(doc)).toContain('Carla');

    doc.querySelector('#resc-filter-situacao').value = 'lancada';
    mod.render();
    expect(linhas(doc)).toHaveLength(4);
    expect(texto(doc)).not.toContain('Carla');
  });

  it('filtra por motivo e por busca livre', async () => {
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '';

    doc.querySelector('#resc-filter-motivo').value = 'Sem justa causa';
    mod.render();
    expect(linhas(doc)).toHaveLength(2);

    doc.querySelector('#resc-filter-motivo').value = '';
    doc.querySelector('#resc-search').value = 'adm';
    mod.render();
    expect(linhas(doc)).toHaveLength(2);     // Carla e Davi, pelo setor
  });

  it('mostra mensagem própria quando nada casa com o filtro', async () => {
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-search').value = 'ninguém';
    mod.render();
    expect(texto(doc)).toContain('Nenhuma rescisão encontrada');
  });
});

describe('totais', () => {
  it('soma e média contam só as rescisões lançadas', async () => {
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '2026';
    mod.render();

    // Acertos 4000 + 1000 + 2000, mais a multa de 800 da Elza.
    // Carla não entra em nada: nem soma, nem média.
    expect(doc.querySelector('#resc-stat-total').textContent).toBe('R$ 7800.00');
    expect(doc.querySelector('#resc-stat-media').textContent).toBe('R$ 2333.33');
    expect(doc.querySelector('#resc-stat-qtd').textContent).toBe('3/4');
    expect(doc.querySelector('#resc-stat-pendente').textContent).toBe('1');
  });

  it('o recorte de ano muda o total', async () => {
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '2025';
    mod.render();
    expect(doc.querySelector('#resc-stat-total').textContent).toBe('R$ 9000.00');

    doc.querySelector('#resc-filter-ano').value = '';
    mod.render();
    expect(doc.querySelector('#resc-stat-total').textContent).toBe('R$ 16800.00');
  });

  it('sem nenhum valor lançado a média não é zero disfarçado de número', async () => {
    const { mod, doc } = await criar([{ id: 9, nome: 'Eva', motivo: 'Acordo mútuo', data: '2026-02-01', valor: null }]);
    mod.render();
    expect(doc.querySelector('#resc-stat-media').textContent).toBe('—');
    expect(doc.querySelector('#resc-stat-total').textContent).toBe('R$ 0.00');
  });
});

describe('gráfico de gasto', () => {
  it('com ano selecionado abre os 12 meses, inclusive os vazios', async () => {
    let cfg = null;
    global.Chart = class { constructor(_, c) { cfg = c; } destroy() {} };
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '2026';
    mod.render();

    expect(cfg.data.labels).toHaveLength(12);
    expect(cfg.data.datasets[0].data[2]).toBe(6000);   // março: Ana + Elza
    expect(cfg.data.datasets[0].data[4]).toBe(1000);   // maio: Carla não soma
    expect(cfg.data.datasets[0].data[0]).toBe(0);      // janeiro
    delete global.Chart;
  });

  it('sem recorte de ano o eixo passa a ser o ano', async () => {
    let cfg = null;
    global.Chart = class { constructor(_, c) { cfg = c; } destroy() {} };
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '';
    mod.render();

    expect(cfg.data.labels).toEqual(['2025', '2026']);
    expect(cfg.data.datasets[0].data).toEqual([9000, 7000]);
    delete global.Chart;
  });
});

describe('lançamento', () => {
  it('abre o modal já com a data do desligamento quando não há acerto', async () => {
    const { mod, doc } = await criar(clonar());
    mod.render();
    mod.abrirModal(3);

    const form = doc.querySelector('#form-rescisao');
    expect(doc.querySelector('#modal-rescisao').classList.contains('active')).toBe(true);
    expect(doc.querySelector('#resc-modal-nome').textContent).toBe('Carla');
    expect(form.elements['data'].value).toBe('2026-05-28');
    expect(form.elements['valor'].value).toBe('');
  });

  it('grava nas colunas do banco e atualiza a linha em memória', async () => {
    const salvos = [];
    const dados = clonar();
    const { mod, doc } = await criar(dados, salvos);
    mod.render();
    mod.abrirModal(3);

    const form = doc.querySelector('#form-rescisao');
    form.elements['valor'].value = '3200.50';
    form.elements['data'].value = '2026-06-05';
    await mod.salvar(new global.Event('submit'));

    expect(salvos).toEqual([{
      id: 3, encargos_rescisao: 3200.5, data_pagamento: '2026-06-05', multa_rescisoria: null,
    }]);

    const carla = dados.find(d => d.id === 3);
    expect(carla.valor).toBe(3200.5);
    expect(carla.encargos_rescisao).toBe(3200.5);
    expect(carla.data_rescisao).toBe('2026-06-05');
    expect(doc.querySelector('#modal-rescisao').classList.contains('active')).toBe(false);
  });

  it('valor em branco volta a rescisão para pendente', async () => {
    const salvos = [];
    const dados = clonar();
    const { mod, doc } = await criar(dados, salvos);
    mod.render();
    mod.abrirModal(1);

    doc.querySelector('#form-rescisao').elements['valor'].value = '';
    await mod.salvar(new global.Event('submit'));

    expect(salvos[0].encargos_rescisao).toBeNull();
    expect(dados.find(d => d.id === 1).valor).toBeNull();
  });

  it('não grava sem sessão, mas mantém a tela coerente', async () => {
    const salvos = [];
    const dados = clonar();
    const dom = new JSDOM(`<body>${PAGINA}${MODAL}</body>`);
    global.window = dom.window;
    global.document = dom.window.document;
    global.FormData = dom.window.FormData;
    global.Event = dom.window.Event;
    const doc = dom.window.document;

    const { RescisoesModule } = await import('../src/modules/rescisoes.js');
    const mod = new RescisoesModule({
      $: (s) => doc.querySelector(s),
      h: (s) => String(s ?? ''),
      iniciais: (s) => String(s ?? '').slice(0, 2),
      fmtDate: (d) => String(d ?? ''),
      fmtBRL: (v) => 'R$ ' + Number(v || 0).toFixed(2),
      mesLabel: (c) => c,
      DESLIGAMENTOS: dados,
      CHART_COLORS: { phthaloLight: '#000', grid: '#eee' },
      Auth: { sessaoAtual: async () => null },
      Desligamentos: { atualizar: async (id, p) => { salvos.push({ id, ...p }); } },
      showToast: () => {},
    });

    mod.render();
    mod.abrirModal(3);
    doc.querySelector('#form-rescisao').elements['valor'].value = '500';
    await mod.salvar(new global.Event('submit'));

    expect(salvos).toHaveLength(0);
    expect(dados.find(d => d.id === 3).valor).toBe(500);
  });
});

// A multa só existe em justa causa. O risco aqui não é a tela: é o dado. Um
// valor de multa gravado num desligamento que não a admite entraria no total
// do período para sempre, e ninguém olharia duas vezes.
describe('multa rescisória', () => {
  it('a regra vive num só lugar e cobre apenas justa causa', async () => {
    const { MOTIVOS_COM_MULTA, admiteMulta } = await import('../src/modules/rescisoes.js');
    expect(MOTIVOS_COM_MULTA).toEqual(['Justa causa']);
    expect(admiteMulta('Justa causa')).toBe(true);
    ['Sem justa causa', 'Pedido do colaborador', 'Acordo mútuo',
      'Término de contrato', 'Aposentadoria', '', undefined].forEach(m => {
      expect(admiteMulta(m)).toBe(false);
    });
  });

  it('a coluna mostra "não se aplica" fora da justa causa', async () => {
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '';
    mod.render();

    const porNome = (n) => linhas(doc).find(tr => tr.textContent.includes(n));
    expect(porNome('Ana').textContent).toContain('não se aplica');
    expect(porNome('Elza').textContent).toContain('R$ 800.00');
    // Justa causa sem multa lançada é lançamento a fazer, não "não se aplica".
    expect(porNome('Carla').textContent).toContain('A lançar');
    expect(porNome('Carla').textContent).not.toContain('não se aplica');
  });

  it('ignora multa gravada em motivo que não a admite', async () => {
    // Linha adulterada à mão no banco: a tela não pode exibi-la nem somá-la.
    const dados = clonar();
    dados.find(d => d.id === 1).multa = 5000;       // Ana, sem justa causa
    const { mod, doc } = await criar(dados);
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '2026';
    mod.render();

    expect(doc.querySelector('#resc-stat-multa').textContent).toBe('R$ 800.00');
    expect(doc.querySelector('#resc-stat-total').textContent).toBe('R$ 7800.00');
  });

  it('entra no total do período somada ao acerto', async () => {
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '2026';
    mod.render();

    expect(doc.querySelector('#resc-stat-multa').textContent).toBe('R$ 800.00');
    expect(doc.querySelector('#resc-stat-multa-sub').textContent).toBe('1 de 2 por justa causa');
    expect(doc.querySelector('#resc-stat-total-sub').textContent)
      .toBe('R$ 7000.00 de acerto + R$ 800.00 de multa');
  });

  it('o gráfico separa acerto de multa em barras empilhadas', async () => {
    let cfg = null;
    global.Chart = class { constructor(_, c) { cfg = c; } destroy() {} };
    const { mod, doc } = await criar(clonar());
    mod.render();
    doc.querySelector('#resc-filter-ano').value = '2026';
    mod.render();

    expect(cfg.data.datasets).toHaveLength(2);
    expect(cfg.data.datasets[1].label).toContain('Multa');
    expect(cfg.data.datasets[1].data[2]).toBe(800);   // março, da Elza
    expect(cfg.data.datasets[1].data[4]).toBe(0);     // maio não teve multa
    expect(cfg.options.scales.y.stacked).toBe(true);
    delete global.Chart;
  });

  it('o campo abre na justa causa e fica fora do formulário nos outros motivos', async () => {
    const { mod, doc } = await criar(clonar());
    mod.render();
    const form = doc.querySelector('#form-rescisao');

    mod.abrirModal(5);                                // Elza, justa causa
    expect(doc.querySelector('#resc-grupo-multa').style.display).toBe('');
    expect(form.elements['multa'].disabled).toBe(false);
    expect(form.elements['multa'].value).toBe('800.00');

    mod.abrirModal(1);                                // Ana, sem justa causa
    expect(doc.querySelector('#resc-grupo-multa').style.display).toBe('none');
    // Desabilitado, não só escondido: campo oculto mas habilitado volta no
    // FormData e viraria dado.
    expect(form.elements['multa'].disabled).toBe(true);
    expect([...new FormData(form).keys()]).not.toContain('multa');
    expect(doc.querySelector('#resc-multa-aviso').textContent).toContain('não se aplica');
  });

  it('grava a multa na justa causa', async () => {
    const salvos = [];
    const dados = clonar();
    const { mod, doc } = await criar(dados, salvos);
    mod.render();
    mod.abrirModal(3);                                // Carla, justa causa

    const form = doc.querySelector('#form-rescisao');
    form.elements['valor'].value = '1500';
    form.elements['multa'].value = '620.40';
    await mod.salvar(new global.Event('submit'));

    expect(salvos[0].multa_rescisoria).toBe(620.4);
    const carla = dados.find(d => d.id === 3);
    expect(carla.multa).toBe(620.4);
    expect(carla.multa_rescisoria).toBe(620.4);
  });

  it('descarta a multa na gravação quando o motivo não a admite', async () => {
    const salvos = [];
    const dados = clonar();
    const { mod, doc } = await criar(dados, salvos);
    mod.render();
    mod.abrirModal(1);                                // Ana, sem justa causa

    // Reabilita o campo à força e preenche: é o que um formulário já aberto
    // faria se o motivo mudasse por baixo, ou um usuário pelo console.
    const form = doc.querySelector('#form-rescisao');
    form.elements['multa'].disabled = false;
    form.elements['multa'].value = '9999';
    form.elements['valor'].value = '4000';
    await mod.salvar(new global.Event('submit'));

    expect(salvos[0].multa_rescisoria).toBeNull();
    expect(dados.find(d => d.id === 1).multa).toBeNull();
  });

  it('limpar o campo remove a multa lançada', async () => {
    const salvos = [];
    const dados = clonar();
    const { mod, doc } = await criar(dados, salvos);
    mod.render();
    mod.abrirModal(5);                                // Elza, com 800 lançados

    doc.querySelector('#form-rescisao').elements['multa'].value = '';
    await mod.salvar(new global.Event('submit'));

    expect(salvos[0].multa_rescisoria).toBeNull();
    expect(dados.find(d => d.id === 5).multa).toBeNull();
  });
});

describe('ligação com o resto do sistema', () => {
  it('a página está registrada para impressão de relatório', () => {
    const relatorio = readFileSync(new URL('../src/utils/relatorio.js', import.meta.url), 'utf8');
    expect(relatorio).toContain("rescisoes:");
  });

  it('o item de menu aponta para a página que existe', () => {
    expect(html).toContain('data-page="rescisoes"');
    expect(html).toContain('id="page-rescisoes"');
  });

  it('o mapper traz as colunas do acerto rescisório', async () => {
    // Script clássico: exporta pelo window.
    globalThis.window = globalThis.window || {};
    await import('../src/utils/mappers.js');
    const reg = window.mapDesligamento({
      id: 7, colaborador_id: 3, data_desligamento: '2026-04-01',
      motivo: 'Justa causa', encargos_rescisao: 7777.77, data_pagamento: '2026-04-12',
      multa_rescisoria: 1234.56,
    });
    expect(reg.valor).toBe(7777.77);
    expect(reg.data_rescisao).toBe('2026-04-12');
    expect(reg.multa).toBe(1234.56);
  });
});
