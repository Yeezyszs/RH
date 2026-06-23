// API — Gestão
// Depende de: sb, withTimeout, Cache, mapAdvertencia, mapEvento (supabase.js)

const Advertencias = {
  async listar({ page = 1, limit = 50 } = {}) {
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    const { data, error, count } = await withTimeout(
      sb.from('advertencias')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('data_advertencia', { ascending: false })
    );
    if (error) throw error;

    return {
      data:       data.map(mapAdvertencia),
      total:      count,
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

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('advertencias').update(payload).eq('id', id).select().single()
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

const FeedbackClima = {
  async listarFeedbacks() {
    const cached = Cache.get('feedbacks');
    if (cached) return cached;
    const { data, error } = await withTimeout(
      sb.from('feedbacks')
        .select('id, colaborador_id, avaliador, data, nota_entrega, nota_comportamento, nota_colaboracao, pontos_fortes, pontos_desenvolver, plano_acao')
        .not('data', 'is', null)
        .order('data', { ascending: false })
    );
    if (error) throw error;
    Cache.set('feedbacks', data);
    return data;
  },

  async criarFeedback(payload) {
    const { data, error } = await withTimeout(
      sb.from('feedbacks').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate('feedbacks');
    return data;
  },

  async atualizarFeedback(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('feedbacks').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('feedbacks');
    return data;
  },

  async excluirFeedback(id) {
    const { error } = await withTimeout(
      sb.from('feedbacks').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('feedbacks');
  },

  async listarPesquisas() {
    const cached = Cache.get('pesquisas_clima');
    if (cached) return cached;
    const { data, error } = await withTimeout(
      sb.from('pesquisas_clima')
        .select('id, titulo, inicio, fim, convidados, responderam, score_lideranca, score_ambiente, score_reconhecimento, score_carreira, score_comunicacao, score_remuneracao')
        .not('inicio', 'is', null)
        .order('inicio', { ascending: false })
    );
    if (error) throw error;
    Cache.set('pesquisas_clima', data);
    return data;
  },

  async criarPesquisa(payload) {
    const { data, error } = await withTimeout(
      sb.from('pesquisas_clima').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate('pesquisas_clima');
    return data;
  },

  async atualizarPesquisa(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('pesquisas_clima').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('pesquisas_clima');
    return data;
  },

  async excluirPesquisa(id) {
    const { error } = await withTimeout(
      sb.from('pesquisas_clima').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('pesquisas_clima');
  },
};

const PoliticasEmpresa = {
  async listar() {
    const cached = Cache.get('politicas_empresa');
    if (cached) return cached;
    const { data, error } = await withTimeout(
      sb.from('politicas_empresa')
        .select('id, titulo, descricao, criado_em, atualizado_em')
        .order('atualizado_em', { ascending: false })
    );
    if (error) throw error;
    Cache.set('politicas_empresa', data);
    return data;
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('politicas_empresa').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate('politicas_empresa');
    return data;
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('politicas_empresa')
        .update({ ...payload, atualizado_em: new Date().toISOString() })
        .eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('politicas_empresa');
    return data;
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('politicas_empresa').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('politicas_empresa');
  },
};

const RespostasPesquisa = {
  async listarPorPesquisa(pesquisaId) {
    const { data, error } = await withTimeout(
      sb.from('respostas_pesquisa')
        .select('id, colaborador_id, pergunta, resposta, rating, data_resposta, colaboradores(nome)')
        .eq('pesquisa_id', pesquisaId)
        .order('data_resposta', { ascending: false })
    );
    if (error) throw error;
    return data ?? [];
  },

  async registrar(pesquisaId, colaboradorId, respostas) {
    const rows = respostas.map(r => ({
      pesquisa_id:    pesquisaId,
      colaborador_id: colaboradorId,
      pergunta:       r.pergunta,
      resposta:       r.resposta || null,
      rating:         r.rating   || null,
    }));
    const { data, error } = await withTimeout(
      sb.from('respostas_pesquisa').insert(rows).select()
    );
    if (error) throw error;
    return data;
  },
};

const Cronograma = {
  async listar() {
    const { data, error } = await withTimeout(
      sb.from('cronograma').select('*').order('data_inicio')
    );
    if (error) throw error;
    return data.map(mapEvento);
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('cronograma').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate('cronograma');
    return mapEvento(data);
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('cronograma').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('cronograma');
    return mapEvento(data);
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('cronograma').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('cronograma');
  },
};

const Dashboard = {
  async kpis() {
    const cached = Cache.get('dashboard_kpis');
    if (cached) return cached;

    const { data, error } = await withTimeout(
      sb.from('dashboard_kpis').select('*').single()
    );
    if (error) throw error;
    Cache.set('dashboard_kpis', data);
    return data;
  },

  async aniversariantesHoje() {
    const hoje = new Date();
    const mes  = hoje.getMonth() + 1;
    const dia  = hoje.getDate();

    const { data, error } = await withTimeout(
      sb.from('colaboradores')
        .select('id, nome, data_nascimento, departamentos(nome)')
        .eq('status', 'ativo')
    );
    if (error) throw error;

    return data.filter(c => {
      if (!c.data_nascimento) return false;
      const d = new Date(c.data_nascimento);
      return d.getMonth() + 1 === mes && d.getDate() === dia;
    });
  },
};

const PlanoCarreiras = {
  async listarTrilhas() {
    const { data, error } = await withTimeout(
      sb.from('trilhas_carreira').select('*').order('nome')
    );
    if (error) throw error;
    return data;
  },

  async listarPlanos() {
    const { data, error } = await withTimeout(
      sb.from('plano_carreiras_colaborador')
        .select('*')
        .order('colaborador_id')
    );
    if (error) throw error;
    return data;
  },

  async upsertPlano(colabId, payload) {
    const row = {
      colaborador_id:          colabId,
      trilha_id:               payload.trilha_id || null,
      cargo_atual_id:          payload.cargo_atual_id || null,
      cargo_alvo_id:           payload.cargo_alvo_id  || null,
      data_inicio:             payload.data_inicio || new Date().toISOString().slice(0, 10),
      data_previsao_conclusao: payload.prazo || null,
      progresso_percentual:    payload.progresso ?? 0,
      plano_acao:              payload.plano_acao || null,
      observacoes:             payload.observacoes || null,
    };
    const { data, error } = await withTimeout(
      sb.from('plano_carreiras_colaborador')
        .upsert(row, { onConflict: 'colaborador_id' })
        .select()
        .single()
    );
    if (error) throw error;
    Cache.invalidate();
    return data;
  },

  async excluirPlano(colabId) {
    const { error } = await withTimeout(
      sb.from('plano_carreiras_colaborador')
        .delete()
        .eq('colaborador_id', colabId)
    );
    if (error) throw error;
    Cache.invalidate();
  },
};
