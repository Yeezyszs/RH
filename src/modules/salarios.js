// Salarios Module
// Gerencia tabela salarial restrita com gráficos de distribuição

import { limparFormulario } from '../utils/ui.js?v=dev';

export class SalariosModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate = deps.fmtDate;
    this.fmtBRL = deps.fmtBRL;
    this.faixaIdx = deps.faixaIdx;
    this.COLABORADORES = deps.COLABORADORES;
    this.SALARIOS = deps.SALARIOS;
    this.FOLHA_HIST = deps.FOLHA_HIST || [];
    this.mesLabel = deps.mesLabel;
    this.FAIXAS = deps.FAIXAS;
    this.CHART_COLORS = deps.CHART_COLORS;
    this.Auth = deps.Auth;
    this.Salarios = deps.Salarios;

    this._chartSalSetor = null;
    this._chartSalFaixa = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'sal-search') { clearTimeout(this._searchT); this._searchT = setTimeout(() => this.render(), 250); }
    });

    document.addEventListener('change', (e) => {
      if (['sal-filter-setor', 'sal-filter-faixa', 'sal-competencia'].includes(e.target.id)) this.render();
    });

    document.querySelectorAll('.nav-item[data-page="salarios"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  /** Competências com folha importada, da mais nova para a mais antiga. */
  _competencias() {
    return [...new Set(this.FOLHA_HIST.map(h => h.competencia).filter(Boolean))].sort().reverse();
  }

  /** Preenche o seletor de mês e devolve a competência escolhida ('' = atual). */
  _preencherCompetencias() {
    const sel = this.$('#sal-competencia');
    if (!sel) return '';
    const comps = this._competencias();
    const atual = sel.value;
    sel.innerHTML = '<option value="">Salário atual (cadastro)</option>'
      + comps.map(c => `<option value="${c}">Folha de ${this.h(this.mesLabel(c))}</option>`).join('');
    sel.value = comps.includes(atual) ? atual : '';
    // Sem folha importada o seletor não tem o que oferecer.
    sel.style.display = comps.length ? '' : 'none';
    return sel.value;
  }

  render() {
    const tb = this.$('#tb-salarios');
    if (!tb) return;

    const q    = (this.$('#sal-search')?.value || '').trim().toLowerCase();
    const fSet = this.$('#sal-filter-setor')?.value || '';
    const fFx  = this.$('#sal-filter-faixa')?.value;
    const comp = this._preencherCompetencias();

    // Olhando uma competência passada, a lista é a daquela folha — inclusive
    // quem já foi desligado depois. Olhando o atual, é o efetivo de hoje.
    const doMes = comp
      ? new Map(this.FOLHA_HIST.filter(h => h.competencia === comp).map(h => [h.colaborador_id, h]))
      : null;

    const ativos = comp
      ? this.COLABORADORES.filter(c => doMes.has(c.id))
      : this.COLABORADORES.filter(c => c.status !== 'inativo');

    const linhas = ativos.map(c => {
      if (comp) {
        const h = doMes.get(c.id);
        return {
          colab:          c,
          valor:          parseFloat(h.salario_base) || 0,
          data_alteracao: null,
          observacoes:    '',
          liquido:        h.liquido != null ? parseFloat(h.liquido) : null,
          temSalario:     true,
          historico:      true,
        };
      }
      const s = this.SALARIOS[c.id];
      return {
        colab:          c,
        valor:          s?.valor || 0,
        data_alteracao: s?.data_alteracao || null,
        observacoes:    s?.observacoes || '',
        liquido:        null,
        temSalario:     !!s,
        historico:      false,
      };
    });

    const filtradas = linhas.filter(r => {
      if (fSet && r.colab.setor !== fSet) return false;
      if (fFx !== '' && fFx != null) {
        if (!r.temSalario) return false;
        if (this.faixaIdx(r.valor) !== parseInt(fFx, 10)) return false;
      }
      if (q) {
        const hay = [r.colab.nome, r.colab.setor, r.colab.area].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.valor - a.valor);

    const comSal = linhas.filter(r => r.temSalario);
    const soma   = comSal.reduce((s, r) => s + r.valor, 0);
    const medio  = comSal.length ? soma / comSal.length : 0;
    const ordenados = [...comSal].map(r => r.valor).sort((a, b) => a - b);
    const mediana = ordenados.length
      ? (ordenados.length % 2
          ? ordenados[(ordenados.length - 1) / 2]
          : (ordenados[ordenados.length / 2 - 1] + ordenados[ordenados.length / 2]) / 2)
      : 0;

    this.$('#sal-stat-total').textContent   = this.fmtBRL(soma);
    this.$('#sal-stat-medio').textContent   = this.fmtBRL(medio);
    this.$('#sal-stat-mediana').textContent = this.fmtBRL(mediana);
    this.$('#sal-stat-sem').textContent     = linhas.filter(r => !r.temSalario).length;

    // Rótulos que mudam com o modo: no histórico não existe "sem cadastro",
    // existe "pessoas na folha"; e a última coluna passa a ser o líquido pago.
    const rotSem = this.$('#sal-stat-sem-label');
    if (rotSem) rotSem.textContent = comp ? 'Pessoas na folha' : 'Sem salário cadastrado';
    if (comp) this.$('#sal-stat-sem').textContent = linhas.length;
    const thUlt = this.$('#sal-th-ultima');
    if (thUlt) thUlt.textContent = comp ? 'Líquido do mês' : 'Última alteração';
    const aviso = this.$('#sal-aviso-historico');
    if (aviso) {
      aviso.style.display = comp ? '' : 'none';
      if (comp) {
        const liq = linhas.reduce((s2, r) => s2 + (r.liquido || 0), 0);
        aviso.innerHTML = `Você está vendo a <strong>folha de ${this.h(this.mesLabel(comp))}</strong>, `
          + `como ela foi importada — não dá para editar o passado. `
          + `Líquido pago no mês: <strong>${this.fmtBRL(liq)}</strong>.`;
      }
    }

    tb.innerHTML = filtradas.length
      ? filtradas.map(r => {
          const c = r.colab;
          const faixa = r.temSalario ? this.FAIXAS[this.faixaIdx(r.valor)].short : '—';
          const salDisp = r.temSalario
            ? `<span class="cell-mono" style="font-weight:600; color:var(--phthalo-dark)">${this.fmtBRL(r.valor)}</span>`
            : `<span style="color:var(--text-soft); font-style:italic">sem cadastro</span>`;
          const faixaDisp = r.temSalario
            ? `<span class="badge info">${faixa}</span>`
            : `<span class="badge neutral">—</span>`;
          return `
            <tr${r.historico ? '' : ` onclick="abrirModalSalario(${c.id})"`}>
              <td>
                <div class="cell-person">
                  <div class="cell-avatar">${this.h(this.iniciais(c.nome))}</div>
                  <div>
                    <div class="cell-person-name">${this.h(c.nome)}</div>
                    <div class="cell-person-sub">Mat. ${this.h(c.matricula || '—')}</div>
                  </div>
                </div>
              </td>
              <td>
                <div>${this.h(c.setor)}</div>
                ${c.area ? `<div class="cell-person-sub">${this.h(c.area)}</div>` : ''}
              </td>
              <td style="text-align:right">${salDisp}</td>
              <td>${faixaDisp}</td>
              <td class="cell-mono">${r.historico
                ? (r.liquido != null ? this.fmtBRL(r.liquido) : '—')
                : (r.data_alteracao ? this.fmtDate(r.data_alteracao) : '—')}</td>
              <td class="actions" onclick="event.stopPropagation()">
                ${r.historico ? '' : `<button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalSalario(${c.id})">✎</button>`}
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="6" class="empty">Nenhum colaborador encontrado</td></tr>`;

    this._renderCharts(linhas);
  }

  _renderCharts(linhas) {
    if (typeof Chart === 'undefined') return;

    const comSal = linhas.filter(r => r.temSalario);

    const porSetor = {};
    comSal.forEach(r => {
      porSetor[r.colab.setor] = (porSetor[r.colab.setor] || 0) + r.valor;
    });
    const setores = Object.keys(porSetor).sort((a, b) => porSetor[b] - porSetor[a]);
    const totalSetor = Object.values(porSetor).reduce((a, b) => a + b, 0);

    const setorBadge = this.$('#sal-setor-badge');
    if (setorBadge) setorBadge.textContent = this.fmtBRL(totalSetor);

    this._chartSalSetor?.destroy();
    const ctxSetor = this.$('#chart-sal-setor');
    if (ctxSetor) {
      this._chartSalSetor = new Chart(ctxSetor, {
        type: 'doughnut',
        data: {
          labels: setores,
          datasets: [{
            data: setores.map(s => porSetor[s]),
            backgroundColor: [
              this.CHART_COLORS.phthalo, this.CHART_COLORS.phthaloLight, this.CHART_COLORS.phthaloBright,
              '#7EB9E0', '#B1D4EA',
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
            legend: { position: 'right', labels: { padding: 10, boxWidth: 12, font: { size: 11 } } },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${this.fmtBRL(ctx.parsed)}` } },
          },
        },
      });
    }

    const contagem = this.FAIXAS.map(() => 0);
    comSal.forEach(r => contagem[this.faixaIdx(r.valor)]++);

    this._chartSalFaixa?.destroy();
    const ctxFaixa = this.$('#chart-sal-faixa');
    if (ctxFaixa) {
      this._chartSalFaixa = new Chart(ctxFaixa, {
        type: 'bar',
        data: {
          labels: this.FAIXAS.map(f => f.short),
          datasets: [{
            label: 'Colaboradores',
            data: contagem,
            backgroundColor: this.CHART_COLORS.phthaloLight,
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { title: (items) => this.FAIXAS[items[0].dataIndex].label } },
          },
          scales: {
            y: { beginAtZero: true, grid: { color: this.CHART_COLORS.grid }, ticks: { stepSize: 1 } },
            x: { grid: { display: false } },
          },
        },
      });
    }
  }

  abrirModal(colabId) {
    const c = this.COLABORADORES.find(x => x.id === colabId);
    if (!c) return;
    const s = this.SALARIOS[colabId];
    const form = this.$('#form-salario');
    limparFormulario(form);
    form.elements['colaborador_id'].value = colabId;
    this.$('#sal-colab-nome').value = `${c.nome} — ${c.setor}${c.area ? ` · ${c.area}` : ''}`;
    this.$('#sal-modal-title').textContent = s
      ? `Editar salário — ${c.nome}`
      : `Cadastrar salário — ${c.nome}`;
    if (s) {
      form.elements['valor'].value          = s.valor;
      form.elements['data_alteracao'].value = s.data_alteracao;
      form.elements['observacoes'].value    = s.observacoes || '';
    } else {
      form.elements['data_alteracao'].value = new Date().toISOString().slice(0, 10);
    }
    this.$('#modal-salario').classList.add('active');
  }

  fecharModal() {
    this.$('#modal-salario').classList.remove('active');
  }

  async salvar(ev) {
    ev.preventDefault();
    const form = this.$('#form-salario');
    const data = Object.fromEntries(new FormData(form));
    const colabId = parseInt(data.colaborador_id, 10);

    const valor = parseFloat(data.valor);
    if (!data.valor || isNaN(valor) || valor <= 0 || valor > 9999999.99) {
      window.showToast?.('Salário inválido (deve ser entre R$ 0,01 e R$ 9.999.999,99)', 'err');
      return;
    }
    if (!data.data_alteracao || !/^\d{4}-\d{2}-\d{2}$/.test(data.data_alteracao)) {
      window.showToast?.('Data de alteração obrigatória', 'err');
      return;
    }
    if ((data.observacoes || '').length > 500) {
      window.showToast?.('Observações muito longas (máx. 500 caracteres)', 'err');
      return;
    }

    const payload = {
      colaborador_id: colabId,
      valor:          Math.round(valor * 100) / 100,
      data_alteracao: data.data_alteracao,
      observacoes:    data.observacoes || '',
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        const existente = this.SALARIOS[colabId];
        if (existente?.id) {
          await this.Salarios.atualizar(existente.id, payload);
        } else {
          await this.Salarios.criar(payload);
        }
      } catch (err) {
        window.showToast?.('Erro ao salvar: ' + err.message, 'err');
        return;
      }
    } else {
      this.SALARIOS[colabId] = {
        valor:          payload.valor,
        data_alteracao: payload.data_alteracao,
        observacoes:    payload.observacoes,
      };
    }
    this.fecharModal();
    this.render();
  }

  exportSalarios() {
    window.showToast?.('Exportação CSV será implementada na integração', 'ok');
  }
}

export default SalariosModule;
