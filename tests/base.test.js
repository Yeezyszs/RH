import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';

// base.js é um script "plain" (não-módulo) que anexa h/diasAte/fmtBRL ao window.
// Definimos window antes do import dinâmico para que o arquivo carregue sem erro
// e a cobertura seja atribuída a src/utils/base.js.
beforeAll(async () => {
  globalThis.window = globalThis.window || {};
  await import('../src/utils/base.js');
});

afterEach(() => vi.restoreAllMocks());

// ─── Exposição global ────────────────────────────────────────────────────────
describe('base.js — globais', () => {
  it('expõe h() no window', () => expect(typeof window.h).toBe('function'));
  it('expõe diasAte() no window', () => expect(typeof window.diasAte).toBe('function'));
  it('expõe fmtBRL() no window', () => expect(typeof window.fmtBRL).toBe('function'));
});

// ─── h() — escape HTML ───────────────────────────────────────────────────────
describe('h()', () => {
  it('escapa &', () => expect(window.h('a & b')).toBe('a &amp; b'));
  it('escapa <', () => expect(window.h('<script>')).toBe('&lt;script&gt;'));
  it('escapa >', () => expect(window.h('x > y')).toBe('x &gt; y'));
  it('escapa "', () => expect(window.h('"valor"')).toBe('&quot;valor&quot;'));
  it("escapa '", () => expect(window.h("it's")).toBe('it&#39;s'));
  it('retorna string vazia para null', () => expect(window.h(null)).toBe(''));
  it('retorna string vazia para undefined', () => expect(window.h(undefined)).toBe(''));
  it('converte número para string sem escape', () => expect(window.h(42)).toBe('42'));
  it('não altera string sem caracteres especiais', () => expect(window.h('ola mundo')).toBe('ola mundo'));
});

// ─── diasAte() ───────────────────────────────────────────────────────────────
describe('diasAte()', () => {
  it('retorna 0 para a data de hoje', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    expect(window.diasAte(hoje)).toBe(0);
  });
  it('retorna número positivo para data futura', () => {
    const futuro = new Date();
    futuro.setDate(futuro.getDate() + 10);
    expect(window.diasAte(futuro.toISOString().slice(0, 10))).toBe(10);
  });
  it('retorna número negativo para data passada', () => {
    const passado = new Date();
    passado.setDate(passado.getDate() - 5);
    expect(window.diasAte(passado.toISOString().slice(0, 10))).toBe(-5);
  });
});

// ─── fmtBRL() ────────────────────────────────────────────────────────────────
describe('fmtBRL()', () => {
  it('formata número como moeda BRL', () => {
    const out = window.fmtBRL(1234.5);
    expect(out).toContain('1.234,5');
    expect(out).toContain('R$');
  });
  it('retorna R$ 0,00 para null', () => {
    const out = window.fmtBRL(null);
    expect(out).toContain('0,00');
  });
  it('retorna R$ 0,00 para undefined', () => {
    const out = window.fmtBRL(undefined);
    expect(out).toContain('0,00');
  });
});
