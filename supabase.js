// ============================================================================
// Supabase Client — RH System
// Não incluir a secret key aqui. Usar apenas anon/public key.
// ============================================================================

const SUPABASE_URL  = 'https://smfiujgaxaodyfwvoxwy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZml1amdheGFvZHlmd3ZveHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjczOTQsImV4cCI6MjA5MzA0MzM5NH0.8zj1LtQOMZWOkaoYIxSQHG1xnpQFxtHVRtQ6vXHnrPY';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================================
// TIMEOUT — evita UI congelada em requisições lentas
// ============================================================================

async function withTimeout(promise, ms = 6000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Requisição expirou. Verifique sua conexão.')),
      ms
    );
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

// ============================================================================
// RETRY — tenta novamente com exponential backoff
// ============================================================================

async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === maxRetries - 1;
      if (isLast) throw err;
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.warn(`[RH] Tentativa ${attempt + 1} falhou. Retentando em ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ============================================================================
// CACHE LOCAL — 5 minutos por padrão
// ============================================================================

const Cache = {
  _store: new Map(),
  TTL: 5 * 60 * 1000,

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
      this._store.clear();
    }
  },
};

// ============================================================================
// AUTH
// ============================================================================

const Auth = {
  async login(email, senha) {
    const { data, error } = await withTimeout(
      sb.auth.signInWithPassword({ email, password: senha })
    );
    if (error) throw error;
    Cache.invalidate();
    return data;
  },

  async logout() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    Cache.invalidate();
  },

  async sessaoAtual() {
    const { data } = await sb.auth.getSession();
    return data.session;
  },

  onMudanca(callback) {
    sb.auth.onAuthStateChange((_event, session) => callback(session));
  },
};

// ============================================================================
// HELPERS — mappers (banco → UI)
// ============================================================================

function mapColaborador(row) {
  return {
    id:            row.id,
    nome:          row.nome,
    matricula:     row.cpf?.replace(/\D/g, '').slice(-6) || String(row.id).padStart(6, '0'),
    cargo:         row.cargos?.nome        || row.cargo  || '—',
    setor:         row.departamentos?.nome || row.setor  || '—',
    area:          row.area                || '',
    sexo:          row.genero === 'Masculino' ? 'M' : row.genero === 'Feminino' ? 'F' : 'O',
    escolaridade:  row.escolaridade        || '',
    admissao:      row.data_admissao       || '',
    status:        row.status              || 'ativo',
    nascimento:    row.data_nascimento     || '',
    cpf:           row.cpf                 || '',
    telefone:      row.celular || row.telefone || '',
    email:         row.email               || '',
    endereco:      [row.endereco, row.cidade, row.estado].filter(Boolean).join(' — '),
    departamento_id: row.departamento_id,
    cargo_id:      row.cargo_id,
    salario:       row.salario,
    tipo_contrato: row.tipo_contrato,
  };
}

function mapAdvertencia(row) {
  return {
    id:        row.id,
    colab_id:  row.colaborador_id,
    data:      row.data_advertencia,
    tipo:      row.tipo,
    motivo:    row.motivo,
    descricao: row.descricao || '',
    status:    row.resposta_colaborador ? 'respondida' : 'pendente',
  };
}

function mapFerias(row) {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicio = row.data_inicio;
  const fim    = row.data_termino;
  const status = fim < hoje ? 'concluida' : inicio <= hoje ? 'em_curso' : 'planejada';
  return {
    id:             row.id,
    colaborador_id: row.colaborador_id,
    inicio,
    fim,
    dias:           row.dias_usados,
    abono:          row.abono_pecuniario ?? 0,
    saldo:          row.dias_saldo,
    ano:            row.ano_referencia,
    aprovado:       row.aprovado,
    observacoes:    row.observacoes || '',
    status,
  };
}

function mapDesligamento(row) {
  const c = row.colaboradores || {};
  return {
    id:             row.id,
    colaborador_id: row.colaborador_id,
    nome:           c.nome           || row.nome           || '—',
    cargo:          c.cargo          || row.cargo          || '—',
    setor:          c.setor          || row.setor          || '—',
    admissao:       c.data_admissao  || row.admissao       || null,
    data:           row.data_desligamento,
    ultimo_dia:     row.ultimo_dia   || row.data_desligamento,
    motivo:      row.motivo,
    tipo:        row.tipo,
    aviso:       row.aviso        || null,
    observacoes: row.observacoes  || '',
    entrevista:  row.entrevista   || { realizada: false },
    valor:       row.encargos_rescisao,
  };
}

function mapEvento(row) {
  return {
    id:          row.id,
    titulo:      row.titulo,
    data:        row.data_inicio?.split('T')[0],
    hora_inicio: row.data_inicio?.split('T')[1]?.slice(0, 5) || '',
    hora_fim:    row.data_termino?.split('T')[1]?.slice(0, 5) || '',
    local:       row.local || '',
    tipo:        row.tipo || 'evento',
    descricao:   row.descricao || '',
  };
}

// ============================================================================
// COLABORADORES — com paginação, cache e timeout
// ============================================================================

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

// ============================================================================
// DEPARTAMENTOS
// ============================================================================

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

// ============================================================================
// CARGOS
// ============================================================================

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

// ============================================================================
// ADVERTÊNCIAS
// ============================================================================

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

// ============================================================================
// FÉRIAS
// ============================================================================

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

// ============================================================================
// DESLIGAMENTOS
// ============================================================================

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

// ============================================================================
// VENCIMENTOS (documentos + ASOs)
// ============================================================================

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
      id:            row.id,
      colaborador_id: row.colaborador_id,
      categoria,
      item:          categoria === 'ASO' ? 'ASO Periódico' : (row.tipo || 'Documento'),
      emissao:       row.data_emissao   || null,
      vencimento:    row.data_vencimento,
      observacoes:   row.observacoes    || '',
      _tabela:       categoria === 'ASO' ? 'asos' : 'documentos',
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

  async excluir(id, tabela = 'documentos') {
    const { error } = await withTimeout(
      sb.from(tabela).delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('vencimentos');
    if (tabela === 'participantes_treinamento') Cache.invalidate('treinamentos');
  },
};

// ============================================================================
// EPI
// ============================================================================

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
};

// ============================================================================
// CRONOGRAMA
// ============================================================================

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

// ============================================================================
// VALE-COMBUSTÍVEL
// ============================================================================

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
};

// ============================================================================
// TREINAMENTOS
// ============================================================================

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

// ============================================================================
// VALE-ALIMENTAÇÃO
// ============================================================================

const ValeAlimentacao = {
  async listar() {
    const cached = Cache.get('vale_alimentacao');
    if (cached) return cached;
    const { data, error } = await withTimeout(
      sb.from('vale_alimentacao')
        .select('id, colaborador_id, mes, ano, valor_mensal, data_concessao, status')
        .order('colaborador_id')
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

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('vale_alimentacao').delete().eq('id', id)
    );
    if (error) throw error;
    Cache.invalidate('vale_alimentacao');
  },
};

// ============================================================================
// SALÁRIOS (restrito)
// ============================================================================

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

// ============================================================================
// FEEDBACK & CLIMA
// ============================================================================

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

// ============================================================================
// DASHBOARD — KPIs
// ============================================================================

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

// ============================================================================
// ROTATIVIDADE
// ============================================================================

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

// ============================================================================
// PLANO DE CARREIRAS
// ============================================================================

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

window.PlanoCarreiras = PlanoCarreiras;

// ============================================================================
// INICIALIZAÇÃO — carrega dados e sobrescreve mocks
// ============================================================================

async function inicializarSupabase() {
  try {
    const sessao = await Auth.sessaoAtual();
    if (!sessao) {
      console.info('[RH] Sem sessão ativa — usando dados mock.');
      return;
    }

    console.info('[RH] Sessão ativa, carregando dados...');

    const [colaboradores, advertencias, ferias, desligamentos, eventos, pcPlanos,
           vencimentos, epis, salarios, feedbacks, pesquisas, valeComb, valeAlim, rotat, trein] =
      await Promise.allSettled([
        Colaboradores.listar(),
        Advertencias.listar(),
        Ferias.listar(),
        Desligamentos.listar(),
        Cronograma.listar(),
        PlanoCarreiras.listarPlanos(),
        Vencimentos.listar(),
        Epis.listar(),
        Salarios.listar(),
        FeedbackClima.listarFeedbacks(),
        FeedbackClima.listarPesquisas(),
        ValeCombustivel.listar(),
        ValeAlimentacao.listar(),
        Rotatividade.listar(),
        Treinamentos.listarParticipacoes(),
      ]);

    if (colaboradores.status === 'fulfilled') {
      const lista = colaboradores.value?.data ?? colaboradores.value;
      if (lista?.length > 0) {
        COLABORADORES = lista;
        console.info(`[RH] ${COLABORADORES.length} colaboradores carregados.`);
      }
    }

    if (advertencias.status === 'fulfilled') {
      const lista = advertencias.value?.data ?? advertencias.value;
      if (lista?.length > 0) {
        ADVERTENCIAS = lista;
        console.info(`[RH] ${ADVERTENCIAS.length} advertências carregadas.`);
      }
    }

    if (ferias.status === 'fulfilled') {
      const lista = ferias.value?.data ?? ferias.value;
      if (lista?.length > 0) {
        FERIAS = lista;
        console.info(`[RH] ${FERIAS.length} férias carregadas.`);
      }
    }

    if (desligamentos.status === 'fulfilled') {
      const lista = desligamentos.value?.data ?? desligamentos.value;
      if (lista?.length > 0) {
        DESLIGAMENTOS = lista;
        console.info(`[RH] ${DESLIGAMENTOS.length} desligamentos carregados.`);
      }
    }

    if (eventos.status === 'fulfilled') {
      const lista = eventos.value?.data ?? eventos.value;
      if (lista?.length > 0) {
        EVENTOS = lista;
        console.info(`[RH] ${EVENTOS.length} eventos carregados.`);
      }
    }

    if (pcPlanos.status === 'fulfilled') {
      const lista = pcPlanos.value ?? [];
      if (lista.length > 0 && window.PC_PLANOS) {
        lista.forEach(p => {
          window.PC_PLANOS[p.colaborador_id] = {
            _dbId:          p.id,
            cargo_atual_id: p.cargo_atual_id || null,
            cargo_alvo_id:  p.cargo_alvo_id  || null,
            prazo:          p.data_previsao_conclusao || null,
            progresso:      p.progresso_percentual ?? 0,
            plano_acao:     p.plano_acao || p.observacoes || '',
          };
        });
        console.info(`[RH] ${lista.length} planos de carreira carregados.`);
      }
    }

    if (vencimentos.status === 'fulfilled') {
      const lista = vencimentos.value ?? [];
      if (lista.length > 0) {
        VENCIMENTOS = lista;
        console.info(`[RH] ${VENCIMENTOS.length} vencimentos carregados.`);
      }
    }

    if (epis.status === 'fulfilled') {
      const lista = epis.value ?? [];
      if (lista.length > 0) {
        EPI_ENTREGAS = lista;
        console.info(`[RH] ${EPI_ENTREGAS.length} EPIs carregados.`);
      }
    }

    if (salarios.status === 'fulfilled') {
      const lista = salarios.value ?? [];
      if (lista.length > 0) {
        lista.forEach(s => {
          SALARIOS[s.colaborador_id] = {
            id:             s.id,
            valor:          s.valor,
            data_alteracao: s.data_alteracao,
            observacoes:    s.observacoes || '',
          };
        });
        console.info(`[RH] ${lista.length} salários carregados.`);
      }
    }

    if (feedbacks.status === 'fulfilled') {
      const lista = feedbacks.value ?? [];
      if (lista.length > 0) {
        FEEDBACK = lista;
        console.info(`[RH] ${FEEDBACK.length} feedbacks carregados.`);
      }
    }

    if (pesquisas.status === 'fulfilled') {
      const lista = pesquisas.value ?? [];
      if (lista.length > 0) {
        CLIMA = lista;
        console.info(`[RH] ${CLIMA.length} pesquisas de clima carregadas.`);
      }
    }

    if (valeComb.status === 'fulfilled') {
      const lista = valeComb.value ?? [];
      if (lista.length > 0) {
        VALE_LANCAMENTOS = lista;
        console.info(`[RH] ${VALE_LANCAMENTOS.length} lançamentos de vale carregados.`);
      }
    }

    if (valeAlim.status === 'fulfilled') {
      const lista = valeAlim.value ?? [];
      if (lista.length > 0) {
        VALE_ALIMENTACAO = lista;
        console.info(`[RH] ${VALE_ALIMENTACAO.length} vale-alimentação carregados.`);
      }
    }

    if (rotat.status === 'fulfilled') {
      const lista = rotat.value ?? [];
      if (lista.length > 0) {
        ROTATIVIDADE = lista;
        console.info(`[RH] ${ROTATIVIDADE.length} registros de rotatividade carregados.`);
      }
    }

    if (trein.status === 'fulfilled') {
      const lista = trein.value ?? [];
      if (lista.length > 0) {
        const treinVencimentos = lista.map(p => ({
          id:             p.id,
          colaborador_id: p.colaborador_id,
          categoria:      'Treinamento',
          item:           p.treinamentos?.nome || 'Treinamento',
          emissao:        p.data_conclusao || null,
          vencimento:     p.data_vencimento,
          observacoes:    p.observacoes || '',
          _tabela:        'participantes_treinamento',
        }));
        VENCIMENTOS = [...VENCIMENTOS.filter(v => v._tabela !== 'participantes_treinamento'), ...treinVencimentos];
        console.info(`[RH] ${treinVencimentos.length} treinamentos carregados como vencimentos.`);
      }
    }

    if (typeof renderColaboradores  === 'function') renderColaboradores();
    if (typeof renderDesligamentos  === 'function') renderDesligamentos();
    if (typeof renderAdvertencias   === 'function') renderAdvertencias();
    if (typeof renderFerias         === 'function') renderFerias();
    if (typeof renderCronograma     === 'function') renderCronograma();
    if (typeof renderVencimentos    === 'function') renderVencimentos();
    if (typeof renderEpi            === 'function') renderEpi();
    if (typeof renderRotatividade   === 'function') renderRotatividade();
    if (typeof renderSalarios         === 'function') renderSalarios();
    if (typeof renderQuadro           === 'function') renderQuadro();
    if (typeof renderPlanoCarreiras   === 'function') renderPlanoCarreiras();
    if (typeof renderDashboard        === 'function') renderDashboard();

    console.info('[RH] Dados carregados com sucesso.');
    setupRealTimeListeners();
  } catch (err) {
    console.warn('[RH] Erro ao carregar dados, usando mock:', err.message);
  }
}

// ============================================================================
// SINCRONIZAÇÃO REAL-TIME
// ============================================================================

async function setupRealTimeListeners() {
  const handler = (payload) => {
    const { eventType, new: novoReg, old: regAnterior, table } = payload;
    const id = novoReg?.id ?? regAnterior?.id;

    if (table === 'colaboradores') {
      if (eventType === 'INSERT') {
        const novo = mapColaborador(novoReg);
        COLABORADORES.unshift(novo);
      } else if (eventType === 'UPDATE') {
        const i = COLABORADORES.findIndex(x => x.id === id);
        if (i >= 0) COLABORADORES[i] = mapColaborador(novoReg);
      } else if (eventType === 'DELETE') {
        COLABORADORES = COLABORADORES.filter(x => x.id !== id);
      }
      if (typeof renderColaboradores === 'function') renderColaboradores();
    }

    if (table === 'advertencias') {
      if (eventType === 'INSERT') {
        ADVERTENCIAS.unshift(mapAdvertencia(novoReg));
      } else if (eventType === 'UPDATE') {
        const i = ADVERTENCIAS.findIndex(x => x.id === id);
        if (i >= 0) ADVERTENCIAS[i] = mapAdvertencia(novoReg);
      } else if (eventType === 'DELETE') {
        ADVERTENCIAS = ADVERTENCIAS.filter(x => x.id !== id);
      }
      if (typeof renderAdvertencias === 'function') renderAdvertencias();
    }

    if (table === 'ferias') {
      if (eventType === 'INSERT') {
        FERIAS.unshift(mapFerias(novoReg));
      } else if (eventType === 'UPDATE') {
        const i = FERIAS.findIndex(x => x.id === id);
        if (i >= 0) FERIAS[i] = mapFerias(novoReg);
      } else if (eventType === 'DELETE') {
        FERIAS = FERIAS.filter(x => x.id !== id);
      }
      if (typeof renderFerias === 'function') renderFerias();
    }

    if (table === 'desligamentos') {
      if (eventType === 'INSERT') {
        DESLIGAMENTOS.unshift(mapDesligamento(novoReg));
      } else if (eventType === 'UPDATE') {
        const i = DESLIGAMENTOS.findIndex(x => x.id === id);
        if (i >= 0) DESLIGAMENTOS[i] = mapDesligamento(novoReg);
      } else if (eventType === 'DELETE') {
        DESLIGAMENTOS = DESLIGAMENTOS.filter(x => x.id !== id);
      }
      if (typeof renderDesligamentos === 'function') renderDesligamentos();
    }

    if (table === 'cronograma') {
      if (eventType === 'INSERT') {
        EVENTOS.unshift(mapEvento(novoReg));
      } else if (eventType === 'UPDATE') {
        const i = EVENTOS.findIndex(x => x.id === id);
        if (i >= 0) EVENTOS[i] = mapEvento(novoReg);
      } else if (eventType === 'DELETE') {
        EVENTOS = EVENTOS.filter(x => x.id !== id);
      }
      if (typeof renderCronograma === 'function') renderCronograma();
    }

    if (table === 'epis') {
      if (eventType === 'INSERT') {
        EPI_ENTREGAS.unshift(novoReg);
      } else if (eventType === 'UPDATE') {
        const i = EPI_ENTREGAS.findIndex(x => x.id === id);
        if (i >= 0) EPI_ENTREGAS[i] = novoReg;
      } else if (eventType === 'DELETE') {
        EPI_ENTREGAS = EPI_ENTREGAS.filter(x => x.id !== id);
      }
      if (typeof renderEpi === 'function') renderEpi();
    }

    if (table === 'salario_atual') {
      const colabId = novoReg?.colaborador_id ?? regAnterior?.colaborador_id;
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        SALARIOS[colabId] = { id: novoReg.id, valor: novoReg.valor, data_alteracao: novoReg.data_alteracao, observacoes: novoReg.observacoes || '' };
      } else if (eventType === 'DELETE') {
        delete SALARIOS[colabId];
      }
      if (typeof renderSalarios === 'function') renderSalarios();
    }

    if (table === 'documentos' || table === 'asos') {
      const mapVenc = (row) => ({
        id:            row.id,
        colaborador_id: row.colaborador_id,
        categoria:     table === 'asos' ? 'ASO' : 'Documento',
        item:          table === 'asos' ? 'ASO Periódico' : (row.tipo || 'Documento'),
        emissao:       row.data_emissao   || null,
        vencimento:    row.data_vencimento,
        observacoes:   row.observacoes    || '',
        _tabela:       table,
      });
      if (eventType === 'INSERT') {
        VENCIMENTOS.unshift(mapVenc(novoReg));
      } else if (eventType === 'UPDATE') {
        const i = VENCIMENTOS.findIndex(x => x.id === id && x._tabela === table);
        if (i >= 0) VENCIMENTOS[i] = mapVenc(novoReg);
      } else if (eventType === 'DELETE') {
        VENCIMENTOS = VENCIMENTOS.filter(x => !(x.id === id && x._tabela === table));
      }
      if (typeof renderVencimentos === 'function') renderVencimentos();
    }

    if (table === 'feedbacks') {
      if (eventType === 'INSERT') {
        FEEDBACK.unshift(novoReg);
      } else if (eventType === 'UPDATE') {
        const i = FEEDBACK.findIndex(x => x.id === id);
        if (i >= 0) FEEDBACK[i] = novoReg;
      } else if (eventType === 'DELETE') {
        FEEDBACK = FEEDBACK.filter(x => x.id !== id);
      }
      if (typeof renderFeedback === 'function') renderFeedback();
    }

    if (table === 'pesquisas_clima') {
      if (eventType === 'INSERT') {
        CLIMA.unshift(novoReg);
      } else if (eventType === 'UPDATE') {
        const i = CLIMA.findIndex(x => x.id === id);
        if (i >= 0) CLIMA[i] = novoReg;
      } else if (eventType === 'DELETE') {
        CLIMA = CLIMA.filter(x => x.id !== id);
      }
      if (typeof renderClima === 'function') renderClima();
    }

    if (table === 'vale_combustivel') {
      if (eventType === 'INSERT') {
        VALE_LANCAMENTOS.unshift(novoReg);
      } else if (eventType === 'UPDATE') {
        const i = VALE_LANCAMENTOS.findIndex(x => x.id === id);
        if (i >= 0) VALE_LANCAMENTOS[i] = novoReg;
      } else if (eventType === 'DELETE') {
        VALE_LANCAMENTOS = VALE_LANCAMENTOS.filter(x => x.id !== id);
      }
      if (typeof renderValeLancamentos === 'function') renderValeLancamentos();
    }

    if (table === 'vale_alimentacao') {
      if (eventType === 'INSERT') {
        VALE_ALIMENTACAO.unshift(novoReg);
      } else if (eventType === 'UPDATE') {
        const i = VALE_ALIMENTACAO.findIndex(x => x.id === id);
        if (i >= 0) VALE_ALIMENTACAO[i] = novoReg;
      } else if (eventType === 'DELETE') {
        VALE_ALIMENTACAO = VALE_ALIMENTACAO.filter(x => x.id !== id);
      }
      if (typeof renderValeAlimentacao === 'function') renderValeAlimentacao();
    }

    if (table === 'rotatividade') {
      if (eventType === 'INSERT') {
        ROTATIVIDADE.unshift(novoReg);
      } else if (eventType === 'UPDATE') {
        const i = ROTATIVIDADE.findIndex(x => x.id === id);
        if (i >= 0) ROTATIVIDADE[i] = novoReg;
      } else if (eventType === 'DELETE') {
        ROTATIVIDADE = ROTATIVIDADE.filter(x => x.id !== id);
      }
      if (typeof renderRotatividade === 'function') renderRotatividade();
    }

    if (table === 'participantes_treinamento') {
      const mapTrein = (row) => ({
        id:             row.id,
        colaborador_id: row.colaborador_id,
        categoria:      'Treinamento',
        item:           row.treinamentos?.nome || 'Treinamento',
        emissao:        row.data_conclusao || null,
        vencimento:     row.data_vencimento,
        observacoes:    row.observacoes || '',
        _tabela:        'participantes_treinamento',
      });
      if (eventType === 'INSERT' && novoReg.data_vencimento) {
        VENCIMENTOS.unshift(mapTrein(novoReg));
      } else if (eventType === 'UPDATE') {
        const i = VENCIMENTOS.findIndex(x => x.id === id && x._tabela === 'participantes_treinamento');
        if (i >= 0) VENCIMENTOS[i] = mapTrein(novoReg);
        else if (novoReg.data_vencimento) VENCIMENTOS.unshift(mapTrein(novoReg));
      } else if (eventType === 'DELETE') {
        VENCIMENTOS = VENCIMENTOS.filter(x => !(x.id === id && x._tabela === 'participantes_treinamento'));
      }
      if (typeof renderVencimentos === 'function') renderVencimentos();
    }

    console.debug(`[RH] Real-time: ${eventType} em ${table} (id: ${id})`);
  };

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'colaboradores' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'advertencias' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'ferias' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'desligamentos' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'cronograma' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'epis' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'salario_atual' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'documentos' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'asos' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'feedbacks' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'pesquisas_clima' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'vale_combustivel' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'vale_alimentacao' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'rotatividade' },
    handler
  ).subscribe();

  sb.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'participantes_treinamento' },
    handler
  ).subscribe();

  const centerEl = document.querySelector('.topbar-center span:last-child');
  if (centerEl) centerEl.textContent = 'Sincronização real-time ativa';

  console.info('[RH] Listeners real-time ativados.');
}

// ============================================================================
// ESCOPO GLOBAL
// ============================================================================

window.sb              = sb;
window.Cache           = Cache;
window.withTimeout     = withTimeout;
window.withRetry       = withRetry;
window.Auth            = Auth;
window.Colaboradores   = Colaboradores;
window.Departamentos   = Departamentos;
window.Cargos          = Cargos;
window.Advertencias    = Advertencias;
window.Ferias          = Ferias;
window.Desligamentos   = Desligamentos;
window.Vencimentos     = Vencimentos;
window.Epis            = Epis;
window.Cronograma      = Cronograma;
window.ValeCombustivel = ValeCombustivel;
window.ValeAlimentacao = ValeAlimentacao;
window.Rotatividade    = Rotatividade;
window.Treinamentos    = Treinamentos;
window.Salarios        = Salarios;
window.FeedbackClima   = FeedbackClima;
window.Dashboard       = Dashboard;
window.PlanoCarreiras  = PlanoCarreiras;
