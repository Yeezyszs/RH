import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { FeriasModule } from '../src/modules/ferias.js';

// A tela de férias falava a língua da lei: "aquisitivo", "concessivo", "abono
// pecuniário", quatro campos financeiros mostrando "—". Estes testes cobrem a
// reformulação: a situação em linguagem direta, a data de retorno calculada e
// as regras da CLT avisadas enquanto o usuário digita, não depois de salvar.

function montar({ colaboradores, ferias = [], salarios = {} } = {}) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ini = html.indexOf('<div id="modal-ferias"');
  const fim = html.indexOf('<!-- ════════════', ini);
  const dom = new JSDOM(`<body>${html.slice(ini, fim)}</body>`);

  global.window = dom.window;
  global.document = dom.window.document;
  global.FormData = dom.window.FormData;

  const mod = new FeriasModule({
    $: (s) => dom.window.document.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (d) => (d ? d.split('-').reverse().join('/') : '—'),
    fmtBRL: (v) => 'R$ ' + Number(v).toFixed(2),
    COLABORADORES: colaboradores,
    FERIAS: ferias,
    SALARIOS: salarios,
    Auth: null, Ferias: null,
  });
  return { mod, doc: dom.window.document };
}

const VETERANO = { id: 1, nome: 'Adão', setor: 'Produção', status: 'ativo', admissao: '2018-09-10' };
const NOVATO   = { id: 2, nome: 'Novato', setor: 'Produção', status: 'ativo', admissao: '2026-03-01' };
// Um ano e pouco de casa: exatamente um ciclo, ainda longe do prazo.
const RECENTE  = { id: 3, nome: 'Recente', setor: 'Produção', status: 'ativo', admissao: '2025-06-01' };

afterEach(() => vi.useRealTimers());

describe('situação — responde o que fazer, sem jargão', () => {
  it('quem não tem 1 ano de casa vê a data em que passa a ter direito', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00'));
    const { mod } = montar({ colaboradores: [NOVATO] });
    const s = mod._situacaoFerias(NOVATO);
    expect(s.tipo).toBe('sem_direito');
    expect(s.detalhe).toContain('01/03/2027');
  });

  it('perto do prazo, diz quantos dias restam', () => {
    // Em 02/09/2026 são 7 ciclos completos desde 2018. Com 6 quitados, o ciclo
    // aberto é o de 2024-09-10 a 2025-09-09, cujo prazo cai em 09/09/2026.
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00'));
    const quitados = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1, colaborador_id: 1, dias: 30, abono: 0,
      inicio: '2020-01-01', fim: '2020-01-30',
    }));
    const { mod } = montar({ colaboradores: [VETERANO], ferias: quitados });
    const s = mod._situacaoFerias(VETERANO);
    expect(s.tipo).toBe('urgente');
    expect(s.titulo).toContain('7 dias');
    expect(s.saldo).toBe(30);
  });

  it('quem nunca tirou férias aparece como vencido, não como em dia', () => {
    // Antes da correção isto era impossível: a tela olhava sempre o ciclo mais
    // recente, cujo prazo ainda não chegou. Anos sem férias passavam batidos.
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00'));
    const { mod } = montar({ colaboradores: [VETERANO] });
    const s = mod._situacaoFerias(VETERANO);
    expect(s.tipo).toBe('vencido');
    expect(s.detalhe).toContain('dobro');
    expect(s.detalhe).toContain('períodos acumulados');
    expect(s.prazo).toBe('2020-09-09');   // prazo do PRIMEIRO ciclo, de 2019
  });

  it('com folga de prazo, não gera alarme', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-15T12:00:00'));
    const quitados = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1, colaborador_id: 1, dias: 30, abono: 0,
      inicio: '2020-01-01', fim: '2020-01-30',
    }));
    const { mod } = montar({ colaboradores: [VETERANO], ferias: quitados });
    expect(mod._situacaoFerias(VETERANO).tipo).toBe('em_dia');
  });

  it('com todos os ciclos usados, aparece como em dia', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00'));
    const ferias = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1, colaborador_id: 1, dias: 30, abono: 0,
      inicio: '2020-01-01', fim: '2020-01-30',
    }));
    const { mod } = montar({ colaboradores: [VETERANO], ferias });
    const s = mod._situacaoFerias(VETERANO);
    expect(s.tipo).toBe('quitado');
    expect(s.saldo).toBe(0);
  });

  it('dias vendidos contam como usados', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00'));
    // 20 tirados + 10 vendidos fecham um ciclo inteiro.
    const ferias = [{ id: 1, colaborador_id: 1, inicio: '2026-01-05', fim: '2026-01-24', dias: 20, abono: 10 }];
    const { mod } = montar({ colaboradores: [VETERANO], ferias });
    expect(mod._situacaoFerias(VETERANO).diasUsados).toBe(30);
  });
});

