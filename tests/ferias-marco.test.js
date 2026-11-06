import { describe, it, expect, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { FeriasModule } from '../src/modules/ferias.js';

// O sistema contava os ciclos aquisitivos desde a admissão e descontava só as
// férias registradas NELE. Como o controle era feito fora, tudo o que foi
// tirado antes é invisível: quem tinha 8 anos de casa aparecia com "8 períodos
// acumulados sem tirar" e "prazo vencido há 2339 dias" — número produzido pela
// falta de histórico, não pela realidade.
//
// Agora o padrão é "em dia": um único período em aberto, o último ciclo
// completo. Quem afirma que alguém está atrasado é o RH, pelo marco.

function montar({ colaboradores, ferias = [], salvos = [] } = {}) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ini = html.indexOf('<div id="modal-ferias"');
  const dom = new JSDOM(`<body>${html.slice(ini, html.indexOf('<!-- ════════════', ini))}</body>`);

  global.window = dom.window;
  global.document = dom.window.document;
  global.FormData = dom.window.FormData;
  const doc = dom.window.document;

  const mod = new FeriasModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (d) => (d ? d.split('-').reverse().join('/') : '—'),
    fmtBRL: (v) => 'R$ ' + Number(v).toFixed(2),
    COLABORADORES: colaboradores,
    FERIAS: ferias,
    SALARIOS: {},
    Auth: { sessaoAtual: async () => ({ user: 1 }) },
    Ferias: null,
    Colaboradores: { atualizar: async (id, p) => { salvos.push({ id, ...p }); return { id, ...p }; } },
  });
  return { mod, doc };
}

// Oito anos de casa, nenhuma férias registrada neste sistema.
const veterano = (extra = {}) => ({
  id: 1, nome: 'Adão', setor: 'Produção', status: 'ativo', admissao: '2018-09-10', ...extra,
});

const emSetembro = () => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00')); };
afterEach(() => vi.useRealTimers());

describe('sem marco, o sistema assume férias em dia', () => {
  it('não inventa períodos acumulados para quem tem anos de casa', () => {
    emSetembro();
    const c = veterano();
    const { mod } = montar({ colaboradores: [c] });
    const s = mod._situacaoFerias(c);

    expect(s.tipo).not.toBe('vencido');
    expect(s.aquisitivo.ciclosVencidos).toBe(1);
    expect(s.detalhe).not.toContain('períodos acumulados');
    // O alerta do período corrente ainda pode falar em dobro — o que não pode
    // é o atraso fabricado: nada de prazo estourado há anos.
    expect(s.diasAteOPrazo).toBeGreaterThan(0);
  });

  it('o período em aberto é o último ciclo completo', () => {
    emSetembro();
    const c = veterano();
    const { mod } = montar({ colaboradores: [c] });
    const s = mod._situacaoFerias(c);

    // Em 02/09/2026 o último ciclo fechado vai de 10/09/2024 a 09/09/2025.
    expect(s.aquisitivo.inicio).toBe('2024-09-10');
    expect(s.aquisitivo.fim).toBe('2025-09-09');
    expect(s.prazo).toBe('2026-09-09');
    expect(s.saldo).toBe(30);
  });

  it('ainda avisa quando esse único período está perto do prazo', () => {
    // "Em dia" não quer dizer "nunca alerta": o período corrente também vence.
    emSetembro();
    const c = veterano();
    const { mod } = montar({ colaboradores: [c] });
    expect(mod._situacaoFerias(c).tipo).toBe('urgente');
  });

  it('quem tem pouco tempo de casa não muda de comportamento', () => {
    emSetembro();
    const novato = { id: 2, nome: 'Novato', status: 'ativo', admissao: '2026-03-01' };
    const { mod } = montar({ colaboradores: [novato] });
    expect(mod._situacaoFerias(novato).tipo).toBe('sem_direito');
  });

  it('férias registradas no sistema continuam quitando o período', () => {
    emSetembro();
    const c = veterano();
    const ferias = [{ id: 1, colaborador_id: 1, inicio: '2026-01-05', fim: '2026-02-03', dias: 30, abono: 0 }];
    const { mod } = montar({ colaboradores: [c], ferias });
    expect(mod._situacaoFerias(c).tipo).toBe('quitado');
  });
});

