// Feedback & Clima Module
// Manages individual feedback, climate surveys, and survey responses

const CLIMA_DIMS = ['lideranca', 'ambiente', 'reconhecimento', 'carreira', 'comunicacao', 'remuneracao'];
const CLIMA_DIM_LABEL = {
  lideranca:      'Liderança',
  ambiente:       'Ambiente',
  reconhecimento: 'Reconhecimento',
  carreira:       'Carreira',
  comunicacao:    'Comunicação',
  remuneracao:    'Remuneração',
};

export class FeedbackClimaModule {
  constructor(deps) {
    this.$                = deps.$;
    this.h                = deps.h;
    this.iniciais         = deps.iniciais;
    this.fmtDate          = deps.fmtDate;
    this.COLABORADORES    = deps.COLABORADORES;
    this.FEEDBACK         = deps.FEEDBACK;
    this.CLIMA            = deps.CLIMA;
    this.CHART_COLORS     = deps.CHART_COLORS;
    this.Auth             = deps.Auth;
    this.FeedbackClima    = deps.FeedbackClima;
    this.RespostasPesquisa = deps.RespostasPesquisa;
    this.showToast        = deps.showToast;

    this._chartClEvo  = null;
    this._chartClDims = null;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'fb-search') this.renderFeedback();
    });
    document.addEventListener('change', (e) => {
      if (e.target.id === 'fb-filter-setor') this.renderFeedback();
    });
    document.querySelectorAll('.nav-item[data-page="feedback-clima"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => {
        this.renderFeedback();
        this.renderClima();
      }, 60));
    });
  }

  _notaGeral(f) {
    return (f.nota_entrega + f.nota_comportamento + f.nota_colaboracao) / 3;
  }

  _scoreGeral(p) {
    const vals = CLIMA_DIMS.map(d => p['score_' + d]);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  _pctParticipacao(p) {
    return p.convidados ? (p.responderam / p.convidados) * 100 : 0;
  }

  renderFeedback() {
    const tb = this.$('#tb-feedback');
    if (!tb) return;

    const q    = (this.$('#fb-search')?.value || '').trim().toLowerCase();
    const fSet = this.$('#fb-filter-setor')?.value || '';

    const enriched = this.FEEDBACK.map(f => {
      const c = this.COLABORADORES.find(x => x.id === f.colaborador_id);
      return { ...f, _colab: c, _geral: this._notaGeral(f) };
    });

    const lista = enriched.filter(f => {
      if (fSet && f._colab?.setor !== fSet) return false;
      if (q) {
        const hay = [f._colab?.nome, f.avaliador].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data));

    tb.innerHTML = lista.length ? lista.map(f => {
      const c = f._colab;
      const dot = (n) => `<span class="rating" title="${n}/5">${[1, 2, 3, 4, 5].map(i =>
        `<span class="dot ${i <= n ? 'on-' + n : ''}"></span>`).join('')}</span>`;
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
              </div>` : `<span style="color:var(--text-soft)">—</span>`}
          </td>
          <td>${this.h(f.avaliador)}</td>
          <td class="cell-mono">${this.fmtDate(f.data)}</td>
          <td>${dot(f.nota_entrega)}</td>
          <td>${dot(f.nota_comportamento)}</td>
          <td>${dot(f.nota_colaboracao)}</td>
          <td class="cell-mono" style="text-align:right; font-weight:700; color:var(--phthalo-dark)">${f._geral.toFixed(1).replace('.', ',')}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalFeedback(${f.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirFeedback(${f.id})">🗑</button>
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="8" class="empty">Nenhum feedback encontrado</td></tr>`;

    const now           = new Date();
    const mesChaveAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.$('#fb-stat-mes').textContent   = this.FEEDBACK.filter(f => f.data.startsWith(mesChaveAtual)).length;
    const media = this.FEEDBACK.length
      ? this.FEEDBACK.reduce((s, f) => s + this._notaGeral(f), 0) / this.FEEDBACK.length : 0;
    this.$('#fb-stat-nota').textContent  = media ? media.toFixed(1).replace('.', ',') + '/5' : '—';

    const limite = new Date();
    limite.setMonth(limite.getMonth() - 6);
    const limiteIso = limite.toISOString().slice(0, 10);
    const ativos = this.COLABORADORES.filter(c => c.status !== 'inativo');
    let semFb = 0;
    ativos.forEach(c => {
      const ult = this.FEEDBACK.filter(f => f.colaborador_id === c.id)
        .sort((a, b) => b.data.localeCompare(a.data))[0];
      if (!ult || ult.data < limiteIso) semFb++;
    });
    this.$('#fb-stat-sem').textContent   = semFb;
    this.$('#fb-stat-total').textContent = this.FEEDBACK.length;
  }

  abrirModalFeedback(id = null) {
    const form = this.$('#form-feedback');
    form.reset();
    document.querySelectorAll('#form-feedback .rating-input').forEach(g => {
      g.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    });
    this.$('#form-fb-colab').innerHTML = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => `<option value="${c.id}">${this.h(c.nome)} — ${this.h(c.setor)}</option>`).join('');

    if (id != null) {
      const f = this.FEEDBACK.find(x => x.id === id);
      if (f) {
        this.$('#fb-modal-title').textContent = 'Editar feedback';
        for (const [k, v] of Object.entries(f)) {
          const fld = form.elements[k];
          if (fld) fld.value = v ?? '';
        }
        if (typeof setRating === 'function') {
          setRating('nota_entrega',       f.nota_entrega);
          setRating('nota_comportamento', f.nota_comportamento);
          setRating('nota_colaboracao',   f.nota_colaboracao);
        }
      }
    } else {
      this.$('#fb-modal-title').textContent = 'Registrar feedback';
      form.elements['data'].value = new Date().toISOString().slice(0, 10);
    }
    this.$('#modal-feedback').classList.add('active');
  }

  fecharModalFeedback() {
    this.$('#modal-feedback').classList.remove('active');
  }

  async salvarFeedback(ev) {
    ev.preventDefault();
    const form = this.$('#form-feedback');
    const data = Object.fromEntries(new FormData(form));
    const id   = data.id ? parseInt(data.id, 10) : null;

    const payload = {
      colaborador_id:     parseInt(data.colaborador_id, 10),
      avaliador:          data.avaliador,
      data:               data.data,
      nota_entrega:       parseInt(data.nota_entrega, 10)       || 0,
      nota_comportamento: parseInt(data.nota_comportamento, 10) || 0,
      nota_colaboracao:   parseInt(data.nota_colaboracao, 10)   || 0,
      pontos_fortes:      data.pontos_fortes || '',
      pontos_desenvolver: data.pontos_desenvolver || '',
      plano_acao:         data.plano_acao || '',
    };

    if (!payload.nota_entrega || !payload.nota_comportamento || !payload.nota_colaboracao) {
      this.showToast('Preencha as 3 notas', 'err');
      return;
    }

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        if (id != null) {
          const saved = await this.FeedbackClima.atualizarFeedback(id, payload);
          const i = this.FEEDBACK.findIndex(x => x.id === id);
          if (i >= 0) this.FEEDBACK[i] = saved;
        } else {
          const saved = await this.FeedbackClima.criarFeedback(payload);
          this.FEEDBACK.unshift(saved);
        }
      } catch (err) { this.showToast('Erro ao salvar: ' + err.message, 'err'); return; }
    } else {
      if (id != null) {
        const i = this.FEEDBACK.findIndex(x => x.id === id);
        if (i >= 0) this.FEEDBACK[i] = { ...this.FEEDBACK[i], ...payload };
      } else {
        const nextId = Math.max(0, ...this.FEEDBACK.map(x => x.id)) + 1;
        this.FEEDBACK.unshift({ id: nextId, ...payload });
      }
    }
    this.showToast(id != null ? 'Feedback atualizado' : 'Feedback registrado', 'ok');
    this.fecharModalFeedback();
    this.renderFeedback();
  }

  async excluirFeedback(id) {
    if (!confirm('Excluir este feedback?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try { await this.FeedbackClima.excluirFeedback(id); } catch (err) { this.showToast('Erro: ' + err.message, 'err'); return; }
    }
    const idx = this.FEEDBACK.findIndex(x => x.id === id);
    if (idx >= 0) this.FEEDBACK.splice(idx, 1);
    this.renderFeedback();
    this.showToast('Feedback excluído');
  }

  renderClima() {
    const tb = this.$('#tb-clima');
    if (!tb) return;

    const ordenadas = [...this.CLIMA].sort((a, b) => a.inicio.localeCompare(b.inicio));
    const ultima    = ordenadas[ordenadas.length - 1];

    tb.innerHTML = [...this.CLIMA].sort((a, b) => b.inicio.localeCompare(a.inicio)).map(p => {
      const part = this._pctParticipacao(p);
      const sc   = this._scoreGeral(p);
      const partBadge = part >= 80 ? `<span class="badge ok">${part.toFixed(0)}%</span>`
                      : part >= 60 ? `<span class="badge warn">${part.toFixed(0)}%</span>`
                                   : `<span class="badge danger">${part.toFixed(0)}%</span>`;
      return `
        <tr>
          <td style="font-weight:600">${this.h(p.titulo)}</td>
          <td class="cell-mono">${this.fmtDate(p.inicio)} → ${this.fmtDate(p.fim)}</td>
          <td class="cell-mono" style="text-align:right">${p.convidados}</td>
          <td class="cell-mono" style="text-align:right">${p.responderam}</td>
          <td>${partBadge}</td>
          <td class="cell-mono" style="text-align:right; font-weight:700; color:var(--phthalo-dark)">${sc.toFixed(2).replace('.', ',')}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm btn-icon" title="Ver respostas" onclick="abrirModalRespostasPesquisa(${p.id})">☰</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalClima(${p.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirClima(${p.id})">🗑</button>
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="7" class="empty">Nenhuma pesquisa cadastrada</td></tr>`;

    if (ultima) {
      this.$('#cl-stat-ultima').textContent = `${ultima.titulo} · ${this.fmtDate(ultima.fim)}`;
      this.$('#cl-stat-part').textContent   = this._pctParticipacao(ultima).toFixed(0) + '%';
      this.$('#cl-stat-score').textContent  = this._scoreGeral(ultima).toFixed(2).replace('.', ',');
      let worst = null;
      CLIMA_DIMS.forEach(d => {
        const v = ultima['score_' + d];
        if (!worst || v < worst.v) worst = { d, v };
      });
      this.$('#cl-stat-fraca').textContent = worst
        ? `${CLIMA_DIM_LABEL[worst.d]} · ${worst.v.toFixed(1).replace('.', ',')}`
        : '—';
    } else {
      this.$('#cl-stat-ultima').textContent = '—';
      this.$('#cl-stat-part').textContent   = '—';
      this.$('#cl-stat-score').textContent  = '—';
      this.$('#cl-stat-fraca').textContent  = '—';
    }

    this._chartClEvo?.destroy();
    this._chartClEvo = new Chart(this.$('#chart-cl-evolucao'), {
      type: 'line',
      data: {
        labels: ordenadas.map(p => p.titulo),
        datasets: [{
          label: 'Score geral',
          data: ordenadas.map(p => this._scoreGeral(p)),
          borderColor: this.CHART_COLORS.phthalo,
          backgroundColor: 'rgba(46,122,184,.12)',
          borderWidth: 2.5,
          tension: .35,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: this.CHART_COLORS.phthaloBright,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 10, grid: { color: this.CHART_COLORS.grid } },
          x: { grid: { display: false } },
        },
      },
    });

    this._chartClDims?.destroy();
    if (ultima) {
      this._chartClDims = new Chart(this.$('#chart-cl-dimensoes'), {
        type: 'bar',
        data: {
          labels: CLIMA_DIMS.map(d => CLIMA_DIM_LABEL[d]),
          datasets: [{
            label: 'Score',
            data: CLIMA_DIMS.map(d => ultima['score_' + d]),
            backgroundColor: CLIMA_DIMS.map(d => {
              const v = ultima['score_' + d];
              return v >= 7.5 ? '#10B981' : v >= 6.0 ? '#F59E0B' : '#EF4444';
            }),
            borderRadius: 4,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { min: 0, max: 10, grid: { color: this.CHART_COLORS.grid } },
            y: { grid: { display: false } },
          },
        },
      });
    }
  }

  abrirModalClima(id = null) {
    const form = this.$('#form-clima');
    form.reset();
    if (id != null) {
      const p = this.CLIMA.find(x => x.id === id);
      if (p) {
        this.$('#cl-modal-title').textContent = 'Editar pesquisa';
        for (const [k, v] of Object.entries(p)) {
          const f = form.elements[k];
          if (f) f.value = v ?? '';
        }
      }
    } else {
      this.$('#cl-modal-title').textContent = 'Nova pesquisa de clima';
    }
    this.$('#modal-clima').classList.add('active');
  }

  fecharModalClima() {
    this.$('#modal-clima').classList.remove('active');
  }

  async salvarClima(ev) {
    ev.preventDefault();
    const form = this.$('#form-clima');
    const data = Object.fromEntries(new FormData(form));
    const id   = data.id ? parseInt(data.id, 10) : null;

    const payload = {
      titulo:               data.titulo,
      inicio:               data.inicio,
      fim:                  data.fim,
      convidados:           parseInt(data.convidados, 10)  || 0,
      responderam:          parseInt(data.responderam, 10) || 0,
      score_lideranca:      parseFloat(data.score_lideranca)      || 0,
      score_ambiente:       parseFloat(data.score_ambiente)       || 0,
      score_reconhecimento: parseFloat(data.score_reconhecimento) || 0,
      score_carreira:       parseFloat(data.score_carreira)       || 0,
      score_comunicacao:    parseFloat(data.score_comunicacao)    || 0,
      score_remuneracao:    parseFloat(data.score_remuneracao)    || 0,
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        if (id != null) {
          const saved = await this.FeedbackClima.atualizarPesquisa(id, payload);
          const i = this.CLIMA.findIndex(x => x.id === id);
          if (i >= 0) this.CLIMA[i] = saved;
        } else {
          const saved = await this.FeedbackClima.criarPesquisa(payload);
          this.CLIMA.unshift(saved);
        }
      } catch (err) { this.showToast('Erro ao salvar: ' + err.message, 'err'); return; }
    } else {
      if (id != null) {
        const i = this.CLIMA.findIndex(x => x.id === id);
        if (i >= 0) this.CLIMA[i] = { ...this.CLIMA[i], ...payload };
      } else {
        const nextId = Math.max(0, ...this.CLIMA.map(x => x.id)) + 1;
        this.CLIMA.unshift({ id: nextId, ...payload });
      }
    }
    this.showToast(id != null ? 'Pesquisa atualizada' : 'Pesquisa cadastrada', 'ok');
    this.fecharModalClima();
    this.renderClima();
  }

  async excluirClima(id) {
    if (!confirm('Excluir esta pesquisa?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try { await this.FeedbackClima.excluirPesquisa(id); } catch (err) { this.showToast('Erro: ' + err.message, 'err'); return; }
    }
    const idx = this.CLIMA.findIndex(x => x.id === id);
    if (idx >= 0) this.CLIMA.splice(idx, 1);
    this.renderClima();
    this.showToast('Pesquisa excluída');
  }

  async abrirModalRespostasPesquisa(pesquisaId) {
    const modal = this.$('#modal-respostas-pesquisa');
    if (!modal) return;
    const pesquisa = this.CLIMA.find(x => x.id === pesquisaId);
    this.$('#modal-resp-title').textContent = pesquisa?.titulo || 'Respostas da pesquisa';
    this.$('#modal-resp-body').innerHTML = `<p class="empty">Carregando...</p>`;
    modal.classList.add('active');

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (!temSessao) {
      this.$('#modal-resp-body').innerHTML = `<p class="empty">Disponível apenas com sessão ativa</p>`;
      return;
    }
    try {
      const respostas = await this.RespostasPesquisa.listarPorPesquisa(pesquisaId);
      if (!respostas.length) {
        this.$('#modal-resp-body').innerHTML = `<p class="empty">Nenhuma resposta registrada</p>`;
        return;
      }
      const por_colaborador = {};
      respostas.forEach(r => {
        const nome = r.colaboradores?.nome || `#${r.colaborador_id}`;
        if (!por_colaborador[nome]) por_colaborador[nome] = [];
        por_colaborador[nome].push(r);
      });
      this.$('#modal-resp-body').innerHTML = Object.entries(por_colaborador).map(([nome, regs]) => `
        <div style="margin-bottom:16px">
          <div style="font-weight:600;margin-bottom:6px">${this.h(nome)}</div>
          <table class="data" style="margin:0">
            <thead><tr><th>Pergunta</th><th>Resposta</th><th style="text-align:right">Rating</th></tr></thead>
            <tbody>
              ${regs.map(r => `<tr><td>${this.h(r.pergunta || '—')}</td><td>${this.h(r.resposta || '—')}</td><td class="cell-mono" style="text-align:right">${r.rating ?? '—'}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      `).join('');
    } catch (err) {
      this.$('#modal-resp-body').innerHTML = `<p class="empty" style="color:var(--danger)">Erro: ${this.h(err.message)}</p>`;
    }
  }

  fecharModalRespostasPesquisa() {
    this.$('#modal-respostas-pesquisa')?.classList.remove('active');
  }
}

export default FeedbackClimaModule;
