// ============================================================================
// Supabase Client — RH System
// Não incluir a secret key aqui. Usar apenas anon/public key.
// ============================================================================

const SUPABASE_URL  = 'https://smfiujgaxaodyfwvoxwy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZml1amdheGFvZHlmd3ZveHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjczOTQsImV4cCI6MjA5MzA0MzM5NH0.8zj1LtQOMZWOkaoYIxSQHG1xnpQFxtHVRtQ6vXHnrPY';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================================
// AUTH
// ============================================================================

const Auth = {
  async login(email, senha) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
    return data;
  },

  async logout() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
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
// HELPERS
// ============================================================================

function mapColaborador(row) {
  return {
    id:           row.id,
    nome:         row.nome,
    matricula:    row.cpf?.replace(/\D/g, '').slice(-6) || String(row.id).padStart(6, '0'),
    cargo:        row.cargos?.nome        || row.cargo  || '—',
    setor:        row.departamentos?.nome || row.setor  || '—',
    area:         row.area                || '',
    sexo:         row.genero === 'Masculino' ? 'M' : row.genero === 'Feminino' ? 'F' : 'O',
    escolaridade: row.escolaridade        || '',
    admissao:     row.data_admissao       || '',
    status:       row.status              || 'ativo',
    nascimento:   row.data_nascimento     || '',
    cpf:          row.cpf                 || '',
    telefone:     row.celular || row.telefone || '',
    email:        row.email               || '',
    endereco:     [row.endereco, row.cidade, row.estado].filter(Boolean).join(' — '),
    departamento_id: row.departamento_id,
    cargo_id:     row.cargo_id,
    salario:      row.salario,
    tipo_contrato: row.tipo_contrato,
  };
}

function mapAdvertencia(row) {
  return {
    id:         row.id,
    colab_id:   row.colaborador_id,
    data:       row.data_advertencia,
    tipo:       row.tipo,
    motivo:     row.motivo,
    descricao:  row.descricao || '',
    status:     row.resposta_colaborador ? 'respondida' : 'pendente',
  };
}

function mapFerias(row) {
  return {
    id:          row.id,
    colab_id:    row.colaborador_id,
    inicio:      row.data_inicio,
    fim:         row.data_termino,
    dias:        row.dias_usados,
    saldo:       row.dias_saldo,
    ano:         row.ano_referencia,
    aprovado:    row.aprovado,
    observacoes: row.observacoes || '',
  };
}

function mapDesligamento(row) {
  return {
    id:       row.id,
    colab_id: row.colaborador_id,
    data:     row.data_desligamento,
    motivo:   row.motivo,
    tipo:     row.tipo,
    valor:    row.encargos_rescisao,
  };
}

function mapEvento(row) {
  return {
    id:           row.id,
    titulo:       row.titulo,
    data:         row.data_inicio?.split('T')[0],
    hora_inicio:  row.data_inicio?.split('T')[1]?.slice(0,5) || '',
    hora_fim:     row.data_termino?.split('T')[1]?.slice(0,5) || '',
    local:        row.local || '',
    tipo:         row.tipo || 'evento',
    descricao:    row.descricao || '',
  };
}

// ============================================================================
// COLABORADORES
// ============================================================================

