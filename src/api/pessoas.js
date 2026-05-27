// API — Pessoas
// Depende de: sb, withTimeout, withRetry, Cache, mapColaborador, mapDesligamento (supabase.js)

const Colaboradores = {
  async listar({ page = 1, limit = 100, busca = '', status = '', setor = '' } = {}) {
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
          data:       data.map(mapColaborador),
          total:      count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        };
      })())
    );

    Cache.set(cacheKey, result);
    return result;
  },

  async buscar(id) {
    const cacheKey = `colaborador_${id}`;
    const cached = Cache.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await withTimeout(
      sb.from('colaboradores')
        .select('*, cargos(nome), departamentos(nome)')
        .eq('id', id)
        .single()
    );
    if (error) throw error;

    const result = mapColaborador(data);
    Cache.set(cacheKey, result);
    return result;
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('colaboradores').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate();
    return mapColaborador(data);
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('colaboradores').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate(`colaborador_${id}`);
    Cache.invalidate();
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

const Departamentos = {
  async listar() {
    const cached = Cache.get('departamentos');
    if (cached) return cached;

    const { data, error } = await withTimeout(
      sb.from('departamentos').select('*').eq('ativo', true).order('nome')
    );
    if (error) throw error;
    Cache.set('departamentos', data);
    return data;
  },
};

const Cargos = {
  async listar() {
    const cached = Cache.get('cargos');
    if (cached) return cached;

    const { data, error } = await withTimeout(
      sb.from('cargos').select('*').eq('ativo', true).order('nome')
    );
    if (error) throw error;
    Cache.set('cargos', data);
    return data;
  },
};

const HistoricoColaboradores = {
  async listarPorColab(colaboradorId) {
    const { data, error } = await withTimeout(
      sb.from('historico_colaboradores')
        .select('id, data_mudanca, motivo, cargo_anterior_id, cargo_novo_id, departamento_anterior_id, departamento_novo_id, salario_anterior, salario_novo, cargos_anterior:cargo_anterior_id(nome), cargos_novo:cargo_novo_id(nome), depto_anterior:departamento_anterior_id(nome), depto_novo:departamento_novo_id(nome)')
        .eq('colaborador_id', colaboradorId)
        .order('data_mudanca', { ascending: false })
    );
    if (error) throw error;
    return data ?? [];
  },

  async registrar(payload) {
    const { data, error } = await withTimeout(
      sb.from('historico_colaboradores').insert(payload).select().single()
    );
    if (error) throw error;
    return data;
  },
};

const Desligamentos = {
  async listar({ page = 1, limit = 50 } = {}) {
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    const { data, error, count } = await withTimeout(
      sb.from('desligamentos')
        .select('*, colaboradores(nome, data_admissao)', { count: 'exact' })
        .range(from, to)
        .order('data_desligamento', { ascending: false })
    );
    if (error) throw error;

    return {
      data:       data.map(mapDesligamento),
      total:      count,
      page,
      totalPages: Math.ceil(count / limit),
    };
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('desligamentos').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate();
    return mapDesligamento(data);
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('desligamentos').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate();
  },
};

const Rotatividade = {
  async listar() {
    const cached = Cache.get('rotatividade');
    if (cached) return cached;
    const { data, error } = await withTimeout(
      sb.from('rotatividade')
        .select('id, colaborador_id, data_desligamento, motivo_desligamento, tipo_saida, aviso_previo_dias, entrevista_saida, feedback_saida')
        .order('data_desligamento', { ascending: false })
    );
    if (error) throw error;
    Cache.set('rotatividade', data);
    return data;
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('rotatividade').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate('rotatividade');
    return data;
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('rotatividade').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('rotatividade');
    return data;
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('rotatividade').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('rotatividade');
  },
};
