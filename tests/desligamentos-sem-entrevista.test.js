import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// A entrevista de saída saiu da tela de Desligamentos. O que este arquivo
// protege não é a ausência em si — é o que a remoção podia quebrar:
//
//  1. a tabela: tirar uma coluna do <thead> e esquecer a célula (ou o
//     colspan da linha vazia) desalinha o cabeçalho dos dados em silêncio;
//  2. o cadastro: o payload não pode mais carregar o campo `entrevista`;
//  3. os outros módulos: o listener de rating era GLOBAL — pegava clique em
//     qualquer `.rating-input button` da página, incluindo os do formulário
//     de feedback, e escrevia a classe `active` por nome de campo. Ele foi
//     embora junto; o de feedback é escopado e continua sozinho.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const modulo = readFileSync(new URL('../src/modules/desligamentos.js', import.meta.url), 'utf8');

const PAGINA = (() => {
  const ini = html.indexOf('<section id="page-desligamentos"');
  return html.slice(ini, html.indexOf('</section>', ini) + 10);
})();

const DESLIGAMENTOS = [
  { id: 1, nome: 'Ana Souza', setor: 'Obra', area: '', motivo: 'Sem justa causa',
    tipo: 'involuntario', data: '2026-03-10', admissao: '2024-03-10' },
  { id: 2, nome: 'Bruno Lima', setor: 'Adm', area: '', motivo: 'Pedido do colaborador',
    tipo: 'voluntario', data: '2026-05-05', admissao: '2025-11-05' },
];

async function montar(lista = DESLIGAMENTOS) {
  const dom = new JSDOM(`<body>${PAGINA}</body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  global.FormData = dom.window.FormData;
  const doc = dom.window.document;

  const { DesligamentosModule } = await import('../src/modules/desligamentos.js');
  const mod = new DesligamentosModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s ?? '').slice(0, 2),
    fmtDate: (d) => String(d ?? ''),
    DESLIGAMENTOS: lista.map(d => ({ ...d })),
    COLABORADORES: [],
    Auth: { sessaoAtual: async () => null },
    Desligamentos: null,
  });
  mod.render();
  return { mod, doc };
}

describe('Desligamentos sem entrevista de saída', () => {
  it('cabeçalho e linhas têm o mesmo número de colunas', async () => {
    const { doc } = await montar();
    const ths = doc.querySelectorAll('#page-desligamentos thead th').length;
    const tds = doc.querySelectorAll('#tb-desligamentos tr').item(0).querySelectorAll('td').length;
    expect(ths).toBe(6);
    expect(tds).toBe(ths);
  });

  it('a linha vazia ocupa a largura toda da tabela', async () => {
    const { mod, doc } = await montar([]);
    mod.render();
    const colspan = doc.querySelector('#tb-desligamentos td').getAttribute('colspan');
    expect(Number(colspan)).toBe(doc.querySelectorAll('#page-desligamentos thead th').length);
  });

  it('nada de entrevista sobrou na tela nem no módulo', async () => {
    const { doc } = await montar();
    expect(doc.querySelector('#page-desligamentos').textContent.toLowerCase())
      .not.toContain('entrevista');
    expect(html).not.toContain('modal-entrevista');
    expect(html).not.toContain('desl-filter-entrevista');
    // Comentário de cabeçalho explica a remoção; código, nenhum.
    expect(modulo.split('\n').filter(l => !l.trim().startsWith('//')).join('\n'))
      .not.toMatch(/entrevista/i);
  });

  it('o cadastro não grava mais o campo entrevista', async () => {
    const dom = new JSDOM(`<body>${PAGINA}
      <div id="modal-desligamento"></div>
      <form id="form-desligamento">
        <select name="colaborador_id"><option value="9" selected>x</option></select>
        <input name="data" value="2026-06-01">
        <input name="ultimo_dia" value="2026-06-01">
        <input name="motivo" value="Sem justa causa">
        <input name="tipo" value="involuntario">
        <input name="aviso" value="indenizado">
        <input name="observacoes" value="">
      </form></body>`);
    global.window = dom.window;
    global.document = dom.window.document;
    global.FormData = dom.window.FormData;
    const doc = dom.window.document;

    const enviados = [];
    const { DesligamentosModule } = await import('../src/modules/desligamentos.js');
    const mod = new DesligamentosModule({
      $: (s) => doc.querySelector(s),
      h: (s) => String(s ?? ''),
      iniciais: (s) => String(s ?? '').slice(0, 2),
      fmtDate: (d) => String(d ?? ''),
      DESLIGAMENTOS: [],
      COLABORADORES: [{ id: 9, nome: 'Carla', setor: 'Obra', cargo: 'Aux', admissao: '2024-01-01', status: 'ativo' }],
      Auth: { sessaoAtual: async () => ({ user: 1 }) },
      Desligamentos: { criar: async (p) => { enviados.push(p); return { id: 1, ...p }; } },
    });

    await mod.salvarDesligamento({ preventDefault() {} });
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).not.toHaveProperty('entrevista');
    expect(enviados[0].motivo).toBe('Sem justa causa');
  });

  it('não captura mais o clique nos ratings dos outros formulários', async () => {
    const dom = new JSDOM(`<body>${PAGINA}
      <form id="form-feedback">
        <div class="rating-input" data-rating-field="nota_entrega">
          <button type="button" data-rating-val="4">4</button>
        </div>
      </form></body>`);
    global.window = dom.window;
    global.document = dom.window.document;
    global.FormData = dom.window.FormData;
    const doc = dom.window.document;

    const { DesligamentosModule } = await import('../src/modules/desligamentos.js');
    new DesligamentosModule({
      $: (s) => doc.querySelector(s),
      h: (s) => String(s ?? ''),
      iniciais: (s) => String(s ?? '').slice(0, 2),
      fmtDate: (d) => String(d ?? ''),
      DESLIGAMENTOS: [], COLABORADORES: [],
      Auth: { sessaoAtual: async () => null },
      Desligamentos: null,
    });

    const botao = doc.querySelector('#form-feedback button');
    expect(() => botao.click()).not.toThrow();
    // Quem marca o botão é o handler do próprio feedback, que não está aqui.
    expect(botao.classList.contains('active')).toBe(false);
  });
});
