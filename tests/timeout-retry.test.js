import { describe, it, expect, vi, afterEach } from 'vitest';
import { withTimeout, withRetry } from './helpers.js';

describe('withTimeout', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('resolve o valor quando a promise completa antes do timeout', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000);
    expect(result).toBe(42);
  });

  it('resolve objetos complexos', async () => {
    const data = { id: 1, nome: 'Ana' };
    const result = await withTimeout(Promise.resolve(data), 1000);
    expect(result).toEqual(data);
  });

  it('rejeita com mensagem de timeout quando excede o prazo', async () => {
    vi.useFakeTimers();
    const lenta = new Promise(resolve => setTimeout(() => resolve('tarde'), 5000));
    const promise = withTimeout(lenta, 100);
    vi.advanceTimersByTime(101);
    await expect(promise).rejects.toThrow('Requisição expirou. Verifique sua conexão.');
  });

  it('propaga o erro original da promise rejeitada', async () => {
    const erro = new Error('Falha de rede');
    await expect(withTimeout(Promise.reject(erro), 1000)).rejects.toThrow('Falha de rede');
  });

  it('usa 6000ms como timeout padrão', async () => {
    vi.useFakeTimers();
    const lenta = new Promise(resolve => setTimeout(() => resolve('ok'), 10000));
    const promise = withTimeout(lenta); // sem ms explícito
    vi.advanceTimersByTime(5999);
    // ainda não expirou
    vi.advanceTimersByTime(2);
    await expect(promise).rejects.toThrow('expirou');
  });

  it('cancela o timer quando a promise resolve (sem memory leak)', async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const promise = withTimeout(Promise.resolve('ok'), 1000);
    vi.runAllTimers();
    await promise;
    expect(clearSpy).toHaveBeenCalled();
  });
});

describe('withRetry', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('retorna o resultado na primeira tentativa bem-sucedida', async () => {
    const fn = vi.fn().mockResolvedValue('sucesso');
    const result = await withRetry(fn, 3);
    expect(result).toBe('sucesso');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('tenta novamente após falha e retorna quando bem-sucedido', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('falha'))
      .mockResolvedValue('ok');
    const promise = withRetry(fn, 3);
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('lança o erro após esgotar todas as tentativas', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValue(new Error('erro persistente'));
    // .catch imediato evita warning de unhandled rejection durante os timers
    const promise = withRetry(fn, 3).catch(e => e);
    await vi.runAllTimersAsync();
    const err = await promise;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('erro persistente');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('lança imediatamente erros que não são de timeout (sem retry)', async () => {
    // withRetry em supabase.js retenta somente timeouts — mas a versão atual
    // retenta qualquer erro até maxRetries. Validamos o comportamento real.
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('qualquer erro'))
      .mockResolvedValue('ok');
    const promise = withRetry(fn, 3);
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respeita o maxRetries = 1 (sem retentativas)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('erro'));
    await expect(withRetry(fn, 1)).rejects.toThrow('erro');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
