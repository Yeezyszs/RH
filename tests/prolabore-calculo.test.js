import { describe, it, expect, beforeAll } from 'vitest';
import { ProlaboreModule } from '../src/modules/prolabore.js';

// Cálculo de descontos e líquido do pró-labore, no módulo de produção.
// São dois regimes distintos (sócio e cooperado) que somam coisas diferentes —
// trocar um pelo outro dá um número plausível e errado.

let mod;
beforeAll(() => {
  globalThis.document = globalThis.document || { addEventListener() {}, querySelectorAll: () => [] };
  mod = new ProlaboreModule({
    $: () => null,
    h: (s) => s,
    fmtBRL: (v) => `R$ ${v}`,
    PROLABORE: [],
    showToast: () => {},
  });
});

describe('_descontos — regime de sócio', () => {
  it('soma INSS, IRRF, Unimed e adiantamento', () => {
    expect(mod._descontos({ tipo: 'socio', inss: 100, irrf: 325.25, unimed: 250.5, adiantamento: 400 }))
      .toBe(1075.75);
  });

  // O pró-labore é tributável: sem o IRRF na conta, o líquido sai maior do que
  // o sócio recebe de fato, e o erro é silencioso.
  it('o IRRF entra no desconto', () => {
    expect(mod._descontos({ tipo: 'socio', inss: 932.31, irrf: 1200 })).toBe(2132.31);
    expect(mod._liquido({ tipo: 'socio', valor_base: 10000, inss: 932.31, irrf: 1200 }))
      .toBeCloseTo(7867.69, 2);
  });

  it('IRRF ausente conta como zero — lançamento antigo não muda de valor', () => {
    expect(mod._descontos({ tipo: 'socio', inss: 932.31, unimed: 0, adiantamento: 0 }))
      .toBe(932.31);
  });

  it('campo ausente conta como zero', () => {
    expect(mod._descontos({ tipo: 'socio', inss: 100 })).toBe(100);
  });

  it('string numérica é convertida', () => {
    expect(mod._descontos({ tipo: 'socio', inss: '100.50', unimed: '49.50' })).toBe(150);
  });

  it('valor inválido não contamina o total', () => {
    expect(mod._descontos({ tipo: 'socio', inss: 100, unimed: 'abc' })).toBe(100);
  });

  it('sem nenhum desconto o total é zero', () => {
    expect(mod._descontos({ tipo: 'socio' })).toBe(0);
  });
});

describe('_descontos — regime de cooperado', () => {
  it('soma os itens da lista, ignorando INSS/IRRF/Unimed', () => {
    const r = {
      tipo: 'cooper',
      inss: 999, irrf: 999, unimed: 999,   // não entram neste regime
      itens: [{ valor: 120 }, { valor: 80.25 }],
    };
    expect(mod._descontos(r)).toBe(200.25);
  });

  it('lista vazia dá zero', () => {
    expect(mod._descontos({ tipo: 'cooper', itens: [] })).toBe(0);
  });

  it('itens ausentes não quebram o cálculo', () => {
    expect(mod._descontos({ tipo: 'cooper' })).toBe(0);
  });

  it('itens em formato inesperado não quebram o cálculo', () => {
    expect(mod._descontos({ tipo: 'cooper', itens: 'nada disso' })).toBe(0);
  });

  it('item sem valor conta como zero', () => {
    expect(mod._descontos({ tipo: 'cooper', itens: [{ valor: 50 }, {}] })).toBe(50);
  });
});

describe('_liquido — base menos descontos', () => {
  it('desconta do valor base no regime de sócio', () => {
    expect(mod._liquido({ tipo: 'socio', valor_base: 10000, inss: 1100, unimed: 400 }))
      .toBe(8500);
  });

  it('desconta os itens no regime de cooperado', () => {
    expect(mod._liquido({ tipo: 'cooper', valor_base: 5000, itens: [{ valor: 300 }] }))
      .toBe(4700);
  });

  it('sem descontos o líquido é a base', () => {
    expect(mod._liquido({ tipo: 'socio', valor_base: 7500 })).toBe(7500);
  });

  it('sem base o líquido é negativo, não NaN', () => {
    // Cenário de erro de digitação: precisa aparecer como número, para a tela
    // mostrar algo evidentemente errado em vez de "NaN" ou zero silencioso.
    expect(mod._liquido({ tipo: 'socio', inss: 200 })).toBe(-200);
  });

  it('trabalha com centavos sem perder precisão perceptível', () => {
    const v = mod._liquido({ tipo: 'socio', valor_base: 1234.56, inss: 234.56 });
    expect(v).toBeCloseTo(1000, 2);
  });
});
