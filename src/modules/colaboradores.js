// Colaboradores Module
// Gerencia renderização e lógica da seção de colaboradores

export class ColaboradoresModule {
  constructor(deps) {
    this.Colaboradores = deps.Colaboradores;
    this.Departamentos = deps.Departamentos;
    this.Auth = deps.Auth;
    this.$ = deps.$;
    this.h = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate = deps.fmtDate;
    this.tempoCasa = deps.tempoCasa;
    this.STATUS_LABEL = deps.STATUS_LABEL;
    this.COLABORADORES = deps.COLABORADORES;

    // Estado da seção
    this.state = {
      page: 1,
      limit: 50,
      totalPages: 1,
      total: 0,
      drawerColabId: null,
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'col-search') {
        this.state.page = 1;
        this.render();
      }
    });

    document.addEventListener('change', (e) => {
      if (['col-filter-setor', 'col-filter-status'].includes(e.target.id)) {
        this.state.page = 1;
        this.render();
      }
    });
  }

  async render() {
    const tbody = this.$('#tb-colaboradores');
    if (!tbody) return;

    const busca  = (this.$('#col-search')?.value  || '').trim();
    const status = this.$('#col-filter-status')?.value || '';
    const setor  = this.$('#col-filter-setor')?.value  || '';

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);

    if (temSessao) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty" style="color:var(--text-muted)">Carregando…</td></tr>`;
      try {
        const res = await this.Colaboradores.listar({
          page: this.state.page,
          limit: this.state.limit,
          busca,
          status,
          setor
        });

        this.state.total = res.total;
        this.state.totalPages = res.totalPages;

        tbody.innerHTML = res.data.length
          ? this._renderLinhas(res.data)
          : `<tr><td colspan="6" class="empty">Nenhum colaborador encontrado</td></tr>`;

        this._updateStats(res.data);
        this._renderPaginacao(res.page, res.totalPages, res.total);
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty">Erro ao carregar: ${this.h(err.message)}</td></tr>`;
      }
    } else {
      // Fallback mock
      const lista = this._filtrarMock(busca, status, setor);
      tbody.innerHTML = lista.length
        ? this._renderLinhas(lista)
        : `<tr><td colspan="6" class="empty">Nenhum colaborador encontrado</td></tr>`;
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
    } catch (_) {}
  }

  irPagina(p) {
    if (p < 1 || p > this.state.totalPages) return;
    this.state.page = p;
    this.render();
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
          <td>${this.h(c.cargo)}</td>
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
        x.cargo.toLowerCase().includes(q)
      );
    }
    if (status) lista = lista.filter(x => x.status === status);
    if (setor)  lista = lista.filter(x => String(x.departamento_id) === String(setor));
    return lista;
  }
}

export default ColaboradoresModule;
