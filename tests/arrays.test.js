import { describe, it, expect, beforeAll } from 'vitest';

// Os arrays globais são compartilhados POR REFERÊNCIA com os módulos: cada um
// guardou `this.X = deps.X` no bootstrap. Reatribuir (`X = novo`) criaria outro
// array e deixaria todas as telas apontando para o antigo, vazio. Estes
// helpers existem para alterar o conteúdo mantendo a referência — e é isso que
// os testes abaixo protegem.
beforeAll(async () => {
  globalThis.window = globalThis.window || {};
  await import('../src/utils/arrays.js');
});

describe('_preencherArray — troca o conteúdo, mantém a referência', () => {
  it('substitui os itens', () => {
    const arr = [1, 2, 3];
    window._preencherArray(arr, ['a', 'b']);
    expect(arr).toEqual(['a', 'b']);
  });

  it('mantém a MESMA referência (é o ponto de existir)', () => {
    const arr = [1];
    const mesmo = arr;
    window._preencherArray(arr, [9, 9, 9]);
    expect(arr).toBe(mesmo);
  });

  it('esvazia quando recebe lista vazia', () => {
    const arr = [1, 2];
    window._preencherArray(arr, []);
    expect(arr).toHaveLength(0);
  });
});

describe('_filtrarArray — remove no lugar', () => {
  it('mantém só o que passa no filtro', () => {
    const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
    window._filtrarArray(arr, x => x.id !== 2);
    expect(arr.map(x => x.id)).toEqual([1, 3]);
  });

  it('mantém a referência', () => {
    const arr = [{ id: 1 }, { id: 2 }];
    const mesmo = arr;
    window._filtrarArray(arr, x => x.id !== 1);
    expect(arr).toBe(mesmo);
  });

  it('filtro que exclui tudo deixa o array vazio', () => {
    const arr = [{ id: 1 }];
    window._filtrarArray(arr, () => false);
    expect(arr).toEqual([]);
  });
});

describe('_upsertArray — idempotente por id', () => {
  it('insere no topo quando o id é novo', () => {
    const arr = [{ id: 1, v: 'a' }];
    window._upsertArray(arr, { id: 2, v: 'b' });
    expect(arr.map(x => x.id)).toEqual([2, 1]);
  });

  it('substitui no lugar quando o id já existe', () => {
    const arr = [{ id: 1, v: 'a' }, { id: 2, v: 'b' }];
    window._upsertArray(arr, { id: 2, v: 'ATUALIZADO' });
    expect(arr).toHaveLength(2);
    expect(arr[1]).toEqual({ id: 2, v: 'ATUALIZADO' });
  });

  it('não duplica quando o realtime ecoa um insert já aplicado localmente', () => {
    // Cenário real: o módulo insere otimisticamente após salvar e, logo depois,
    // chega o evento de realtime com o mesmo registro.
    const arr = [];
    window._upsertArray(arr, { id: 7, v: 'x' });
    window._upsertArray(arr, { id: 7, v: 'x' });
    expect(arr).toHaveLength(1);
  });

  it('preserva a posição do item atualizado', () => {
    const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
    window._upsertArray(arr, { id: 1, novo: true });
    expect(arr[0]).toEqual({ id: 1, novo: true });
    expect(arr.map(x => x.id)).toEqual([1, 2, 3]);
  });

  it('mantém a referência', () => {
    const arr = [];
    const mesmo = arr;
    window._upsertArray(arr, { id: 1 });
    expect(arr).toBe(mesmo);
  });
});
