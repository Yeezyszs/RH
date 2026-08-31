import { describe, it, expect, vi, afterEach } from 'vitest';
import { debounce, optionsColaboradores, competenciaAtual } from '../src/utils/ui.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

describe('debounce', () => {
  afterEach(() => vi.useRealTimers());

  it('só dispara depois da pausa', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    debounce(fn, 250)();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uma rajada vira uma chamada só', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 250);
    d(); vi.advanceTimersByTime(100);
    d(); vi.advanceTimersByTime(100);
    d(); vi.advanceTimersByTime(250);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('entrega os argumentos da última chamada', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('primeiro');
    d('ultimo');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('ultimo');
  });

  it('cancel aborta o disparo pendente', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    d.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('optionsColaboradores', () => {
  const pessoas = [
    { id: 3, nome: 'Carlos', setor: 'Produção', status: 'ativo' },
    { id: 1, nome: 'Ana',    setor: 'RH',       status: 'ativo' },
    { id: 2, nome: 'Bruno',  setor: 'Logística', status: 'inativo' },
  ];

  it('ordena os ativos por nome', () => {
    const html = optionsColaboradores(pessoas, esc);
    expect(html.indexOf('Ana')).toBeLessThan(html.indexOf('Carlos'));
  });

  it('põe os inativos num optgroup ao final', () => {
    const html = optionsColaboradores(pessoas, esc);
    expect(html).toContain('<optgroup label="Inativos / Desligados">');
    expect(html.indexOf('Carlos')).toBeLessThan(html.indexOf('optgroup'));
  });

  it('marca o inativo no rótulo', () => {
    expect(optionsColaboradores(pessoas, esc)).toContain('Bruno — Logística (inativo)');
  });

  it('mantém os inativos selecionáveis (lançamento retroativo)', () => {
    expect(optionsColaboradores(pessoas, esc)).toContain('<option value="2">');
  });

  it('não cria o optgroup quando todos estão ativos', () => {
    const so_ativos = pessoas.filter(c => c.status !== 'inativo');
    expect(optionsColaboradores(so_ativos, esc)).not.toContain('optgroup');
  });

  it('escapa o nome — impede injeção pelo cadastro', () => {
    const perigoso = [{ id: 9, nome: '<img src=x onerror=alert(1)>', setor: 'X', status: 'ativo' }];
    const html = optionsColaboradores(perigoso, esc);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('devolve string vazia sem colaboradores', () => {
    expect(optionsColaboradores([], esc)).toBe('');
  });
});

describe('competenciaAtual', () => {
  it('formata como AAAA-MM', () => {
    expect(competenciaAtual(new Date(2026, 7, 27))).toBe('2026-08');
  });

  it('zera à esquerda os meses de um dígito', () => {
    expect(competenciaAtual(new Date(2026, 0, 5))).toBe('2026-01');
  });

  it('usa a data local, não UTC', () => {
    // Em fuso negativo (Brasil), toISOString() do último dia às 21h já virou o
    // mês seguinte em UTC. A competência precisa seguir o calendário local.
    expect(competenciaAtual(new Date(2026, 7, 31, 21, 0, 0))).toBe('2026-08');
  });

  it('dezembro não vira janeiro do ano seguinte', () => {
    expect(competenciaAtual(new Date(2026, 11, 31, 23, 0, 0))).toBe('2026-12');
  });
});
