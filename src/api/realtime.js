// Assinaturas de tempo real do Supabase.
//
// Extraído de init.js, que passava de 750 linhas com três assuntos misturados:
// carga inicial, realtime e exportação de globais. Aqui fica só o realtime.
//
// Depende (via globais, todas já carregadas quando isto roda) de: sb, dos
// arrays de src/data-store.js, dos helpers de src/utils/arrays.js, dos mappers
// e das funções render* dos módulos.

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

    if (table === 'epi_catalogo') {
      if (eventType === 'DELETE') {
        _filtrarArray(EPI_CATALOGO, x => x.id !== id);
      } else {
        _upsertArray(EPI_CATALOGO, novoReg);
      }
      if (typeof renderEpiCatalogo === 'function') renderEpiCatalogo();
      if (typeof renderEpi === 'function') renderEpi();
      if (typeof renderEpiKits === 'function') renderEpiKits();
    }

    if (table === 'epi_kits') {
      const area = novoReg?.area ?? regAnterior?.area;
      if (eventType === 'DELETE') {
        if (area) delete EPI_KITS[area];
      } else if (area) {
        EPI_KITS[area] = novoReg.grupos || [];
      }
      if (typeof renderEpiKits === 'function') renderEpiKits();
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

    if (table === 'prestadores_servico') {
      if (eventType === 'DELETE') {
        _filtrarArray(PRESTADORES, x => x.id !== id);
      } else {
        _upsertArray(PRESTADORES, novoReg);
      }
      if (typeof renderPrestadores === 'function') renderPrestadores();
    }

    if (table === 'procedimentos_empresa') {
      if (eventType === 'DELETE') {
        _filtrarArray(PROCEDIMENTOS, x => x.id !== id);
      } else {
        _upsertArray(PROCEDIMENTOS, novoReg);
      }
      if (typeof renderProcedimentos === 'function') renderProcedimentos();
    }

    if (table === 'prolabore_socios') {
      if (eventType === 'DELETE') {
        _filtrarArray(PROLABORE, x => x.id !== id);
      } else {
        _upsertArray(PROLABORE, novoReg);
      }
      if (typeof renderProlabore === 'function') renderProlabore();
    }

    if (table === 'sac_mensagens') {
      if (eventType === 'DELETE') {
        _filtrarArray(SAC, x => x.id !== id);
      } else {
        _upsertArray(SAC, novoReg);
      }
      if (typeof renderSac === 'function') renderSac();
      if (typeof renderSacTratativas === 'function') renderSacTratativas();
      if (typeof atualizarBadgeSac === 'function') atualizarBadgeSac();
    }

    if (table === 'contatos_emergencia') {
      if (eventType === 'DELETE') {
        _filtrarArray(CONTATOS_EMERG, x => x.id !== id);
      } else {
        _upsertArray(CONTATOS_EMERG, novoReg);
      }
    }

    if (table === 'vale_combustivel') {
      // Só há linhas de competência (cota/consumo/saldo). Os lançamentos de
      // abastecimento saíram na reformulação do benefício.
      if (novoReg && novoReg.colaborador_id != null) {
        VALE_COTAS[novoReg.colaborador_id] = parseFloat(novoReg.valor_mensal) || 0;
        if (novoReg.mes != null && novoReg.ano != null) {
          const chave = `${novoReg.colaborador_id}|${novoReg.ano}-${String(novoReg.mes).padStart(2, '0')}`;
          VALE_COTAS_MES[chave] = parseFloat(novoReg.valor_mensal) || 0;
          VALE_USO_MES[chave]   = parseFloat(novoReg.utilizado) || 0;
          if (novoReg.saldo_inicial != null) VALE_SALDO_INI[chave] = parseFloat(novoReg.saldo_inicial) || 0;
          else delete VALE_SALDO_INI[chave];
        }
      }
      if (typeof renderVale === 'function') renderVale();
    }

    if (table === 'vale_descontos') {
      if (eventType === 'DELETE') {
        _filtrarArray(VALE_DESCONTOS, x => x.id !== id);
      } else if (novoReg) {
        _upsertArray(VALE_DESCONTOS, novoReg);
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
    'politicas_empresa', 'epi_catalogo', 'epi_kits', 'prestadores_servico',
    'contatos_emergencia', 'procedimentos_empresa', 'prolabore_socios', 'sac_mensagens', 'vale_descontos',
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

window.setupRealTimeListeners = setupRealTimeListeners;
