// Rotatividade Module
// Exibe gráficos de turnover, movimentações e KPIs de rotatividade

export class RotatividadeModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate = deps.fmtDate;
    this.faixaIdx = deps.faixaIdx;
    this.COLABORADORES = deps.COLABORADORES;
    this.DESLIGAMENTOS = deps.DESLIGAMENTOS || [];
    this.SALARIOS = deps.SALARIOS;
    this.CHART_COLORS = deps.CHART_COLORS;

    this._chartRotMov    = null;
    this._chartRotTaxa   = null;
    this._chartRotMotivos = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('change', (e) => {
      if (['rot-periodo', 'rot-filter-setor', 'rot-filter-sexo', 'rot-filter-escolaridade', 'rot-filter-faixa'].includes(e.target.id)) {
        this.render();
      }
    });

    document.querySelectorAll('.nav-item[data-page="rotatividade"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  render() {
    const periodoEl = this.$('#rot-periodo');
    const n = parseInt(periodoEl?.value || '12', 10);

    const rotData   = this._buildRotData(n);
    const labels    = rotData.labels;
    const admissoes = rotData.admissoes;
    const desligad  = rotData.desligados;
    const taxa      = rotData.taxa;

    const fSetor = this.$('#rot-filter-setor')?.value        || '';
    const fSexo  = this.$('#rot-filter-sexo')?.value         || '';
    const fEsc   = this.$('#rot-filter-escolaridade')?.value || '';
    const fFaixa = this.$('#rot-filter-faixa')?.value;
    const temFiltro = fSetor || fSexo || fEsc || (fFaixa != null && fFaixa !== '');

    const passaFiltro = (c) => {
      if (fSetor && c.setor !== fSetor) return false;
      if (fSexo  && c.sexo  !== fSexo)  return false;
      if (fEsc   && c.escolaridade !== fEsc) return false;
      if (fFaixa != null && fFaixa !== '') {
        const sal = this.SALARIOS[c.id]?.valor;
        if (!sal) return false;
        if (this.faixaIdx(sal) !== parseInt(fFaixa, 10)) return false;
      }
      return true;
    };

    const totalAdm = admissoes.reduce((a, b) => a + b, 0);
    const totalDes = desligad.reduce((a, b) => a + b, 0);
    const taxaAtual = taxa[taxa.length - 1];
    const taxaAnt   = taxa[taxa.length - 2] ?? taxaAtual;
    const deltaTaxa = +(taxaAtual - taxaAnt).toFixed(1);

    this.$('#rot-kpi-taxa').innerHTML = `${taxaAtual.toFixed(1).replace('.', ',')}<span class="unit">%</span>`;
    const trendTaxa = this.$('#rot-kpi-taxa-trend');
    trendTaxa.className = 'kpi-trend ' + (deltaTaxa < 0 ? 'up' : deltaTaxa > 0 ? 'down' : '');
    trendTaxa.textContent = deltaTaxa === 0
      ? 'estável vs. mês anterior'
      : `${deltaTaxa > 0 ? '↑' : '↓'} ${Math.abs(deltaTaxa).toFixed(1).replace('.', ',')} pp vs. mês anterior`;

    this.$('#rot-kpi-admitidos').textContent = totalAdm;
    this.$('#rot-kpi-admitidos-trend').textContent = `média ${(totalAdm / n).toFixed(1).replace('.', ',')}/mês`;

    this.$('#rot-kpi-desligados').textContent = totalDes;
    this.$('#rot-kpi-desligados-trend').textContent = `média ${(totalDes / n).toFixed(1).replace('.', ',')}/mês`;

    const ativos = this.COLABORADORES.filter(c => c.status !== 'inativo' && c.admissao && passaFiltro(c));
    if (ativos.length) {
      const now = new Date();
      const totalAnos = ativos.reduce((acc, c) => {
        const start = new Date(c.admissao + 'T00:00:00');
        return acc + (now - start) / (1000 * 60 * 60 * 24 * 365.25);
      }, 0);
      this.$('#rot-kpi-perm').innerHTML = `${(totalAnos / ativos.length).toFixed(1).replace('.', ',')}<span class="unit">anos</span>`;
    } else if (temFiltro) {
      this.$('#rot-kpi-perm').innerHTML = `—<span class="unit">sem dados</span>`;
    }

    this._renderCharts(labels, admissoes, desligad, taxa, rotData);
    this._renderTabela(fSetor, rotData);
  }

  _buildRotData(n) {
    const agora = new Date();
    const labels = [], admissoes = [], desligados = [], taxa = [];

    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const chave = d.getFullYear() * 100 + d.getMonth();
      const mesLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
      labels.push(mesLabel);

      const admMes = this.COLABORADORES.filter(c => {
        if (!c.admissao) return false;
        const da = new Date(c.admissao);
        return da.getFullYear() * 100 + da.getMonth() === chave;
      }).length;

      const desMes = this.DESLIGAMENTOS.filter(dl => {
        if (!dl.data) return false;
        const dd = new Date(dl.data);
        return dd.getFullYear() * 100 + dd.getMonth() === chave;
      }).length;

      const hc = this.COLABORADORES.filter(c => c.status !== 'inativo').length || 1;
      const taxaMes = ((admMes + desMes) / 2 / hc * 100);

      admissoes.push(admMes);
      desligados.push(desMes);
      taxa.push(parseFloat(taxaMes.toFixed(1)));
    }

    const motivosCont = {};
    this.DESLIGAMENTOS.forEach(dl => {
      const motivo = dl.tipo_saida || 'Outros';
      motivosCont[motivo] = (motivosCont[motivo] || 0) + 1;
    });
    const motivos = Object.entries(motivosCont).map(([label, valor]) => ({ label, valor }));

    const movimentacoes = [];
    this.COLABORADORES.filter(c => c.admissao).slice(0, 20).forEach(c => {
      movimentacoes.push({
        tipo: 'admissao',
        nome: c.nome,
        setor: c.setor,
        cargo: c.cargo,
        data: c.admissao,
        motivo: '—',
      });
    });
    this.DESLIGAMENTOS.slice(0, 20).forEach(dl => {
      const col = this.COLABORADORES.find(c => c.id === dl.colaborador_id);
      if (col) {
        movimentacoes.push({
          tipo: 'desligamento',
          nome: col.nome,
          setor: col.setor,
          cargo: col.cargo,
          data: dl.data,
          motivo: dl.tipo_saida || '—',
        });
      }
    });
    movimentacoes.sort((a, b) => new Date(b.data) - new Date(a.data));

    return { labels, admissoes, desligados, taxa, motivos, movimentacoes };
  }

  _renderCharts(labels, admissoes, desligad, taxa, rotData) {
    if (typeof Chart === 'undefined') return;

    this._chartRotMov?.destroy();
    this._chartRotMov = new Chart(this.$('#chart-rot-movimento'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Admissões',     data: admissoes, backgroundColor: this.CHART_COLORS.phthaloBright, borderRadius: 4 },
          { label: 'Desligamentos', data: desligad,  backgroundColor: '#EF4444',                       borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } } },
        scales: {
          y: { beginAtZero: true, grid: { color: this.CHART_COLORS.grid }, ticks: { stepSize: 1 } },
          x: { grid: { display: false } },
        },
      },
    });

    this._chartRotTaxa?.destroy();
    this._chartRotTaxa = new Chart(this.$('#chart-rot-taxa'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Rotatividade %',
          data: taxa,
          borderColor: this.CHART_COLORS.phthalo,
          backgroundColor: 'rgba(46,122,184,.12)',
          borderWidth: 2.5,
          tension: .35,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: this.CHART_COLORS.phthaloBright,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: this.CHART_COLORS.grid }, ticks: { callback: v => v + '%' } },
          x: { grid: { display: false } },
        },
      },
    });

    const motLabels = rotData.motivos.map(m => m.label);
    const motData   = rotData.motivos.map(m => m.valor);
    const totalMot  = motData.reduce((a, b) => a + b, 0);
    const motBadge = this.$('#rot-motivos-badge');
    if (motBadge) motBadge.textContent = `${totalMot} saídas`;

    this._chartRotMotivos?.destroy();
    this._chartRotMotivos = new Chart(this.$('#chart-rot-motivos'), {
      type: 'doughnut',
      data: {
        labels: motLabels,
        datasets: [{
          data: motData,
          backgroundColor: [
            this.CHART_COLORS.phthalo,
            this.CHART_COLORS.phthaloLight,
            this.CHART_COLORS.phthaloBright,
            '#7EB9E0',
            '#B1D4EA',
          ],
          borderColor: '#fff',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 10, boxWidth: 10, font: { size: 10.5 } },
          },
        },
      },
    });
  }

  _renderTabela(fSetor, rotData) {
    const tb = this.$('#tb-rot-movimentacoes');
    if (!tb) return;

    const movFiltradas = rotData.movimentacoes.filter(m => {
      if (fSetor && m.setor !== fSetor) return false;
      return true;
    });

    tb.innerHTML = movFiltradas.length
      ? movFiltradas.map(m => {
          const chip = m.tipo === 'admissao'
            ? `<span class="activity-chip admissao">Admissão</span>`
            : `<span class="activity-chip desligamento">Desligamento</span>`;
          return `
            <tr>
              <td>${chip}</td>
              <td>
                <div class="cell-person">
                  <div class="cell-avatar">${this.h(this.iniciais(m.nome))}</div>
                  <div class="cell-person-name">${this.h(m.nome)}</div>
                </div>
              </td>
              <td>
                <div>${this.h(m.cargo)}</div>
                <div class="cell-person-sub">${this.h(m.setor)}</div>
              </td>
              <td class="cell-mono">${this.fmtDate(m.data)}</td>
              <td style="color:var(--text-muted)">${this.h(m.motivo)}</td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="5" class="empty">Nenhuma movimentação no filtro</td></tr>`;
  }

  limparFiltros() {
    ['rot-filter-setor', 'rot-filter-sexo', 'rot-filter-escolaridade', 'rot-filter-faixa'].forEach(id => {
      const el = this.$('#' + id);
      if (el) el.value = '';
    });
    this.render();
  }
}

export default RotatividadeModule;