describe('data de retorno — o que o gestor precisa saber', () => {
  let mod;
  beforeEach(() => { ({ mod } = montar({ colaboradores: [VETERANO] })); });

  it('30 dias a partir de 01/10 terminam em 30/10', () => {
    expect(mod._fimEVolta('2026-10-01', 30).fim).toBe('2026-10-30');
  });

  it('a volta ao trabalho é o dia seguinte ao fim', () => {
    expect(mod._fimEVolta('2026-10-01', 30).volta).toBe('2026-10-31');
  });

  it('um único dia começa e termina no mesmo dia', () => {
    const r = mod._fimEVolta('2026-10-01', 1);
    expect(r.fim).toBe('2026-10-01');
    expect(r.volta).toBe('2026-10-02');
  });

  it('atravessa a virada do ano', () => {
    expect(mod._fimEVolta('2026-12-20', 15).fim).toBe('2027-01-03');
  });

  it('sem data ou sem dias não calcula nada', () => {
    expect(mod._fimEVolta('', 30)).toBeNull();
    expect(mod._fimEVolta('2026-10-01', 0)).toBeNull();
  });
});

describe('regras da CLT avisadas antes de salvar', () => {
  const emSetembro = () => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00')); };

  it('impede lançar mais dias do que o saldo', () => {
    emSetembro();
    const ferias = [{ id: 1, colaborador_id: 1, inicio: '2026-01-05', fim: '2026-01-24', dias: 20, abono: 0 }];
    const { mod } = montar({ colaboradores: [VETERANO], ferias });
    const avisos = mod._avisosDoPeriodo({ colabId: 1, inicio: '2026-10-01', dias: 15, vender: 0 });
    expect(avisos.some(a => a.nivel === 'erro' && a.texto.includes('Restam 10'))).toBe(true);
  });

  it('impede o 4º período — a lei permite 3', () => {
    emSetembro();
    const ferias = [1, 2, 3].map(i => ({
      id: i, colaborador_id: 1, inicio: `2026-0${i}-05`, fim: `2026-0${i}-09`, dias: 5, abono: 0,
    }));
    const { mod } = montar({ colaboradores: [VETERANO], ferias });
    const avisos = mod._avisosDoPeriodo({ colabId: 1, inicio: '2026-10-01', dias: 5, vender: 0 });
    expect(avisos.some(a => a.nivel === 'erro' && a.texto.includes('máximo 3'))).toBe(true);
  });

  it('impede parte com menos de 5 dias quando há divisão', () => {
    emSetembro();
    const ferias = [{ id: 1, colaborador_id: 1, inicio: '2026-01-05', fim: '2026-01-18', dias: 14, abono: 0 }];
    const { mod } = montar({ colaboradores: [VETERANO], ferias });
    const avisos = mod._avisosDoPeriodo({ colabId: 1, inicio: '2026-10-01', dias: 3, vender: 0 });
    expect(avisos.some(a => a.nivel === 'erro' && a.texto.includes('5 dias'))).toBe(true);
  });

  it('avisa quando nenhuma parte chega a 14 dias', () => {
    emSetembro();
    const ferias = [{ id: 1, colaborador_id: 1, inicio: '2026-01-05', fim: '2026-01-14', dias: 10, abono: 0 }];
    const { mod } = montar({ colaboradores: [VETERANO], ferias });
    const avisos = mod._avisosDoPeriodo({ colabId: 1, inicio: '2026-10-01', dias: 10, vender: 0 });
    expect(avisos.some(a => a.nivel === 'atencao' && a.texto.includes('14 dias'))).toBe(true);
  });

  it('período de 30 dias de uma vez não gera aviso nenhum', () => {
    emSetembro();
    const { mod } = montar({ colaboradores: [RECENTE] });
    expect(mod._avisosDoPeriodo({ colabId: 3, inicio: '2026-09-05', dias: 30, vender: 0 })).toEqual([]);
  });

  it('avisa quando o período começa depois do prazo legal', () => {
    emSetembro();
    const { mod } = montar({ colaboradores: [VETERANO] });
    const avisos = mod._avisosDoPeriodo({ colabId: 1, inicio: '2026-12-01', dias: 30, vender: 0 });
    expect(avisos.some(a => a.texto.includes('dobro'))).toBe(true);
  });
});

