// Inicialização Supabase + Real-time
// Depende de: todos os objetos API, Auth, mappers, globais de data-store.js

async function inicializarSupabase() {
  try {
    const sessao = await Auth.sessaoAtual();
    if (!sessao) {
      console.info('[RH] Sem sessão ativa — usando dados mock.');
      return;
    }

    console.info('[RH] Sessão ativa, carregando dados...');

    const [colaboradores, advertencias, ferias, desligamentos, afastamentos, eventos, pcPlanos,
           vencimentos, epis, salarios, feedbacks, pesquisas, valeAlim, rotat, trein, valeCotas, politicas, epiCatalogo, epiKits, prestadores, contatosEmerg, procedimentos, prolabore, sac, valeDesc, config] =
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
        ValeAlimentacao.listar(),
        Rotatividade.listar(),
        Treinamentos.listarParticipacoes(),
        ValeCombustivel.listarCotas(),
        PoliticasEmpresa.listar(),
        Epis.listarCatalogo(),
        Epis.listarKits(),
        PrestadoresServico.listar(),
        ContatosEmergencia.listar(),
        ProcedimentosEmpresa.listar(),
        ProlaboreSocios.listar(),
        SacMensagens.listar(),
        ValeDescontos.listar(),
        Configuracoes.listar(),
      ]);

    // Nada acima rejeita (allSettled), então o que falhou precisa ser
    // recolhido explicitamente — senão a tela renderiza vazia sem avisar.
    const falhas = coletarFalhas({
      'colaboradores':       colaboradores,
      'advertências':        advertencias,
      'férias':              ferias,
      'desligamentos':       desligamentos,
      'afastamentos':        afastamentos,
      'cronograma':          eventos,
      'planos de carreira':  pcPlanos,
      'vencimentos':         vencimentos,
      'EPIs':                epis,
      'salários':            salarios,
      'feedbacks':           feedbacks,
      'pesquisas de clima':  pesquisas,
      'vale alimentação':    valeAlim,
      'rotatividade':        rotat,
      'treinamentos':        trein,
      'cotas do vale':       valeCotas,
      'políticas':           politicas,
      'catálogo de EPI':     epiCatalogo,
      'kits de EPI':         epiKits,
      'prestadores':         prestadores,
      'contatos de emergência': contatosEmerg,
      'procedimentos':       procedimentos,
      'pró-labore':          prolabore,
      'SAC':                 sac,
      'descontos do vale':   valeDesc,
      'configurações':       config,
    });

    window.FALHAS_CARREGAMENTO = falhas;
    if (falhas.length) {
      falhas.forEach(f => console.error(`[RH] Falha ao carregar ${f.nome}: ${f.erro}`));
      if (typeof mostrarFalhasCarregamento === 'function') mostrarFalhasCarregamento(falhas);
    }

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

    if (epiCatalogo.status === 'fulfilled') {
      const lista = epiCatalogo.value ?? [];
      if (lista.length > 0) {
        _preencherArray(EPI_CATALOGO, lista);
        console.info(`[RH] ${EPI_CATALOGO.length} itens de catálogo de EPI carregados.`);
      }
    }

    if (epiKits.status === 'fulfilled') {
      const lista = epiKits.value ?? [];
      lista.forEach(k => { if (k.area) EPI_KITS[k.area] = k.grupos || []; });
      if (lista.length > 0) console.info(`[RH] ${lista.length} kits de EPI carregados.`);
    }

    if (prestadores.status === 'fulfilled') {
      const lista = prestadores.value ?? [];
      if (lista.length > 0) {
        _preencherArray(PRESTADORES, lista);
        console.info(`[RH] ${PRESTADORES.length} prestadores de serviço carregados.`);
      }
    }

    if (contatosEmerg.status === 'fulfilled') {
      const lista = contatosEmerg.value ?? [];
      if (lista.length > 0) {
        _preencherArray(CONTATOS_EMERG, lista);
        console.info(`[RH] ${CONTATOS_EMERG.length} contatos de emergência carregados.`);
      }
    }

    if (procedimentos.status === 'fulfilled') {
      const lista = procedimentos.value ?? [];
      if (lista.length > 0) {
        _preencherArray(PROCEDIMENTOS, lista);
        console.info(`[RH] ${PROCEDIMENTOS.length} procedimentos carregados.`);
      }
    }

    if (prolabore.status === 'fulfilled') {
      const lista = prolabore.value ?? [];
      if (lista.length > 0) {
        _preencherArray(PROLABORE, lista);
        console.info(`[RH] ${PROLABORE.length} lançamentos de pró-labore carregados.`);
      }
    }

    if (sac.status === 'fulfilled') {
      const lista = sac.value ?? [];
      if (lista.length > 0) {
        _preencherArray(SAC, lista);
        console.info(`[RH] ${SAC.length} mensagens de SAC carregadas.`);
      }
    }

    if (valeDesc.status === 'fulfilled') {
      const lista = valeDesc.value ?? [];
      if (lista.length > 0) {
        _preencherArray(VALE_DESCONTOS, lista);
        console.info(`[RH] ${VALE_DESCONTOS.length} descontos de vale combustível carregados.`);
      }
    }

    if (config.status === 'fulfilled') {
      (config.value ?? []).forEach(c => { CONFIG[c.chave] = c.valor; });
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
        // Cota mais recente por colaborador (lista ordenada por ano/mês desc)
        // + histórico mês a mês em VALE_COTAS_MES.
        lista.forEach(c => {
          const valor = parseFloat(c.valor_mensal) || 0;
          if (c.mes != null && c.ano != null) {
            const chave = `${c.colaborador_id}|${c.ano}-${String(c.mes).padStart(2, '0')}`;
            VALE_COTAS_MES[chave] = valor;
            if (c.utilizado != null) VALE_USO_MES[chave] = parseFloat(c.utilizado) || 0;
            if (c.saldo_inicial != null) VALE_SALDO_INI[chave] = parseFloat(c.saldo_inicial) || 0;
          }
          if (VALE_COTAS[c.colaborador_id] != null) return;
          VALE_COTAS[c.colaborador_id] = valor;
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
    if (typeof renderEpiCatalogo    === 'function') renderEpiCatalogo();
    if (typeof renderEpiKits        === 'function') renderEpiKits();
    if (typeof renderRotatividade   === 'function') renderRotatividade();
    if (typeof renderSalarios       === 'function') renderSalarios();
    if (typeof renderQuadro         === 'function') renderQuadro();
    if (typeof renderPlanoCarreiras === 'function') renderPlanoCarreiras();
    if (typeof renderPoliticas      === 'function') renderPoliticas();
    if (typeof renderProcedimentos  === 'function') renderProcedimentos();
    if (typeof renderProlabore      === 'function') renderProlabore();
    if (typeof renderSac            === 'function') renderSac();
    if (typeof renderSacTratativas  === 'function') renderSacTratativas();
    if (typeof renderPrestadores    === 'function') renderPrestadores();
    if (typeof renderBeneficios     === 'function') renderBeneficios();
    if (typeof renderDashboard      === 'function') renderDashboard();

    console.info('[RH] Dados carregados com sucesso.');
    setupRealTimeListeners();
  } catch (err) {
    console.error('[RH] Erro na carga inicial:', err);
    if (typeof mostrarFalhasCarregamento === 'function') {
      mostrarFalhasCarregamento([{ nome: 'os dados do sistema', erro: descreverErro(err) }]);
    }
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
window.ContatosEmergencia     = ContatosEmergencia;
window.Desligamentos          = Desligamentos;
window.Afastamentos           = Afastamentos;
window.Rotatividade           = Rotatividade;
window.Vencimentos            = Vencimentos;
window.Epis                   = Epis;
window.Treinamentos           = Treinamentos;
window.Ferias                 = Ferias;
window.Salarios               = Salarios;
window.ValeCombustivel        = ValeCombustivel;
window.ValeDescontos          = ValeDescontos;
window.Configuracoes          = Configuracoes;
window.ValeAlimentacao        = ValeAlimentacao;
window.Advertencias           = Advertencias;
window.FeedbackClima          = FeedbackClima;
window.PoliticasEmpresa       = PoliticasEmpresa;
window.ProcedimentosEmpresa   = ProcedimentosEmpresa;
window.ProlaboreSocios        = ProlaboreSocios;
window.SacMensagens           = SacMensagens;
window.StorageDocs            = StorageDocs;
window.PrestadoresServico     = PrestadoresServico;
window.RespostasPesquisa      = RespostasPesquisa;
window.Cronograma             = Cronograma;
window.Dashboard              = Dashboard;
window.PlanoCarreiras         = PlanoCarreiras;
window.inicializarSupabase    = inicializarSupabase;
