// Vencimentos Module
// Gerencia ASOs, documentos e treinamentos com controle de vencimento

export class VencimentosModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate = deps.fmtDate;
    this.VENCIMENTOS = deps.VENCIMENTOS;
    this.COLABORADORES = deps.COLABORADORES;
    this.CHART_COLORS = deps.CHART_COLORS;
    this.Auth = deps.Auth;
    this.Vencimentos = deps.Vencimentos;

    this.VENC_CAT_BADGE = {
      'ASO': { cls: 'info', t: 'ASO' },
      'Documento': { cls: 'neutral', t: 'Documento' },
      'Treinamento': { cls: 'ok', t: 'Treinamento' },
    };

    this._chartVencTimeline = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'venc-search') this.render();
    });

    document.addEventListener('change', (e) => {
      if (['venc-filter-cat', 'venc-filter-status'].includes(e.target.id)) this.render();
    });

    document.querySelectorAll('.nav-item[data-page="vencimentos"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  render() {
    const tb = this.$('#tb-vencimentos');
    if (!tb) return;

    const q = (this.$('#venc-search')?.value || '').trim().toLowerCase();
    const fCat = this.$('#venc-filter-cat')?.value || '';
    const fSt = this.$('#venc-filter-status')?.value || '';

    const enriched = this.VENCIMENTOS.map(v => {
      const c = this.COLABORADORES.find(x => x.id === v.colaborador_id);
      const dias = this._diasAte(v.vencimento);
      return { ...v, _colab: c, _dias: dias, _status: this._vencStatus(dias) };
    });

    const lista = enriched.filter(v => {
      if (fCat && v.categoria !== fCat) return false;
      if (fSt && v._status !== fSt) return false;
      if (q) {
        const hay = [v._colab?.nome, v.item, v.categoria].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => a._dias - b._dias);

    tb.innerHTML = lista.length
      ? this._renderLinhas(lista)
      : `<tr><td colspan="8" class="empty">Nenhum vencimento encontrado</td></tr>`;

    const tot = (st) => enriched.filter(v => v._status === st).length;
    this.$('#venc-stat-vencidos').textContent = tot('vencido');
    this.$('#venc-stat-criticos').textContent = tot('critico');
    this.$('#venc-stat-alerta').textContent = tot('alerta');
    this.$('#venc-stat-ok').textContent = tot('ok');

    this._renderTimeline(enriched);
  }

  _renderLinhas(lista) {
    return lista.map(v => {
      const c = v._colab;
      const catBadge = this.VENC_CAT_BADGE[v.categoria] || { cls: 'neutral', t: v.categoria };
      return `
        <tr onclick="if(${c?.id || 0}) abrirDrawerColab(${c?.id || 0})">
          <td>
            ${c ? `
              <div class="cell-person">
                <div class="cell-avatar">${this.h(this.iniciais(c.nome))}</div>
                <div>
                  <div class="cell-person-name">${this.h(c.nome)}</div>
                  <div class="cell-person-sub">${this.h(c.setor)}</div>
                </div>
              </div>
            ` : `<span style="color:var(--text-soft)">— colaborador removido —</span>`}
          </td>
          <td><span class="badge ${catBadge.cls}">${catBadge.t}</span></td>
          <td style="font-weight:500;">${this.h(v.item)}</td>
          <td class="cell-mono">${this.fmtDate(v.emissao)}</td>
          <td class="cell-mono">${this.fmtDate(v.vencimento)}</td>
          <td class="cell-mono">${this._diasFmt(v._dias)}</td>
          <td>${this._vencBadge(v._dias)}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="Renovar" onclick="renovarVencimento(${v.id})">&#8635;</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalVencimento(${v.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirVencimento(${v.id})">🗑</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  _renderTimeline(enriched) {
    const el = this.$('#chart-venc-timeline');
    if (!el || typeof Chart === 'undefined') return;

    const semanas = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    for (let i = 0; i < 13; i++) {
      const start = new Date(hoje);
      start.setDate(hoje.getDate() + i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      semanas.push({
        start, end, aso: 0, doc: 0, trn: 0,
        label: `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`,
      });
    }

    enriched.forEach(v => {
      const dias = v._dias;
      if (dias < 0 || dias > 13 * 7) return;
      const idx = Math.floor(dias / 7);
      const bucket = semanas[idx];
      if (!bucket) return;
      if (v.categoria === 'ASO') bucket.aso++;
      else if (v.categoria === 'Documento') bucket.doc++;
      else if (v.categoria === 'Treinamento') bucket.trn++;
    });

    this._chartVencTimeline?.destroy?.();
    this._chartVencTimeline = new Chart(el, {
      type: 'bar',
      data: {
        labels: semanas.map(s => s.label),
        datasets: [
          { label: 'ASO', data: semanas.map(s => s.aso), backgroundColor: this.CHART_COLORS.phthaloBright, stack: 's', borderRadius: 3 },
          { label: 'Documento', data: semanas.map(s => s.doc), backgroundColor: this.CHART_COLORS.phthaloLight, stack: 's', borderRadius: 3 },
          { label: 'Treinamento', data: semanas.map(s => s.trn), backgroundColor: this.CHART_COLORS.phthalo, stack: 's', borderRadius: 3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: this.CHART_COLORS.grid }, ticks: { stepSize: 1 } },
        },
      },
    });
  }

  setFiltroStatus(st) {
    const el = this.$('#venc-filter-status');
    if (!el) return;
    el.value = (el.value === st) ? '' : st;
    this.render();
  }

  abrirModalVencimento(id = null) {
    const form = this.$('#form-vencimento');
    form.reset();
    const sel = this.$('#form-venc-colab');
    sel.innerHTML = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => `<option value="${c.id}">${this.h(c.nome)} — ${this.h(c.setor)}</option>`)
      .join('');

    if (id != null) {
      const v = this.VENCIMENTOS.find(x => x.id === id);
      if (v) {
        this.$('#modal-venc-title').textContent = 'Editar vencimento';
        for (const [k, val] of Object.entries(v)) {
          const f = form.elements[k];
          if (f) f.value = val ?? '';
        }
      }
    } else {
      this.$('#modal-venc-title').textContent = 'Novo vencimento';
    }
    this.$('#modal-vencimento').classList.add('active');
  }

  fecharModalVencimento() {
    this.$('#modal-vencimento').classList.remove('active');
  }

  async salvarVencimento(ev) {
    ev.preventDefault();
    const form = this.$('#form-vencimento');
    const data = Object.fromEntries(new FormData(form));
    const id = data.id ? parseInt(data.id, 10) : null;

    const payload = {
      colaborador_id:  parseInt(data.colaborador_id, 10),
      categoria:       data.categoria,
      tipo:            data.item,
      data_emissao:    data.emissao || null,
      data_vencimento: data.vencimento,
      observacoes:     data.observacoes || '',
    };

    const frontendItem = {
      colaborador_id: payload.colaborador_id,
      categoria:      payload.categoria,
      item:           payload.tipo,
      emissao:        payload.data_emissao || null,
      vencimento:     payload.data_vencimento,
      observacoes:    payload.observacoes || '',
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        const saved = await this.Vencimentos.criar(payload);
        this.VENCIMENTOS.unshift({ ...frontendItem, id: saved.id, _tabela: saved._tabela });
      } catch (err) {
        alert('Erro ao salvar: ' + err.message);
        return;
      }
    } else {
      if (id != null) {
        const i = this.VENCIMENTOS.findIndex(x => x.id === id);
        if (i >= 0) this.VENCIMENTOS[i] = { ...this.VENCIMENTOS[i], ...frontendItem };
      } else {
        const newId = Math.max(0, ...this.VENCIMENTOS.map(x => x.id)) + 1;
        this.VENCIMENTOS.unshift({ id: newId, ...frontendItem });
      }
    }
    this.fecharModalVencimento();
    this.render();
    if (typeof window.atualizarBadgeVencimentos === 'function') window.atualizarBadgeVencimentos();
  }

  renovarVencimento(id) {
    const v = this.VENCIMENTOS.find(x => x.id === id);
    if (!v) return;

    const meses = /CNH/i.test(v.item) ? 60 : 12;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const novoVenc = new Date(hoje);
    novoVenc.setMonth(novoVenc.getMonth() + meses);

    this.abrirModalVencimento();
    const form = this.$('#form-vencimento');
    form.elements['colaborador_id'].value = v.colaborador_id;
    form.elements['categoria'].value = v.categoria;
    form.elements['item'].value = v.item;
    form.elements['emissao'].value = hoje.toISOString().slice(0, 10);
    form.elements['vencimento'].value = novoVenc.toISOString().slice(0, 10);
    form.elements['observacoes'].value = `Renovação do registro #${id}`;
    this.$('#modal-venc-title').textContent = 'Renovar vencimento';
  }

  async excluirVencimento(id) {
    if (!confirm('Excluir este vencimento?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      const v = this.VENCIMENTOS.find(x => x.id === id);
      const tabela = v?._tabela || 'documentos';
      try {
        await this.Vencimentos.excluir(id, tabela);
        // Remove do array local após sucesso no banco
        this.VENCIMENTOS = this.VENCIMENTOS.filter(x => x.id !== id);
      } catch (err) {
        alert('Erro ao excluir: ' + err.message);
        return;
      }
    } else {
      this.VENCIMENTOS = this.VENCIMENTOS.filter(x => x.id !== id);
    }
    this.render();
    if (typeof window.atualizarBadgeVencimentos === 'function') window.atualizarBadgeVencimentos();
  }

  urgentes() {
    return this.VENCIMENTOS.filter(v => {
      const dias = this._diasAte(v.vencimento);
      return dias <= 30;
    });
  }

  _diasAte(isoVenc) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const v = new Date(isoVenc + 'T00:00:00');
    return Math.round((v - hoje) / (1000 * 60 * 60 * 24));
  }

  _vencStatus(dias) {
    if (dias < 0) return 'vencido';
    if (dias <= 7) return 'critico';
    if (dias <= 30) return 'alerta';
    return 'ok';
  }

  _vencBadge(dias) {
    const st = this._vencStatus(dias);
    if (st === 'vencido') return `<span class="badge danger">Vencido</span>`;
    if (st === 'critico') return `<span class="badge warn">Crítico</span>`;
    if (st === 'alerta') return `<span class="badge info">Atenção</span>`;
    return `<span class="badge ok">OK</span>`;
  }

  _diasFmt(dias) {
    if (dias < 0) return `<span style="color:var(--danger); font-weight:600;">${Math.abs(dias)}d atrás</span>`;
    if (dias === 0) return `<span style="color:var(--warning); font-weight:600;">Hoje</span>`;
    if (dias <= 7) return `<span style="color:var(--warning); font-weight:600;">${dias}d</span>`;
    return `<span style="color:var(--text-muted);">${dias}d</span>`;
  }
}

export default VencimentosModule;
