// Desligamentos Module
// Gerencia renderização, drawer e modais de desligamentos + entrevista de saída

export class DesligamentosModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate = deps.fmtDate;
    this.DESLIGAMENTOS = deps.DESLIGAMENTOS;
    this.COLABORADORES = deps.COLABORADORES;

    this.state = {
      drawerDeslId: null,
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'desl-search') this.render();
    });

    document.addEventListener('change', (e) => {
      if (['desl-filter-motivo', 'desl-filter-entrevista'].includes(e.target.id)) this.render();
    });

    document.querySelectorAll('.nav-item[data-page="desligamentos"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });

    document.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-dtab-desl]');
      if (!tab) return;
      const name = tab.dataset.dtabDesl;
      tab.parentElement.querySelectorAll('[data-dtab-desl]').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('[data-dsec-desl]').forEach(s => s.classList.toggle('active', s.dataset.dsecDesl === name));
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.rating-input button');
      if (!btn) return;
      const field = btn.parentElement.dataset.ratingField;
      const val = parseInt(btn.dataset.ratingVal, 10);
      this._setRating(field, val);
    });
  }

  render() {
    const tb = this.$('#tb-desligamentos');
    if (!tb) return;

    const q = (this.$('#desl-search')?.value || '').trim().toLowerCase();
    const fMot = this.$('#desl-filter-motivo')?.value || '';
    const fEnt = this.$('#desl-filter-entrevista')?.value || '';

    const lista = this.DESLIGAMENTOS.filter(d => {
      if (fMot && d.motivo !== fMot) return false;
      if (fEnt === 'realizada' && !d.entrevista?.realizada) return false;
      if (fEnt === 'pendente' && d.entrevista?.realizada) return false;
      if (q) {
        const hay = [d.nome, d.cargo].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data));

    tb.innerHTML = lista.length
      ? this._renderLinhas(lista)
      : `<tr><td colspan="7" class="empty">Nenhum desligamento encontrado</td></tr>`;

    this._updateStats();
  }

  _renderLinhas(lista) {
    return lista.map(d => {
      const ent = d.entrevista?.realizada
        ? `<span class="badge ok">Realizada</span>`
        : `<span class="badge warn">Pendente</span>`;
      const tipoChip = d.tipo === 'voluntario'
        ? `<span class="badge info">Voluntário</span>`
        : `<span class="badge neutral">Involuntário</span>`;
      return `
        <tr onclick="abrirDrawerDesl(${d.id})">
          <td>
            <div class="cell-person">
              <div class="cell-avatar" style="background:linear-gradient(135deg,#991B1B,#7F1D1D);">${this.h(this.iniciais(d.nome))}</div>
              <div>
                <div class="cell-person-name">${this.h(d.nome)}</div>
                <div class="cell-person-sub">${tipoChip.replace('<span class="badge', '<span class="badge" style="font-size:.62rem;padding:2px 7px;"')}</div>
              </div>
            </div>
          </td>
          <td>
            <div>${this.h(d.cargo)}</div>
            <div class="cell-person-sub">${this.h(d.setor)}</div>
          </td>
          <td class="cell-mono">${this.fmtDate(d.data)}</td>
          <td>${this.h(d.motivo)}</td>
          <td class="cell-mono">${this._tempoEntre(d.admissao, d.data)}</td>
          <td>${ent}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="Entrevista" onclick="abrirModalEntrevista(${d.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirDesligamento(${d.id})">🗑</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  _updateStats() {
    const anoAtual = new Date().getFullYear();
    const doAno = this.DESLIGAMENTOS.filter(d => new Date(d.data + 'T00:00:00').getFullYear() === anoAtual);

    this.$('#desl-stat-total').textContent = doAno.length;

    const volunt = doAno.filter(d => d.tipo === 'voluntario').length;
    this.$('#desl-stat-volunt').textContent = doAno.length ? `${volunt}/${doAno.length}` : '0';
    this.$('#desl-stat-pend').textContent = this.DESLIGAMENTOS.filter(d => !d.entrevista?.realizada).length;

    if (doAno.length) {
      const totalDias = doAno.reduce((acc, d) => {
        const a = new Date(d.admissao + 'T00:00:00');
        const b = new Date(d.data + 'T00:00:00');
        return acc + (b - a) / (1000 * 60 * 60 * 24);
      }, 0);
      const mediaAnos = totalDias / doAno.length / 365.25;
      const anos = Math.floor(mediaAnos);
      const meses = Math.round((mediaAnos - anos) * 12);
      this.$('#desl-stat-tempo').textContent = anos > 0 ? `${anos}a ${meses}m` : `${meses} meses`;
    } else {
      this.$('#desl-stat-tempo').textContent = '—';
    }
  }

  abrirDrawer(id) {
    const d = this.DESLIGAMENTOS.find(x => x.id === id);
    if (!d) return;
    this.state.drawerDeslId = id;

    this.$('#ddesl-avatar').textContent = this.iniciais(d.nome);
    this.$('#ddesl-name').textContent = d.nome;
    this.$('#ddesl-role').textContent = `${d.cargo} · ${d.setor}`;

    const tipoChip = d.tipo === 'voluntario'
      ? `<span class="badge info">Voluntário</span>`
      : `<span class="badge neutral">Involuntário</span>`;
    const avisoLabel = { trabalhado: 'Trabalhado', indenizado: 'Indenizado', dispensado: 'Dispensado' }[d.aviso] || '—';

    this.$('#ddesl-detalhes').innerHTML = `
      <div class="info-item"><div class="info-label">Data do desligamento</div><div class="info-value mono">${this.fmtDate(d.data)}</div></div>
      <div class="info-item"><div class="info-label">Último dia</div><div class="info-value mono">${this.fmtDate(d.ultimo_dia)}</div></div>
      <div class="info-item"><div class="info-label">Motivo</div><div class="info-value">${this.h(d.motivo)}</div></div>
      <div class="info-item"><div class="info-label">Tipo</div><div class="info-value">${tipoChip}</div></div>
      <div class="info-item"><div class="info-label">Aviso prévio</div><div class="info-value">${avisoLabel}</div></div>
      <div class="info-item"><div class="info-label">Tempo de casa</div><div class="info-value mono">${this._tempoEntre(d.admissao, d.data)}</div></div>
      <div class="info-sep"></div>
      <div class="info-item"><div class="info-label">Admissão</div><div class="info-value mono">${this.fmtDate(d.admissao)}</div></div>
      <div class="info-item"><div class="info-label">Status entrevista</div><div class="info-value">${d.entrevista?.realizada ? '<span class="badge ok">Realizada</span>' : '<span class="badge warn">Pendente</span>'}</div></div>
      <div class="info-item" style="grid-column:1/-1"><div class="info-label">Observações</div><div class="info-value">${this.h(d.observacoes || '—')}</div></div>
    `;

    const e = d.entrevista;
    if (e?.realizada) {
      this.$('#ddesl-entrevista').innerHTML = `
        <div class="info-grid">
          <div class="info-item"><div class="info-label">Data</div><div class="info-value mono">${this.fmtDate(e.data)}</div></div>
          <div class="info-item"><div class="info-label">Responsável</div><div class="info-value">${this.h(e.responsavel || '—')}</div></div>
          <div class="info-sep"></div>
          <div class="info-item"><div class="info-label">Satisfação geral</div><div class="info-value">${this._renderRatingView(e.satisfacao)}</div></div>
          <div class="info-item"><div class="info-label">Clima</div><div class="info-value">${this._renderRatingView(e.clima)}</div></div>
          <div class="info-item"><div class="info-label">Liderança</div><div class="info-value">${this._renderRatingView(e.lideranca)}</div></div>
          <div class="info-item"><div class="info-label">Recomendaria?</div><div class="info-value">${e.recomendaria ? '<span class="badge ok">Sim</span>' : '<span class="badge danger">Não</span>'}</div></div>
          <div class="info-sep"></div>
          <div class="info-item" style="grid-column:1/-1"><div class="info-label">Motivo principal (livre)</div><div class="info-value">${this.h(e.motivo_livre || '—')}</div></div>
          <div class="info-item" style="grid-column:1/-1"><div class="info-label">Feedback para a empresa</div><div class="info-value" style="white-space:pre-wrap">${this.h(e.feedback || '—')}</div></div>
        </div>
      `;
      this.$('#btn-drawer-entrevista').textContent = 'Editar entrevista';
    } else {
      this.$('#ddesl-entrevista').innerHTML = `<div class="empty">Entrevista de saída ainda não realizada.<br>Clique em "Registrar entrevista" abaixo.</div>`;
      this.$('#btn-drawer-entrevista').textContent = 'Registrar entrevista';
    }

    document.querySelectorAll('[data-dtab-desl]').forEach(t => t.classList.toggle('active', t.dataset.dtabDesl === 'detalhes'));
    document.querySelectorAll('[data-dsec-desl]').forEach(s => s.classList.toggle('active', s.dataset.dsecDesl === 'detalhes'));

    this.$('#drawer-backdrop-desl').classList.add('active');
    this.$('#drawer-desl').classList.add('active');
  }

  fecharDrawer() {
    this.$('#drawer-backdrop-desl').classList.remove('active');
    this.$('#drawer-desl').classList.remove('active');
    this.state.drawerDeslId = null;
  }

  abrirModalDesligamento() {
    const form = this.$('#form-desligamento');
    form.reset();
    const sel = this.$('#form-desl-colab');
    sel.innerHTML = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => `<option value="${c.id}">${this.h(c.nome)} — ${this.h(c.cargo)}</option>`)
      .join('');
    this.$('#modal-desligamento').classList.add('active');
  }

  fecharModalDesligamento() {
    this.$('#modal-desligamento').classList.remove('active');
  }

  salvarDesligamento(ev) {
    ev.preventDefault();
    const form = this.$('#form-desligamento');
    const data = Object.fromEntries(new FormData(form));
    const c = this.COLABORADORES.find(x => x.id === parseInt(data.colaborador_id, 10));
    if (!c) return;

    const newId = Math.max(0, ...this.DESLIGAMENTOS.map(x => x.id)) + 1;
    this.DESLIGAMENTOS.unshift({
      id: newId,
      colaborador_id: c.id,
      nome: c.nome,
      cargo: c.cargo,
      setor: c.setor,
      admissao: c.admissao,
      data: data.data,
      ultimo_dia: data.ultimo_dia || data.data,
      motivo: data.motivo,
      tipo: data.tipo,
      aviso: data.aviso,
      observacoes: data.observacoes || '',
      entrevista: { realizada: false },
    });

    c.status = 'inativo';
    this.fecharModalDesligamento();
    this.render();
  }

  excluirDesligamento(id) {
    if (!confirm('Excluir este registro de desligamento?')) return;
    this.DESLIGAMENTOS = this.DESLIGAMENTOS.filter(x => x.id !== id);
    this.render();
  }

  abrirModalEntrevista(deslId) {
    const d = this.DESLIGAMENTOS.find(x => x.id === deslId);
    if (!d) return;
    const form = this.$('#form-entrevista');
    form.reset();
    form.elements['desligamento_id'].value = deslId;

    document.querySelectorAll('.rating-input').forEach(g => {
      g.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    });

    const e = d.entrevista || {};
    if (e.realizada) {
      this._setRating('satisfacao', e.satisfacao);
      this._setRating('clima', e.clima);
      this._setRating('lideranca', e.lideranca);
      form.elements['recomendaria'].checked = !!e.recomendaria;
      form.elements['motivo_livre'].value = e.motivo_livre || '';
      form.elements['feedback'].value = e.feedback || '';
      form.elements['responsavel'].value = e.responsavel || '';
    }

    this.$('#modal-entrevista').classList.add('active');
  }

  fecharModalEntrevista() {
    this.$('#modal-entrevista').classList.remove('active');
  }

  salvarEntrevista(ev) {
    ev.preventDefault();
    const form = this.$('#form-entrevista');
    const data = Object.fromEntries(new FormData(form));
    const id = parseInt(data.desligamento_id, 10);
    const d = this.DESLIGAMENTOS.find(x => x.id === id);
    if (!d) return;

    d.entrevista = {
      realizada: true,
      data: new Date().toISOString().slice(0, 10),
      satisfacao: parseInt(data.satisfacao, 10) || null,
      clima: parseInt(data.clima, 10) || null,
      lideranca: parseInt(data.lideranca, 10) || null,
      recomendaria: data.recomendaria === 'on',
      motivo_livre: data.motivo_livre || '',
      feedback: data.feedback || '',
      responsavel: data.responsavel || '',
    };

    this.fecharModalEntrevista();
    this.render();
    if (this.state.drawerDeslId === id) this.abrirDrawer(id);
  }

  abrirModalEntrevistaDoDrawer() {
    if (this.state.drawerDeslId != null) this.abrirModalEntrevista(this.state.drawerDeslId);
  }

  _tempoEntre(inicio, fim) {
    if (!inicio || !fim) return '—';
    const a = new Date(inicio + 'T00:00:00');
    const b = new Date(fim + 'T00:00:00');
    const anos = (b - a) / (1000 * 60 * 60 * 24 * 365.25);
    const y = Math.floor(anos);
    const m = Math.round((anos - y) * 12);
    if (y <= 0 && m <= 0) return '< 1 mês';
    if (y === 0) return `${m}m`;
    if (m === 0) return `${y}a`;
    return `${y}a ${m}m`;
  }

  _renderRatingView(v) {
    if (!v) return '<span class="badge neutral">—</span>';
    const dots = [1, 2, 3, 4, 5].map(i =>
      `<span class="dot ${i <= v ? 'on-' + v : ''}"></span>`
    ).join('');
    return `<div class="rating">${dots}</div>`;
  }

  _setRating(field, value) {
    if (!value) return;
    const group = document.querySelector(`.rating-input[data-rating-field="${field}"]`);
    if (!group) return;
    group.querySelectorAll('button').forEach(b => b.classList.toggle('active', parseInt(b.dataset.ratingVal, 10) === value));
    const input = document.querySelector(`#form-entrevista [name="${field}"]`);
    if (input) input.value = value;
  }
}

export default DesligamentosModule;
