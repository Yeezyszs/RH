import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// O seletor da CAT só oferecia quem está na casa. Mas acidente de trabalho não
// some do histórico quando a pessoa é desligada, e a CAT muitas vezes é
// emitida depois — inclusive quando o próprio acidente levou ao afastamento e
// ao desligamento. Restringir aos ativos impedia registrar justamente os casos
// mais graves.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const trecho = (abre, fecha) => {
  const ini = html.indexOf(abre);
  return html.slice(ini, html.indexOf(fecha, ini));
};
const PAGINA = trecho('<section id="page-compliance-sst"', '</section>') + '</section>';
const MODAL  = trecho('<div id="modal-cat"', '<!-- ════════════');

const PESSOAS = [
  { id: 1, nome: 'Adão Ribeiro',    setor: 'Produção', cargo: 'Operador', status: 'ativo' },
  { id: 2, nome: 'Zuleica Antiga',  setor: 'Logística', cargo: 'Aux',     status: 'inativo' },
  { id: 3, nome: 'Beatriz Nunes',   setor: 'Produção', cargo: 'Analista', status: 'ativo' },
  { id: 4, nome: 'Alceu Saiu',      setor: 'Produção', cargo: 'Operador', status: 'inativo' },
  { id: 5, nome: 'Carlos Afastado', setor: 'Produção', cargo: 'Operador', status: 'afastado' },
];

async function montar({ cats = [] } = {}) {
  const dom = new JSDOM(`<body><div id="page-compliance-sst">${PAGINA}</div>${MODAL}</body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  global.FormData = dom.window.FormData;
  const doc = dom.window.document;

  const { ComplianceSstModule } = await import('../src/modules/compliance-sst.js');
  const mod = new ComplianceSstModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (d) => (d ? d.split('-').reverse().join('/') : '—'),
    COLABORADORES: PESSOAS,
    TREINAMENTOS_NR: [], CAT: cats, PROGRAMAS: [], PLANO_ACAO: [],
    Auth: { sessaoAtual: async () => null },
    TreinamentosNR: null, CatAcidentes: null, ProgramasEsocial: null, StorageDocs: null,
    showToast: () => {},
  });
  return { mod, doc };
}

const grupos = (doc) => [...doc.querySelectorAll('#form-cat [name="colaborador_id"] optgroup')]
  .map(g => ({ rotulo: g.label, nomes: [...g.querySelectorAll('option')].map(o => o.textContent) }));

describe('seletor de colaborador da CAT', () => {
  it('oferece também quem já saiu, num grupo à parte', async () => {
    const { mod, doc } = await montar();
    mod.abrirModalCat();

    const g = grupos(doc);
    expect(g.map(x => x.rotulo)).toEqual(['Colaboradores', 'Ex-colaboradores']);
    expect(g[1].nomes.join(' ')).toContain('Zuleica Antiga');
    expect(g[1].nomes.join(' ')).toContain('Alceu Saiu');
  });

  it('os ativos vêm primeiro — é o uso do dia a dia', async () => {
    const { mod, doc } = await montar();
    mod.abrirModalCat();

    const todas = [...doc.querySelectorAll('#form-cat [name="colaborador_id"] option')]
      .map(o => o.textContent);
    expect(todas.indexOf('Adão Ribeiro — Produção'))
      .toBeLessThan(todas.indexOf('Alceu Saiu — Produção'));
  });

  it('afastado continua entre os ativos — ainda é da casa', async () => {
    const { mod, doc } = await montar();
    mod.abrirModalCat();
    expect(grupos(doc)[0].nomes.join(' ')).toContain('Carlos Afastado');
  });

  it('cada grupo sai em ordem alfabética', async () => {
    const { mod, doc } = await montar();
    mod.abrirModalCat();
    const g = grupos(doc);
    expect(g[0].nomes).toEqual([...g[0].nomes].sort((a, b) => a.localeCompare(b)));
    expect(g[1].nomes).toEqual([...g[1].nomes].sort((a, b) => a.localeCompare(b)));
  });

  it('sem nenhum desligado, o grupo de ex não aparece vazio', async () => {
    const dom = new JSDOM(`<body><div id="page-compliance-sst">${PAGINA}</div>${MODAL}</body>`);
    global.window = dom.window;
    global.document = dom.window.document;
    global.FormData = dom.window.FormData;
    const doc = dom.window.document;
    const { ComplianceSstModule } = await import('../src/modules/compliance-sst.js');
    const mod = new ComplianceSstModule({
      $: (s) => doc.querySelector(s),
      h: (s) => String(s ?? ''),
      iniciais: (s) => String(s).slice(0, 2),
      fmtDate: (d) => d || '—',
      COLABORADORES: PESSOAS.filter(p => p.status !== 'inativo'),
      TREINAMENTOS_NR: [], CAT: [], PROGRAMAS: [], PLANO_ACAO: [],
      Auth: { sessaoAtual: async () => null },
      TreinamentosNR: null, CatAcidentes: null, ProgramasEsocial: null, StorageDocs: null,
      showToast: () => {},
    });
    mod.abrirModalCat();
    expect(grupos(doc).map(g => g.rotulo)).toEqual(['Colaboradores']);
  });

  it('editar uma CAT antiga reencontra o colaborador desligado', async () => {
    // Sem os ex na lista, abrir para editar deixava o seletor na pessoa
    // errada — e salvar moveria o acidente para outra pessoa, em silêncio.
    const { mod, doc } = await montar({
      cats: [{ id: 9, colaborador_id: 2, data_acidente: '2026-04-16', tipo: 'tipico' }],
    });
    mod.abrirModalCat(9);
    expect(doc.querySelector('#form-cat [name="colaborador_id"]').value).toBe('2');
  });
});

describe('a lista de CAT', () => {
  it('marca quem já não é da casa', async () => {
    const { mod, doc } = await montar({
      cats: [{ id: 9, colaborador_id: 2, data_acidente: '2026-04-16', tipo: 'tipico' }],
    });
    mod.renderCat();
    const linha = doc.querySelector('#tb-sst-cat tr').textContent;
    expect(linha).toContain('Zuleica Antiga');
    expect(linha).toContain('ex-colaborador');
  });

  it('não marca quem está ativo', async () => {
    const { mod, doc } = await montar({
      cats: [{ id: 9, colaborador_id: 1, data_acidente: '2026-04-16', tipo: 'tipico' }],
    });
    mod.renderCat();
    expect(doc.querySelector('#tb-sst-cat tr').textContent).not.toContain('ex-colaborador');
  });

  it('a matriz de treinamentos continua só com quem está na casa', async () => {
    // Ex-colaborador entra na CAT, que é histórico, mas não na matriz de
    // treinamentos, que é a foto de quem precisa estar qualificado hoje.
    const { mod, doc } = await montar();
    mod.renderTreinamentos();
    const nomes = doc.querySelector('#tb-sst-matriz').textContent;
    expect(nomes).not.toContain('Zuleica Antiga');
    expect(doc.querySelector('#sst-stat-pessoas').textContent).toBe('3');
  });
});
