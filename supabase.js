// Supabase Client — RH System
// Não incluir a secret key aqui. Usar apenas anon/public key.

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
