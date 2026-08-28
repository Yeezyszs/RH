import { describe, it, expect, beforeEach } from 'vitest';
import { ValeCombustivelModule } from '../src/modules/vale-combustivel.js';

// O módulo mexe no DOM só dentro de render(); aqui exercitamos apenas o cálculo
// (_resumoDoMes / _saldoAnterior), que é a regra do saldo acumulativo.

function novoModulo({ cotas = {}, uso = {}, descontos = [], padrao = '150', colaboradores } = {}) {
  globalThis.document = globalThis.document || { addEventListener() {}, querySelectorAll: () => [] };
  return new ValeCombustivelModule({
    $: () => null,
    h: (s) => s,
    iniciais: (s) => s.slice(0, 2),
    fmtDate: (s) => s,
    fmtBRL: (v) => `R$ ${v}`,
    mesChave: (iso) => (iso ? iso.slice(0, 7) : ''),
    mesLabel: (c) => c,
    COLABORADORES: colaboradores || [{ id: 1, nome: 'TESTE', setor: 'Produção', status: 'ativo' }],
    VALE_COTAS: {},
    VALE_COTAS_MES: cotas,
    VALE_USO_MES: uso,
    VALE_DESCONTOS: descontos,
    CONFIG: { vale_combustivel_valor_padrao: padrao },
    CHART_COLORS: { grid: '#eee' },
    showToast: () => {},
  });
}

const linha = (mod, mes, colabId = 1) =>
  mod._resumoDoMes(mes).find(r => r.colab.id === colabId);

describe('vale combustível — saldo acumulativo', () => {
  let mod;

  beforeEach(() => {
    // Jan: crédito 150, gastou 50. Fev: crédito 150, sem gasto.
    mod = novoModulo({
      cotas: { '1|2026-01': 150, '1|2026-02': 150 },
      uso:   { '1|2026-01': 50 },
    });
  });

  it('no primeiro mês o saldo anterior é zero', () => {
    expect(linha(mod, '2026-01').anterior).toBe(0);
  });

  it('sobra do mês vira saldo (150 − 50 = 100)', () => {
    expect(linha(mod, '2026-01').saldo).toBe(100);
  });

  it('a sobra é o saldo anterior do mês seguinte', () => {
    expect(linha(mod, '2026-02').anterior).toBe(100);
  });

  it('acumula com o crédito do mês seguinte (100 + 150 = 250)', () => {
    expect(linha(mod, '2026-02').saldo).toBe(250);
  });

  it('consumo total zera o saldo, sem acumular', () => {
    const m = novoModulo({
      cotas: { '1|2026-01': 150, '1|2026-02': 150 },
      uso:   { '1|2026-01': 150 },
    });
    expect(linha(m, '2026-01').saldo).toBe(0);
    expect(linha(m, '2026-02').anterior).toBe(0);
    expect(linha(m, '2026-02').saldo).toBe(150);
  });
});

describe('vale combustível — descontos', () => {
  it('desconto reduz o saldo do mês', () => {
    const m = novoModulo({
      cotas: { '1|2026-01': 150 },
      descontos: [{ id: 1, colaborador_id: 1, mes: 1, ano: 2026, motivo: 'falta', valor: 50 }],
    });
    const r = linha(m, '2026-01');
    expect(r.perdido).toBe(50);
    expect(r.saldo).toBe(100);
  });

  it('vários descontos no mesmo mês somam', () => {
    const m = novoModulo({
      cotas: { '1|2026-01': 150 },
      descontos: [
        { id: 1, colaborador_id: 1, mes: 1, ano: 2026, motivo: 'falta',  valor: 50 },
        { id: 2, colaborador_id: 1, mes: 1, ano: 2026, motivo: 'atraso', valor: 25 },
      ],
    });
    expect(linha(m, '2026-01').perdido).toBe(75);
    expect(linha(m, '2026-01').saldo).toBe(75);
  });

  it('desconto maior que o disponível não gera saldo negativo', () => {
    const m = novoModulo({
      cotas: { '1|2026-01': 150 },
      descontos: [{ id: 1, colaborador_id: 1, mes: 1, ano: 2026, motivo: 'suspensao', valor: 400 }],
    });
    const r = linha(m, '2026-01');
    expect(r.saldo).toBe(0);
    expect(r.disponivel).toBe(0);
  });

  it('desconto e consumo se combinam (150 − 30 desconto − 20 gasto = 100)', () => {
    const m = novoModulo({
      cotas: { '1|2026-01': 150 },
      uso:   { '1|2026-01': 20 },
      descontos: [{ id: 1, colaborador_id: 1, mes: 1, ano: 2026, motivo: 'atraso', valor: 30 }],
    });
    expect(linha(m, '2026-01').saldo).toBe(100);
  });
});

describe('vale combustível — valor padrão', () => {
  it('mês sem valores gravados usa o valor padrão', () => {
    const m = novoModulo({ cotas: {} });
    expect(m._baseDe(1, '2026-08')).toBe(150);
  });

  it('valor padrão configurável é respeitado', () => {
    const m = novoModulo({ cotas: {}, padrao: '200' });
    expect(m._baseDe(1, '2026-08')).toBe(200);
  });

  it('competência já gravada não herda o padrão para quem não consta', () => {
    // O mês 2026-01 tem valores (do colaborador 2), então o 1 não recebeu nada.
    const m = novoModulo({
      cotas: { '2|2026-01': 150 },
      colaboradores: [
        { id: 1, nome: 'A', setor: 'X', status: 'ativo' },
        { id: 2, nome: 'B', setor: 'X', status: 'ativo' },
      ],
    });
    expect(m._baseDe(1, '2026-01')).toBe(0);
    expect(m._baseDe(2, '2026-01')).toBe(150);
  });
});
