// Funções puras extraídas de supabase.js para uso nos testes.
// Não importa o Supabase nem depende de window/DOM.

export async function withTimeout(promise, ms = 6000) {
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

export async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === maxRetries - 1;
      if (isLast) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

export function makeCache(TTL = 5 * 60 * 1000) {
  return {
    _store: new Map(),
    TTL,
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
}

export function mapColaborador(row) {
  return {
    id:             row.id,
    nome:           row.nome,
    matricula:      row.cpf?.replace(/\D/g, '').slice(-6) || String(row.id).padStart(6, '0'),
    cargo:          row.cargos?.nome        || row.cargo  || '—',
    setor:          row.departamentos?.nome || row.setor  || '—',
    area:           row.area                || '',
    sexo:           row.genero === 'Masculino' ? 'M' : row.genero === 'Feminino' ? 'F' : 'O',
    escolaridade:   row.escolaridade        || '',
    admissao:       row.data_admissao       || '',
    status:         row.status              || 'ativo',
    nascimento:     row.data_nascimento     || '',
    cpf:            row.cpf                 || '',
    telefone:       row.celular || row.telefone || '',
    email:          row.email               || '',
    endereco:       [row.endereco, row.cidade, row.estado].filter(Boolean).join(' — '),
    departamento_id: row.departamento_id,
    cargo_id:       row.cargo_id,
    salario:        row.salario,
    tipo_contrato:  row.tipo_contrato,
  };
}

export function mapAdvertencia(row) {
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

export function mapFerias(row) {
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

export function mapDesligamento(row) {
  return {
    id:       row.id,
    colab_id: row.colaborador_id,
    data:     row.data_desligamento,
    motivo:   row.motivo,
    tipo:     row.tipo,
    valor:    row.encargos_rescisao,
  };
}

export function mapEvento(row) {
  if (!row) return { id: undefined, titulo: '', data: undefined, hora_inicio: '', hora_fim: '', local: '', tipo: 'evento', status: 'agendado', descricao: '' };
  // Timestamps podem vir com 'T' (API REST) ou espaço (Realtime). Normaliza.
  const ini = row.data_inicio ? String(row.data_inicio).replace(' ', 'T') : '';
  const fim = row.data_termino ? String(row.data_termino).replace(' ', 'T') : '';
  return {
    id:          row.id,
    titulo:      row.titulo,
    data:        ini ? ini.slice(0, 10) : undefined,
    hora_inicio: ini.split('T')[1]?.slice(0, 5) || '',
    hora_fim:    fim.split('T')[1]?.slice(0, 5) || '',
    local:       row.local || '',
    tipo:        row.tipo || 'evento',
    status:      row.status || 'agendado',
    descricao:   row.descricao || '',
  };
}
