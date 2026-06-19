/**
 * API — Pessoas
 *
 * Módulo de CRUD para todas as operações relacionadas a colaboradores, departamentos,
 * cargos, histórico de colaboradores e desligamentos.
 *
 * Depende de: sb, withTimeout, withRetry, Cache (supabase.js)
 *
 * 📚 GUIA DE USO:
 *
 * 1. LISTAR colaboradores
 *    const resultado = await Colaboradores.listar({ page: 1, limit: 50 });
 *    resultado.data = array de colaboradores
 *    resultado.total = quantos colaboradores existem no total
 *
 * 2. BUSCAR um colaborador por ID
 *    const colab = await Colaboradores.buscar(42);
 *
 * 3. CRIAR um novo colaborador
 *    const novo = await Colaboradores.criar({ nome: 'João', email: 'joao@...' });
 *    novo.id = novo ID gerado no banco
 *
 * 4. ATUALIZAR um colaborador
 *    const atualizado = await Colaboradores.atualizar(42, { setor: 'Produção' });
 *
 * 5. DELETAR um colaborador
 *    await Colaboradores.excluir(42);
 */

/**
 * Colaboradores — Gerencia dados de colaboradores (funcionários)
 *
 * @typedef {Object} Colaborador
 * @property {number} id
 * @property {string} nome
 * @property {string} cpf
 * @property {string} email
 * @property {string} setor — Nome do setor (Produção, Admin, etc)
 * @property {string} area — Área/especialidade (opcional)
 * @property {string} status — 'ativo', 'férias', 'afastado', 'inativo'
 * @property {string} data_admissao — ISO format: '2024-01-15'
 */

// Transforma resposta do Supabase em objeto flat para UI.
// Aceita tanto o formato da RPC listar_colaboradores_seguro (que já traz setor,
// cargo e os campos de PII descriptografados) quanto o retorno cru de um
// INSERT/UPDATE (com joins aninhados e PII zerada pelo trigger).
function mapColaborador(raw) {
  // documentacao é um objeto JSON (vindo descriptografado da RPC) com os campos
  // extras (pis, ctps, cnh, dados bancários, etc.). Espalhamos no nível raiz
  // para que o formulário/drawer leiam c.pis, c.ctps, … diretamente.
  const doc = (raw.documentacao && typeof raw.documentacao === 'object') ? raw.documentacao : {};
  return {
    ...raw,
    ...doc,
    setor: raw.setor || raw.departamentos?.nome || '',
    cargo: raw.cargo || raw.cargos?.nome || '',
    matricula: raw.matricula || '',
    sexo: raw.genero === 'Masculino' ? 'M' : raw.genero === 'Feminino' ? 'F' : raw.genero === 'Outro' ? 'O' : '',
    escolaridade: raw.escolaridade || '',
    estado_civil: raw.estado_civil || '',
    telefone: raw.telefone || '',
    endereco: raw.endereco || '',
    rg: raw.rg || '',
    cpf: raw.cpf || '',
    nascimento: raw.data_nascimento || '',
    admissao: raw.data_admissao || '',
  };
}

function mapDesligamento(raw) {
  return {
    ...raw,
    data: raw.data_desligamento,
    nome: raw.colaboradores?.nome || raw.nome || '',
    admissao: raw.colaboradores?.data_admissao || raw.admissao || '',
  };
}

