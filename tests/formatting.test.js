import { describe, it, expect, vi, afterEach } from 'vitest';
import { h, iniciais, fmtDate, fmtBRL, tempoCasa, diasAte, vencStatus, vencBadge, mesChave, mesLabel, addDays } from '../src/utils/formatting.js';

afterEach(() => vi.restoreAllMocks());

// ─── h() — escape HTML ───────────────────────────────────────────────────────
describe('h()', () => {
  it('escapa &', () => expect(h('a & b')).toBe('a &amp; b'));
  it('escapa <', () => expect(h('<script>')).toBe('&lt;script&gt;'));
  it('escapa >', () => expect(h('x > y')).toBe('x &gt; y'));
  it('escapa "', () => expect(h('"valor"')).toBe('&quot;valor&quot;'));
  it("escapa '", () => expect(h("it's")).toBe("it&#39;s"));
  it('retorna string vazia para null', () => expect(h(null)).toBe(''));
  it('retorna string vazia para undefined', () => expect(h(undefined)).toBe(''));
  it('converte número para string sem escape', () => expect(h(42)).toBe('42'));
  it('não altera string sem caracteres especiais', () => expect(h('ola mundo')).toBe('ola mundo'));
});

// ─── iniciais() ──────────────────────────────────────────────────────────────
describe('iniciais()', () => {
  it('retorna duas iniciais maiúsculas', () => expect(iniciais('Ana Lima')).toBe('AL'));
  it('usa primeira e última palavra', () => expect(iniciais('João Carlos Silva')).toBe('JS'));
  it('retorna duas letras iguais para nome simples', () => expect(iniciais('Maria')).toBe('MM'));
  it('retorna string vazia para nome vazio', () => expect(iniciais('')).toBe(''));
  it('retorna string vazia para null', () => expect(iniciais(null)).toBe(''));
  it('ignora espaços extras', () => expect(iniciais('  Ana  Lima  ')).toBe('AL'));
});

// ─── fmtDate() ───────────────────────────────────────────────────────────────
describe('fmtDate()', () => {
  it('formata ISO para dd/mm/yyyy', () => expect(fmtDate('2024-03-15')).toBe('15/03/2024'));
  it('retorna — para null', () => expect(fmtDate(null)).toBe('—'));
  it('retorna — para undefined', () => expect(fmtDate(undefined)).toBe('—'));
  it('retorna — para string vazia', () => expect(fmtDate('')).toBe('—'));
  it('mantém zeros à esquerda', () => expect(fmtDate('2024-01-05')).toBe('05/01/2024'));
});

// ─── fmtBRL() ────────────────────────────────────────────────────────────────
describe('fmtBRL()', () => {
  it('formata valor em reais', () => {
    const resultado = fmtBRL(1500);
    expect(resultado).toContain('1.500');
    expect(resultado).toMatch(/R\$/);
  });
  it('trata null como zero', () => {
    const resultado = fmtBRL(null);
    expect(resultado).toContain('0');
  });
  it('trata undefined como zero', () => {
    expect(fmtBRL(undefined)).toContain('0');
  });
});

// ─── tempoCasa() ─────────────────────────────────────────────────────────────
describe('tempoCasa()', () => {
  it('retorna — para null', () => expect(tempoCasa(null)).toBe('—'));
  it('retorna — para string vazia', () => expect(tempoCasa('')).toBe('—'));

  it('retorna "menos de 1 mês" para admissão recente', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    expect(tempoCasa(hoje)).toBe('menos de 1 mês');
  });

  it('retorna anos e meses corretamente', () => {
    vi.spyOn(Date, 'now');
    const resultado = tempoCasa('2020-01-01');
    expect(resultado).toMatch(/\d+a \d+m/);
  });

  it('retorna só anos quando meses = 0', () => {
    const hoje = new Date();
    const dataRef = new Date(hoje.getFullYear() - 2, hoje.getMonth(), hoje.getDate());
    const iso = dataRef.toISOString().slice(0, 10);
    const resultado = tempoCasa(iso);
    expect(resultado).toMatch(/anos?/);
  });
});

// ─── diasAte() ───────────────────────────────────────────────────────────────
describe('diasAte()', () => {
  it('retorna 0 para hoje', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    expect(diasAte(hoje)).toBe(0);
  });

  it('retorna positivo para data futura', () => {
    const amanha = addDays(new Date().toISOString().slice(0, 10), 1);
    expect(diasAte(amanha)).toBeGreaterThan(0);
  });

  it('retorna negativo para data passada', () => {
    const ontem = addDays(new Date().toISOString().slice(0, 10), -1);
    expect(diasAte(ontem)).toBeLessThan(0);
  });
});

// ─── vencStatus() ────────────────────────────────────────────────────────────
describe('vencStatus()', () => {
  it('retorna "vencido" para dias negativos', () => expect(vencStatus(-1)).toBe('vencido'));
  it('retorna "vencido" para 0 dias negativos', () => expect(vencStatus(-30)).toBe('vencido'));
  it('retorna "critico" para 0 a 7 dias', () => {
    expect(vencStatus(0)).toBe('critico');
    expect(vencStatus(7)).toBe('critico');
  });
  it('retorna "alerta" para 8 a 30 dias', () => {
    expect(vencStatus(8)).toBe('alerta');
    expect(vencStatus(30)).toBe('alerta');
  });
  it('retorna "ok" para mais de 30 dias', () => {
    expect(vencStatus(31)).toBe('ok');
    expect(vencStatus(365)).toBe('ok');
  });
});

// ─── vencBadge() ─────────────────────────────────────────────────────────────
describe('vencBadge()', () => {
  it('retorna badge danger para vencido', () => expect(vencBadge(-1)).toContain('badge danger'));
  it('retorna badge warn para crítico', () => expect(vencBadge(3)).toContain('badge warn'));
  it('retorna badge info para alerta', () => expect(vencBadge(15)).toContain('badge info'));
  it('retorna badge ok para ok', () => expect(vencBadge(60)).toContain('badge ok'));
});

// ─── mesChave() / mesLabel() ─────────────────────────────────────────────────
describe('mesChave()', () => {
  it('extrai yyyy-mm de ISO', () => expect(mesChave('2024-03-15')).toBe('2024-03'));
  it('retorna string vazia para null', () => expect(mesChave(null)).toBe(''));
  it('retorna string vazia para undefined', () => expect(mesChave(undefined)).toBe(''));
});

describe('mesLabel()', () => {
  it('formata chave em label legível', () => expect(mesLabel('2024-03')).toBe('Mar/2024'));
  it('retorna string vazia para null', () => expect(mesLabel(null)).toBe(''));
  it('formata dezembro corretamente', () => expect(mesLabel('2024-12')).toBe('Dez/2024'));
  it('formata janeiro corretamente', () => expect(mesLabel('2024-01')).toBe('Jan/2024'));
});

// ─── addDays() ───────────────────────────────────────────────────────────────
describe('addDays()', () => {
  it('adiciona dias corretamente', () => expect(addDays('2024-01-01', 10)).toBe('2024-01-11'));
  it('subtrai dias com n negativo', () => expect(addDays('2024-01-15', -5)).toBe('2024-01-10'));
  it('cruza meses corretamente', () => expect(addDays('2024-01-28', 5)).toBe('2024-02-02'));
  it('cruza anos corretamente', () => expect(addDays('2024-12-30', 5)).toBe('2025-01-04'));
  it('adiciona 0 dias retorna mesma data', () => expect(addDays('2024-06-15', 0)).toBe('2024-06-15'));
});
