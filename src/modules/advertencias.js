// Advertencias Module
// Gerencia advertências disciplinares com gráficos e análise de reincidência

export class AdvertenciasModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate = deps.fmtDate;
    this.ADVERTENCIAS = deps.ADVERTENCIAS;
    this.COLABORADORES = deps.COLABORADORES;
    this.ADV_TIPO_BADGE = deps.ADV_TIPO_BADGE;
    this.ADV_STATUS_BADGE = deps.ADV_STATUS_BADGE;
    this.CHART_COLORS = deps.CHART_COLORS;
    this.Auth = deps.Auth;
    this.Advertencias = deps.Advertencias;

    this.ADV_COLOR = {
      verbal:    '#F59E0B',
      escrita:   '#F97316',
      suspensao: '#DC2626',
    };

    this.state = {
      drawerAdvId: null,
    };

    this._chartAdvTipo = null;
    this._chartAdvEvo  = null;
    this._chartAdvTop  = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'adv-search') this.render();
    });

    document.addEventListener('change', (e) => {
      if (['adv-filter-tipo', 'adv-filter-categoria', 'adv-filter-status'].includes(e.target.id)) this.render();
    });

    document.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-dtab-adv]');
      if (!tab) return;
      const name = tab.dataset.dtabAdv;
      tab.parentElement.querySelectorAll('[data-dtab-adv]').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('[data-dsec-adv]').forEach(s => s.classList.toggle('active', s.dataset.dsecAdv === name));
    });

    document.querySelectorAll('.nav-item[data-page="advertencias"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  render() {
    const tb = this.$('#tb-advertencias');
    if (!tb) return;

    const q  = (this.$('#adv-search')?.value || '').trim().toLowerCase();
    const fT = this.$('#adv-filter-tipo')?.value      || '';
    const fC = this.$('#adv-filter-categoria')?.value || '';
    const fS = this.$('#adv-filter-status')?.value    || '';

    const colabMap = new Map(this.COLABORADORES.map(c => [c.id, c]));
    const enriched = this.ADVERTENCIAS.map(a => {
      return { ...a, _colab: colabMap.get(a.colaborador_id), _reinc: this._contarAdvertenciasUltimoAno(a.colaborador_id) };
    });

    const lista = enriched.filter(a => {
      if (fT && a.tipo !== fT) return false;
      if (fC && a.categoria !== fC) return false;
      if (fS && a.status !== fS) return false;
      if (q) {
        const hay = [a._colab?.nome, a.gestor, a.categoria, a.descricao].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data));

    tb.innerHTML = lista.length
      ? this._renderLinhas(lista)
      : `<tr><td colspan="8" class="empty">Nenhuma advertência encontrada</td></tr>`;

    this._updateStats();
    this._renderCharts();
  }

  _renderLinhas(lista) {
    return lista.map(a => {
      const c = a._colab;
      const tipoBadge = this.ADV_TIPO_BADGE[a.tipo] || { cls: 'neutral', t: a.tipo };
      const reincBadge = a._reinc >= 3
        ? `<span class="badge danger" title="Risco de justa causa">${a._reinc}/ano ⚠</span>`
        : a._reinc === 2
          ? `<span class="badge warn">${a._reinc}/ano</span>`
          : `<span class="badge neutral">${a._reinc}/ano</span>`;
      return `
        <tr onclick="abrirDrawerAdv(${a.id})">
          <td>
            ${c ? `
              <div class="cell-person">
                <div class="cell-avatar" style="background:linear-gradient(135deg,#B45309,#92400E);">${this.h(this.iniciais(c.nome))}</div>
                <div>
                  <div class="cell-person-name">${this.h(c.nome)}</div>
                  <div class="cell-person-sub">${this.h(c.setor)}</div>
                </div>
              </div>` : `<span style="color:var(--text-soft)">—</span>`}
          </td>
          <td class="cell-mono">${this.fmtDate(a.data)}</td>
          <td><span class="badge ${tipoBadge.cls}">${tipoBadge.t}${a.tipo === 'suspensao' && a.dias_suspensao ? ` ${a.dias_suspensao}d` : ''}</span></td>
          <td>${this.h(a.categoria)}</td>
          <td>${this.h(a.gestor)}</td>
          <td>${this.ADV_STATUS_BADGE[a.status] || '—'}</td>
          <td>${reincBadge}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalAdvertencia(${a.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirAdvertencia(${a.id})">🗑</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  _updateStats() {
    const now = new Date();
    const mesChaveAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    this.$('#adv-stat-mes').textContent = this.ADVERTENCIAS.filter(a => a.data.startsWith(mesChaveAtual)).length;

    const contPorColab = {};
    this.ADVERTENCIAS.forEach(a => {
      if (!contPorColab[a.colaborador_id]) contPorColab[a.colaborador_id] = 0;
      contPorColab[a.colaborador_id] = this._contarAdvertenciasUltimoAno(a.colaborador_id);
    });
    this.$('#adv-stat-reinc').textContent = Object.values(contPorColab).filter(n => n >= 3).length;
    this.$('#adv-stat-pend').textContent  = this.ADVERTENCIAS.filter(a => a.status === 'pendente').length;
    this.$('#adv-stat-susp').textContent  = this.ADVERTENCIAS.filter(a => a.tipo === 'suspensao' && a.data.startsWith(mesChaveAtual)).length;
  }

  _renderCharts() {
    const porTipo = { verbal: 0, escrita: 0, suspensao: 0 };
    this.ADVERTENCIAS.forEach(a => { if (porTipo[a.tipo] != null) porTipo[a.tipo]++; });
    const totalTipo = porTipo.verbal + porTipo.escrita + porTipo.suspensao;

    const badgeEl = this.$('#adv-chart-tipo-badge');
    if (badgeEl) badgeEl.textContent = `${totalTipo} total`;

    this._chartAdvTipo?.destroy();
    const ctxTipo = this.$('#chart-adv-tipo');
    if (ctxTipo && typeof Chart !== 'undefined') {
      this._chartAdvTipo = new Chart(ctxTipo, {
        type: 'doughnut',
        data: {
          labels: ['Verbal', 'Escrita', 'Suspensão'],
          datasets: [{
            data: [porTipo.verbal, porTipo.escrita, porTipo.suspensao],
            backgroundColor: [this.ADV_COLOR.verbal, this.ADV_COLOR.escrita, this.ADV_COLOR.suspensao],
            borderColor: '#fff',
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { padding: 10, boxWidth: 12, font: { size: 11 } } },
          },
        },
      });
    }

    const hoje = new Date();
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      meses.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][d.getMonth()],
        verbal: 0, escrita: 0, suspensao: 0,
      });
    }
    this.ADVERTENCIAS.forEach(a => {
      const mChave = a.data.slice(0, 7);
      const m = meses.find(x => x.key === mChave);
      if (m && m[a.tipo] != null) m[a.tipo]++;
    });

    this._chartAdvEvo?.destroy();
    const ctxEvo = this.$('#chart-adv-evolucao');
    if (ctxEvo && typeof Chart !== 'undefined') {
      this._chartAdvEvo = new Chart(ctxEvo, {
        type: 'bar',
        data: {
          labels: meses.map(m => m.label),
          datasets: [
            { label: 'Verbal',    data: meses.map(m => m.verbal),    backgroundColor: this.ADV_COLOR.verbal,    stack: 's', borderRadius: 3 },
            { label: 'Escrita',   data: meses.map(m => m.escrita),   backgroundColor: this.ADV_COLOR.escrita,   stack: 's', borderRadius: 3 },
            { label: 'Suspensão', data: meses.map(m => m.suspensao), backgroundColor: this.ADV_COLOR.suspensao, stack: 's', borderRadius: 3 },
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

    const limite = new Date();
    limite.setFullYear(limite.getFullYear() - 1);
    const limiteIso = limite.toISOString().slice(0, 10);

    const counts = {};
    this.ADVERTENCIAS.forEach(a => {
      if (a.data < limiteIso) return;
      if (!counts[a.colaborador_id]) counts[a.colaborador_id] = { verbal: 0, escrita: 0, suspensao: 0, total: 0 };
      counts[a.colaborador_id][a.tipo]++;
      counts[a.colaborador_id].total++;
    });

    const top = Object.entries(counts)
      .filter(([, c]) => c.total >= 2)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 8);

    this._chartAdvTop?.destroy();
    const ctxTop = this.$('#chart-adv-top');
    if (ctxTop && typeof Chart !== 'undefined') {
      if (top.length === 0) {
        const parent = ctxTop.parentElement;
        parent.innerHTML = `<div class="empty">Nenhum colaborador com 2+ advertências nos últimos 12 meses 🎉</div>`;
      } else {
        const labels = top.map(([id]) => {
          const c = this.COLABORADORES.find(x => x.id === parseInt(id, 10));
          return c ? c.nome : '—';
        });
        this._chartAdvTop = new Chart(ctxTop, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Verbal',    data: top.map(([, c]) => c.verbal),    backgroundColor: this.ADV_COLOR.verbal,    stack: 's', borderRadius: 3 },
              { label: 'Escrita',   data: top.map(([, c]) => c.escrita),   backgroundColor: this.ADV_COLOR.escrita,   stack: 's', borderRadius: 3 },
              { label: 'Suspensão', data: top.map(([, c]) => c.suspensao), backgroundColor: this.ADV_COLOR.suspensao, stack: 's', borderRadius: 3 },
            ],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } } },
            scales: {
              x: { stacked: true, beginAtZero: true, grid: { color: this.CHART_COLORS.grid }, ticks: { stepSize: 1 } },
              y: { stacked: true, grid: { display: false } },
            },
          },
        });
      }
    }
  }

  _contarAdvertenciasUltimoAno(colabId) {
    const limite = new Date();
    limite.setFullYear(limite.getFullYear() - 1);
    const iso = limite.toISOString().slice(0, 10);
    return this.ADVERTENCIAS.filter(a => a.colaborador_id === colabId && a.data >= iso).length;
  }

  abrirDrawer(id) {
    const a = this.ADVERTENCIAS.find(x => x.id === id);
    if (!a) return;
    this.state.drawerAdvId = id;

    const c = this.COLABORADORES.find(x => x.id === a.colaborador_id);

    this.$('#dadv-avatar').textContent = c ? this.iniciais(c.nome) : '—';
    this.$('#dadv-name').textContent   = c?.nome || 'Colaborador removido';
    this.$('#dadv-role').textContent   = c ? `${c.setor}${c.area ? ` · ${c.area}` : ''}` : '—';

    const reinc = this._contarAdvertenciasUltimoAno(a.colaborador_id);
    this.$('#dadv-alerta').innerHTML = reinc >= 3
      ? `<div class="sensitive-banner" style="background:linear-gradient(135deg,#FEE2E2,#FEF2F2); border-color:#FCA5A5; border-left-color:#DC2626;">
           <div class="sb-icon" style="background:#DC2626;">!</div>
           <div>
             <div class="sb-title" style="color:#991B1B;">Risco de justa causa</div>
             <div class="sb-sub" style="color:#7F1D1D;">${reinc} advertências nos últimos 12 meses. Considerar análise jurídica antes de novas medidas.</div>
           </div>
         </div>`
      : '';

    const tipoBadge = this.ADV_TIPO_BADGE[a.tipo] || { cls: 'neutral', t: a.tipo };

    this.$('#dadv-detalhes').innerHTML = `
      <div class="info-item"><div class="info-label">Data</div><div class="info-value mono">${this.fmtDate(a.data)}</div></div>
      <div class="info-item"><div class="info-label">Tipo</div><div class="info-value"><span class="badge ${tipoBadge.cls}">${tipoBadge.t}${a.tipo === 'suspensao' && a.dias_suspensao ? ` ${a.dias_suspensao}d` : ''}</span></div></div>
      <div class="info-item"><div class="info-label">Categoria</div><div class="info-value">${this.h(a.categoria)}</div></div>
      <div class="info-item"><div class="info-label">Status</div><div class="info-value">${this.ADV_STATUS_BADGE[a.status] || '—'}</div></div>
      <div class="info-item"><div class="info-label">Gestor</div><div class="info-value">${this.h(a.gestor)}</div></div>
      <div class="info-item"><div class="info-label">Testemunhas</div><div class="info-value">${this.h(a.testemunhas || '—')}</div></div>
      ${a.assinada_em ? `<div class="info-item"><div class="info-label">Assinada em</div><div class="info-value mono">${this.fmtDate(a.assinada_em)}</div></div>` : ''}
      <div class="info-sep"></div>
      <div class="info-item" style="grid-column:1/-1"><div class="info-label">Descrição</div><div class="info-value" style="white-space:pre-wrap">${this.h(a.descricao)}</div></div>
    `;

    const hist = this.ADVERTENCIAS
      .filter(x => x.colaborador_id === a.colaborador_id && x.id !== a.id)
      .sort((x, y) => y.data.localeCompare(x.data));

    this.$('#dadv-historico').innerHTML = hist.length ? `
      <div style="font-family:var(--mono); font-size:.72rem; color:var(--text-muted); margin-bottom:12px; letter-spacing:.06em;">
        ${hist.length} advertência${hist.length > 1 ? 's' : ''} anterior${hist.length > 1 ? 'es' : ''} deste colaborador:
      </div>
      <ul class="activity-feed">
        ${hist.map(x => {
          const tb = this.ADV_TIPO_BADGE[x.tipo] || {};
          return `
            <li class="activity-item" style="cursor:pointer" onclick="abrirDrawerAdv(${x.id})">
              <span class="badge ${tb.cls || 'neutral'}" style="min-width:80px; text-align:center;">${tb.t || x.tipo}</span>
              <span class="activity-text"><strong>${this.h(x.categoria)}</strong> — ${this.h(x.descricao.slice(0, 80))}${x.descricao.length > 80 ? '…' : ''}</span>
              <span class="activity-time">${this.fmtDate(x.data)}</span>
            </li>
          `;
        }).join('')}
      </ul>
    ` : `<div class="empty">Sem outras advertências registradas</div>`;

    const btn = this.$('#btn-dadv-assinar');
    if (a.status === 'assinada') {
      btn.textContent = 'Já assinada';
      btn.disabled = true;
      btn.style.opacity = '.55';
    } else {
      btn.textContent = 'Marcar como assinada';
      btn.disabled = false;
      btn.style.opacity = '';
    }

    document.querySelectorAll('[data-dtab-adv]').forEach(t => t.classList.toggle('active', t.dataset.dtabAdv === 'detalhes'));
    document.querySelectorAll('[data-dsec-adv]').forEach(s => s.classList.toggle('active', s.dataset.dsecAdv === 'detalhes'));

    this.$('#drawer-backdrop-adv').classList.add('active');
    this.$('#drawer-adv').classList.add('active');
  }

  fecharDrawer() {
    this.$('#drawer-backdrop-adv').classList.remove('active');
    this.$('#drawer-adv').classList.remove('active');
    this.state.drawerAdvId = null;
  }

  marcarAssinada() {
    if (this.state.drawerAdvId == null) return;
    const a = this.ADVERTENCIAS.find(x => x.id === this.state.drawerAdvId);
    if (!a) return;
    a.status = 'assinada';
    a.assinada_em = new Date().toISOString().slice(0, 10);
    this.render();
    this.abrirDrawer(this.state.drawerAdvId);
  }

  mostrarAlertaReincidencia() {
    const form = this.$('#form-advertencia');
    const colabId = parseInt(form.elements['colaborador_id'].value, 10);
    if (!colabId) { this.$('#adv-form-alert').innerHTML = ''; return; }
    const n = this._contarAdvertenciasUltimoAno(colabId);
    if (n >= 3) {
      this.$('#adv-form-alert').innerHTML = `
        <div class="sensitive-banner" style="background:linear-gradient(135deg,#FEE2E2,#FEF2F2); border-color:#FCA5A5; border-left-color:#DC2626;">
          <div class="sb-icon" style="background:#DC2626;">!</div>
          <div>
            <div class="sb-title" style="color:#991B1B;">Risco de justa causa</div>
            <div class="sb-sub" style="color:#7F1D1D;">Este colaborador já possui ${n} advertências nos últimos 12 meses.</div>
          </div>
        </div>
      `;
    } else if (n === 2) {
      this.$('#adv-form-alert').innerHTML = `
        <div class="sensitive-banner">
          <div class="sb-icon">!</div>
          <div>
            <div class="sb-title">Atenção</div>
            <div class="sb-sub">Este colaborador já possui 2 advertências nos últimos 12 meses. Esta seria a 3ª.</div>
          </div>
        </div>
      `;
    } else {
      this.$('#adv-form-alert').innerHTML = '';
    }
  }

  abrirModal(id = null) {
    const form = this.$('#form-advertencia');
    form.reset();
    this.$('#adv-form-alert').innerHTML = '';
    this.$('#adv-suspensao-dias').style.display = 'none';

    this.$('#form-adv-colab').innerHTML = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => `<option value="${c.id}">${this.h(c.nome)} — ${this.h(c.setor)}</option>`)
      .join('');

    if (id != null) {
      const a = this.ADVERTENCIAS.find(x => x.id === id);
      if (a) {
        this.$('#adv-modal-title').textContent = 'Editar advertência';
        for (const [k, v] of Object.entries(a)) {
          const f = form.elements[k];
          if (f) f.value = v ?? '';
        }
        if (a.tipo === 'suspensao') this.$('#adv-suspensao-dias').style.display = '';
        this.mostrarAlertaReincidencia();
      }
    } else {
      this.$('#adv-modal-title').textContent = 'Nova advertência';
      form.elements['data'].value = new Date().toISOString().slice(0, 10);
      form.elements['status'].value = 'pendente';
    }

    form.elements['tipo'].addEventListener('change', () => {
      this.$('#adv-suspensao-dias').style.display = form.elements['tipo'].value === 'suspensao' ? '' : 'none';
    }, { once: false });

    this.$('#modal-advertencia').classList.add('active');
  }

  fecharModal() {
    this.$('#modal-advertencia').classList.remove('active');
  }

  async salvar(ev) {
    ev.preventDefault();
    const form = this.$('#form-advertencia');
    const data = Object.fromEntries(new FormData(form));
    const id = data.id ? parseInt(data.id, 10) : null;

    if (!data.colaborador_id) {
      window.showToast?.('Selecione um colaborador', 'err'); return;
    }
    if (!data.data || !/^\d{4}-\d{2}-\d{2}$/.test(data.data)) {
      window.showToast?.('Data obrigatória', 'err'); return;
    }
    if (!['verbal', 'escrita', 'suspensao'].includes(data.tipo)) {
      window.showToast?.('Tipo de advertência inválido', 'err'); return;
    }
    if (!data.descricao?.trim()) {
      window.showToast?.('Descrição obrigatória', 'err'); return;
    }
    if (!data.gestor?.trim()) {
      window.showToast?.('Gestor responsável obrigatório', 'err'); return;
    }

    const payload = {
      colaborador_id: parseInt(data.colaborador_id, 10),
      data_advertencia: data.data,
      tipo:             data.tipo,
      motivo:           data.descricao,
      descricao:        data.descricao,
      gestor:           data.gestor,
      testemunhas:      data.testemunhas || '',
      resposta_colaborador: data.status === 'respondida' ? data.descricao : null,
      dias_suspensao:   data.tipo === 'suspensao' ? parseInt(data.dias_suspensao, 10) || 1 : null,
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        if (id != null) {
          await this.Advertencias.atualizar(id, payload);
        } else {
          await this.Advertencias.criar(payload);
        }
      } catch (err) {
        window.showToast?.('Erro ao salvar: ' + err.message, 'err');
        return;
      }
    } else {
      if (id != null) {
        const i = this.ADVERTENCIAS.findIndex(x => x.id === id);
        if (i >= 0) this.ADVERTENCIAS[i] = { ...this.ADVERTENCIAS[i], ...payload };
      } else {
        const newId = Math.max(0, ...this.ADVERTENCIAS.map(x => x.id)) + 1;
        this.ADVERTENCIAS.unshift({ id: newId, ...payload });
      }
    }
    this.fecharModal();
    await this.render();
  }

  async excluir(id) {
    if (!confirm('Excluir esta advertência?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Advertencias.excluir(id);
      } catch (err) {
        window.showToast?.('Erro ao excluir: ' + err.message, 'err');
        return;
      }
    } else {
      this.ADVERTENCIAS = this.ADVERTENCIAS.filter(x => x.id !== id);
    }
    await this.render();
  }
}

export default AdvertenciasModule;