const Colaboradores = {
  /**
   * LISTAR colaboradores com paginação e filtros
   *
   * @param {Object} options
   * @param {number} options.page - Página (padrão: 1)
   * @param {number} options.limit - Itens por página (padrão: 100)
   * @param {string} options.busca - Filtro por nome (ex: 'João')
   * @param {string} options.status - Filtro por status (ex: 'ativo')
   * @param {string} options.setor - Filtro por setor
   *
   * @returns {Promise<{data: Colaborador[], total: number, totalPages: number}>}
   *
   * @example
   * // Listar primeira página com 50 colaboradores
   * const resultado = await Colaboradores.listar({ page: 1, limit: 50 });
   * console.log(resultado.data);     // [{ id: 1, nome: 'João', ... }, ...]
   * console.log(resultado.total);    // 250 (total de colaboradores)
   * console.log(resultado.totalPages); // 5 (250 / 50)
   *
   * // Buscar colaboradores de um setor
   * const produção = await Colaboradores.listar({ setor: 'Produção' });
   */
  async listar({ page = 1, limit = 100, busca = '', status = '', setor = '' } = {}) {
    // Busca a lista completa (com PII descriptografada) via RPC segura e
    // mantém em cache; a paginação e os filtros são aplicados no cliente.
    // Isso é necessário porque as colunas sensíveis (cpf, telefone, etc.) só
    // são legíveis através da função listar_colaboradores_seguro().
    let todos = Cache.get('colabs_full');
    if (!todos) {
      const { data, error } = await withRetry(() =>
        withTimeout(sb.rpc('listar_colaboradores_seguro'))
      );
      if (error) throw error;
      todos = (data || []).map(mapColaborador);
      Cache.set('colabs_full', todos);
    }

    let filtrados = todos;
    if (busca) {
      const q = busca.toLowerCase();
      filtrados = filtrados.filter(c =>
        (c.nome || '').toLowerCase().includes(q) ||
        (c.area || '').toLowerCase().includes(q));
    }
    if (status) filtrados = filtrados.filter(c => c.status === status);
    if (setor)  filtrados = filtrados.filter(c => String(c.departamento_id) === String(setor));

    const total      = filtrados.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const from       = (page - 1) * limit;
    const dataPage   = filtrados.slice(from, from + limit);

    return { data: dataPage, total, page, limit, totalPages };
  },

  /**
   * BUSCAR um colaborador por ID
   *
   * Traz TODOS os dados de um único colaborador, incluindo relacionamentos.
   * Resultado é cacheado localmente (localStorage) para evitar requisições repetidas.
   *
   * @param {number} id - ID do colaborador a buscar
   * @returns {Promise<Colaborador>} Dados completos do colaborador
   *
   * @example
   * // Buscar colaborador com ID 42
   * const joao = await Colaboradores.buscar(42);
   * console.log(joao.nome);     // 'João Silva'
   * console.log(joao.email);    // 'joao@empresa.com'
   * console.log(joao.setor);    // 'Produção'
   *
   * @throws {Error} Se colaborador não encontrado
   */
  async buscar(id) {
    // Usa a lista segura (com PII descriptografada) para obter o registro
    // completo, em vez de ler a tabela direto (onde a PII fica zerada/cifrada).
    const res = await Colaboradores.listar({ limit: 100000 });
    const found = res.data.find(c => c.id === id);
    if (!found) throw new Error('Colaborador não encontrado');
    return found;
  },

  /**
   * CRIAR um novo colaborador
   *
   * Envia dados para o Supabase e retorna o novo colaborador com ID gerado.
   *
   * 🔄 FLUXO:
   * 1. Dados enviados via HTTP POST para o Supabase
   * 2. PostgreSQL executa INSERT
   * 3. Novo ID é gerado automaticamente
   * 4. Registro completo retorna ao JavaScript
   * 5. Array global COLABORADORES é atualizado
   * 6. Tabela re-renderizada
   *
   * @param {Object} payload - Dados do novo colaborador
   * @param {string} payload.nome - Nome completo
   * @param {string} payload.cpf - CPF (formato: '123.456.789-00')
   * @param {string} payload.email - Email corporativo
   * @param {string} payload.setor - Setor (ex: 'Produção')
   * @param {string} payload.cargo - Cargo
   * @param {string} payload.data_admissao - Data de admissão (ISO: '2024-01-15')
   *
   * @returns {Promise<Colaborador>} Novo colaborador com ID gerado
   *
   * @example
   * // Criar novo colaborador
   * const novo = await Colaboradores.criar({
   *   nome: 'João Silva',
   *   cpf: '123.456.789-00',
   *   email: 'joao@empresa.com',
   *   setor: 'Produção',
   *   cargo: 'Operador',
   *   data_admissao: '2026-01-15'
   * });
   * console.log(novo.id);    // 42 (novo ID gerado pelo banco)
   * console.log(novo.nome);  // 'João Silva'
   *
   * @throws {Error} Se validação falhar (ex: email duplicado)
   */
  async criar(payload) {
    const { data, error } = await withTimeout(
      sb.from('colaboradores').insert(payload).select().single()
    );
    if (error) throw error;
    Cache.invalidate();
    return mapColaborador(data);
  },

  /**
   * ATUALIZAR um colaborador
   *
   * Modifica um ou mais campos de um colaborador existente.
   *
   * 🔄 FLUXO:
   * 1. Dados enviados via HTTP PATCH para o Supabase
   * 2. PostgreSQL executa UPDATE com WHERE id=X
   * 3. Registro atualizado retorna ao JavaScript
   * 4. Array global COLABORADORES tem item substituído
   * 5. Tabela re-renderizada
   *
   * @param {number} id - ID do colaborador a atualizar
   * @param {Object} payload - Campos a atualizar (apenas os que mudam)
   * @param {string} [payload.setor] - Novo setor
   * @param {string} [payload.cargo] - Novo cargo
   * @param {string} [payload.status] - Novo status (ativo/férias/inativo/afastado)
   * @param {string} [payload.email] - Novo email
   *
   * @returns {Promise<Colaborador>} Colaborador atualizado
   *
   * @example
   * // Atualizar setor de um colaborador
   * const atualizado = await Colaboradores.atualizar(42, {
   *   setor: 'Administrativo'
   * });
   * console.log(atualizado.setor); // 'Administrativo'
   *
   * // Atualizar múltiplos campos de uma vez
   * const multi = await Colaboradores.atualizar(42, {
   *   setor: 'Administrativo',
   *   cargo: 'Supervisor',
   *   status: 'ativo'
   * });
   *
   * @throws {Error} Se colaborador não encontrado
   */
  async atualizar(id, payload) {
    const { data, error } = await withTimeout(
      sb.from('colaboradores').update(payload).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate(`colaborador_${id}`);
    Cache.invalidate();
    return mapColaborador(data);
  },

  /**
   * EXCLUIR um colaborador
   *
   * Remove permanentemente um colaborador do banco de dados.
   * Esta é uma operação irreversível — confirme com o usuário antes de executar!
   *
   * 🔄 FLUXO:
   * 1. Dados enviados via HTTP DELETE para o Supabase
   * 2. PostgreSQL executa DELETE WHERE id=X
   * 3. Linha é removida do banco (sem retorno)
   * 4. Array global COLABORADORES tem item removido (filter)
   * 5. Tabela re-renderizada (linha desaparece)
   *
   * @param {number} id - ID do colaborador a deletar
   * @returns {Promise<void>} Sem retorno (apenas confirma sucesso)
   *
   * @example
   * // Deletar um colaborador
   * if (confirm('Tem certeza que deseja deletar?')) {
   *   await Colaboradores.excluir(42);
   *   // Colaborador 42 foi removido do banco
   *   // Tabela atualiza automaticamente
   * }
   *
   * @throws {Error} Se colaborador não encontrado ou erro na operação
   */
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
