// Vale Combustível Module
// Renders the fuel allowance page: summary table, modal, detail modal, quotas modal, evolution chart

export class ValeCombustivelModule {
  constructor(deps) {
    this.$            = deps.$;
    this.h            = deps.h;
    this.iniciais     = deps.iniciais;
    this.fmtDate      = deps.fmtDate;
    this.fmtBRL       = deps.fmtBRL;
    this.mesChave     = deps.mesChave;
    this.mesLabel     = deps.mesLabel;
    this.COLABORADORES        = deps.COLABORADORES;
    this.VALE_LANCAMENTOS     = deps.VALE_LANCAMENTOS;
    this.VALE_COTAS           = deps.VALE_COTAS;
    this.CHART_COLORS         = deps.CHART_COLORS;
    this.Auth                 = deps.Auth;
    this.ValeCombustivel      = deps.ValeCombustivel;
    this.showToast            = deps.showToast;

    this._chartValeEvo    = null;
    this._detalheColabId  = null;
    this._detalheMes      = null;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'vale-search') this.render();
    });
    document.addEventListener('change', (e) => {
      if (e.target.id === 'vale-mes' || e.target.id === 'vale-filter-setor') this.render();
    });
    document.querySelectorAll('.nav-item[data-page="vale-combustivel"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  _mesesDisponiveis() {
    const meses = new Set();
    this.VALE_LANCAMENTOS.forEach(l => { if (l.data) meses.add(this.mesChave(l.data)); });
    return [...meses].sort().reverse();
  }

  render() {
    const selMes = this.$('#vale-mes');
    if (selMes) {
      const meses = this._mesesDisponiveis();
      const cur = selMes.value;
      selMes.innerHTML = meses.map(m => `<option value="${m}">${this.mesLabel(m)}</option>`).join('');
      if (cur && meses.includes(cur)) selMes.value = cur;
    }

    const mesAtual = selMes?.value || this._mesesDisponiveis()[0];
    const q    = (this.$('#vale-search')?.value || '').trim().toLowerCase();
    const fSet = this.$('#vale-filter-setor')?.value || '';

    const lancMes = this.VALE_LANCAMENTOS.filter(l => this.mesChave(l.data) === mesAtual);
    const ativos  = this.COLABORADORES.filter(c => c.status !== 'inativo');

    const resumo = ativos.map(c => {
      const lancs = lancMes.filter(l => l.colaborador_id === c.id);
      const usado = lancs.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
      const cota  = parseFloat(this.VALE_COTAS[c.id] || 0);
      const saldo = cota - usado;
      return { colab: c, lancs, usado, cota, saldo };
    });

    const filtrados = resumo.filter(r => {
      if (fSet && r.colab.setor !== fSet) return false;
      if (q && !r.colab.nome.toLowerCase().includes(q)) return false;
      return true;
    });

    const totalMes     = resumo.reduce((s, r) => s + r.usado, 0);
    const descontoMes  = resumo.reduce((s, r) => s + Math.max(0, r.usado - r.cota), 0);
    const acimaCota    = resumo.filter(r => r.usado > r.cota && r.cota > 0).length;
    const comLanc      = resumo.filter(r => r.lancs.length > 0).length;
    this.$('#vale-stat-total').textContent    = this.fmtBRL(totalMes);
    this.$('#vale-stat-desconto').textContent = this.fmtBRL(descontoMes);
    this.$('#vale-stat-acima').textContent    = acimaCota;
    this.$('#vale-stat-media').textContent    = this.fmtBRL(comLanc ? totalMes / comLanc : 0);

    const tb = this.$('#tb-vale-resumo');
    if (tb) {
      const lista = filtrados.sort((a, b) => {
        const ea = a.usado - a.cota;
        const eb = b.usado - b.cota;
        if (ea > 0 && eb <= 0) return -1;
        if (eb > 0 && ea <= 0) return 1;
        if (ea !== eb) return eb - ea;
        return a.colab.nome.localeCompare(b.colab.nome);
      });
      tb.innerHTML = lista.length ? lista.map(r => {
        const c = r.colab;
        const excesso  = r.usado - r.cota;
        const desconto = Math.max(0, excesso);
        const statusBadge = r.cota === 0
          ? `<span class="badge neutral">Sem cota</span>`
          : r.usado === 0
            ? `<span class="badge info">Sem uso</span>`
            : excesso > 0
              ? `<span class="badge danger">Acima</span>`
              : excesso <= r.cota * 0.1
                ? `<span class="badge warn">No limite</span>`
                : `<span class="badge ok">Dentro</span>`;
        const saldoStyle  = r.saldo < 0 ? 'color:var(--danger); font-weight:700;' : r.saldo === 0 ? 'color:var(--text-muted)' : 'color:var(--success)';
        const descStyle   = desconto > 0 ? 'color:var(--danger); font-weight:700;' : 'color:var(--text-soft);';
        return `
          <tr onclick="abrirModalValeDetalhe(${c.id}, '${mesAtual}')">
            <td>
              <div class="cell-person">
                <div class="cell-avatar">${this.h(this.iniciais(c.nome))}</div>
                <div>
                  <div class="cell-person-name">${this.h(c.nome)}</div>
                  <div class="cell-person-sub">${this.h(c.setor)}${c.area ? ' · ' + this.h(c.area) : ''}</div>
                </div>
              </div>
            </td>
            <td>
              <div>${this.h(c.setor)}</div>
              ${c.area ? `<div class="cell-person-sub">${this.h(c.area)}</div>` : ''}
            </td>
            <td class="cell-mono" style="text-align:right">${this.fmtBRL(r.cota)}</td>
            <td class="cell-mono" style="text-align:right">${this.fmtBRL(r.usado)}</td>
            <td class="cell-mono" style="text-align:right; ${saldoStyle}">${this.fmtBRL(r.saldo)}</td>
            <td class="cell-mono" style="text-align:right; ${descStyle}">${this.fmtBRL(desconto)}</td>
            <td class="cell-mono">${r.lancs.length}</td>
            <td>${statusBadge}</td>
            <td class="actions" onclick="event.stopPropagation()">
              <button class="btn btn-ghost btn-sm btn-icon" title="Novo lançamento" onclick="abrirModalValeLancamento(null, ${c.id})">+</button>
            </td>
          </tr>
        `;
      }).join('') : `<tr><td colspan="9" class="empty">Sem dados para ${this.mesLabel(mesAtual)}</td></tr>`;
    }

    this._renderEvolucao();
  }

  _renderEvolucao() {
    const meses = this._mesesDisponiveis().slice(0, 6).reverse();
    const cotaGlobal = Object.values(this.VALE_COTAS).reduce((a, b) => a + parseFloat(b || 0), 0);
    const totais = meses.map(m => {
      const lancs = this.VALE_LANCAMENTOS.filter(l => this.mesChave(l.data) === m);
      const total = lancs.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
      let desconto = 0;
      this.COLABORADORES.forEach(c => {
        const usado = lancs.filter(l => l.colaborador_id === c.id).reduce((s, l) => s + parseFloat(l.valor || 0), 0);
        const cota  = parseFloat(this.VALE_COTAS[c.id] || 0);
        desconto += Math.max(0, usado - cota);
      });
      return { total, desconto, cota: cotaGlobal };
    });

    this._chartValeEvo?.destroy();
    this._chartValeEvo = new Chart(this.$('#chart-vale-evolucao'), {
      type: 'bar',
      data: {
        labels: meses.map(m => this.mesLabel(m)),
        datasets: [
          { label: 'Dentro da cota',   data: totais.map(t => t.total - t.desconto), backgroundColor: this.CHART_COLORS.phthaloLight, stack: 'g', borderRadius: 3 },
          { label: 'Desconto em folha', data: totais.map(t => t.desconto),          backgroundColor: '#EF4444',                      stack: 'g', borderRadius: 3 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${this.fmtBRL(ctx.parsed.y)}` } },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: this.CHART_COLORS.grid }, ticks: { callback: v => 'R$ ' + v } },
        },
      },
    });
  }

  abrirModalLancamento(id = null, preColabId = null) {
    const form = this.$('#form-vale-lancamento');
    form.reset();
    this.$('#form-vale-colab').innerHTML = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => `<option value="${c.id}">${this.h(c.nome)} — ${this.h(c.setor)}</option>`).join('');

    if (id != null) {
      const l = this.VALE_LANCAMENTOS.find(x => x.id === id);
      if (l) {
        this.$('#modal-vale-lancto-title').textContent = 'Editar lançamento';
        for (const [k, v] of Object.entries(l)) {
          const f = form.elements[k];
          if (f) f.value = v ?? '';
        }
      }
    } else {
      this.$('#modal-vale-lancto-title').textContent = 'Novo lançamento';
      form.elements['data'].value = new Date().toISOString().slice(0, 10);
      if (preColabId != null) form.elements['colaborador_id'].value = preColabId;
    }
    this.$('#modal-vale-lancamento').classList.add('active');
  }

  fecharModalLancamento() {
    this.$('#modal-vale-lancamento').classList.remove('active');
  }

  async salvarLancamento(ev) {
    ev.preventDefault();
    const form = this.$('#form-vale-lancamento');
    const data = Object.fromEntries(new FormData(form));
    const id   = data.id ? parseInt(data.id, 10) : null;

    const payload = {
      colaborador_id: parseInt(data.colaborador_id, 10),
      data:           data.data,
      valor:          parseFloat(data.valor) || 0,
      litros:         data.litros ? parseFloat(data.litros) : null,
      km_atual:       data.km_atual ? parseInt(data.km_atual, 10) : null,
      posto:          data.posto || '',
      observacoes:    data.observacoes || '',
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        if (id != null) {
          const saved = await this.ValeCombustivel.atualizar(id, payload);
          const i = this.VALE_LANCAMENTOS.findIndex(x => x.id === id);
          if (i >= 0) this.VALE_LANCAMENTOS[i] = saved;
        } else {
          const saved = await this.ValeCombustivel.criar(payload);
          this.VALE_LANCAMENTOS.unshift(saved);
        }
      } catch (err) { this.showToast('Erro ao salvar: ' + err.message, 'err'); return; }
    } else {
      if (id != null) {
        const i = this.VALE_LANCAMENTOS.findIndex(x => x.id === id);
        if (i >= 0) this.VALE_LANCAMENTOS[i] = { ...this.VALE_LANCAMENTOS[i], ...payload };
      } else {
        const nextId = Math.max(0, ...this.VALE_LANCAMENTOS.map(x => x.id)) + 1;
        this.VALE_LANCAMENTOS.unshift({ id: nextId, ...payload });
      }
    }

    this.showToast(id != null ? 'Lançamento atualizado' : 'Lançamento registrado', 'ok');
    this.fecharModalLancamento();
    this.render();
    if (this._detalheColabId) this._renderDetalhe(this._detalheColabId, this._detalheMes);
  }

  async excluirLancamento(id) {
    if (!confirm('Excluir este lançamento?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try { await this.ValeCombustivel.excluir(id); } catch (err) { this.showToast('Erro: ' + err.message, 'err'); return; }
    }
    const idx = this.VALE_LANCAMENTOS.findIndex(x => x.id === id);
    if (idx >= 0) this.VALE_LANCAMENTOS.splice(idx, 1);
    this.render();
    if (this._detalheColabId) this._renderDetalhe(this._detalheColabId, this._detalheMes);
    this.showToast('Lançamento excluído');
  }

  abrirModalDetalhe(colabId, mes) {
    this._detalheColabId = colabId;
    this._detalheMes     = mes;
    this._renderDetalhe(colabId, mes);
    this.$('#btn-vale-det-novo').onclick = () => this.abrirModalLancamento(null, colabId);
    this.$('#modal-vale-detalhe').classList.add('active');
  }

  _renderDetalhe(colabId, mes) {
    const c = this.COLABORADORES.find(x => x.id === colabId);
    if (!c) return;
    const lancs = this.VALE_LANCAMENTOS
      .filter(l => l.colaborador_id === colabId && this.mesChave(l.data) === mes)
      .sort((a, b) => a.data.localeCompare(b.data));
    const usado = lancs.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
    const cota  = parseFloat(this.VALE_COTAS[colabId] || 0);
    const saldo = cota - usado;

    this.$('#vale-det-title').textContent = `${c.nome} — ${this.mesLabel(mes)}`;
    this.$('#vale-det-summary').innerHTML = `
      <div class="info-item"><div class="info-label">Cota mensal</div><div class="info-value mono">${this.fmtBRL(cota)}</div></div>
      <div class="info-item"><div class="info-label">Utilizado</div><div class="info-value mono">${this.fmtBRL(usado)}</div></div>
      <div class="info-item"><div class="info-label">Saldo</div><div class="info-value mono" style="${saldo < 0 ? 'color:var(--danger);font-weight:700' : ''}">${this.fmtBRL(saldo)}</div></div>
      <div class="info-item"><div class="info-label">Desconto em folha</div><div class="info-value mono">${this.fmtBRL(Math.max(0, usado - cota))}</div></div>
    `;

    const tb = this.$('#tb-vale-detalhe');
    tb.innerHTML = lancs.length ? lancs.map(l => `
      <tr>
        <td class="cell-mono">${this.fmtDate(l.data)}</td>
        <td class="cell-mono" style="text-align:right">${this.fmtBRL(l.valor)}</td>
        <td class="cell-mono" style="text-align:right">${l.litros ? l.litros.toFixed(2).replace('.', ',') : '—'}</td>
        <td class="cell-mono" style="text-align:right">${l.km_atual || '—'}</td>
        <td>${this.h(l.posto || '—')}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalValeLancamento(${l.id})">✎</button>
          <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirValeLancamento(${l.id})">🗑</button>
        </td>
      </tr>
    `).join('') : `<tr><td colspan="6" class="empty">Nenhum lançamento neste mês</td></tr>`;
  }

  fecharModalDetalhe() {
    this.$('#modal-vale-detalhe').classList.remove('active');
    this._detalheColabId = null;
    this._detalheMes     = null;
  }

  abrirModalCotas() {
    const ativos = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome));

    const tb = this.$('#tb-vale-cotas');
    tb.innerHTML = ativos.map(c => `
        <tr data-setor="${this.h(c.setor || '')}">
          <td>${this.h(c.nome)}</td>
          <td>${this.h(c.setor)}</td>
          <td style="text-align:right">
            <input type="number" step="0.01" min="0" value="${this.VALE_COTAS[c.id] || 0}"
                   id="cota-input-${c.id}" data-colab="${c.id}"
                   style="width:130px; text-align:right; background:var(--bluish-bg); border:1px solid var(--border); border-radius:6px; padding:6px 10px; font-family:var(--mono); font-size:.85rem;">
          </td>
        </tr>
      `).join('');

    // Popula o seletor de setor da padronização
    const setores = [...new Set(ativos.map(c => c.setor).filter(Boolean))].sort();
    const sel = this.$('#vale-cota-pad-setor');
    if (sel) sel.innerHTML = setores.map(s => `<option value="${this.h(s)}">${this.h(s)}</option>`).join('');

    this.$('#modal-vale-cotas').classList.add('active');
  }

  // Preenche os inputs de cota de todos os colaboradores do setor escolhido
  // com o valor informado (a persistência ocorre ao clicar em "Salvar cotas").
  aplicarCotaSetor() {
    const setor = this.$('#vale-cota-pad-setor')?.value || '';
    const valor = parseFloat(this.$('#vale-cota-pad-valor')?.value) || 0;
    if (!setor) return;
    let n = 0;
    this.$('#tb-vale-cotas').querySelectorAll('tr').forEach(tr => {
      if (tr.dataset.setor === setor) {
        const input = tr.querySelector('input[data-colab]');
        if (input) { input.value = valor; n++; }
      }
    });
    this.showToast(`Valor aplicado a ${n} colaborador(es) do setor ${setor}`, 'ok');
  }

  // Persiste todas as cotas alteradas no banco (quando há sessão) e atualiza
  // o estado em memória.
  async salvarCotas() {
    const inputs = [...this.$('#tb-vale-cotas').querySelectorAll('input[data-colab]')];
    const now = new Date();
    const mes = now.getMonth() + 1;
    const ano = now.getFullYear();

    const temSessao = this.ValeCombustivel && this.Auth && await this.Auth.sessaoAtual().catch(() => null);

    let ok = 0, falhas = 0;
    for (const input of inputs) {
      const colabId = parseInt(input.dataset.colab, 10);
      const valor   = parseFloat(input.value) || 0;
      if ((parseFloat(this.VALE_COTAS[colabId]) || 0) === valor) continue; // sem mudança

      if (temSessao) {
        try {
          await this.ValeCombustivel.upsertCota({
            colaborador_id: colabId,
            mes, ano,
            valor_mensal:   valor,
            data_concessao: now.toISOString().slice(0, 10),
            status:         'ativo',
          });
        } catch (err) {
          falhas++;
          console.error('Falha ao salvar cota de', colabId, err);
          continue;
        }
      }
      this.VALE_COTAS[colabId] = valor;
      ok++;
    }

    this.fecharModalCotas();
    this.render();
    if (falhas) this.showToast(`${ok} cota(s) salva(s), ${falhas} com erro`, 'err');
    else        this.showToast(ok ? `${ok} cota(s) salva(s)` : 'Nenhuma alteração', 'ok');
  }

  fecharModalCotas() {
    this.$('#modal-vale-cotas').classList.remove('active');
  }
}

export default ValeCombustivelModule;
