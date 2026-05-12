// Férias Module
// Gerencia renderização, timeline e cálculos de férias (CLT)

export class FeriasModule {
  constructor(deps) {
    this.Ferias = deps.Ferias;
    this.Colaboradores = deps.Colaboradores;
    this.Salarios = deps.Salarios;
    this.$ = deps.$;
    this.h = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate = deps.fmtDate;
    this.fmtBRL = deps.fmtBRL;
    this.FERIAS = deps.FERIAS;
    this.COLABORADORES = deps.COLABORADORES;
    this.SALARIOS = deps.SALARIOS;

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'fer-search') {
        this.render();
      }
    });

    document.addEventListener('change', (e) => {
      if (['fer-filter-setor', 'fer-filter-status'].includes(e.target.id)) {
        this.render();
      }
    });

    document.querySelectorAll('.nav-item[data-page="ferias"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  async render() {
    const tb = this.$('#tb-ferias');
    if (!tb) return;

    const q = (this.$('#fer-search')?.value || '').trim().toLowerCase();
    const fSet = this.$('#fer-filter-setor')?.value || '';
    const fSt = this.$('#fer-filter-status')?.value || '';

    const hoje = this._isoNow();
    const d30 = this._addDays(hoje, 30);

    const ativos = this.COLABORADORES.filter(c => c.status !== 'inativo');

    const linhas = ativos.map(c => {
      const aq = this._periodoAquisitivoAtual(c.admissao);
      const periodos = this.FERIAS.filter(f => f.colaborador_id === c.id);
      const diasUsados = periodos
        .filter(p => p.status !== 'planejada' || new Date(p.inicio) <= new Date())
        .reduce((s, p) => s + (p.dias + (p.abono || 0)), 0);
      const saldo = aq ? Math.max(0, 30 - diasUsados) : 0;

      const proximos = periodos
        .filter(p => p.fim >= hoje)
        .sort((a, b) => a.inicio.localeCompare(b.inicio));
      const proximo = proximos[0] || null;

      let status = 'pendente';
      if (proximo && proximo.inicio <= hoje && proximo.fim >= hoje) status = 'em_ferias';
      else if (proximo && proximo.inicio <= d30) status = 'planejada';
      else if (aq && aq.concessivoLimite < hoje) status = 'vencido';
      else if (aq && aq.concessivoLimite <= this._addDays(hoje, 60)) status = 'vencendo';

      const sal = parseFloat(this.SALARIOS[c.id]?.valor || 0);
      let provisao = 0;
      if (sal && saldo > 0) {
        const bruto = (sal / 30) * saldo;
        provisao = bruto + (bruto / 3);
      }

      return { colab: c, aq, periodos, saldo, proximo, status, provisao };
    });

    const filtradas = linhas.filter(r => {
      if (fSet && r.colab.setor !== fSet) return false;
      if (fSt && r.status !== fSt) return false;
      if (q && !r.colab.nome.toLowerCase().includes(q)) return false;
      if (!r.aq) return false;
      return true;
    }).sort((a, b) => {
      const order = { vencido: 0, vencendo: 1, em_ferias: 2, planejada: 3, pendente: 4 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });

    tb.innerHTML = filtradas.length
      ? this._renderLinhas(filtradas)
      : `<tr><td colspan="9" class="empty">Nenhum colaborador encontrado</td></tr>`;

    this._updateStats(linhas);
    this._renderTimeline(linhas);
  }

  _renderLinhas(filtradas) {
    return filtradas.map(r => {
      const c = r.colab;
      const stBadge = {
        em_ferias: `<span class="badge info">Em férias</span>`,
        planejada: `<span class="badge ok">Planejada</span>`,
        pendente: `<span class="badge neutral">Pendente</span>`,
        vencendo: `<span class="badge warn">Vencendo</span>`,
        vencido: `<span class="badge danger">Vencido</span>`,
      }[r.status];
      const proxTxt = r.proximo
        ? `${this.fmtDate(r.proximo.inicio)} → ${this.fmtDate(r.proximo.fim)}`
        : '<span style="color:var(--text-soft)">—</span>';
      const provDisp = r.provisao > 0
        ? `<span class="cell-mono" style="font-weight:600; color:var(--phthalo-dark)">${this.fmtBRL(r.provisao)}</span>`
        : `<span style="color:var(--text-soft)">—</span>`;

      return `
        <tr onclick="abrirModalFerias(${c.id})">
          <td>
            <div class="cell-person">
              <div class="cell-avatar">${this.h(this.iniciais(c.nome))}</div>
              <div>
                <div class="cell-person-name">${this.h(c.nome)}</div>
                <div class="cell-person-sub">${this.h(c.cargo)} · ${this.h(c.setor)}${c.area ? ' · ' + this.h(c.area) : ''}</div>
              </div>
            </div>
          </td>
          <td class="cell-mono">${this.fmtDate(c.admissao)}</td>
          <td class="cell-mono">${this.fmtDate(r.aq.inicio)} → ${this.fmtDate(r.aq.fim)}</td>
          <td class="cell-mono">${this.fmtDate(r.aq.concessivoLimite)}</td>
          <td class="cell-mono" style="text-align:right; font-weight:600; ${r.saldo === 0 ? 'color:var(--text-muted)' : ''}">${r.saldo}</td>
          <td style="text-align:right">${provDisp}</td>
          <td class="cell-mono">${proxTxt}</td>
          <td>${stBadge}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="Agendar" onclick="abrirModalFerias(${c.id})">+</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  _updateStats(linhas) {
    this.$('#fer-stat-agora').textContent = linhas.filter(r => r.status === 'em_ferias').length;
    this.$('#fer-stat-prox').textContent = linhas.filter(r => r.status === 'planejada').length;
    this.$('#fer-stat-pend').textContent = linhas.filter(r => r.status === 'pendente').length;
    this.$('#fer-stat-venc').textContent = linhas.filter(r => r.status === 'vencendo' || r.status === 'vencido').length;

    const provBy = (setor) => linhas
      .filter(r => !setor || r.colab.setor === setor)
      .reduce((s, r) => s + r.provisao, 0);
    this.$('#fer-stat-prov-total').textContent = this.fmtBRL(provBy(null));
    this.$('#fer-stat-prov-prod').textContent = this.fmtBRL(provBy('Produção'));
    this.$('#fer-stat-prov-adm').textContent = this.fmtBRL(provBy('Administrativo'));
    this.$('#fer-stat-prov-gado').textContent = this.fmtBRL(provBy('Área Externa'));
  }

  _renderTimeline(linhas) {
    const wrap = this.$('#fer-timeline');
    if (!wrap) return;

    const ano = new Date().getFullYear();
    this.$('#fer-timeline-ano').textContent = String(ano);

    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const ativas = linhas
      .map(r => ({ r, periodos: r.periodos.filter(p => p.inicio.startsWith(String(ano)) || p.fim.startsWith(String(ano))) }))
      .filter(x => x.periodos.length)
      .sort((a, b) => a.periodos[0].inicio.localeCompare(b.periodos[0].inicio));

    if (!ativas.length) {
      wrap.innerHTML = `<div class="empty">Nenhuma férias agendada para ${ano}</div>`;
      return;
    }

    const hoje = new Date();
    const todayPct = ((hoje.getMonth() * 30 + hoje.getDate()) / (12 * 30)) * 100;

    const rowsHtml = ativas.map(({ r, periodos }) => {
      const segsHtml = periodos.map(p => {
        const ini = new Date(p.inicio + 'T00:00:00');
        const fim = new Date(p.fim + 'T00:00:00');
        const iniDay = (Math.max(0, ini.getMonth()) * 30) + (ini.getFullYear() === ano ? ini.getDate() : 1);
        const fimDay = (Math.min(11, fim.getMonth()) * 30) + (fim.getFullYear() === ano ? fim.getDate() : 30);
        const left = Math.max(0, (iniDay / (12 * 30)) * 100);
        const width = Math.max(0.8, ((fimDay - iniDay + 1) / (12 * 30)) * 100);
        const st = this._periodoStatus(p);
        const color = st === 'em_curso' ? '#2E7AB8' : st === 'concluida' ? '#8A98A8' : '#4A9FD6';
        const label = `${this.fmtDate(p.inicio)} — ${this.fmtDate(p.fim)} · ${p.dias}d${p.abono ? ' + ' + p.abono + ' abono' : ''}`;
        return `<div class="fer-seg" style="left:${left}%; width:${width}%; background:${color};" title="${this.h(label)}"></div>`;
      }).join('');
      return `
        <div class="fer-row" onclick="abrirModalFerias(${r.colab.id})">
          <div class="fer-row-name">
            <div class="cell-avatar" style="width:24px;height:24px;font-size:.65rem;">${this.h(this.iniciais(r.colab.nome))}</div>
            <div>
              <div style="font-size:.85rem; font-weight:600; color:var(--text);">${this.h(r.colab.nome)}</div>
              <div class="cell-person-sub">${this.h(r.colab.setor)}</div>
            </div>
          </div>
          <div class="fer-row-track">
            ${segsHtml}
          </div>
        </div>
      `;
    }).join('');

    wrap.innerHTML = `
      <div class="fer-timeline">
        <div class="fer-header">
          <div class="fer-header-spacer"></div>
          <div class="fer-header-months">
            ${meses.map(m => `<div class="fer-header-month">${m}</div>`).join('')}
          </div>
        </div>
        <div class="fer-body">
          <div class="fer-today" style="left:calc(230px + ${todayPct}% - ${todayPct * 230 / 100}px)"></div>
          ${rowsHtml}
        </div>
      </div>
    `;
  }

  _isoNow() {
    return new Date().toISOString().slice(0, 10);
  }

  _addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  _addYears(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setFullYear(d.getFullYear() + n);
    return d.toISOString().slice(0, 10);
  }

  _periodoAquisitivoAtual(admissao) {
    if (!admissao) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const adm = new Date(admissao + 'T00:00:00');
    const anos = (hoje - adm) / (1000 * 60 * 60 * 24 * 365.25);
    const ciclo = Math.max(0, Math.floor(anos));
    if (ciclo < 1) return null;
    const ini = this._addYears(admissao, ciclo - 1);
    const fim = this._addDays(this._addYears(admissao, ciclo), -1);
    const concessivoLimite = this._addYears(fim, 1);
    return { inicio: ini, fim, concessivoLimite };
  }

  _periodoStatus(p) {
    const hoje = this._isoNow();
    if (p.status === 'concluida') return 'concluida';
    if (p.inicio > hoje) return 'planejada';
    if (p.fim >= hoje) return 'em_curso';
    return 'concluida';
  }

  _diasEntre(a, b) {
    return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / (1000 * 60 * 60 * 24)) + 1;
  }

  calcDias(iniVal, fimVal) {
    if (iniVal && fimVal && fimVal >= iniVal) {
      return this._diasEntre(iniVal, fimVal);
    }
    return 0;
  }

  salvarPeriodo(colabId, inicio, fim, dias, abono = 0) {
    const diasCalc = this._diasEntre(inicio, fim);
    const diasFinal = dias || diasCalc;
    const abonoFinal = parseInt(abono, 10) || 0;

    if (!inicio || !fim || diasFinal <= 0) {
      throw new Error('Período inválido');
    }

    const existentes = this.FERIAS.filter(x => x.colaborador_id === colabId)
      .reduce((s, p) => s + (p.dias + (p.abono || 0)), 0);
    if (existentes + diasFinal + abonoFinal > 30) {
      throw new Error(`Limite de 30 dias será excedido (${existentes}d já existentes)`);
    }

    const newId = Math.max(0, ...this.FERIAS.map(x => x.id)) + 1;
    this.FERIAS.push({
      id: newId,
      colaborador_id: colabId,
      inicio,
      fim,
      dias: diasFinal,
      abono: abonoFinal,
      observacoes: '',
      status: 'planejada',
    });
  }

  deletePeriodo(id) {
    this.FERIAS = this.FERIAS.filter(x => x.id !== id);
  }
}

export default FeriasModule;
