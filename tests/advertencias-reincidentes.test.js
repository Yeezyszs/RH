import { describe, it, expect, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// "Top reincidentes" ficava preso em "Nenhum colaborador com 2+ advertências"
// mesmo com quatro reincidentes listados na tabela logo abaixo.
//
// A causa não era a contagem: era o estado vazio. Ele substituía o innerHTML
// do container do gráfico, o que apagava o <canvas> do DOM. A primeira
// renderização acontece antes de os dados chegarem do banco — então o canvas
// morria ali, e nenhuma renderização seguinte tinha onde desenhar.
//
// É um erro que não aparece em teste de cálculo nenhum: a conta sempre
// esteve certa. Só aparece renderizando duas vezes, que é o que a tela faz.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const PAGINA = (() => {
  const ini = html.indexOf('<div class="toolbar">', html.indexOf('page-advertencias'));
  return html.slice(ini, html.indexOf('</section>', ini));
})();

const PESSOAS = [
  { id: 1, nome: 'Reginaldo Patrocinio Junior', setor: 'Produção', status: 'ativo' },
  { id: 2, nome: 'Tiago Henrique da Silva',     setor: 'Produção', status: 'ativo' },
  { id: 3, nome: 'Fabio Rodrigues de Oliveira', setor: 'Produção', status: 'ativo' },
];

const adv = (id, colaborador_id, data, tipo = 'verbal') => ({
  id, colaborador_id, data, tipo,
  categoria: 'Conduta / postura', motivo: 'x', gestor: 'MAYCON', status: 'assinada',
});

// Como está no banco hoje: três reincidentes dentro dos últimos 12 meses.
const REINCIDENTES = [
  adv(1, 1, '2026-02-19'), adv(2, 1, '2026-05-10'), adv(3, 1, '2026-09-03'),
  adv(4, 2, '2026-02-21'), adv(5, 2, '2026-07-23', 'escrita'),
  adv(6, 3, '2026-04-30'), adv(7, 3, '2026-08-03'),
];

async function montar(advertencias) {
  const dom = new JSDOM(`<body><div id="page-advertencias">${PAGINA}</div></body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  const doc = dom.window.document;

  // Chart dublê: interessa o que o módulo manda desenhar, não o desenho.
  const desenhados = [];
  global.Chart = class {
    constructor(canvas, cfg) { desenhados.push({ id: canvas?.id, cfg }); }
    destroy() {}
  };

  const { AdvertenciasModule } = await import('../src/modules/advertencias.js');
  const mod = new AdvertenciasModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (d) => d || '—',
    ADVERTENCIAS: advertencias,
    COLABORADORES: PESSOAS,
    ADV_TIPO_BADGE: { verbal: { cls: 'warn', t: 'Verbal' }, escrita: { cls: 'danger', t: 'Escrita' }, suspensao: { cls: 'danger', t: 'Suspensão' } },
    ADV_STATUS_BADGE: { assinada: { cls: 'ok', t: 'Assinada' }, pendente: { cls: 'warn', t: 'Pendente' } },
    CHART_COLORS: { grid: '#eee', phthalo: '#123E6B' },
    Auth: { sessaoAtual: async () => null },
    Advertencias: null,
  });
  return { mod, doc, desenhados };
}

const topDesenhado = (desenhados) =>
  desenhados.filter(d => d.id === 'chart-adv-top').slice(-1)[0];

afterEach(() => { vi.useRealTimers(); delete global.Chart; });
const emNovembro = () => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-13T12:00:00')); };

describe('top reincidentes', () => {
  it('desenha o gráfico quando há quem tenha 2 ou mais', async () => {
    emNovembro();
    const { mod, doc, desenhados } = await montar(REINCIDENTES);
    mod.render();

    const g = topDesenhado(desenhados);
    expect(g, 'o gráfico do top não foi desenhado').toBeTruthy();
    expect(g.cfg.data.labels).toHaveLength(3);
    expect(doc.querySelector('#adv-top-vazio').style.display).toBe('none');
  });

  it('ordena do mais reincidente para o menos', async () => {
    emNovembro();
    const { mod, desenhados } = await montar(REINCIDENTES);
    mod.render();

    const g = topDesenhado(desenhados);
    expect(g.cfg.data.labels[0]).toContain('Reginaldo');   // 3 advertências
    const totais = g.cfg.data.labels.map((_, i) =>
      g.cfg.data.datasets.reduce((s, d) => s + d.data[i], 0));
    expect(totais).toEqual([...totais].sort((a, b) => b - a));
  });

  it('separa as advertências por tipo nas barras', async () => {
    emNovembro();
    const { mod, desenhados } = await montar(REINCIDENTES);
    mod.render();

    const g = topDesenhado(desenhados);
    const i = g.cfg.data.labels.findIndex(n => n.includes('Tiago'));
    const [verbal, escrita] = g.cfg.data.datasets;
    expect(verbal.data[i]).toBe(1);
    expect(escrita.data[i]).toBe(1);
  });

  it('sem reincidentes, avisa sem destruir o canvas', async () => {
    emNovembro();
    const { mod, doc } = await montar([adv(1, 1, '2026-09-03')]);   // uma só
    mod.render();

    expect(doc.querySelector('#adv-top-vazio').style.display).not.toBe('none');
    // O canvas continua no DOM — é disto que dependia a recuperação.
    expect(doc.querySelector('#chart-adv-top')).toBeTruthy();
  });

  it('a tela se recupera: renderiza vazia e depois com os dados', async () => {
    // É exatamente a sequência da vida real — a primeira renderização
    // acontece antes de os dados chegarem do banco.
    emNovembro();
    const lista = [];
    const { mod, doc, desenhados } = await montar(lista);

    mod.render();
    expect(topDesenhado(desenhados)).toBeFalsy();
    expect(doc.querySelector('#adv-top-vazio').style.display).not.toBe('none');

    lista.push(...REINCIDENTES);
    mod.render();

    const g = topDesenhado(desenhados);
    expect(g, 'depois dos dados chegarem o gráfico tem de aparecer').toBeTruthy();
    expect(g.cfg.data.labels).toHaveLength(3);
    expect(doc.querySelector('#adv-top-vazio').style.display).toBe('none');
  });

  it('e volta a avisar quando os reincidentes saem da janela de 12 meses', async () => {
    emNovembro();
    const lista = [...REINCIDENTES];
    const { mod, doc, desenhados } = await montar(lista);
    mod.render();
    expect(topDesenhado(desenhados)).toBeTruthy();

    lista.length = 0;
    mod.render();
    expect(doc.querySelector('#adv-top-vazio').style.display).not.toBe('none');
    expect(doc.querySelector('#chart-adv-top').style.display).toBe('none');
  });

  it('advertência de mais de 12 meses não conta', async () => {
    emNovembro();
    const { mod, doc } = await montar([
      adv(1, 1, '2025-01-10'), adv(2, 1, '2025-03-15'),   // fora da janela
      adv(3, 1, '2026-09-03'),                            // dentro
    ]);
    mod.render();
    expect(doc.querySelector('#adv-top-vazio').style.display).not.toBe('none');
  });
});
