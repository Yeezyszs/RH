// API — Compliance
// Depende de: sb, withTimeout, Cache (supabase.js)

const Vencimentos = {
  async listar() {
    const cached = Cache.get('vencimentos');
    if (cached) return cached;

    const [docs, asos] = await withTimeout(
      Promise.all([
        sb.from('documentos').select('id, colaborador_id, tipo, data_emissao, data_vencimento, observacoes').order('data_vencimento'),
        sb.from('asos').select('id, colaborador_id, data_emissao, data_vencimento, observacoes').order('data_vencimento'),
      ])
    );
    if (docs.error) throw docs.error;
    if (asos.error) throw asos.error;

    const mapRow = (row, categoria) => ({
      id:             row.id,
      colaborador_id: row.colaborador_id,
      categoria,
      item:           categoria === 'ASO' ? 'ASO Periódico' : (row.tipo || 'Documento'),
      emissao:        row.data_emissao   || null,
      vencimento:     row.data_vencimento,
      observacoes:    row.observacoes    || '',
      _tabela:        categoria === 'ASO' ? 'asos' : 'documentos',
    });

    const result = [
      ...docs.data.map(r => mapRow(r, 'Documento')),
      ...asos.data.map(r => mapRow(r, 'ASO')),
    ];

    Cache.set('vencimentos', result);
    return result;
  },

  async criar(payload) {
    if (payload.categoria === 'Treinamento') {
      const row = {
        colaborador_id:  payload.colaborador_id,
        data_conclusao:  payload.data_emissao || null,
        data_vencimento: payload.data_vencimento,
        observacoes:     payload.observacoes || null,
        status:          'concluido',
      };
      const { data, error } = await withTimeout(
        sb.from('participantes_treinamento').insert(row).select().single()
      );
      if (error) throw error;
      Cache.invalidate('vencimentos');
      Cache.invalidate('treinamentos');
      return { ...row, id: data.id, _tabela: 'participantes_treinamento' };
    }

    const tabela = payload.categoria === 'ASO' ? 'asos' : 'documentos';
    const base = {
      colaborador_id:  payload.colaborador_id,
      data_emissao:    payload.data_emissao || null,
      data_vencimento: payload.data_vencimento,
      observacoes:     payload.observacoes || null,
    };
    const row = tabela === 'documentos' ? { ...base, tipo: payload.tipo || payload.item } : base;
    const { data, error } = await withTimeout(
      sb.from(tabela).insert(row).select().single()
    );
    if (error) throw error;
    Cache.invalidate('vencimentos');
    return { ...row, id: data.id, _tabela: tabela };
  },

  async atualizar(id, payload, tabela = 'documentos') {
    const base = {
      data_emissao:    payload.data_emissao || null,
      data_vencimento: payload.data_vencimento,
      observacoes:     payload.observacoes || null,
    };
    const row = tabela === 'documentos' ? { ...base, tipo: payload.tipo || payload.item } : base;
    const { data, error } = await withTimeout(
      sb.from(tabela).update(row).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('vencimentos');
    if (tabela === 'participantes_treinamento') Cache.invalidate('treinamentos');
    return { ...row, id, _tabela: tabela };
  },

  async excluir(id, tabela = 'documentos') {
    const { error } = await withTimeout(
      sb.from(tabela).delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('vencimentos');
    if (tabela === 'participantes_treinamento') Cache.invalidate('treinamentos');
  },
};

const Epis = {
  async listar() {
    const { data, error } = await withTimeout(
      sb.from('epis')
        .select('*, colaboradores(nome)')
        .order('data_entrega', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('epis').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate('epis');
    return data;
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('epis').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('epis');
    return data;
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('epis').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('epis');
  },

  // ── Catálogo de EPIs (tabela epi_catalogo) ──────────────────────────────────
  async listarCatalogo() {
    const { data, error } = await withTimeout(
      sb.from('epi_catalogo')
        .select('id, nome, ca, validade_ca, vida_util_meses, fabricante, quantidade')
        .order('nome')
    );
    if (error) throw error;
    return data ?? [];
  },

  async criarCatalogo(payload) {
    const { data, error } = await withTimeout(
      sb.from('epi_catalogo').insert(payload).select()
    );
    if (error) throw error;
    Cache.invalidate('epi_catalogo');
    return data && data[0];
  },

  async atualizarCatalogo(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('epi_catalogo')
        .update({ ...payload, atualizado_em: new Date().toISOString() })
        .eq('id', id).select()
    );
    if (error) throw error;
    Cache.invalidate('epi_catalogo');
    return (data && data[0]) || { id, ...payload };
  },

  async excluirCatalogo(id) {
    const { error } = await withTimeout(
      sb.from('epi_catalogo').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('epi_catalogo');
  },

  // ── Kits de EPI por área (tabela epi_kits) ──────────────────────────────────
  async listarKits() {
    const { data, error } = await withTimeout(
      sb.from('epi_kits').select('area, epi_ids')
    );
    if (error) throw error;
    return data ?? [];
  },

  async salvarKit(area, epiIds) {
    const { data, error } = await withTimeout(
      sb.from('epi_kits')
        .upsert({ area, epi_ids: epiIds, atualizado_em: new Date().toISOString() }, { onConflict: 'area' })
        .select()
    );
    if (error) throw error;
    Cache.invalidate('epi_kits');
    return data && data[0];
  },
};

const Treinamentos = {
  async listarParticipacoes() {
    const cached = Cache.get('treinamentos');
    if (cached) return cached;
    const { data, error } = await withTimeout(
      sb.from('participantes_treinamento')
        .select('id, colaborador_id, data_conclusao, data_vencimento, status, avaliacao_final, observacoes, treinamentos(id, nome, categoria, carga_horaria)')
        .not('data_vencimento', 'is', null)
        .order('data_vencimento', { ascending: true })
    );
    if (error) throw error;
    Cache.set('treinamentos', data);
    return data;
  },

  async criarParticipacao(payload) {
    const { data, error } = await withTimeout(
      sb.from('participantes_treinamento').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate('treinamentos');
    Cache.invalidate('vencimentos');
    return data;
  },

  async atualizarParticipacao(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('participantes_treinamento').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('treinamentos');
    Cache.invalidate('vencimentos');
    return data;
  },

  async excluirParticipacao(id) {
    const { error } = await withTimeout(
      sb.from('participantes_treinamento').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('treinamentos');
    Cache.invalidate('vencimentos');
  },
};