const Colaboradores = {
  async listar() {
    const { data, error } = await sb
      .from('colaboradores')
      .select('*, cargos(nome), departamentos(nome)')
      .order('nome');
    if (error) throw error;
    return data.map(mapColaborador);
  },

  async buscar(id) {
    const { data, error } = await sb
      .from('colaboradores')
      .select('*, cargos(nome), departamentos(nome)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return mapColaborador(data);
  },

  async criar(payload) {
    const { data, error } = await sb
      .from('colaboradores')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapColaborador(data);
  },

  async atualizar(id, payload) {
    const { data, error } = await sb
      .from('colaboradores')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapColaborador(data);
  },

  async excluir(id) {
    const { error } = await sb
      .from('colaboradores')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============================================================================
// DEPARTAMENTOS
// ============================================================================

const Departamentos = {
  async listar() {
    const { data, error } = await sb
      .from('departamentos')
      .select('*')
      .eq('ativo', true)
      .order('nome');
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// CARGOS
// ============================================================================

const Cargos = {
  async listar() {
    const { data, error } = await sb
      .from('cargos')
      .select('*')
      .eq('ativo', true)
      .order('nome');
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// ADVERTÊNCIAS
// ============================================================================

const Advertencias = {
  async listar() {
    const { data, error } = await sb
      .from('advertencias')
      .select('*')
      .order('data_advertencia', { ascending: false });
    if (error) throw error;
    return data.map(mapAdvertencia);
  },

  async criar(payload) {
    const { data, error } = await sb
      .from('advertencias')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapAdvertencia(data);
  },

  async excluir(id) {
    const { error } = await sb.from('advertencias').delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================================================
// FÉRIAS
// ============================================================================

const Ferias = {
  async listar() {
    const { data, error } = await sb
      .from('ferias')
      .select('*')
      .order('data_inicio', { ascending: false });
    if (error) throw error;
    return data.map(mapFerias);
  },

  async criar(payload) {
    const { data, error } = await sb
      .from('ferias')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapFerias(data);
  },

  async atualizar(id, payload) {
    const { data, error } = await sb
      .from('ferias')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapFerias(data);
  },

  async excluir(id) {
    const { error } = await sb.from('ferias').delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================================================
// DESLIGAMENTOS
// ============================================================================

const Desligamentos = {
  async listar() {
    const { data, error } = await sb
      .from('desligamentos')
      .select('*')
      .order('data_desligamento', { ascending: false });
    if (error) throw error;
    return data.map(mapDesligamento);
  },

  async criar(payload) {
    const { data, error } = await sb
      .from('desligamentos')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapDesligamento(data);
  },
};

// ============================================================================
// VENCIMENTOS (documentos + ASOs)
// ============================================================================

const Vencimentos = {
  async listar() {
    const [docs, asos] = await Promise.all([
      sb.from('documentos').select('*, colaboradores(nome)').order('data_vencimento'),
      sb.from('asos').select('*, colaboradores(nome)').order('data_vencimento'),
    ]);
    if (docs.error) throw docs.error;
    if (asos.error) throw asos.error;

    const hoje = new Date();

    const mapDoc = (row, categoria) => {
      const venc  = new Date(row.data_vencimento);
      const diff  = Math.ceil((venc - hoje) / 86400000);
      return {
        id:        row.id,
        colab_id:  row.colaborador_id,
        colab:     row.colaboradores?.nome || '—',
        categoria,
        tipo:      row.tipo || categoria,
        vencimento: row.data_vencimento,
        status:    diff < 0 ? 'vencido' : diff <= 30 ? 'a_vencer' : 'ok',
        diasRestantes: diff,
      };
    };

    return [
      ...docs.data.map(r => mapDoc(r, 'Documento')),
      ...asos.data.map(r => mapDoc(r, 'ASO')),
    ];
  },
};

// ============================================================================
// EPI
// ============================================================================

const Epis = {
  async listar() {
    const { data, error } = await sb
      .from('epis')
      .select('*, colaboradores(nome)')
      .order('data_entrega', { ascending: false });
    if (error) throw error;
    return data;
  },

  async criar(payload) {
    const { data, error } = await sb
      .from('epis')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// CRONOGRAMA
// ============================================================================

const Cronograma = {
  async listar() {
    const { data, error } = await sb
      .from('cronograma')
      .select('*')
      .order('data_inicio');
    if (error) throw error;
    return data.map(mapEvento);
  },

  async criar(payload) {
    const { data, error } = await sb
      .from('cronograma')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapEvento(data);
  },

  async atualizar(id, payload) {
    const { data, error } = await sb
      .from('cronograma')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapEvento(data);
  },

  async excluir(id) {
    const { error } = await sb.from('cronograma').delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================================================
// VALE-COMBUSTÍVEL
// ============================================================================

const ValeCombustivel = {
  async listar(mes, ano) {
    let query = sb.from('vale_combustivel').select('*, colaboradores(nome, departamentos(nome))');
    if (mes) query = query.eq('mes', mes);
    if (ano) query = query.eq('ano', ano);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// VALE-ALIMENTAÇÃO
// ============================================================================

const ValeAlimentacao = {
  async listar(mes, ano) {
    let query = sb.from('vale_alimentacao').select('*, colaboradores(nome, departamentos(nome))');
    if (mes) query = query.eq('mes', mes);
    if (ano) query = query.eq('ano', ano);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// SALÁRIOS (restrito)
// ============================================================================

const Salarios = {
  async listar(mes, ano) {
    let query = sb.from('salarios').select('*, colaboradores(nome, departamentos(nome), cargos(nome))');
    if (mes) query = query.eq('mes', mes);
    if (ano) query = query.eq('ano', ano);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// FEEDBACK & CLIMA
// ============================================================================

const FeedbackClima = {
  async listarFeedbacks() {
    const { data, error } = await sb
      .from('feedbacks')
      .select('*, colaboradores(nome)')
      .order('data_feedback', { ascending: false });
    if (error) throw error;
    return data;
  },

  async listarPesquisas() {
    const { data, error } = await sb
      .from('pesquisas_clima')
      .select('*')
      .order('data_inicio', { ascending: false });
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// DASHBOARD — KPIs
// ============================================================================

const Dashboard = {
  async kpis() {
    const { data, error } = await sb
      .from('dashboard_kpis')
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async aniversariantesHoje() {
    const hoje = new Date();
    const mes  = hoje.getMonth() + 1;
    const dia  = hoje.getDate();
    const { data, error } = await sb
      .from('colaboradores')
      .select('id, nome, data_nascimento, departamentos(nome)')
      .eq('status', 'ativo');
    if (error) throw error;
    return data.filter(c => {
      const d = new Date(c.data_nascimento);
      return d.getMonth() + 1 === mes && d.getDate() === dia;
    });
  },
};

// ============================================================================
// INICIALIZAÇÃO — carrega dados do Supabase e sobrescreve mocks
// ============================================================================

async function inicializarSupabase() {
  try {
    const sessao = await Auth.sessaoAtual();
    if (!sessao) {
      console.info('[Supabase] Sem sessão ativa — usando dados mock.');
      return;
    }

    console.info('[Supabase] Sessão ativa, carregando dados...');

    const [colaboradores, advertencias, ferias, desligamentos, eventos] = await Promise.allSettled([
      Colaboradores.listar(),
      Advertencias.listar(),
      Ferias.listar(),
      Desligamentos.listar(),
      Cronograma.listar(),
    ]);

    if (colaboradores.status === 'fulfilled' && colaboradores.value.length > 0) {
      COLABORADORES = colaboradores.value;
      console.info(`[Supabase] ${COLABORADORES.length} colaboradores carregados.`);
    }

    if (advertencias.status === 'fulfilled' && advertencias.value.length > 0) {
      ADVERTENCIAS = advertencias.value;
      console.info(`[Supabase] ${ADVERTENCIAS.length} advertências carregadas.`);
    }

    if (ferias.status === 'fulfilled' && ferias.value.length > 0) {
      FERIAS = ferias.value;
      console.info(`[Supabase] ${FERIAS.length} registros de férias carregados.`);
    }

    if (desligamentos.status === 'fulfilled' && desligamentos.value.length > 0) {
      DESLIGAMENTOS = desligamentos.value;
      console.info(`[Supabase] ${DESLIGAMENTOS.length} desligamentos carregados.`);
    }

    if (eventos.status === 'fulfilled' && eventos.value.length > 0) {
      EVENTOS = eventos.value;
      console.info(`[Supabase] ${EVENTOS.length} eventos carregados.`);
    }

    // Re-renderizar módulos após carregar dados reais
    if (typeof renderColaboradores  === 'function') renderColaboradores();
    if (typeof renderDesligamentos  === 'function') renderDesligamentos();
    if (typeof renderAdvertencias   === 'function') renderAdvertencias();
    if (typeof renderFerias         === 'function') renderFerias();
    if (typeof renderCalendario     === 'function') renderCalendario();
    if (typeof renderDashboard      === 'function') renderDashboard();

    console.info('[Supabase] Dados carregados com sucesso.');
  } catch (err) {
    console.warn('[Supabase] Erro ao carregar dados, usando mock:', err.message);
  }
}

// Expor no escopo global para uso no HTML
window.sb          = sb;
window.Auth        = Auth;
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
window.Salarios        = Salarios;
window.FeedbackClima   = FeedbackClima;
window.Dashboard       = Dashboard;
