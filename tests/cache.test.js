import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { makeCache } from './helpers.js';

describe('Cache', () => {
  let cache;

  beforeEach(() => { cache = makeCache(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('retorna null para chave inexistente', () => {
    expect(cache.get('nao-existe')).toBeNull();
  });

  it('armazena e recupera um valor', () => {
    cache.set('colabs', [{ id: 1 }]);
    expect(cache.get('colabs')).toEqual([{ id: 1 }]);
  });

  it('retorna o mesmo objeto por referência', () => {
    const obj = { nome: 'Ana' };
    cache.set('x', obj);
    expect(cache.get('x')).toBe(obj);
  });

  it('retorna null após TTL expirado', () => {
    const cache = makeCache(100);
    cache.set('temp', 'valor');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 200);
    expect(cache.get('temp')).toBeNull();
  });

  it('remove a entrada do store ao expirar', () => {
    const cache = makeCache(100);
    cache.set('temp', 'valor');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 200);
    cache.get('temp');
    expect(cache._store.size).toBe(0);
  });

  it('invalida uma chave específica sem afetar outras', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.invalidate('a');
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
  });

  it('invalida todas as chaves quando chamado sem argumento', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.invalidate();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
    expect(cache.get('c')).toBeNull();
    expect(cache._store.size).toBe(0);
  });

  it('sobrescreve valor existente com nova chamada a set', () => {
    cache.set('k', 'v1');
    cache.set('k', 'v2');
    expect(cache.get('k')).toBe('v2');
  });

  it('aceita valores falsy (0, false, string vazia)', () => {
    cache.set('zero',  0);
    cache.set('falso', false);
    cache.set('vazio', '');
    expect(cache.get('zero')).toBe(0);
    expect(cache.get('falso')).toBe(false);
    expect(cache.get('vazio')).toBe('');
  });
});