describe('o modal renderizado', () => {
  it('mostra o título da situação e o saldo em destaque', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00'));
    const { mod, doc } = montar({ colaboradores: [VETERANO] });
    doc.querySelector('#fer-select-colab').innerHTML = '<option value="1">Adão</option>';
    mod.renderFeriasModal();
    // Quem nunca tirou férias: o banner precisa gritar, não informar.
    expect(doc.querySelector('.fer-banner-titulo').textContent).toContain('Prazo vencido');
    expect(doc.querySelector('.fer-banner').className).toContain('fer-critico');
    expect(doc.querySelector('.fer-saldo').textContent).toContain('30');
  });

  it('não mostra campos financeiros vazios quando não há salário', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00'));
    const { mod, doc } = montar({ colaboradores: [VETERANO] });
    doc.querySelector('#fer-select-colab').innerHTML = '<option value="1">Adão</option>';
    mod.renderFeriasModal();
    // O antigo painel mostrava quatro campos financeiros com "—". Agora há uma
    // frase só, explicando por que não dá para calcular.
    const contexto = doc.querySelector('.fer-contexto').textContent;
    expect(contexto).toContain('Salário não cadastrado');
    expect(doc.querySelectorAll('.info-value').length).toBe(0);
  });

  it('mostra o valor a pagar quando há salário', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00'));
    const { mod, doc } = montar({ colaboradores: [VETERANO], salarios: { 1: { valor: 3000 } } });
    doc.querySelector('#fer-select-colab').innerHTML = '<option value="1">Adão</option>';
    mod.renderFeriasModal();
    // 3000/30*30 = 3000, +1/3 = 4000
    expect(doc.querySelector('.fer-contexto').textContent).toContain('4000.00');
  });

  it('a prévia mostra o último dia e a volta ao trabalho', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00'));
    const { mod, doc } = montar({ colaboradores: [VETERANO] });
    doc.querySelector('#fer-select-colab').innerHTML = '<option value="1">Adão</option>';
    mod.renderFeriasModal();
    const f = doc.querySelector('#form-ferias-periodo');
    f.elements['inicio'].value = '2026-09-05';
    f.elements['dias'].value = '15';
    mod.atualizarPrevia();
    const previa = doc.querySelector('#fer-previa').textContent;
    expect(previa).toContain('19/09/2026');   // último dia
    expect(previa).toContain('20/09/2026');   // volta
  });

  it('o botão de agendar trava quando a regra é violada', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00'));
    const { mod, doc } = montar({ colaboradores: [VETERANO] });
    doc.querySelector('#fer-select-colab').innerHTML = '<option value="1">Adão</option>';
    mod.renderFeriasModal();
    const f = doc.querySelector('#form-ferias-periodo');
    f.elements['inicio'].value = '2026-09-05';
    f.elements['dias'].value = '40';          // acima do saldo de 30
    mod.atualizarPrevia();
    expect(doc.querySelector('#fer-btn-agendar').disabled).toBe(true);
    expect(doc.querySelector('#fer-avisos').textContent).toContain('Restam 30');
  });

  it('o botão volta a liberar com um período válido', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00'));
    const { mod, doc } = montar({ colaboradores: [VETERANO] });
    doc.querySelector('#fer-select-colab').innerHTML = '<option value="1">Adão</option>';
    mod.renderFeriasModal();
    const f = doc.querySelector('#form-ferias-periodo');
    f.elements['inicio'].value = '2026-09-05';
    f.elements['dias'].value = '30';
    mod.atualizarPrevia();
    expect(doc.querySelector('#fer-btn-agendar').disabled).toBe(false);
  });
});
