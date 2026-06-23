// Colaboradores Module
// Gerencia renderização, drawer, modal, dependentes, contatos de emergência e quadro

export class ColaboradoresModule {
  constructor(deps) {
    this.Colaboradores = deps.Colaboradores;
    this.Departamentos = deps.Departamentos;
    this.HistoricoColaboradores = deps.HistoricoColaboradores;
    this.Auth = deps.Auth;
    this.Afastamentos = deps.Afastamentos;
    this.$ = deps.$;
    this.h = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate = deps.fmtDate;
    this.fmtBRL = deps.fmtBRL;
    this.tempoCasa = deps.tempoCasa;
    this.showToast = deps.showToast;
    this.STATUS_LABEL = deps.STATUS_LABEL;
    this.SETOR_ICON = deps.SETOR_ICON;
    this.PARENTESCO_OPTS = deps.PARENTESCO_OPTS;
    this.COLABORADORES = deps.COLABORADORES;
    this.DEPENDENTES = deps.DEPENDENTES;
    this.CONTATOS_EMERG = deps.CONTATOS_EMERG;
    this.EPI_ENTREGAS = deps.EPI_ENTREGAS;
    this.VENCIMENTOS = deps.VENCIMENTOS;
    this.DESLIGAMENTOS = deps.DESLIGAMENTOS;
    this.AFASTAMENTOS = deps.AFASTAMENTOS;

    this.state = {
      page: 1,
      limit: 50,
      totalPages: 1,
      total: 0,
    };

    this._drawerColabId = null;
    this._editandoColabId = null;
    this._depsModal = [];
    this._emergsModal = [];
    this._depSeq = 0;
    this._emergSeq = 0;
    this._editandoContatoId = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
    // Initial render (module loads after DOMContentLoaded)
    this.render();
    this.renderQuadro();
  }

