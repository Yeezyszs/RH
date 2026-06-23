// Inicialização Supabase + Real-time
// Depende de: todos os objetos API, Auth, mappers, globais de data-store.js

// ─── Helpers de mutação ───────────────────────────────────────────────────────
// Os arrays globais (COLABORADORES, FERIAS, etc.) são compartilhados POR
// REFERÊNCIA com os módulos (cada módulo guarda `this.X = deps.X` no bootstrap).
// Por isso NÃO podemos reatribuir (`X = novo`) — isso criaria um array novo e os
// módulos continuariam apontando para o array vazio antigo, deixando as telas
// zeradas. As funções abaixo alteram o conteúdo MANTENDO a mesma referência.

function _preencherArray(arr, novo) {
  arr.length = 0;
  arr.push(...novo);
}

function _filtrarArray(arr, manter) {
  const mantidos = arr.filter(manter);
  arr.length = 0;
  arr.push(...mantidos);
}

// Upsert idempotente por id: se o item já existe (ex.: o módulo o adicionou
// otimisticamente após salvar), substitui no lugar; senão insere no topo.
// Evita registros duplicados quando o evento de realtime "ecoa" um insert que
// o próprio cliente acabou de fazer localmente.
function _upsertArray(arr, item) {
  const i = arr.findIndex(x => x.id === item.id);
  if (i >= 0) arr[i] = item;
  else arr.unshift(item);
}

