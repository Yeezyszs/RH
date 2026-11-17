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

  /**
   * Id do treinamento com aquele nome, criando-o se ainda não existir.
   *
   * `participantes_treinamento.treinamento_id` é obrigatório — uma
   * participação sem treinamento não quer dizer nada. A tela de vencimentos,
   * porém, pede só o NOME do item ("NR 35", "Integração"), porque quem lança
   * ali está registrando o vencimento, não montando um catálogo. Esta função
   * faz a ponte entre as duas visões em vez de afrouxar a chave estrangeira.
   */
  async _idDoTreinamento(nome) {
    const limpo = String(nome || '').trim() || 'Treinamento';
    const { data: achado } = await withTimeout(
      sb.from('treinamentos').select('id').eq('nome', limpo).limit(1).maybeSingle()
    );
    if (achado?.id) return achado.id;

    const { data: novo, error } = await withTimeout(
      sb.from('treinamentos').insert({ nome: limpo, categoria: 'Treinamento' }).select('id').single()
    );
    if (error) throw error;
    Cache.invalidate('treinamentos');
    return novo.id;
  },

  async criar(payload) {
    if (payload.categoria === 'Treinamento') {
      const row = {
        colaborador_id:  payload.colaborador_id,
        treinamento_id:  await this._idDoTreinamento(payload.tipo),
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
        .select('id, nome, ca, validade_ca, vida_util_meses, fabricante, quantidade, grupo')
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
      sb.from('epi_kits').select('area, grupos')
    );
    if (error) throw error;
    return data ?? [];
  },

  async salvarKit(area, grupos) {
    const { data, error } = await withTimeout(
      sb.from('epi_kits')
        .upsert({ area, grupos, atualizado_em: new Date().toISOString() }, { onConflict: 'area' })
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

// ─── Compliance de SST: treinamentos de NR, CAT e programas do eSocial ──────

const TreinamentosNR = {
  async listar() {
    const { data, error } = await withTimeout(
      sb.from('treinamentos_nr')
        .select('id, colaborador_id, nr, data_realizacao, pendente, validade_meses, observacoes')
        .order('colaborador_id')
    );
    if (error) throw error;
    return data ?? [];
  },

  // Uma célula da matriz. Reusa a chave (colaborador, norma): editar a mesma
  // célula duas vezes não cria duas linhas.
  async salvar(payload) {
    const { data, error } = await withTimeout(
      sb.from('treinamentos_nr')
        .upsert({ ...payload, atualizado_em: new Date().toISOString() },
          { onConflict: 'colaborador_id,nr' })
        .select().single()
    );
    if (error) throw error;
    Cache.invalidate();
    return data;
  },

  async excluir(id) {
    const { error } = await withTimeout(sb.from('treinamentos_nr').delete().eq('id', id));
    if (error) throw error;
    Cache.invalidate();
  },
};

const CatAcidentes = {
  async listar() {
    const { data, error } = await withTimeout(
      sb.from('cat_acidentes').select('*').order('data_acidente', { ascending: false })
    );
    if (error) throw error;
    return data ?? [];
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('cat_acidentes').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate();
    return data;
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('cat_acidentes').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate();
    return data;
  },

  async excluir(id) {
    const { error } = await withTimeout(sb.from('cat_acidentes').delete().eq('id', id));
    if (error) throw error;
    Cache.invalidate();
  },
};

const ProgramasEsocial = {
  async listar() {
    const { data, error } = await withTimeout(
      sb.from('programas_esocial').select('*').order('data_documento', { ascending: false })
    );
    if (error) throw error;
    return data ?? [];
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('programas_esocial').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate();
    return data;
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('programas_esocial').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate();
    return data;
  },

  // O plano de ação cai junto pelo ON DELETE CASCADE: plano sem programa não
  // diz de onde veio, e é do programa que a auditoria cobra.
  async excluir(id) {
    const { error } = await withTimeout(sb.from('programas_esocial').delete().eq('id', id));
    if (error) throw error;
    Cache.invalidate();
  },

  async listarPlano() {
    const { data, error } = await withTimeout(
      sb.from('plano_acao_programa').select('*').order('prazo')
    );
    if (error) throw error;
    return data ?? [];
  },

  async salvarItemPlano(payload) {
    const query = payload.id
      ? sb.from('plano_acao_programa').update(payload).eq('id', payload.id)
      : sb.from('plano_acao_programa').insert(payload);
    const { data, error } = await withTimeout(query.select().single());
    if (error) throw error;
    Cache.invalidate();
    return data;
  },

  async excluirItemPlano(id) {
    const { error } = await withTimeout(sb.from('plano_acao_programa').delete().eq('id', id));
    if (error) throw error;
    Cache.invalidate();
  },
};
