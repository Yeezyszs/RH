import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCache, mapColaborador, withTimeout } from './helpers.js';

// ── Fábrica de mock do cliente Supabase ─────────────────────────────────────

function makeSbChain(resolvedValue) {
  const chain = {
    select:  vi.fn().mockReturnThis(),
    eq:      vi.fn().mockReturnThis(),
    ilike:   vi.fn().mockReturnThis(),
    range:   vi.fn().mockReturnThis(),
    order:   vi.fn().mockReturnThis(),
    single:  vi.fn().mockResolvedValue(resolvedValue),
    insert:  vi.fn().mockReturnThis(),
    update:  vi.fn().mockReturnThis(),
    delete:  vi.fn().mockReturnThis(),
    // thenable: `await chain` resolve para resolvedValue
    then(resolve, reject) {
      return Promise.resolve(resolvedValue).then(resolve, reject);
    },
  };
  return chain;
}

// ── Colaboradores inline (mesma lógica do supabase.js, recebe sb e Cache) ───

function makeColaboradores(sb, cache) {
  return {
    async listar({ page = 1, limit = 100, busca = '', status = '', setor = '' } = {}) {
      const cacheKey = `colaboradores_${page}_${limit}_${busca}_${status}_${setor}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const from  = (page - 1) * limit;
      const to    = from + limit - 1;
      let query = sb.from('colaboradores').select('*', { count: 'exact' }).range(from, to).order('nome');
      if (busca)  query = query.ilike('nome', `%${busca}%`);
      if (status) query = query.eq('status', status);
      if (setor)  query = query.eq('departamento_id', setor);

      const { data, error, count } = await query;
      if (error) throw error;

      const result = {
        data:       data.map(mapColaborador),
        total:      count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      };
      cache.set(cacheKey, result);
      return result;
    },

    async buscar(id) {
      const cacheKey = `colaborador_${id}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await sb.from('colaboradores').select('*').eq('id', id).single();
      if (error) throw error;
      const result = mapColaborador(data);
      cache.set(cacheKey, result);
      return result;
    },

    async criar(payload) {
      const { data, error } = await sb.from('colaboradores').insert(payload).select().single();
      if (error) throw error;
      cache.invalidate();
      return mapColaborador(data);
    },

    async atualizar(id, payload) {
      const { data, error } = await sb.from('colaboradores').update(payload).eq('id', id).select().single();
      if (error) throw error;
      cache.invalidate(`colaborador_${id}`);
      cache.invalidate();
      return mapColaborador(data);
    },

    async excluir(id) {
      const { error } = await sb.from('colaboradores').delete().eq('id', id);
      if (error) throw error;
      cache.invalidate();
    },
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const COLAB_ROW = {
  id: 1, nome: 'Ana Paula', email: 'ana@empresa.com',
  status: 'ativo', data_admissao: '2021-03-15',
  cpf: '123.456.789-00', genero: 'Feminino',
  cargos: { nome: 'Analista RH' }, departamentos: { nome: 'Administrativo' },
};

// ── Testes ───────────────────────────────────────────────────────────────────

describe('Colaboradores.listar', () => {
  let cache, sb, Colaboradores;

  beforeEach(() => {
    cache = makeCache();
    const chain = makeSbChain({ data: [COLAB_ROW], error: null, count: 1 });
    sb = { from: vi.fn(() => chain), _chain: chain };
    Colaboradores = makeColaboradores(sb, cache);
  });

  it('retorna data mapeada com total e paginação', async () => {
    const res = await Colaboradores.listar();
    expect(res.data).toHaveLength(1);
    expect(res.data[0].nome).toBe('Ana Paula');
    expect(res.total).toBe(1);
    expect(res.page).toBe(1);
    expect(res.totalPages).toBe(1);
  });

  it('calcula totalPages corretamente', async () => {
    const chain = makeSbChain({ data: Array(10).fill(COLAB_ROW), error: null, count: 95 });
    const sb2 = { from: vi.fn(() => chain) };
    const C2 = makeColaboradores(sb2, makeCache());
    const res = await C2.listar({ limit: 10 });
    expect(res.totalPages).toBe(10);
  });

  it('usa cache na segunda chamada (sb.from não é chamado novamente)', async () => {
    await Colaboradores.listar();
    await Colaboradores.listar();
    expect(sb.from).toHaveBeenCalledTimes(1);
  });

  it('chaves de cache distintas para parâmetros distintos', async () => {
    await Colaboradores.listar({ page: 1 });
    await Colaboradores.listar({ page: 2 });
    expect(sb.from).toHaveBeenCalledTimes(2);
  });

  it('aplica filtro de busca na query', async () => {
    await Colaboradores.listar({ busca: 'Ana' });
    expect(sb._chain.ilike).toHaveBeenCalledWith('nome', '%Ana%');
  });

  it('aplica filtro de status na query', async () => {
    await Colaboradores.listar({ status: 'ativo' });
    expect(sb._chain.eq).toHaveBeenCalledWith('status', 'ativo');
  });

  it('aplica filtro de setor na query', async () => {
    await Colaboradores.listar({ setor: 3 });
    expect(sb._chain.eq).toHaveBeenCalledWith('departamento_id', 3);
  });

  it('lança erro quando Supabase retorna error', async () => {
    const chain = makeSbChain({ data: null, error: { message: 'DB error' }, count: 0 });
    const sb2 = { from: vi.fn(() => chain) };
    const C2 = makeColaboradores(sb2, makeCache());
    await expect(C2.listar()).rejects.toMatchObject({ message: 'DB error' });
  });
});

describe('Colaboradores.buscar', () => {
  let cache, sb, Colaboradores;

  beforeEach(() => {
    cache = makeCache();
    const chain = makeSbChain({ data: COLAB_ROW, error: null });
    sb = { from: vi.fn(() => chain) };
    Colaboradores = makeColaboradores(sb, cache);
  });

  it('retorna colaborador mapeado pelo id', async () => {
    const r = await Colaboradores.buscar(1);
    expect(r.id).toBe(1);
    expect(r.nome).toBe('Ana Paula');
  });

  it('armazena resultado no cache', async () => {
    await Colaboradores.buscar(1);
    expect(cache.get('colaborador_1')).toBeTruthy();
  });

  it('usa cache na segunda chamada', async () => {
    await Colaboradores.buscar(1);
    await Colaboradores.buscar(1);
    expect(sb.from).toHaveBeenCalledTimes(1);
  });
});

describe('Colaboradores.criar', () => {
  let cache, sb, Colaboradores;

  beforeEach(() => {
    cache = makeCache();
    const chain = makeSbChain({ data: COLAB_ROW, error: null });
    sb = { from: vi.fn(() => chain) };
    Colaboradores = makeColaboradores(sb, cache);
  });

  it('retorna o colaborador criado mapeado', async () => {
    const r = await Colaboradores.criar({ nome: 'Ana Paula' });
    expect(r.nome).toBe('Ana Paula');
  });

  it('invalida o cache após criar', async () => {
    cache.set('colaboradores_1_100___', { data: [], total: 0, page: 1, totalPages: 0 });
    await Colaboradores.criar({ nome: 'Ana Paula' });
    expect(cache._store.size).toBe(0);
  });
});

describe('Colaboradores.excluir', () => {
  let cache, sb, Colaboradores;

  beforeEach(() => {
    cache = makeCache();
    const chain = makeSbChain({ error: null });
    sb = { from: vi.fn(() => chain) };
    Colaboradores = makeColaboradores(sb, cache);
  });

  it('invalida o cache após excluir', async () => {
    cache.set('colaboradores_1_100___', { data: [] });
    await Colaboradores.excluir(1);
    expect(cache._store.size).toBe(0);
  });

  it('lança erro quando Supabase retorna error', async () => {
    const chain = makeSbChain({ error: { message: 'FK constraint' } });
    const sb2 = { from: vi.fn(() => chain) };
    const C2 = makeColaboradores(sb2, makeCache());
    await expect(C2.excluir(99)).rejects.toMatchObject({ message: 'FK constraint' });
  });
});