async function inicializarSupabase() {
  try {
    const sessao = await Auth.sessaoAtual();
    if (!sessao) {
      console.info('[RH] Sem sessão ativa — usando dados mock.');
      return;
    }

    console.info('[RH] Sessão ativa, carregando dados...');

    const [colaboradores, advertencias, ferias, desligamentos, afastamentos, eventos, pcPlanos,
           vencimentos, epis, salarios, feedbacks, pesquisas, valeComb, valeAlim, rotat, trein, valeCotas, politicas] =
      await Promise.allSettled([
        Colaboradores.listar(),
        Advertencias.listar(),
        Ferias.listar(),
        Desligamentos.listar(),
        Afastamentos.listar(),
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
        ValeCombustivel.listarCotas(),
        PoliticasEmpresa.listar(),
      ]);

    if (colaboradores.status === 'fulfilled') {
      const lista = colaboradores.value?.data ?? colaboradores.value;
      if (lista?.length > 0) {
        _preencherArray(COLABORADORES, lista);
        console.info(`[RH] ${COLABORADORES.length} colaboradores carregados.`);
      }
    }

    if (advertencias.status === 'fulfilled') {
      const lista = advertencias.value?.data ?? advertencias.value;
      if (lista?.length > 0) {
        _preencherArray(ADVERTENCIAS, lista);
        console.info(`[RH] ${ADVERTENCIAS.length} advertências carregadas.`);
      }
    }

    if (ferias.status === 'fulfilled') {
      const lista = ferias.value?.data ?? ferias.value;
      if (lista?.length > 0) {
        _preencherArray(FERIAS, lista);
        console.info(`[RH] ${FERIAS.length} férias carregadas.`);
      }
    }

    if (desligamentos.status === 'fulfilled') {
      const lista = desligamentos.value?.data ?? desligamentos.value;
      if (lista?.length > 0) {
        _preencherArray(DESLIGAMENTOS, lista);
        console.info(`[RH] ${DESLIGAMENTOS.length} desligamentos carregados.`);
      }
    }

    if (afastamentos.status === 'fulfilled') {
      const lista = afastamentos.value ?? [];
      if (lista.length > 0) {
        _preencherArray(AFASTAMENTOS, lista);
        console.info(`[RH] ${AFASTAMENTOS.length} afastamentos carregados.`);
      }
    }

    if (eventos.status === 'fulfilled') {
      const lista = eventos.value?.data ?? eventos.value;
      if (lista?.length > 0) {
        _preencherArray(EVENTOS, lista);
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
        _preencherArray(VENCIMENTOS, lista);
        console.info(`[RH] ${VENCIMENTOS.length} vencimentos carregados.`);
      }
    }

    if (epis.status === 'fulfilled') {
      const lista = epis.value ?? [];
      if (lista.length > 0) {
        _preencherArray(EPI_ENTREGAS, lista);
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
        _preencherArray(FEEDBACK, lista);
        console.info(`[RH] ${FEEDBACK.length} feedbacks carregados.`);
      }
    }

    if (pesquisas.status === 'fulfilled') {
      const lista = pesquisas.value ?? [];
      if (lista.length > 0) {
        _preencherArray(CLIMA, lista);
        console.info(`[RH] ${CLIMA.length} pesquisas de clima carregadas.`);
      }
    }

    if (valeComb.status === 'fulfilled') {
      const lista = valeComb.value ?? [];
      if (lista.length > 0) {
        _preencherArray(VALE_LANCAMENTOS, lista);
        console.info(`[RH] ${VALE_LANCAMENTOS.length} lançamentos de vale carregados.`);
      }
    }

    if (valeAlim.status === 'fulfilled') {
      const lista = valeAlim.value ?? [];
      if (lista.length > 0) {
        _preencherArray(VALE_ALIMENTACAO, lista);
        // Indexa por colaborador (registro mais recente — lista vem ordenada
        // por ano/mês desc) no formato esperado pelo módulo (VA_BENEFICIOS).
        lista.forEach(v => {
          if (VA_BENEFICIOS[v.colaborador_id]) return;
          VA_BENEFICIOS[v.colaborador_id] = {
            id:             v.id,
            tipo:           v.tipo || 'fixo',
            valor:          v.valor_mensal,
            dias_uteis:     v.dias_uteis ?? null,
            data_alteracao: v.data_concessao,
            observacoes:    v.observacoes || '',
          };
        });
        console.info(`[RH] ${Object.keys(VA_BENEFICIOS).length} vale-alimentação carregados.`);
      }
    }

    if (valeCotas.status === 'fulfilled') {
      const lista = valeCotas.value ?? [];
      if (lista.length > 0) {
        // Cota mais recente por colaborador (lista ordenada por ano/mês desc).
        lista.forEach(c => {
          if (VALE_COTAS[c.colaborador_id] != null) return;
          VALE_COTAS[c.colaborador_id] = parseFloat(c.valor_mensal) || 0;
        });
        console.info(`[RH] ${Object.keys(VALE_COTAS).length} cotas de vale combustível carregadas.`);
      }
    }

    if (rotat.status === 'fulfilled') {
      const lista = rotat.value ?? [];
      if (lista.length > 0) {
        _preencherArray(ROTATIVIDADE, lista);
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
        _preencherArray(VENCIMENTOS, [...VENCIMENTOS.filter(v => v._tabela !== 'participantes_treinamento'), ...treinVencimentos]);
        console.info(`[RH] ${treinVencimentos.length} treinamentos carregados como vencimentos.`);
      }
    }

    if (politicas.status === 'fulfilled') {
      const lista = politicas.value ?? [];
      if (lista.length > 0) {
        _preencherArray(POLITICAS, lista);
        console.info(`[RH] ${POLITICAS.length} políticas carregadas.`);
      }
    }

    popularFiltrosSetor();

    if (typeof renderColaboradores  === 'function') renderColaboradores();
    if (typeof renderDesligamentos  === 'function') renderDesligamentos();
    if (typeof renderAdvertencias   === 'function') renderAdvertencias();
    if (typeof renderFerias         === 'function') renderFerias();
    if (typeof renderCronograma     === 'function') renderCronograma();
    if (typeof renderVencimentos    === 'function') renderVencimentos();
    if (typeof renderEpi            === 'function') renderEpi();
    if (typeof renderRotatividade   === 'function') renderRotatividade();
    if (typeof renderSalarios       === 'function') renderSalarios();
    if (typeof renderQuadro         === 'function') renderQuadro();
    if (typeof renderPlanoCarreiras === 'function') renderPlanoCarreiras();
    if (typeof renderPoliticas      === 'function') renderPoliticas();
    if (typeof renderDashboard      === 'function') renderDashboard();

    console.info('[RH] Dados carregados com sucesso.');
    setupRealTimeListeners();
  } catch (err) {
    console.warn('[RH] Erro ao carregar dados, usando mock:', err.message);
  }
}

function popularFiltrosSetor() {
  const setores = [...new Set(COLABORADORES.map(c => c.setor).filter(Boolean))].sort();
  const opts = setores.map(s => `<option value="${s}">${s}</option>`).join('');
  const ids = ['rot-filter-setor', 'fer-filter-setor',
               'vale-filter-setor', 'va-filter-setor', 'sal-filter-setor', 'fb-filter-setor'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">Todos os setores</option>${opts}`;
  });
}

