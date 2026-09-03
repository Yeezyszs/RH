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
  // O benefício é gerido por competência: cada linha tem `data` nula e guarda
  // crédito (valor_mensal), consumo (utilizado) e saldo de abertura do mês.
  // Os lançamentos de abastecimento (linhas com `data`) saíram na reformulação
  // — com eles saíram listar/criar/atualizar/excluir, que ficaram sem uso.

  async listarCotas() {
    const { data, error } = await withTimeout(
      sb.from('vale_combustivel')
        .select('id, colaborador_id, mes, ano, valor_mensal, utilizado, saldo_inicial')
        .is('data', null)
        .not('valor_mensal', 'is', null)
        .order('colaborador_id')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
    );
    if (error) throw error;
    return data;
  },

  // Esvazia uma competência. Usado pela importação do relatório em modo
  // "substituir": o mês tem que ficar sendo exatamente o que o PDF diz, e
  // upsert sozinho não apaga quem saiu da lista.
  async limparCompetencia(mes, ano) {
    const { error } = await withTimeout(
      sb.from('vale_combustivel').delete().is('data', null).eq('mes', mes).eq('ano', ano)
    );
    if (error) throw error;
    Cache.invalidate('vale_combustivel');
  },

  // Grava a competência inteira de uma vez: assim o mês fica com o conjunto
  // completo de valores e não sobra ninguém herdando o valor padrão.
  async upsertCotasEmLote(linhas) {
    if (!linhas.length) return [];
    const { data, error } = await withTimeout(
      sb.from('vale_combustivel')
        .upsert(linhas, { onConflict: 'colaborador_id,mes,ano' })
        .select(),
      15000
    );
    if (error) throw error;
    Cache.invalidate('vale_combustivel');
    return data ?? [];
  },
};

// Lançamentos que ajustam o vale combustível: descontos (advertência, falta…)
// e adições (viagem, plantão, reembolso…). Mesma tabela, campo `tipo` define
// se o valor entra somando ou subtraindo.
const ValeDescontos = {
  async listar() {
    const { data, error } = await withTimeout(
      sb.from('vale_descontos')
        .select('id, colaborador_id, mes, ano, tipo, motivo, valor, data_ocorrencia, observacoes')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
    );
    if (error) throw error;
    return data ?? [];
  },

  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('vale_descontos').insert(payload).select().single()
    );
    if (error) throw error;
    return data;
  },

  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('vale_descontos').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    return data;
  },

  async excluir(id) {
    const { error } = await withTimeout(
      sb.from('vale_descontos').delete().eq('id', id)
    );
    if (error) throw error;
  },
};

// Configurações gerais (chave/valor)
const Configuracoes = {
  async listar() {
    const { data, error } = await withTimeout(
      sb.from('configuracoes').select('chave, valor')
    );
    if (error) throw error;
    return data ?? [];
  },

  async definir(chave, valor) {
    const { error } = await withTimeout(
      sb.from('configuracoes')
        .upsert({ chave, valor: String(valor), atualizado_em: new Date().toISOString() },
                { onConflict: 'chave' })
    );
    if (error) throw error;
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
