// ============================================================================
// Migration 002: Paginação, Cache e Timeout — supabase.js improvements
// Aplicar substituindo as funções relevantes no supabase.js
// ============================================================================

// ── TIMEOUT HELPER ──────────────────────────────────────────────────────────
async function withTimeout(promise, ms = 6000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Requisição expirou. Verifique sua conexão.')), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── CACHE LOCAL ──────────────────────────────────────────────────────────────
const Cache = {
  _store: new Map(),
  TTL: 5 * 60 * 1000, // 5 minutos

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.time > this.TTL) {
      this._store.delete(key);
      return null;
    }
    return entry.data;
  },

  set(key, data) {
    this._store.set(key, { data, time: Date.now() });
  },

  invalidate(key) {
    if (key) {
      this._store.delete(key);
    } else {
      this._store.clear(); // Limpa tudo (ex: após logout)
    }
  },
};

// ── RETRY COM EXPONENTIAL BACKOFF ────────────────────────────────────────────
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === maxRetries - 1;
      const isTimeout = err.message?.includes('expirou');
      if (isLast || !isTimeout) throw err;
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.warn(`[Retry] Tentativa ${attempt + 1} falhou. Aguardando ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ── COLABORADORES COM PAGINAÇÃO + CACHE + TIMEOUT ────────────────────────────
const Colaboradores = {
  async listar({ page = 1, limit = 50, busca = '', status = '', setor = '' } = {}) {
    const cacheKey = `colaboradores_${page}_${limit}_${busca}_${status}_${setor}`;
    const cached = Cache.get(cacheKey);
    if (cached) return cached;

    const result = await withRetry(() =>
      withTimeout((async () => {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = sb
          .from('colaboradores')
          .select('*, cargos(nome), departamentos(nome)', { count: 'exact' })
          .range(from, to)
          .order('nome');

        if (busca)  query = query.ilike('nome', `%${busca}%`);
        if (status) query = query.eq('status', status);
        if (setor)  query = query.eq('departamento_id', setor);

        const { data, error, count } = await query;
        if (error) throw error;

        return {
          data: data.map(mapColaborador),
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        };
      })()
    ));

    Cache.set(cacheKey, result);
    return result;
  },

  async buscar(id) {
    const cacheKey = `colaborador_${id}`;
    const cached = Cache.get(cacheKey);
    if (cached) return cached;

    const result = await withTimeout(
      sb.from('colaboradores')
        .select('*, cargos(nome), departamentos(nome)')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return mapColaborador(data);
        })
    );

    Cache.set(cacheKey, result);
    return result;
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('colaboradores').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate(); // Invalida cache após criar
    return mapColaborador(data);
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('colaboradores').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate(`colaborador_${id}`);
    Cache.invalidate(); // Invalida listas
    return mapColaborador(data);
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('colaboradores').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate();
  },
};

// ── ADVERTÊNCIAS COM PAGINAÇÃO ─────────────────────────────────────────────
const Advertencias = {
  async listar({ page = 1, limit = 50 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await withTimeout(
      sb.from('advertencias')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('data_advertencia', { ascending: false })
    );
    if (error) throw error;

    return {
      data: data.map(mapAdvertencia),
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    };
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('advertencias').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate('advertencias');
    return mapAdvertencia(data);
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('advertencias').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('advertencias');
  },
};

// ── FÉRIAS COM PAGINAÇÃO ───────────────────────────────────────────────────
const Ferias = {
  async listar({ page = 1, limit = 50 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await withTimeout(
      sb.from('ferias')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('data_inicio', { ascending: false })
    );
    if (error) throw error;

    return {
      data: data.map(mapFerias),
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    };
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('ferias').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate('ferias');
    return mapFerias(data);
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('ferias').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('ferias');
    return mapFerias(data);
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('ferias').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('ferias');
  },
};

// Exportar no escopo global
window.Cache      = Cache;
window.withTimeout = withTimeout;
window.withRetry  = withRetry;