function setupRealTimeListeners() {
  const handler = (payload) => {
    const { eventType, new: novoReg, old: regAnterior, table } = payload;
    const id = novoReg?.id ?? regAnterior?.id;

    if (table === 'colaboradores') {
      if (eventType === 'DELETE') {
        _filtrarArray(COLABORADORES, x => x.id !== id);
        if (typeof renderColaboradores === 'function') renderColaboradores();
        if (typeof renderQuadro        === 'function') renderQuadro();
        if (typeof renderDashboard     === 'function') renderDashboard();
      } else {
        // INSERT/UPDATE: o payload do realtime traz a PII zerada pelo trigger
        // de criptografia, então recarregamos a lista já descriptografada
        // através da RPC segura (listar usa Cache 'colabs_full').
        Cache.invalidate('colabs_full');
        Colaboradores.listar({ limit: 100000 }).then(res => {
          _preencherArray(COLABORADORES, res.data);
          if (typeof renderColaboradores === 'function') renderColaboradores();
          if (typeof renderQuadro        === 'function') renderQuadro();
          if (typeof renderDashboard     === 'function') renderDashboard();
        }).catch(() => {});
      }
    }

    if (table === 'advertencias') {
      if (eventType === 'DELETE') {
        _filtrarArray(ADVERTENCIAS, x => x.id !== id);
      } else {
        _upsertArray(ADVERTENCIAS, mapAdvertencia(novoReg));
      }
      if (typeof renderAdvertencias === 'function') renderAdvertencias();
    }

    if (table === 'ferias') {
      if (eventType === 'DELETE') {
        _filtrarArray(FERIAS, x => x.id !== id);
      } else {
        _upsertArray(FERIAS, mapFerias(novoReg));
      }
      if (typeof renderFerias === 'function') renderFerias();
    }

    if (table === 'desligamentos') {
      if (eventType === 'DELETE') {
        _filtrarArray(DESLIGAMENTOS, x => x.id !== id);
      } else {
        // O payload do realtime traz só a linha de `desligamentos`, sem o join
        // com `colaboradores`, então mapDesligamento devolveria nome '—'.
        // Enriquecemos com os dados do colaborador já carregado em memória.
        const reg = mapDesligamento(novoReg);
        const c = COLABORADORES.find(x => x.id === reg.colaborador_id);
        if (c) {
          reg.nome     = c.nome;
          reg.cargo    = c.cargo;
          reg.setor    = c.setor;
          reg.area     = c.area;
          reg.admissao = c.admissao;
        }
        _upsertArray(DESLIGAMENTOS, reg);
      }
      if (typeof renderDesligamentos === 'function') renderDesligamentos();
    }

    if (table === 'cronograma') {
      if (eventType === 'DELETE') {
        _filtrarArray(EVENTOS, x => x.id !== id);
      } else {
        _upsertArray(EVENTOS, mapEvento(novoReg));
      }
      if (typeof renderCronograma === 'function') renderCronograma();
    }

    if (table === 'epis') {
      if (eventType === 'DELETE') {
        _filtrarArray(EPI_ENTREGAS, x => x.id !== id);
      } else {
        _upsertArray(EPI_ENTREGAS, novoReg);
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
        id:             row.id,
        colaborador_id: row.colaborador_id,
        categoria:      table === 'asos' ? 'ASO' : 'Documento',
        item:           table === 'asos' ? 'ASO Periódico' : (row.tipo || 'Documento'),
        emissao:        row.data_emissao   || null,
        vencimento:     row.data_vencimento,
        observacoes:    row.observacoes    || '',
        _tabela:        table,
      });
      if (eventType === 'DELETE') {
        _filtrarArray(VENCIMENTOS, x => !(x.id === id && x._tabela === table));
      } else {
        // Chave composta (id + _tabela) pois ids colidem entre documentos/asos.
        const i = VENCIMENTOS.findIndex(x => x.id === novoReg.id && x._tabela === table);
        if (i >= 0) VENCIMENTOS[i] = mapVenc(novoReg);
        else VENCIMENTOS.unshift(mapVenc(novoReg));
      }
      if (typeof renderVencimentos === 'function') renderVencimentos();
    }

    if (table === 'feedbacks') {
      if (eventType === 'DELETE') {
        _filtrarArray(FEEDBACK, x => x.id !== id);
      } else {
        _upsertArray(FEEDBACK, novoReg);
      }
      if (typeof renderFeedback === 'function') renderFeedback();
    }

    if (table === 'pesquisas_clima') {
      if (eventType === 'DELETE') {
        _filtrarArray(CLIMA, x => x.id !== id);
      } else {
        _upsertArray(CLIMA, novoReg);
      }
      if (typeof renderClima === 'function') renderClima();
    }

    if (table === 'politicas_empresa') {
      if (eventType === 'DELETE') {
        _filtrarArray(POLITICAS, x => x.id !== id);
      } else {
        _upsertArray(POLITICAS, novoReg);
      }
      if (typeof renderPoliticas === 'function') renderPoliticas();
    }

    if (table === 'vale_combustivel') {
      if (eventType === 'DELETE') {
        _filtrarArray(VALE_LANCAMENTOS, x => x.id !== id);
      } else if (novoReg && novoReg.data) {
        // Linha com data preenchida = lançamento (abastecimento)
        _upsertArray(VALE_LANCAMENTOS, novoReg);
      } else if (novoReg && novoReg.colaborador_id != null) {
        // Linha sem data = cota mensal
        VALE_COTAS[novoReg.colaborador_id] = parseFloat(novoReg.valor_mensal) || 0;
      }
      if (typeof renderVale === 'function') renderVale();
    }

    if (table === 'vale_alimentacao') {
      if (eventType === 'DELETE') {
        _filtrarArray(VALE_ALIMENTACAO, x => x.id !== id);
      } else if (novoReg && novoReg.colaborador_id != null) {
        _upsertArray(VALE_ALIMENTACAO, novoReg);
        VA_BENEFICIOS[novoReg.colaborador_id] = {
          id:             novoReg.id,
          tipo:           novoReg.tipo || 'fixo',
          valor:          novoReg.valor_mensal,
          dias_uteis:     novoReg.dias_uteis ?? null,
          data_alteracao: novoReg.data_concessao,
          observacoes:    novoReg.observacoes || '',
        };
      }
      if (typeof renderValeAlimentacao === 'function') renderValeAlimentacao();
    }

    if (table === 'rotatividade') {
      if (eventType === 'DELETE') {
        _filtrarArray(ROTATIVIDADE, x => x.id !== id);
      } else {
        _upsertArray(ROTATIVIDADE, novoReg);
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
      if (eventType === 'DELETE') {
        _filtrarArray(VENCIMENTOS, x => !(x.id === id && x._tabela === 'participantes_treinamento'));
      } else {
        const i = VENCIMENTOS.findIndex(x => x.id === novoReg.id && x._tabela === 'participantes_treinamento');
        if (i >= 0) VENCIMENTOS[i] = mapTrein(novoReg);
        else if (novoReg.data_vencimento) VENCIMENTOS.unshift(mapTrein(novoReg));
      }
      if (typeof renderVencimentos === 'function') renderVencimentos();
    }

    console.debug(`[RH] Real-time: ${eventType} em ${table} (id: ${id})`);
  };

  const tabelas = [
    'colaboradores', 'advertencias', 'ferias', 'desligamentos', 'cronograma',
    'epis', 'salario_atual', 'documentos', 'asos', 'feedbacks', 'pesquisas_clima',
    'vale_combustivel', 'vale_alimentacao', 'rotatividade', 'participantes_treinamento',
    'politicas_empresa',
  ];

  // Supabase JS v2: um único canal acumula vários filtros .on() antes do
  // .subscribe(). (A sintaxe antiga sb.on(...) era da v1 e não existe na v2,
  // por isso os listeners nunca conectavam e a UI exigia refresh manual.)
  const canal = sb.channel('rh-realtime');
  tabelas.forEach(tabela => {
    canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, handler);
  });
  canal.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      console.info('[RH] Listeners real-time ativados.');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn(`[RH] Real-time não conectou (${status}). UI dependerá de re-render local.`);
    }
  });
}

// Escopo global
window.sb                     = sb;
window.Cache                  = Cache;
window.withTimeout            = withTimeout;
window.withRetry              = withRetry;
window.Auth                   = Auth;
window.Colaboradores          = Colaboradores;
window.Departamentos          = Departamentos;
window.Cargos                 = Cargos;
window.HistoricoColaboradores = HistoricoColaboradores;
window.Desligamentos          = Desligamentos;
window.Afastamentos           = Afastamentos;
window.Rotatividade           = Rotatividade;
window.Vencimentos            = Vencimentos;
window.Epis                   = Epis;
window.Treinamentos           = Treinamentos;
window.Ferias                 = Ferias;
window.Salarios               = Salarios;
window.ValeCombustivel        = ValeCombustivel;
window.ValeAlimentacao        = ValeAlimentacao;
window.Advertencias           = Advertencias;
window.FeedbackClima          = FeedbackClima;
window.PoliticasEmpresa       = PoliticasEmpresa;
window.RespostasPesquisa      = RespostasPesquisa;
window.Cronograma             = Cronograma;
window.Dashboard              = Dashboard;
window.PlanoCarreiras         = PlanoCarreiras;
window.inicializarSupabase    = inicializarSupabase;