  setupEventListeners() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'col-search') {
        this.state.page = 1;
        this.render();
      }
      if (e.target.id === 'quad-search') this.renderQuadro();
    });

    document.addEventListener('change', (e) => {
      if (['col-filter-setor', 'col-filter-status'].includes(e.target.id)) {
        this.state.page = 1;
        this.render();
      }
      if (['quad-filter-status', 'quad-filter-turno'].includes(e.target.id)) {
        this.renderQuadro();
      }
    });

    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.drawer-tab');
      if (!tab) return;
      const name = tab.dataset.dtab;
      tab.parentElement.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.drawer-section').forEach(s => s.classList.toggle('active', s.dataset.dsec === name));
    });

    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.modal-tab-inner');
      if (!tab) return;
      const name = tab.dataset.mtab;
      const box  = tab.closest('.modal-box');
      box.querySelectorAll('.modal-tab-inner').forEach(t => t.classList.toggle('active', t === tab));
      box.querySelectorAll('.modal-sec').forEach(s => s.classList.toggle('active', s.dataset.msec === name));
    });

    document.querySelectorAll('.nav-item[data-page="quadro"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.renderQuadro(), 60));
    });
  }

  // ─── Lista de colaboradores ───────────────────────────────────────────────

  async render() {
    const tbody = this.$('#tb-colaboradores');
    if (!tbody) return;

    const busca  = (this.$('#col-search')?.value  || '').trim();
    const status = this.$('#col-filter-status')?.value || '';
    const setor  = this.$('#col-filter-setor')?.value  || '';

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);

    if (temSessao) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty" style="color:var(--text-muted)">Carregando…</td></tr>`;
      try {
        const res = await this.Colaboradores.listar({
          page: this.state.page,
          limit: this.state.limit,
          busca, status, setor,
        });
        this.state.total      = res.total;
        this.state.totalPages = res.totalPages;

        tbody.innerHTML = res.data.length
          ? this._renderLinhas(res.data)
          : `<tr><td colspan="5" class="empty">Nenhum colaborador encontrado</td></tr>`;

        this._updateStats(this.COLABORADORES);
        this._renderPaginacao(res.page, res.totalPages, res.total);
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty">Erro ao carregar: ${this.h(err.message)}</td></tr>`;
      }
    } else {
      const lista = this._filtrarMock(busca, status, setor);
      tbody.innerHTML = lista.length
        ? this._renderLinhas(lista)
        : `<tr><td colspan="5" class="empty">Nenhum colaborador encontrado</td></tr>`;
      this._updateStats(this.COLABORADORES);
      const bar = this.$('#col-pagination-bar');
      if (bar) bar.style.display = 'none';
    }
  }

  async popularFiltroSetores() {
    const sel = this.$('#col-filter-setor');
    if (!sel) return;
    try {
      const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
      if (!temSessao) return;
      const deps = await this.Departamentos.listar();
      sel.innerHTML = `<option value="">Todos os setores</option>` +
        deps.map(d => `<option value="${d.id}">${this.h(d.nome)}</option>`).join('');
    } catch (err) {
      console.error('Erro ao carregar setores:', err);
      this.showToast?.('Erro ao carregar setores', 'err');
    }
  }

  async irPagina(p) {
    if (p < 1 || p > this.state.totalPages || this._loading) return;
    this._loading = true;
    this.state.page = p;
    try {
      await this.render();
    } finally {
      this._loading = false;
    }
  }

  _renderLinhas(lista) {
    return lista.map(c => {
      const st = this.STATUS_LABEL[c.status] || this.STATUS_LABEL.ativo;
      return `
        <tr onclick="abrirDrawerColab(${c.id})">
          <td>
            <div class="cell-person">
              <div class="cell-avatar">${this.h(this.iniciais(c.nome))}</div>
              <div>
                <div class="cell-person-name">${this.h(c.nome)}</div>
                <div class="cell-person-sub">Mat. ${this.h(c.matricula)}</div>
              </div>
            </div>
          </td>
          <td>
            <div>${this.h(c.setor)}</div>
            ${c.area ? `<div class="cell-person-sub">${this.h(c.area)}</div>` : ''}
          </td>
          <td class="cell-mono">${this.fmtDate(c.admissao)}</td>
          <td><span class="badge ${st.cls}">${st.t}</span></td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalColaborador(${c.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirColaborador(${c.id})">🗑</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  _updateStats(lista) {
    const count = (s) => lista.filter(x => x.status === s).length;
    this.$('#stat-ativos').textContent    = count('ativo');
    this.$('#stat-ferias').textContent    = count('ferias');
    this.$('#stat-afastados').textContent = count('afastado');

    const now = new Date();
    this.$('#stat-admitidos').textContent = lista.filter(x => {
      if (!x.admissao) return false;
      const d = new Date(x.admissao + 'T00:00:00');
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }

  _renderPaginacao(page, totalPages, total) {
    const bar      = this.$('#col-pagination-bar');
    const info     = this.$('#col-pagination-info');
    const controls = this.$('#col-pagination-controls');
    if (!bar) return;

    if (totalPages <= 1) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'flex';
    info.textContent  = `${total} colaborador${total !== 1 ? 'es' : ''}`;

    const btns = [];
    btns.push(`<button class="pagination-btn" onclick="colabIrPagina(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← Ant.</button>`);

    const inicio = Math.max(1, page - 2);
    const fim    = Math.min(totalPages, page + 2);
    if (inicio > 1) btns.push(`<button class="pagination-btn" onclick="colabIrPagina(1)">1</button>`);
    if (inicio > 2) btns.push(`<span class="pagination-info">…</span>`);
    for (let p = inicio; p <= fim; p++) {
      btns.push(`<button class="pagination-btn${p === page ? ' current' : ''}" onclick="colabIrPagina(${p})">${p}</button>`);
    }
    if (fim < totalPages - 1) btns.push(`<span class="pagination-info">…</span>`);
    if (fim < totalPages) btns.push(`<button class="pagination-btn" onclick="colabIrPagina(${totalPages})">${totalPages}</button>`);

    btns.push(`<button class="pagination-btn" onclick="colabIrPagina(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Próx. →</button>`);
    controls.innerHTML = btns.join('');
  }

  _filtrarMock(busca, status, setor) {
    let lista = this.COLABORADORES;
    if (busca) {
      const q = busca.toLowerCase();
      lista = lista.filter(x =>
        x.nome.toLowerCase().includes(q) ||
        x.matricula.includes(q) ||
        (x.area || '').toLowerCase().includes(q)
      );
    }
    if (status) lista = lista.filter(x => x.status === status);
    if (setor)  lista = lista.filter(x => String(x.departamento_id) === String(setor));
    return lista;
  }

  // ─── Drawer ───────────────────────────────────────────────────────────────

  async abrirDrawerColab(id) {
    const c = this.COLABORADORES.find(x => x.id === id);
    if (!c) return;
    this._drawerColabId = id;

    this.$('#dcol-avatar').textContent = this.iniciais(c.nome);
    this.$('#dcol-name').textContent   = c.nome;
    this.$('#dcol-role').textContent   = c.area ? `${c.setor} · ${c.area}` : c.setor;

    const st = this.STATUS_LABEL[c.status] || this.STATUS_LABEL.ativo;
    const sexoLabel = { M:'Masculino', F:'Feminino', O:'Outro' }[c.sexo] || '—';

    this.$('#dcol-dados').innerHTML = `
      <div class="info-item"><div class="info-label">Matrícula</div><div class="info-value mono">${this.h(c.matricula)}</div></div>
      <div class="info-item"><div class="info-label">Status</div><div class="info-value"><span class="badge ${st.cls}">${st.t}</span></div></div>
      <div class="info-item"><div class="info-label">Setor · Área</div><div class="info-value">${this.h(c.setor)}${c.area ? ` · ${this.h(c.area)}` : ''}</div></div>
      <div class="info-item"><div class="info-label">Sexo</div><div class="info-value">${sexoLabel}</div></div>
      <div class="info-item"><div class="info-label">Escolaridade</div><div class="info-value">${this.h(c.escolaridade || '—')}</div></div>
      <div class="info-sep"></div>
      <div class="info-item"><div class="info-label">CPF</div><div class="info-value mono">${this.h(c.cpf || '—')}</div></div>
      <div class="info-item"><div class="info-label">Nascimento</div><div class="info-value mono">${this.fmtDate(c.nascimento)}</div></div>
      <div class="info-item"><div class="info-label">Admissão</div><div class="info-value mono">${this.fmtDate(c.admissao)}</div></div>
      <div class="info-item"><div class="info-label">Tempo de casa</div><div class="info-value mono">${this.tempoCasa(c.admissao)}</div></div>
      <div class="info-sep"></div>
      <div class="info-item"><div class="info-label">Telefone</div><div class="info-value mono">${this.h(c.telefone || '—')}</div></div>
      <div class="info-item"><div class="info-label">E-mail</div><div class="info-value">${this.h(c.email || '—')}</div></div>
      <div class="info-item" style="grid-column:1/-1"><div class="info-label">Endereço</div><div class="info-value">${this.h(c.endereco || '—')}</div></div>
    `;

    this.renderContatosEmergencia(id);

    const docsColab = this.VENCIMENTOS.filter(v => v.colaborador_id === id);
    const hoje = new Date().toISOString().slice(0, 10);

    // Documentação pessoal (RG, CPF, PIS, CTPS, CNH, título, reservista, banco)
    const di    = (label, val) => `<div class="info-item"><div class="info-label">${label}</div><div class="info-value">${val ? this.h(val) : '—'}</div></div>`;
    const diMono = (label, val) => `<div class="info-item"><div class="info-label">${label}</div><div class="info-value mono">${val || '—'}</div></div>`;
    const docPessoal = `
      <div class="info-grid">
        ${diMono('CPF', this.h(c.cpf || ''))}
        ${diMono('RG', this.h(c.rg || ''))}
        ${di('Órgão emissor / UF', c.rg_orgao)}
        ${diMono('Emissão RG', c.rg_emissao ? this.fmtDate(c.rg_emissao) : '')}
        ${di('PIS / PASEP', c.pis)}
        ${di('CTPS nº', c.ctps)}
        ${di('CTPS série / UF', c.ctps_serie)}
        ${di('CNH nº', c.cnh)}
        ${di('Categoria CNH', c.cnh_categoria)}
        ${diMono('Validade CNH', c.cnh_validade ? this.fmtDate(c.cnh_validade) : '')}
        ${di('Título de eleitor', c.titulo_eleitor)}
        ${di('Zona / Seção', c.titulo_zona)}
        ${di('Nº reservista', c.reservista)}
        <div class="info-sep"></div>
        ${di('Banco', c.banco)}
        ${di('Agência', c.agencia)}
        ${di('Conta', c.conta)}
        ${di('Tipo de conta', c.conta_tipo)}
      </div>`;

    const vencTable = docsColab.length ? `
      <div style="font-family:var(--mono); font-size:.72rem; color:var(--text-muted); margin:18px 0 8px; letter-spacing:.06em;">DOCUMENTOS COM VALIDADE</div>
      <table class="data" style="margin: -6px 0;">
        <thead><tr><th>Documento</th><th>Emissão</th><th>Validade</th><th>Status</th></tr></thead>
        <tbody>
          ${docsColab.map(v => {
            const diasR = v.vencimento ? Math.ceil((new Date(v.vencimento) - new Date(hoje)) / 86400000) : null;
            const badge = diasR === null ? '' : diasR < 0 ? `<span class="badge danger">Vencido</span>` : diasR <= 30 ? `<span class="badge warn">Vence em ${diasR}d</span>` : `<span class="badge ok">Válido</span>`;
            return `<tr><td>${this.h(v.item)}</td><td class="cell-mono">${this.fmtDate(v.emissao)}</td><td class="cell-mono">${this.fmtDate(v.vencimento)}</td><td>${badge}</td></tr>`;
          }).join('')}
        </tbody>
      </table>` : '';

    this.$('#dcol-docs').innerHTML = docPessoal + vencTable;

    const episColab = this.EPI_ENTREGAS.filter(e => e.colaborador_id === id && !e.devolvido);
    this.$('#dcol-epi').innerHTML = episColab.length ? `
      <table class="data" style="margin: -6px 0;">
        <thead><tr><th>EPI</th><th>Entrega</th><th>Próxima troca</th></tr></thead>
        <tbody>
          ${episColab.map(e => `<tr><td>${this.h(e.tipo || e.item || '—')}</td><td class="cell-mono">${this.fmtDate(e.data_entrega || e.entrega)}</td><td class="cell-mono">${this.fmtDate(e.proxima_troca) || '—'}</td></tr>`).join('')}
        </tbody>
      </table>
    ` : `<p class="empty" style="padding:12px 0">Nenhum EPI ativo</p>`;

    const afastamentosColab = (this.AFASTAMENTOS || []).filter(a => a.colaborador_id === id).sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
    const tipoLabel = { atestado: 'Atestado', afastamento: 'Afastamento', banco_hora: 'Banco de horas' };
    const statusBadge = (status) => {
      const badges = {
        pendente: '<span class="badge neutral">Pendente</span>',
        aprovado: '<span class="badge ok">Aprovado</span>',
        rejeitado: '<span class="badge danger">Rejeitado</span>',
      };
      return badges[status] || status;
    };
    this.$('#dcol-afastamentos').innerHTML = afastamentosColab.length ? `
      <table class="data" style="margin: -6px 0;">
        <thead><tr><th>Tipo</th><th>Período</th><th>Dias</th><th>Status</th></tr></thead>
        <tbody>
          ${afastamentosColab.map(a => `
            <tr onclick="editarAfastamento(${a.id})">
              <td>${tipoLabel[a.tipo] || a.tipo}</td>
              <td class="cell-mono">${this.fmtDate(a.data_inicio)} — ${this.fmtDate(a.data_termino)}</td>
              <td class="cell-mono">${a.dias_totais}d</td>
              <td>${statusBadge(a.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : `<p class="empty" style="padding:12px 0">Nenhum afastamento registrado</p>`;

    const histEl = this.$('#dcol-historico');
    const admissaoItem = `<li class="activity-item"><span class="activity-chip admissao">Admissão</span><span class="activity-text">Admitido na empresa</span><span class="activity-time">${this.fmtDate(c.admissao)}</span></li>`;

    // Evento de desligamento (se houver) — buscado no array global por colaborador_id
    const desl = (this.DESLIGAMENTOS || []).find(d => d.colaborador_id === id);
    const desligamentoItem = desl
      ? `<li class="activity-item"><span class="activity-chip desligamento">Desligamento</span><span class="activity-text">${this.h(desl.motivo || 'Desligado da empresa')}</span><span class="activity-time">${this.fmtDate(desl.data || desl.data_desligamento)}</span></li>`
      : '';

    histEl.innerHTML = `<ul class="activity-feed" style="margin: -6px 0;">${desligamentoItem}${admissaoItem}</ul>`;

    if (this.HistoricoColaboradores && this.Auth?.sessaoAtual) {
      this.Auth.sessaoAtual().then(sessao => {
        if (!sessao) return;
        this.HistoricoColaboradores.listarPorColab(id).then(registros => {
          const itens = [
            ...registros.map(r => {
              const partes = [];
              if (r.cargos_novo?.nome && r.cargos_anterior?.nome) partes.push(`${r.cargos_anterior.nome} → ${r.cargos_novo.nome}`);
              else if (r.cargos_novo?.nome) partes.push(`Cargo: ${r.cargos_novo.nome}`);
              if (r.depto_novo?.nome && r.depto_anterior?.nome) partes.push(`${r.depto_anterior.nome} → ${r.depto_novo.nome}`);
              if (r.salario_novo && r.salario_anterior) partes.push(`Salário: ${this.fmtBRL(r.salario_anterior)} → ${this.fmtBRL(r.salario_novo)}`);
              const texto = partes.join(' · ') || (r.motivo || 'Alteração');
              return {
                data: r.data_mudanca,
                html: `<li class="activity-item"><span class="activity-chip">RH</span><span class="activity-text">${this.h(texto)}</span><span class="activity-time">${this.fmtDate(r.data_mudanca)}</span></li>`,
              };
            }),
          ];
          if (desl) itens.push({ data: desl.data || desl.data_desligamento, html: desligamentoItem });
          // Ordena do mais recente para o mais antigo; admissão sempre por último
          itens.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
          histEl.innerHTML = `<ul class="activity-feed" style="margin: -6px 0;">${itens.map(i => i.html).join('')}${admissaoItem}</ul>`;
        }).catch(() => {});
      }).catch(() => {});
    }

    document.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.dtab === 'dados'));
    document.querySelectorAll('.drawer-section').forEach(s => s.classList.toggle('active', s.dataset.dsec === 'dados'));

    this.$('#drawer-backdrop').classList.add('active');
    this.$('#drawer-colab').classList.add('active');
  }

  fecharDrawerColab() {
    this.$('#drawer-backdrop').classList.remove('active');
    this.$('#drawer-colab').classList.remove('active');
    this._drawerColabId = null;
  }

  // ─── Dependentes (modal) ─────────────────────────────────────────────────

  _idadeAnos(nascimento) {
    if (!nascimento) return null;
    const d = new Date(nascimento + 'T00:00:00');
    const hoje = new Date();
    let a = hoje.getFullYear() - d.getFullYear();
    if (hoje.getMonth() < d.getMonth() || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())) a--;
    return a;
  }

  _depUpdate(sid, key, val) {
    const dep = this._depsModal.find(x => x._sid === sid);
    if (dep) dep[key] = val;
  }

  _emergUpdate(sid, key, val) {
    const em = this._emergsModal.find(x => x._sid === sid);
    if (em) em[key] = val;
  }

  renderDepsModal() {
    const el = document.getElementById('dep-lista-modal');
    if (!el) return;
    if (!this._depsModal.length) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:.88rem;padding:4px 0 10px;">Nenhum dependente cadastrado.</div>';
      return;
    }
    el.innerHTML = this._depsModal.map(d => {
      const idade = d.nascimento ? this._idadeAnos(d.nascimento) : null;
      const requerEscola = idade !== null && idade >= 4 && idade < 14;
      // Garante que a data está em formato ISO (yyyy-mm-dd)
      const dataNascimento = d.nascimento ? String(d.nascimento).trim() : '';
      return `
      <div class="inline-card" id="dep-card-${d._sid}">
        <div class="inline-card-body">
          <div class="form-group">
            <label>Nome <span class="req">*</span></label>
            <input type="text" value="${this.h(d.nome)}" placeholder="Nome completo"
              oninput="window._depUpdate(${d._sid},'nome',this.value)">
          </div>
          <div class="form-group">
            <label>Parentesco</label>
            <select onchange="window._depUpdate(${d._sid},'parentesco',this.value)">
              ${['Filho(a)','Cônjuge','Mãe','Pai','Irmã','Irmão','Outro'].map(p =>
                `<option value="${p}"${d.parentesco===p?' selected':''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Data de nascimento <span style="color:var(--text-muted);font-size:.8rem;">(dd/mm/aaaa)</span></label>
            <input type="date" value="${dataNascimento}"
              oninput="window._depDataNasc(${d._sid},this.value)">
          </div>
          <div class="form-group">
            <label>CPF do dependente</label>
            <input type="text" value="${this.h(d.cpf||'')}" placeholder="000.000.000-00"
              oninput="window._depUpdate(${d._sid},'cpf',this.value)">
          </div>
          <div class="form-group full" id="dep-escola-${d._sid}" style="${requerEscola ? '' : 'display:none'}">
            <label>Escola (obrigatório — 4 a 14 anos)</label>
            <input type="text" value="${this.h(d.escola||'')}" placeholder="Nome da escola / creche"
              oninput="window._depUpdate(${d._sid},'escola',this.value)">
            <div class="inline-card-hint">📚 Dependentes entre 4 e 14 anos — campo de escola exigido para fins de declaração e benefícios.</div>
          </div>
        </div>
        <button type="button" class="inline-card-remove" title="Remover" onclick="window.removerDepModal(${d._sid})">×</button>
      </div>`;
    }).join('');
  }

  // Atualiza a data de nascimento do dependente SEM re-renderizar a lista
  // inteira (isso recriava o <input type=date> a cada tecla e impedia digitar
  // o ano). Apenas mostra/esconde o campo de escola conforme a idade.
  _depDataNasc(sid, val) {
    this._depUpdate(sid, 'nascimento', val);
    const idade = val ? this._idadeAnos(val) : null;
    const requerEscola = idade !== null && idade >= 4 && idade < 14;
    const escolaEl = document.getElementById(`dep-escola-${sid}`);
    if (escolaEl) escolaEl.style.display = requerEscola ? '' : 'none';
  }

  adicionarDepModal() {
    this._depsModal.push({ _sid: ++this._depSeq, nome:'', parentesco:'Filho(a)', nascimento:'', cpf:'', escola:'' });
    this.renderDepsModal();
  }

  removerDepModal(sid) {
    this._depsModal = this._depsModal.filter(x => x._sid !== sid);
    this.renderDepsModal();
  }

  // ─── Emergência (modal) ───────────────────────────────────────────────────

  renderEmergsModal() {
    const el = document.getElementById('emerg-lista-modal');
    if (!el) return;
    if (!this._emergsModal.length) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:.88rem;padding:4px 0 10px;">Nenhum contato de emergência cadastrado.</div>';
      return;
    }
    el.innerHTML = this._emergsModal.map(c => `
      <div class="inline-card" id="emerg-card-${c._sid}">
        <div class="inline-card-body">
          <div class="form-group">
            <label>Nome <span class="req">*</span></label>
            <input type="text" value="${this.h(c.nome)}" placeholder="Nome do contato"
              oninput="window._emergUpdate(${c._sid},'nome',this.value)">
          </div>
          <div class="form-group">
            <label>Parentesco</label>
            <select onchange="window._emergUpdate(${c._sid},'parentesco',this.value)">
              ${this.PARENTESCO_OPTS.map(p =>
                `<option value="${p}"${c.parentesco===p?' selected':''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="form-group full">
            <label>Telefone</label>
            <input type="tel" value="${this.h(c.telefone||'')}" placeholder="(00) 00000-0000"
              oninput="window._emergUpdate(${c._sid},'telefone',this.value)">
          </div>
        </div>
        <button type="button" class="inline-card-remove" title="Remover" onclick="window.removerEmergModal(${c._sid})">×</button>
      </div>`).join('');
  }

  adicionarEmergModal() {
    this._emergsModal.push({ _sid: ++this._emergSeq, nome:'', parentesco:'Cônjuge', telefone:'' });
    this.renderEmergsModal();
  }

  removerEmergModal(sid) {
    this._emergsModal = this._emergsModal.filter(x => x._sid !== sid);
    this.renderEmergsModal();
  }

  // ─── Modal colaborador ────────────────────────────────────────────────────

  // Carrega os departamentos (setores) do banco e preenche o <select> do modal.
  // O <option> mantém o id como value — é isso que o INSERT/UPDATE espera.
  async _popularSelectsModal() {
    const selDep = document.querySelector('#form-colaborador [name="departamento_id"]');
    if (!selDep) return;
    try {
      const deptos = await this.Departamentos.listar();
      selDep.innerHTML = `<option value="">—</option>` +
        deptos.map(d => `<option value="${d.id}">${this.h(d.nome)}</option>`).join('');
    } catch (err) {
      console.error('Erro ao carregar setores:', err);
      this.showToast?.('Erro ao carregar setores', 'err');
    }
  }

  async abrirModalColaborador(id = null) {
    this._editandoColabId = id;
    this._depsModal   = [];
    this._emergsModal = [];

    const form = document.getElementById('form-colaborador');
    form.reset();

    // Popula o select de setor com dados do banco (precisa vir antes do
    // preenchimento, senão o .value de edição não encontra a <option>)
    await this._popularSelectsModal();

    if (id != null) {
      document.getElementById('modal-colab-title').textContent = 'Editar colaborador';
      const c = this.COLABORADORES.find(x => x.id === id);
      if (c) {
        // Mapeamento de nomes de colunas do banco para nomes de campos do form.
        // 'genero' fica de fora de propósito: o mapColaborador já fornece
        // 'sexo' (M/F/O), que casa com as <option> do select.
        const fieldMap = {
          'data_admissao': 'admissao',
          'data_nascimento': 'nascimento',
          'data_desligamento': 'desligamento',
        };
        const ignorar = new Set(['genero']);
        for (const [k, v] of Object.entries(c)) {
          if (ignorar.has(k)) continue;
          const formFieldName = fieldMap[k] || k;
          const f = form.elements[formFieldName];
          if (f) f.value = v ?? '';
        }
      }
      this._depsModal   = (this.DEPENDENTES || []).filter(d => d.colaborador_id === id)
                          .map(d => ({ ...d, _sid: ++this._depSeq }));
      this._emergsModal = this.CONTATOS_EMERG.filter(c => c.colaborador_id === id)
                          .map(c => ({ ...c, _sid: ++this._emergSeq }));
    } else {
      document.getElementById('modal-colab-title').textContent = 'Novo colaborador';
    }

    const box = document.getElementById('modal-colaborador').querySelector('.modal-box');
    box.querySelectorAll('.modal-tab-inner').forEach(t => t.classList.toggle('active', t.dataset.mtab === 'dados'));
    box.querySelectorAll('.modal-sec').forEach(s => s.classList.toggle('active', s.dataset.msec === 'dados'));

    this.renderDepsModal();
    this.renderEmergsModal();
    document.getElementById('modal-colaborador').classList.add('active');
  }

  fecharModalColaborador() {
    document.getElementById('modal-colaborador').classList.remove('active');
    this._editandoColabId = null;
  }

  async salvarColaborador(e) {
    e.preventDefault();
    const form = document.getElementById('form-colaborador');
    const data = Object.fromEntries(new FormData(form));

    const depSemEscola = this._depsModal.filter(d => {
      const idade = d.nascimento ? this._idadeAnos(d.nascimento) : null;
      const requerEscola = idade !== null && idade >= 4 && idade < 14;
      return requerEscola && !d.escola.trim();
    });
    if (depSemEscola.length) {
      this.showToast('Preencha a escola dos dependentes entre 4 e 14 anos', 'err');
      const box = document.getElementById('modal-colaborador').querySelector('.modal-box');
      box.querySelectorAll('.modal-tab-inner').forEach(t => t.classList.toggle('active', t.dataset.mtab === 'dependentes'));
      box.querySelectorAll('.modal-sec').forEach(s => s.classList.toggle('active', s.dataset.msec === 'dependentes'));
      return;
    }

    // Documentos extras → JSON único (criptografado no banco pelo trigger).
    const docCampos = ['rg_orgao','rg_emissao','pis','ctps','ctps_serie','cnh',
      'cnh_categoria','cnh_validade','titulo_eleitor','titulo_zona','reservista',
      'banco','agencia','conta','conta_tipo'];
    const documentacao = {};
    docCampos.forEach(k => { documentacao[k] = data[k] || ''; });
    const temDoc = Object.values(documentacao).some(v => v !== '');

    // Campos PII textuais: enviamos string vazia (não null) quando limpos, para
    // que o trigger de criptografia distinga "limpar" ('') de "não alterar"
    // (null/ausente em updates parciais) e zere o respectivo _enc no banco.
    const payload = {
      nome:            data.nome,
      matricula:       data.matricula || null,
      data_admissao:   data.admissao,
      data_nascimento: data.nascimento || null,
      cpf:             data.cpf || '',
      rg:              data.rg || '',
      email:           data.email || null,
      telefone:        data.telefone || '',
      celular:         data.celular || '',
      endereco:        data.endereco || '',
      escolaridade:    data.escolaridade || null,
      estado_civil:    data.estado_civil || null,
      genero:          data.sexo === 'M' ? 'Masculino' : data.sexo === 'F' ? 'Feminino' : 'Outro',
      status:          data.status || 'ativo',
      turno:           data.turno || 'diurno',
      departamento_id: data.departamento_id ? parseInt(data.departamento_id, 10) : null,
      area:            data.area || null,
      documentacao:    temDoc ? JSON.stringify(documentacao) : '',
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    let colabId;

    if (temSessao) {
      try {
        if (this._editandoColabId != null) {
          await this.Colaboradores.atualizar(this._editandoColabId, payload);
          colabId = this._editandoColabId;
          this.showToast('Colaborador atualizado', 'ok');
        } else {
          const novo = await this.Colaboradores.criar(payload);
          colabId = novo.id;
          this.showToast('Colaborador cadastrado', 'ok');
        }
        // Recarrega a lista completa (com PII descriptografada) para o array
        // global, que alimenta drawer, quadro e dashboard.
        const todos = await this.Colaboradores.listar({ limit: 100000 });
        this.COLABORADORES.length = 0;
        this.COLABORADORES.push(...todos.data);
        if (window.renderQuadro)    window.renderQuadro();
        if (window.renderDashboard) window.renderDashboard();
      } catch (err) {
        this.showToast('Erro ao salvar: ' + err.message, 'err');
        return;
      }
    } else {
      if (this._editandoColabId != null) {
        const i = this.COLABORADORES.findIndex(x => x.id === this._editandoColabId);
        if (i >= 0) this.COLABORADORES[i] = { ...this.COLABORADORES[i], ...data };
        colabId = this._editandoColabId;
        this.showToast('Colaborador atualizado', 'ok');
      } else {
        colabId = Math.max(0, ...this.COLABORADORES.map(x => x.id)) + 1;
        this.COLABORADORES.unshift({ id: colabId, ...data });
        this.showToast('Colaborador cadastrado', 'ok');
      }
    }

    if (!temSessao) {
      this.DEPENDENTES = this.DEPENDENTES.filter(d => d.colaborador_id !== colabId);
      this._depsModal.forEach(d => {
        const { _sid, ...rest } = d;
        const existeId = rest.id || Math.max(0, ...this.DEPENDENTES.map(x => x.id), 0) + 1;
        this.DEPENDENTES.push({ ...rest, id: existeId, colaborador_id: colabId });
      });
      this.CONTATOS_EMERG = this.CONTATOS_EMERG.filter(c => c.colaborador_id !== colabId);
      this._emergsModal.forEach(c => {
        const { _sid, ...rest } = c;
        const existeId = rest.id || Math.max(0, ...this.CONTATOS_EMERG.map(x => x.id), 0) + 1;
        this.CONTATOS_EMERG.push({ ...rest, id: existeId, colaborador_id: colabId });
      });
    }

    this.fecharModalColaborador();
    this.render();
  }

  editarColaboradorDoDrawer() {
    // Captura o id ANTES de fechar o drawer — fecharDrawerColab() zera
    // _drawerColabId, e sem isso o modal abriria em modo "Novo colaborador".
    const id = this._drawerColabId;
    if (id != null) {
      this.fecharDrawerColab();
      this.abrirModalColaborador(id);
    }
  }

  async excluirColaborador(id) {
    if (!confirm('Excluir este colaborador?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Colaboradores.excluir(id);
        this.showToast('Colaborador excluído');
      } catch (err) {
        this.showToast('Erro ao excluir: ' + err.message, 'err');
        return;
      }
    } else {
      this.COLABORADORES = this.COLABORADORES.filter(x => x.id !== id);
      this.showToast('Colaborador excluído');
    }
    this.render();
  }

  // ─── Contatos de emergência (drawer) ─────────────────────────────────────

  renderContatosEmergencia(colabId) {
    const el = this.$('#dcol-emerg-list');
    if (!el) return;
    const lista = this.CONTATOS_EMERG.filter(c => c.colaborador_id === colabId);
    if (!lista.length) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:.88rem;padding:8px 0;">Nenhum contato de emergência cadastrado.</div>';
      return;
    }
    el.innerHTML = lista.map(c => `
      <div class="emerg-card">
        <div class="emerg-avatar">${this.h(c.nome[0] || '?')}</div>
        <div class="emerg-info">
          <div class="emerg-nome">${this.h(c.nome)}</div>
          <div class="emerg-sub">
            <span class="emerg-parentesco">${this.h(c.parentesco)}</span>
            <span class="emerg-tel">📞 ${this.h(c.telefone)}</span>
          </div>
        </div>
        <div class="emerg-actions">
          <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalContato(${c.id})">✎</button>
          <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirContato(${c.id})">🗑</button>
        </div>
      </div>
    `).join('');
  }

  abrirModalContato(id = null) {
    this._editandoContatoId = id || null;
    const form = this.$('#form-contato');
    form.reset();

    const sel = this.$('#contato-select-parentesco');
    sel.innerHTML = this.PARENTESCO_OPTS.map(p => `<option value="${p}">${p}</option>`).join('');

    if (id) {
      const c = this.CONTATOS_EMERG.find(x => x.id === id);
      if (!c) return;
      this.$('#contato-modal-title').textContent = 'Editar contato de emergência';
      form.elements['nome'].value     = c.nome;
      form.elements['telefone'].value = c.telefone;
      sel.value                       = c.parentesco;
    } else {
      this.$('#contato-modal-title').textContent = 'Novo contato de emergência';
    }
    this.$('#modal-contato-emerg').classList.add('active');
  }

  fecharModalContato() {
    this.$('#modal-contato-emerg').classList.remove('active');
    this._editandoContatoId = null;
  }

  salvarContato(e) {
    e.preventDefault();
    const form = this.$('#form-contato');
    const nome       = form.elements['nome'].value.trim();
    const telefone   = form.elements['telefone'].value.trim();
    const parentesco = form.elements['parentesco'].value;
    if (!nome) { this.showToast('Informe o nome do contato', 'err'); return; }

    if (this._editandoContatoId) {
      const c = this.CONTATOS_EMERG.find(x => x.id === this._editandoContatoId);
      if (c) Object.assign(c, { nome, telefone, parentesco });
      this.showToast('Contato atualizado', 'ok');
    } else {
      this.CONTATOS_EMERG.push({
        id: Math.max(0, ...this.CONTATOS_EMERG.map(x => x.id)) + 1,
        colaborador_id: this._drawerColabId,
        nome, telefone, parentesco,
      });
      this.showToast('Contato cadastrado', 'ok');
    }
    this.fecharModalContato();
    this.renderContatosEmergencia(this._drawerColabId);
  }

  excluirContato(id) {
    if (!confirm('Remover este contato de emergência?')) return;
    this.CONTATOS_EMERG = this.CONTATOS_EMERG.filter(x => x.id !== id);
    this.renderContatosEmergencia(this._drawerColabId);
    this.showToast('Contato removido');
  }

  exportColaboradores() {
    this.showToast('Exportação CSV será implementada na integração', 'ok');
  }

  // ─── Quadro de funcionários ───────────────────────────────────────────────

  renderQuadro() {
    const grid = this.$('#setor-grid');
    if (!grid) return;

    const q       = (this.$('#quad-search')?.value || '').trim().toLowerCase();
    const fStatus = this.$('#quad-filter-status')?.value || '';
    const fTurno  = this.$('#quad-filter-turno')?.value || '';

    const filtrados = this.COLABORADORES.filter(c => {
      // Afastados nunca aparecem no quadro (continuam acessíveis na página de Colaboradores)
      if (c.status === 'afastado') return false;
      // Se nenhum filtro de status é aplicado, exclui inativos automaticamente
      if (!fStatus && c.status === 'inativo') return false;
      if (fStatus && c.status !== fStatus) return false;
      if (fTurno && (c.turno || 'diurno') !== fTurno) return false;
      if (q && !c.nome.toLowerCase().includes(q)) return false;
      return true;
    });

    const SEM_AREA = '— sem área definida —';
    const porSetor = {};
    filtrados.forEach(c => {
      const area = c.area || SEM_AREA;
      const turno = c.turno || 'diurno';
      if (!porSetor[c.setor])       porSetor[c.setor] = {};
      if (!porSetor[c.setor][area]) porSetor[c.setor][area] = {};
      if (!porSetor[c.setor][area][turno]) porSetor[c.setor][area][turno] = [];
      porSetor[c.setor][area][turno].push(c);
    });

    const setoresAtivos = Object.keys(porSetor);
    this.$('#quad-stat-total').textContent   = filtrados.length;
    this.$('#quad-stat-setores').textContent = setoresAtivos.length;

    const totalSetor = (s) => {
      let total = 0;
      Object.values(porSetor[s]).forEach(areaObj => {     // areaObj = { turno: [pessoas] }
        Object.values(areaObj).forEach(pessoasArr => {    // pessoasArr = [pessoas]
          total += pessoasArr.length;
        });
      });
      return total;
    };

    let maior = '—', maiorN = 0;
    setoresAtivos.forEach(s => {
      const n = totalSetor(s);
      if (n > maiorN) { maiorN = n; maior = `${s} (${n})`; }
    });
    this.$('#quad-stat-maior').textContent = maior;

    if (!setoresAtivos.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1; background:var(--white); border:1px solid var(--border); border-radius:12px;">Nenhum colaborador encontrado</div>`;
      return;
    }

    setoresAtivos.sort((a, b) => totalSetor(b) - totalSetor(a));

    grid.innerHTML = setoresAtivos.map(setor => {
      const areas = porSetor[setor];
      const total = totalSetor(setor);
      const areasOrdenadas = Object.keys(areas).sort((a, b) => {
        if (a === SEM_AREA) return 1;
        if (b === SEM_AREA) return -1;
        return a.localeCompare(b);
      });

      const areasHtml = areasOrdenadas.map(area => {
        const turnos = porSetor[setor][area];
        const turnosOrdenados = Object.keys(turnos).sort((a, b) => {
          const order = { diurno: 0, noturno: 1 };
          return (order[a] ?? 99) - (order[b] ?? 99);
        });

        const turnosHtml = turnosOrdenados.map(turno => {
          const pessoas = turnos[turno];
          const pessoasHtml = pessoas
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map(p => `
              <div class="func-mini" onclick="abrirDrawerColab(${p.id})">
                <div class="cell-avatar">${this.h(this.iniciais(p.nome))}</div>
                <div class="func-mini-name">${this.h(p.nome)}</div>
                <div class="func-mini-status ${this.h(p.status)}" title="${this.h(this.STATUS_LABEL[p.status]?.t || p.status)}"></div>
              </div>
            `).join('');

          const turnoLabel = turno === 'noturno' ? '🌙 Noturno' : '☀️ Diurno';
          return `
            <div style="margin-bottom:12px;">
              <div class="area-header" style="padding-left:12px; opacity:0.7; font-size:0.85rem;">
                <span>${turnoLabel}</span>
                <span class="area-count">${pessoas.length}</span>
              </div>
              <div class="func-list" style="margin-top:6px;">${pessoasHtml}</div>
            </div>
          `;
        }).join('');

        const totalArea = turnosOrdenados.reduce((sum, turno) => sum + turnos[turno].length, 0);
        const isSemArea = area === SEM_AREA;
        return `
          <div class="area-block">
            <div class="area-header">
              <span class="area-name${isSemArea ? ' sem-area' : ''}">${this.h(area)}</span>
              <span class="area-count">${totalArea}</span>
            </div>
            <div class="area-body">${turnosHtml}</div>
          </div>
        `;
      }).join('');

      // Setores com muitos colaboradores ocupam a linha inteira para
      // distribuir os nomes em várias colunas (menos crescimento vertical)
      const wide = total > 8 ? ' setor-card--wide' : '';

      return `
        <div class="setor-card${wide}">
          <div class="setor-header">
            <div class="setor-icon">${this.SETOR_ICON[setor] || '◆'}</div>
            <div class="setor-title-block">
              <div class="setor-name">${this.h(setor)}</div>
              <div class="setor-meta">${areasOrdenadas.filter(a => a !== SEM_AREA).length} ${areasOrdenadas.filter(a => a !== SEM_AREA).length === 1 ? 'área' : 'áreas'}</div>
            </div>
            <div class="setor-count">${total}</div>
          </div>
          <div class="setor-body">${areasHtml}</div>
        </div>
      `;
    }).join('');
  }

  // ─── Afastamentos ─────────────────────────────────────────────────────────

  abrirModalAfastamento(id = null) {
    const colabId = id || this._drawerColabId;
    if (!colabId) return;

    this.$('#modal-afastamento-title').textContent = 'Novo afastamento';
    this.$('#afastamento-colab-id').value = colabId;
    this.$('#form-afastamento').reset();
    this.$('#form-afastamento').elements['data_inicio'].value = new Date().toISOString().slice(0, 10);
    this.$('#form-afastamento').elements['data_termino'].value = new Date().toISOString().slice(0, 10);
    this.$('#modal-afastamento').classList.add('active');
  }

  fecharModalAfastamento() {
    this.$('#modal-afastamento').classList.remove('active');
  }

  async salvarAfastamento(ev) {
    ev.preventDefault();
    const form = this.$('#form-afastamento');
    const data = Object.fromEntries(new FormData(form));

    const colabId = parseInt(data.colaborador_id, 10);
    const dataInicio = data.data_inicio;
    const dataTermino = data.data_termino;

    if (!dataInicio || !dataTermino || dataTermino < dataInicio) {
      this.showToast('Datas inválidas', 'err');
      return;
    }

    const diasTotais = Math.ceil((new Date(dataTermino + 'T00:00:00') - new Date(dataInicio + 'T00:00:00')) / 86400000) + 1;

    const payload = {
      colaborador_id: colabId,
      tipo: data.tipo,
      data_inicio: dataInicio,
      data_termino: dataTermino,
      dias_totais: diasTotais,
      motivo: data.motivo || '',
      status: data.status || 'pendente',
      observacoes: data.observacoes || '',
    };

    const temSessao = this.Afastamentos && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Afastamentos.criar(payload);
        this.showToast('Afastamento registrado', 'ok');
      } catch (err) {
        this.showToast('Erro ao salvar: ' + err.message, 'err');
        return;
      }
    } else {
      const newId = Math.max(0, ...(this.AFASTAMENTOS.map(x => x.id) || [0])) + 1;
      this.AFASTAMENTOS.push({
        id: newId,
        ...payload,
        criado_em: new Date().toISOString(),
      });
      this.showToast('Afastamento adicionado', 'ok');
    }

    form.reset();
    this.fecharModalAfastamento();
    this.abrirDrawerColab(colabId);
  }

  editarAfastamento(id) {
    const afastamento = this.AFASTAMENTOS.find(a => a.id === id);
    if (!afastamento) return;

    this.$('#modal-afastamento-title').textContent = 'Editar afastamento';
    const form = this.$('#form-afastamento');
    form.elements['colaborador_id'].value = afastamento.colaborador_id;
    form.elements['tipo'].value = afastamento.tipo;
    form.elements['data_inicio'].value = afastamento.data_inicio;
    form.elements['data_termino'].value = afastamento.data_termino;
    form.elements['dias_totais'].value = afastamento.dias_totais;
    form.elements['motivo'].value = afastamento.motivo || '';
    form.elements['status'].value = afastamento.status;
    form.elements['observacoes'].value = afastamento.observacoes || '';

    this.$('#modal-afastamento').classList.add('active');
  }
}

export default ColaboradoresModule;
