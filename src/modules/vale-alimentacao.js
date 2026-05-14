// Vale Alimentação Module
// Manages the food allowance page: table, modal, evolution chart

export class ValeAlimentacaoModule {
  constructor(deps) {
    this.$            = deps.$;
    this.h            = deps.h;
    this.iniciais     = deps.iniciais;
    this.fmtDate      = deps.fmtDate;
    this.fmtBRL       = deps.fmtBRL;
    this.mesLabel     = deps.mesLabel;
    this.COLABORADORES    = deps.COLABORADORES;
    this.VA_BENEFICIOS    = deps.VA_BENEFICIOS;
    this.CHART_COLORS     = deps.CHART_COLORS;
    this.showToast        = deps.showToast;

    this._chartVaEvo = null;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'va-search') this.render();
    });
    document.addEventListener('change', (e) => {
      if (['va-mes', 'va-filter-setor', 'va-filter-tipo'].includes(e.target.id)) this.render();
    });
    document.querySelectorAll('.nav-item[data-page="vale-alimentacao"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  _diasUteisDoMes(chaveMes) {
    if (!chaveMes) return 22;
    const [y, m] = chaveMes.split('-').map(Number);
    const dimM   = new Date(y, m, 0).getDate();
    let count    = 0;
    for (let d = 1; d <= dimM; d++) {
      const dow = new Date(y, m - 1, d).getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }

  _valorMensal(beneficio, chaveMes) {
    if (!beneficio) return 0;
    if (beneficio.tipo === 'fixo') return parseFloat(beneficio.valor) || 0;
    const dias = beneficio.dias_uteis || this._diasUteisDoMes(chaveMes);
    return (parseFloat(beneficio.valor) || 0) * dias;
  }

  render() {
    const tb = this.$('#tb-vale-alimentacao');
    if (!tb) return;

    const selMes = this.$('#va-mes');
    if (selMes && selMes.options.length === 0) {
      const now  = new Date();
      const meses = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      selMes.innerHTML = meses.map(m => `<option value="${m}">${this.mesLabel(m)}</option>`).join('');
    }
    const now      = new Date();
    const mesAtual = selMes?.value || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const q     = (this.$('#va-search')?.value || '').trim().toLowerCase();
    const fSet  = this.$('#va-filter-setor')?.value || '';
    const fTipo = this.$('#va-filter-tipo')?.value  || '';

    const ativos = this.COLABORADORES.filter(c => c.status !== 'inativo');

    const linhas = ativos.map(c => {
      const b = this.VA_BENEFICIOS[c.id];
      return { colab: c, beneficio: b, total: this._valorMensal(b, mesAtual) };
    });

    const filtradas = linhas.filter(r => {
      if (fSet  && r.colab.setor !== fSet)   return false;
      if (fTipo === 'sem'      &&  r.beneficio)                         return false;
      if (fTipo === 'fixo'     && r.beneficio?.tipo !== 'fixo')         return false;
      if (fTipo === 'dia_util' && r.beneficio?.tipo !== 'dia_util')     return false;
      if (q && !r.colab.nome.toLowerCase().includes(q))                 return false;
      return true;
    }).sort((a, b) => b.total - a.total || a.colab.nome.localeCompare(b.colab.nome));

    tb.innerHTML = filtradas.length ? filtradas.map(r => {
      const c = r.colab;
      const b = r.beneficio;
      const dias = b?.tipo === 'dia_util' ? (b.dias_uteis || this._diasUteisDoMes(mesAtual)) : null;
      const tipoBadge = !b
        ? `<span class="badge neutral">Sem cadastro</span>`
        : b.tipo === 'fixo'
          ? `<span class="badge info">Fixo mensal</span>`
          : `<span class="badge warn">Por dia útil</span>`;
      return `
        <tr onclick="abrirModalValeAlimentacao(${c.id})">
          <td>
            <div class="cell-person">
              <div class="cell-avatar">${this.h(this.iniciais(c.nome))}</div>
              <div>
                <div class="cell-person-name">${this.h(c.nome)}</div>
                <div class="cell-person-sub">${this.h(c.cargo)}</div>
              </div>
            </div>
          </td>
          <td>
            <div>${this.h(c.setor)}</div>
            ${c.area ? `<div class="cell-person-sub">${this.h(c.area)}</div>` : ''}
          </td>
          <td>${tipoBadge}</td>
          <td class="cell-mono" style="text-align:right">${b ? this.fmtBRL(b.valor) : '—'}</td>
          <td class="cell-mono" style="text-align:right">${dias ?? '—'}</td>
          <td class="cell-mono" style="text-align:right; font-weight:600; color:var(--phthalo-dark)">${b ? this.fmtBRL(r.total) : '—'}</td>
          <td class="cell-mono">${b?.data_alteracao ? this.fmtDate(b.data_alteracao) : '—'}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="${b ? 'Editar' : 'Cadastrar'}" onclick="abrirModalValeAlimentacao(${c.id})">${b ? '✎' : '+'}</button>
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="8" class="empty">Nenhum colaborador encontrado</td></tr>`;

    const beneficiados = linhas.filter(r => r.beneficio);
    const folha = beneficiados.reduce((s, r) => s + r.total, 0);
    this.$('#va-stat-folha').textContent = this.fmtBRL(folha);
    this.$('#va-stat-benef').textContent = beneficiados.length;
    this.$('#va-stat-medio').textContent = this.fmtBRL(beneficiados.length ? folha / beneficiados.length : 0);
    this.$('#va-stat-sem').textContent   = linhas.length - beneficiados.length;

    this._renderEvolucao();
  }

  _renderEvolucao() {
    const ctx = this.$('#chart-vale-alimentacao-evolucao');
    if (!ctx) return;

    const selMes  = this.$('#va-mes');
    const now     = new Date();
    const baseMes = selMes?.value || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [y, m]  = baseMes.split('-').map(Number);
    const meses   = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const totaisFixo = [];
    const totaisDU   = [];
    meses.forEach(chave => {
      let fx = 0, du = 0;
      Object.values(this.VA_BENEFICIOS).forEach(b => {
        if (b.tipo === 'fixo') {
          fx += parseFloat(b.valor) || 0;
        } else if (b.tipo === 'dia_util') {
          const dias = b.dias_uteis || this._diasUteisDoMes(chave);
          du += (parseFloat(b.valor) || 0) * dias;
        }
      });
      totaisFixo.push(fx);
      totaisDU.push(du);
    });

    this._chartVaEvo?.destroy();
    this._chartVaEvo = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: meses.map(m => this.mesLabel(m)),
        datasets: [
          { label: 'Fixo mensal',  data: totaisFixo, backgroundColor: this.CHART_COLORS.phthaloLight,  stack: 'g', borderRadius: 3 },
          { label: 'Por dia útil', data: totaisDU,   backgroundColor: this.CHART_COLORS.phthaloBright, stack: 'g', borderRadius: 3 },
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

  abrirModal(colabId = null) {
    const form = this.$('#form-vale-alimentacao');
    form.reset();

    const sel = this.$('#va-form-colab');
    sel.innerHTML = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => `<option value="${c.id}">${this.h(c.nome)} — ${this.h(c.setor)}</option>`).join('');

    if (colabId != null) sel.value = colabId;
    sel.disabled = colabId != null;

    this._preencherExistente();
    this.$('#modal-vale-alimentacao').classList.add('active');
  }

  _preencherExistente() {
    const form    = this.$('#form-vale-alimentacao');
    const colabId = parseInt(this.$('#va-form-colab').value, 10);
    form.elements['colaborador_id'].value = colabId;

    const c = this.COLABORADORES.find(x => x.id === colabId);
    this.$('#va-modal-title').textContent = c ? `VA — ${c.nome}` : 'Configurar vale alimentação';

    const b        = this.VA_BENEFICIOS[colabId];
    const btnRemov = this.$('#btn-va-remover');
    if (b) {
      form.elements['tipo'].value           = b.tipo;
      form.elements['valor'].value          = b.valor;
      form.elements['dias_uteis'].value     = b.dias_uteis ?? 22;
      form.elements['data_alteracao'].value = b.data_alteracao;
      form.elements['observacoes'].value    = b.observacoes || '';
      btnRemov.style.display = '';
    } else {
      form.elements['tipo'].value           = 'fixo';
      form.elements['valor'].value          = '';
      form.elements['dias_uteis'].value     = 22;
      form.elements['data_alteracao'].value = new Date().toISOString().slice(0, 10);
      form.elements['observacoes'].value    = '';
      btnRemov.style.display = 'none';
    }
    this.alternarTipo();
  }

  preencherExistente() {
    this._preencherExistente();
  }

  alternarTipo() {
    const tipo      = this.$('#form-vale-alimentacao').elements['tipo'].value;
    const grupoDias = this.$('#va-dias-uteis-group');
    const lbl       = this.$('#va-label-valor');
    if (tipo === 'dia_util') {
      grupoDias.style.display = '';
      lbl.textContent = 'Valor por dia (R$)';
    } else {
      grupoDias.style.display = 'none';
      lbl.textContent = 'Valor mensal (R$)';
    }
  }

  fecharModal() {
    this.$('#modal-vale-alimentacao').classList.remove('active');
  }

  salvar(ev) {
    ev.preventDefault();
    const form    = this.$('#form-vale-alimentacao');
    const data    = Object.fromEntries(new FormData(form));
    const colabId = parseInt(data.colaborador_id, 10);
    if (!colabId) return;

    this.VA_BENEFICIOS[colabId] = {
      tipo:           data.tipo,
      valor:          parseFloat(data.valor) || 0,
      dias_uteis:     data.tipo === 'dia_util' ? (parseInt(data.dias_uteis, 10) || null) : null,
      data_alteracao: data.data_alteracao,
      observacoes:    data.observacoes || '',
    };
    this.showToast('Vale alimentação atualizado', 'ok');
    this.fecharModal();
    this.render();
  }

  remover() {
    const colabId = parseInt(this.$('#form-vale-alimentacao').elements['colaborador_id'].value, 10);
    if (!colabId) return;
    if (!confirm('Remover o cadastro de vale alimentação deste colaborador?')) return;
    delete this.VA_BENEFICIOS[colabId];
    this.fecharModal();
    this.render();
    this.showToast('Cadastro removido');
  }
}

export default ValeAlimentacaoModule;
