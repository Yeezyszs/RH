// API — Benefícios
// Depende de: sb, withTimeout, Cache, mapFerias (supabase.js)

const Ferias = {
  async listar({ page = 1, limit = 50 } = {}) {
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    const { data, error, count } = await withTimeout(
      sb.from('ferias')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('data_inicio', { ascending: false })
    );
    if (error) throw error;

    return {
      data:       data.map(mapFerias),
      total:      count,
      page,
      totalPages: Math.ceil(count / limit),
    };
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('ferias').insert(payload).select().single()
    );
    if (error) throw error;
    return mapFerias(data);
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('ferias').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    return mapFerias(data);
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('ferias').delete().eq('id', id)
    );
    if (error) throw error;
  },
};

const Salarios = {
  async listar() {
    const cached = Cache.get('salarios');
    if (cached) return cached;
    const { data, error } = await withTimeout(
      sb.from('salario_atual').select('id, colaborador_id, valor, data_alteracao, observacoes').order('colaborador_id')
    );
    if (error) throw error;
    Cache.set('salarios', data);
    return data;
  },

  async criar(payload) {
    const row = {
      colaborador_id: payload.colaborador_id,
      valor:          payload.valor          ?? 0,
      data_alteracao: payload.data_alteracao || new Date().toISOString().slice(0, 10),
      observacoes:    payload.observacoes    || null,
    };
    const { data, error } = await withTimeout(
      sb.from('salario_atual').insert(row).select().single()
    );
    if (error) throw error;
    Cache.invalidate('salarios');
    return data;
  },

  async atualizar(id, payload) {
    const row = {
      valor:          payload.valor          ?? 0,
      data_alteracao: payload.data_alteracao || new Date().toISOString().slice(0, 10),
      observacoes:    payload.observacoes    || null,
    };
    const { data, error } = await withTimeout(
      sb.from('salario_atual').update(row).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('salarios');
    return data;
  },
};

const ValeCombustivel = {
  async listar() {
    const cached = Cache.get('vale_combustivel');
    if (cached) return cached;
    const { data, error } = await withTimeout(
      sb.from('vale_combustivel')
        .select('id, colaborador_id, data, valor, litros, km_atual, posto, observacoes')
        .not('data', 'is', null)
        .order('data', { ascending: false })
    );
    if (error) throw error;
    Cache.set('vale_combustivel', data);
    return data;
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('vale_combustivel').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate('vale_combustivel');
    return data;
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('vale_combustivel').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('vale_combustivel');
    return data;
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('vale_combustivel').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('vale_combustivel');
  },

  // ─── Cotas mensais ────────────────────────────────────────────────────────
  // As cotas ficam em linhas da própria tabela vale_combustivel com `data`
  // nula e `mes`/`ano`/`valor_mensal` preenchidos (os lançamentos têm `data`).

  async listarCotas() {
    const { data, error } = await withTimeout(
      sb.from('vale_combustivel')
        .select('id, colaborador_id, mes, ano, valor_mensal')
        .is('data', null)
        .not('valor_mensal', 'is', null)
        .order('colaborador_id')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  async upsertCota(payload) {
    const { data, error } = await withTimeout(
      sb.from('vale_combustivel')
        .upsert(payload, { onConflict: 'colaborador_id,mes,ano' })
        .select()
        .single()
    );
    if (error) throw error;
    Cache.invalidate('vale_combustivel');
    return data;
  },
};

const ValeAlimentacao = {
  async listar() {
    const cached = Cache.get('vale_alimentacao');
    if (cached) return cached;
    const { data, error } = await withTimeout(
      sb.from('vale_alimentacao')
        .select('id, colaborador_id, mes, ano, valor_mensal, data_concessao, status, tipo, dias_uteis, observacoes')
        .order('colaborador_id')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
    );
    if (error) throw error;
    Cache.set('vale_alimentacao', data);
    return data;
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('vale_alimentacao').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate('vale_alimentacao');
    return data;
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('vale_alimentacao').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('vale_alimentacao');
    return data;
  },

  // Cria ou atualiza o benefício do colaborador para o mês/ano informado
  // (chave única colaborador_id, mes, ano) — usado tanto no cadastro
  // individual quanto na padronização por setor.
  async upsert(payload) {
    const { data, error } = await withTimeout(
      sb.from('vale_alimentacao')
        .upsert(payload, { onConflict: 'colaborador_id,mes,ano' })
        .select()
        .single()
    );
    if (error) throw error;
    Cache.invalidate('vale_alimentacao');
    return data;
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('vale_alimentacao').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('vale_alimentacao');
  },
};

const Afastamentos = {
  async listar(colabId = null) {
    let query = sb.from('afastamentos').select('*').order('data_inicio', { ascending: false });
    if (colabId) {
      query = query.eq('colaborador_id', colabId);
    }
    const { data, error } = await withTimeout(query);
    if (error) throw error;
    return data || [];
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('afastamentos').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate('afastamentos');
    return data;
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('afastamentos').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('afastamentos');
    return data;
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('afastamentos').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('afastamentos');
  },
};
