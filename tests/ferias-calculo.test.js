import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { FeriasModule } from '../src/modules/ferias.js';

// Cálculos de férias no módulo de PRODUÇÃO. São regras com efeito legal
// (período aquisitivo, limite concessivo) e financeiro (dias a pagar), então
// erram caro e em silêncio — não há tela que denuncie um cálculo errado.

function novoModulo({ colaboradores = [], ferias = [], salarios = {} } = {}) {
  globalThis.document = globalThis.document || { addEventListener() {}, querySelectorAll: () => [] };
  return new FeriasModule({
    $: () => null,
    h: (s) => s,
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (s) => s,
    fmtBRL: (v) => `R$ ${v}`,
    FERIAS: ferias,
    COLABORADORES: colaboradores,
    SALARIOS: salarios,
    showToast: () => {},
  });
}

let mod;
beforeAll(() => { mod = novoModulo(); });
afterEach(() => vi.useRealTimers());

describe('calcDias — dias de férias do período', () => {
  it('conta os dois extremos (30 dias cheios)', () => {
    // 01/07 a 30/07 são 30 dias, não 29 — o último dia também é férias.
    expect(mod.calcDias('2026-07-01', '2026-07-30')).toBe(30);
  });

  it('período de um único dia conta 1', () => {
    expect(mod.calcDias('2026-07-01', '2026-07-01')).toBe(1);
  });

  it('atravessa a virada do mês', () => {
    expect(mod.calcDias('2026-01-25', '2026-02-05')).toBe(12);
  });

  it('atravessa a virada do ano', () => {
    expect(mod.calcDias('2025-12-26', '2026-01-04')).toBe(10);
  });

  it('conta o dia extra em ano bissexto', () => {
    // 2028 é bissexto: 24/02 a 01/03 inclui 29/02.
    expect(mod.calcDias('2028-02-24', '2028-03-01')).toBe(7);
  });

  it('devolve 0 quando o fim é anterior ao início', () => {
    expect(mod.calcDias('2026-07-30', '2026-07-01')).toBe(0);
  });

  it('devolve 0 quando falta uma das datas', () => {
    expect(mod.calcDias('', '2026-07-30')).toBe(0);
    expect(mod.calcDias('2026-07-01', '')).toBe(0);
    expect(mod.calcDias('', '')).toBe(0);
  });
});

describe('_periodoAquisitivoAtual — direito a férias', () => {
  afterEach(() => vi.useRealTimers());

  it('não há período antes de completar 1 ano de casa', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00'));
    expect(mod._periodoAquisitivoAtual('2026-01-10')).toBeNull();
  });

  it('devolve o primeiro período assim que completa 1 ano', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00'));
    const p = mod._periodoAquisitivoAtual('2025-01-10');
    expect(p.inicio).toBe('2025-01-10');
    expect(p.fim).toBe('2026-01-09');   // véspera do aniversário seguinte
  });

  it('o limite concessivo é 1 ano após o fim do aquisitivo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00'));
    const p = mod._periodoAquisitivoAtual('2025-01-10');
    expect(p.concessivoLimite).toBe('2027-01-09');
  });

  it('avança para o ciclo corrente em quem tem mais tempo de casa', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00'));
    const p = mod._periodoAquisitivoAtual('2020-03-15');
    // Em jun/2026 são 6 anos completos: o ciclo aberto é o 6º.
    expect(p.inicio).toBe('2025-03-15');
    expect(p.fim).toBe('2026-03-14');
  });

  it('sem data de admissão não há período', () => {
    expect(mod._periodoAquisitivoAtual(null)).toBeNull();
    expect(mod._periodoAquisitivoAtual('')).toBeNull();
  });
});

describe('_periodoStatus — situação do período', () => {
  afterEach(() => vi.useRealTimers());

  const emAberto = (inicio, fim) => ({ inicio, fim });

  it('período futuro é planejada', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00'));
    expect(mod._periodoStatus(emAberto('2026-07-01', '2026-07-30'))).toBe('planejada');
  });

  it('período que engloba hoje é em_curso', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00'));
    expect(mod._periodoStatus(emAberto('2026-07-01', '2026-07-30'))).toBe('em_curso');
  });

  it('o último dia ainda conta como em_curso', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00'));
    expect(mod._periodoStatus(emAberto('2026-07-01', '2026-07-30'))).toBe('em_curso');
  });

  it('período passado é concluida', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00'));
    expect(mod._periodoStatus(emAberto('2026-07-01', '2026-07-30'))).toBe('concluida');
  });

  it('status gravado como concluída prevalece sobre as datas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00'));
    expect(mod._periodoStatus({ inicio: '2026-07-01', fim: '2026-07-30', status: 'concluida' }))
      .toBe('concluida');
  });
});

describe('_addYears / _addDays — aritmética de datas', () => {
  it('soma anos preservando o dia', () => {
    expect(mod._addYears('2025-01-10', 1)).toBe('2026-01-10');
  });

  it('subtrai um dia atravessando o mês', () => {
    expect(mod._addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('subtrai um dia atravessando o ano', () => {
    expect(mod._addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('respeita fevereiro em ano bissexto', () => {
    expect(mod._addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});