describe('com marco, o RH registra o atraso real', () => {
  it('marco na admissão faz contar tudo desde o começo', () => {
    emSetembro();
    const c = veterano({ ferias_marco: '2018-09-10' });
    const { mod } = montar({ colaboradores: [c] });
    const s = mod._situacaoFerias(c);

    expect(s.tipo).toBe('vencido');
    expect(s.prazo).toBe('2020-09-09');          // prazo do primeiro ciclo
    expect(s.aquisitivo.ciclosVencidos).toBe(7);
    expect(s.detalhe).toContain('períodos acumulados');
  });

  it('marco intermediário quita o que veio antes dele', () => {
    emSetembro();
    // Em dia até 10/09/2022: os ciclos de 2018 a 2021 estão pagos.
    const c = veterano({ ferias_marco: '2022-09-10' });
    const { mod } = montar({ colaboradores: [c] });
    const s = mod._situacaoFerias(c);

    expect(s.aquisitivo.inicio).toBe('2022-09-10');
    expect(s.prazo).toBe('2024-09-09');
    expect(s.aquisitivo.ciclosVencidos).toBe(3);
    expect(s.tipo).toBe('vencido');
  });

  it('marco posterior ao último ciclo deixa tudo quitado', () => {
    emSetembro();
    const c = veterano({ ferias_marco: '2026-08-01' });
    const { mod } = montar({ colaboradores: [c] });
    expect(mod._situacaoFerias(c).tipo).toBe('quitado');
  });

  it('marco antes da admissão não produz ciclo negativo', () => {
    emSetembro();
    const c = veterano({ ferias_marco: '2010-01-01' });
    const { mod } = montar({ colaboradores: [c] });
    expect(mod._situacaoFerias(c).aquisitivo.inicio).toBe('2018-09-10');
  });
});

describe('o controle do marco na tela', () => {
  const abrir = (c, salvos) => {
    const r = montar({ colaboradores: [c], salvos });
    r.doc.querySelector('#fer-select-colab').innerHTML = `<option value="${c.id}">${c.nome}</option>`;
    r.mod.renderFeriasModal();
    return r;
  };

  it('sem marco, explica a premissa e oferece registrar o atraso', () => {
    emSetembro();
    const { doc } = abrir(veterano(), []);
    const texto = doc.querySelector('#fer-marco').textContent;
    expect(texto).toContain('em dia');
    expect(texto).toContain('Registrar atraso');
    expect(doc.querySelector('#fer-marco-form').hidden).toBe(true);
  });

  it('com marco, mostra a data que o RH registrou', () => {
    emSetembro();
    const { doc } = abrir(veterano({ ferias_marco: '2020-06-11' }), []);
    expect(doc.querySelector('#fer-marco').textContent).toContain('11/06/2020');
    expect(doc.querySelector('#fer-marco-data').value).toBe('2020-06-11');
  });

  it('a prévia mostra o efeito antes de salvar', () => {
    emSetembro();
    const { mod, doc } = abrir(veterano(), []);
    mod.alternarMarco();
    expect(doc.querySelector('#fer-marco-form').hidden).toBe(false);

    doc.querySelector('#fer-marco-data').value = '2018-09-10';
    mod.previewMarco();
    expect(doc.querySelector('#fer-marco-previa').textContent).toContain('7 períodos em aberto');

    doc.querySelector('#fer-marco-data').value = '';
    mod.previewMarco();
    expect(doc.querySelector('#fer-marco-previa').textContent).toContain('em dia');
  });

  it('salvar grava a data e muda a situação na hora', async () => {
    emSetembro();
    const salvos = [];
    const c = veterano();
    const { mod, doc } = abrir(c, salvos);
    doc.querySelector('#fer-marco-data').value = '2018-09-10';
    await mod.salvarMarco();

    expect(salvos).toEqual([{ id: 1, ferias_marco: '2018-09-10' }]);
    expect(c.ferias_marco).toBe('2018-09-10');
    expect(doc.querySelector('.fer-banner-titulo').textContent).toContain('Prazo vencido');
  });

  it('limpar devolve o colaborador para "em dia"', async () => {
    emSetembro();
    const salvos = [];
    const c = veterano({ ferias_marco: '2018-09-10' });
    const { mod, doc } = abrir(c, salvos);
    await mod.limparMarco();

    expect(salvos).toEqual([{ id: 1, ferias_marco: null }]);
    expect(c.ferias_marco).toBeNull();
    expect(doc.querySelector('.fer-banner-titulo').textContent).not.toContain('Prazo vencido');
  });

  it('recusa data anterior à admissão sem gravar nada', async () => {
    emSetembro();
    const salvos = [];
    const erros = [];
    const c = veterano();
    const { mod, doc } = abrir(c, salvos);
    // Depois de montar: é o montar que troca o global.window.
    global.window.showToast = (msg, tipo) => erros.push([msg, tipo]);
    doc.querySelector('#fer-marco-data').value = '2017-01-01';
    await mod.salvarMarco();

    expect(salvos).toHaveLength(0);
    expect(c.ferias_marco).toBeUndefined();
    expect(erros[0][1]).toBe('err');
  });
});
