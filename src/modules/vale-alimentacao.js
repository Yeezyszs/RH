// Vale Alimentação Module
// Manages the food allowance page: table, modal, evolution chart

import { optionsColaboradores, limparFormulario } from '../utils/ui.js?v=dev';

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
    this.VA_POR_MES       = deps.VA_POR_MES || {};
    this.mesChave         = deps.mesChave;
    this.CHART_COLORS     = deps.CHART_COLORS;
    this.showToast        = deps.showToast;
    this.Auth             = deps.Auth;
    this.ValeAlimentacao  = deps.ValeAlimentacao;

    this._chartVaEvo = null;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'va-search') { clearTimeout(this._searchT); this._searchT = setTimeout(() => this.render(), 250); }
    });
    document.addEventListener('change', (e) => {
      if (['va-mes', 'va-filter-setor', 'va-filter-tipo'].includes(e.target.id)) this.render();
      if (e.target.id === 'va-pad-setor') this._atualizarContagemPadronizar();
      if (e.target.id === 'va-pad-tipo')  this.alternarTipoPadronizar();
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

  /**
   * Meses do seletor: os que têm lançamento, mais o corrente.
   *
   * Antes a lista eram os 12 meses anteriores a hoje, existissem ou não — o
   * RH escolhia maio e via a configuração de hoje, porque a tela ignorava a
   * competência. Mostrar só o que existe deixa claro o que foi registrado.
   *
   * @returns {string} a competência selecionada, no formato AAAA-MM
   */
  _preencherMeses() {
    // `mesChave` do projeto recebe a data em ISO, não um objeto Date.
    const atual = this.mesChave(new Date().toISOString().slice(0, 10));

    const comLancamento = [...new Set(
      Object.keys(this.VA_POR_MES || {}).map(k => k.split('|')[1]).filter(Boolean),
    )];
    const meses = [...new Set([atual, ...comLancamento])].sort().reverse();

    const sel = this.$('#va-mes');
    if (sel) {
      const assinatura = meses.join(',');
      if (sel._assinatura !== assinatura) {
        const anterior = sel.value;
        sel.innerHTML = meses.map(m => `<option value="${m}">${this.mesLabel(m)}</option>`).join('');
        sel._assinatura = assinatura;
        sel.value = meses.includes(anterior) ? anterior : meses[0];
      }
      return sel.value || meses[0];
    }
    return meses[0];
  }

  /** Quem estava na casa naquela competência, pela admissão e pelo desligamento. */
  _naCasaEm(c, mes) {
    const [y, m] = String(mes).split('-').map(Number);
    if (!y || !m) return true;
    const inicio = `${mes}-01`;
    const fim    = `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    const admissao     = c.data_admissao || c.admissao || '';
    const desligamento = c.data_desligamento || '';
    if (admissao && admissao > fim)            return false;
    if (desligamento && desligamento < inicio) return false;
    return true;
  }

  /**
   * As linhas de uma competência: quem recebeu, e quanto.
   *
   * Competência IMPORTADA é a lista da operadora, e nada além dela. Antes
   * esta tela partia sempre de todo mundo que está na casa hoje e caía no
   * cadastro vigente quando faltava lançamento — em janeiro apareciam, com o
   * valor de hoje, pessoas admitidas em agosto. O relatório da operadora é a
   * verdade do mês: se o PDF de janeiro traz 46 pessoas, janeiro tem 46
   * linhas, inclusive as de quem já foi desligado desde então.
   *
   * Competência SEM lançamento nenhum continua caindo no cadastro vigente —
   * é o mês corrente, ainda não creditado, e aí a pergunta é mesmo "quanto
   * está combinado". Só que restrita a quem já tinha sido admitido.
   */
  _linhasDoMes(mes) {
    const sufixo = `|${mes}`;
    const lancados = Object.keys(this.VA_POR_MES || {})
      .filter(k => k.endsWith(sufixo))
      .map(k => Number(k.slice(0, -sufixo.length)));

    const linha = (c, beneficio) =>
      ({ colab: c, beneficio, total: this._valorMensal(beneficio, mes) });

    if (lancados.length) {
      const porId = new Map(this.COLABORADORES.map(c => [c.id, c]));
      return lancados
        .filter(id => porId.has(id))
        .map(id => linha(porId.get(id), this.VA_POR_MES[`${id}${sufixo}`]));
    }

    return this.COLABORADORES
      .filter(c => c.status !== 'inativo' && this._naCasaEm(c, mes))
      .map(c => linha(c, this.VA_BENEFICIOS[c.id]));
  }

  render() {
    const tb = this.$('#tb-vale-alimentacao');
    if (!tb) return;

    const mesAtual = this._preencherMeses();

    const q     = (this.$('#va-search')?.value || '').trim().toLowerCase();
    const fSet  = this.$('#va-filter-setor')?.value || '';
    const fTipo = this.$('#va-filter-tipo')?.value  || '';

    const linhas = this._linhasDoMes(mesAtual);

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
                <div class="cell-person-sub">${this.h(c.setor)}${c.area ? ' · ' + this.h(c.area) : ''}</div>
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
    // Sem a guarda, uma falha ao carregar o Chart.js derrubava o render
    // inteiro — a tabela de valores sumia junto com o gráfico. É a mesma
    // guarda que os outros módulos já tinham.
    if (!ctx || typeof Chart === 'undefined') return;

    const selMes  = this.$('#va-mes');
    const now     = new Date();
    const baseMes = selMes?.value || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [y, m]  = baseMes.split('-').map(Number);
    const meses   = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    // Cada barra é a competência dela, não o cadastro de hoje repetido seis
    // vezes — que era o que o gráfico mostrava: a mesma altura em todos os
    // meses, inclusive nos que já tinham relatório importado.
    const totaisFixo = [];
    const totaisDU   = [];
    meses.forEach(chave => {
      let fx = 0, du = 0;
      this._linhasDoMes(chave).forEach(({ beneficio, total }) => {
        if (!beneficio) return;
        if (beneficio.tipo === 'dia_util') du += total;
        else fx += total;
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
    limparFormulario(form);

    const sel = this.$('#va-form-colab');
    sel.innerHTML = optionsColaboradores(this.COLABORADORES, this.h);

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

  async salvar(ev) {
    ev.preventDefault();
    const form    = this.$('#form-vale-alimentacao');
    const data    = Object.fromEntries(new FormData(form));
    const colabId = parseInt(data.colaborador_id, 10);
    if (!colabId) return;

    const beneficio = {
      tipo:           data.tipo,
      valor:          parseFloat(data.valor) || 0,
      dias_uteis:     data.tipo === 'dia_util' ? (parseInt(data.dias_uteis, 10) || null) : null,
      data_alteracao: data.data_alteracao || new Date().toISOString().slice(0, 10),
      observacoes:    data.observacoes || '',
    };

    try {
      await this._persistir(colabId, beneficio);
    } catch (err) {
      this.showToast('Erro ao salvar: ' + err.message, 'err');
      return;
    }

    this.showToast('Vale alimentação atualizado', 'ok');
    this.fecharModal();
    this.render();
  }

  // Persiste um benefício (no banco quando há sessão) e atualiza o estado
  // em memória. Reutilizado pelo cadastro individual e pela padronização.
  async _persistir(colabId, beneficio) {
    const temSessao = this.ValeAlimentacao && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      const now = new Date();
      const salvo = await this.ValeAlimentacao.upsert({
        colaborador_id: colabId,
        mes:            now.getMonth() + 1,
        ano:            now.getFullYear(),
        valor_mensal:   beneficio.valor,
        tipo:           beneficio.tipo,
        dias_uteis:     beneficio.dias_uteis,
        data_concessao: beneficio.data_alteracao,
        observacoes:    beneficio.observacoes,
        status:         'ativo',
      });
      this.VA_BENEFICIOS[colabId] = { ...beneficio, id: salvo.id };
    } else {
      this.VA_BENEFICIOS[colabId] = { ...beneficio };
    }
  }

  async remover() {
    const colabId = parseInt(this.$('#form-vale-alimentacao').elements['colaborador_id'].value, 10);
    if (!colabId) return;
    if (!confirm('Remover o cadastro de vale alimentação deste colaborador?')) return;

    const benef = this.VA_BENEFICIOS[colabId];
    const temSessao = this.ValeAlimentacao && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao && benef?.id) {
      try {
        await this.ValeAlimentacao.excluir(benef.id);
      } catch (err) {
        this.showToast('Erro ao remover: ' + err.message, 'err');
        return;
      }
    }
    delete this.VA_BENEFICIOS[colabId];
    this.fecharModal();
    this.render();
    this.showToast('Cadastro removido');
  }

  // ─── Padronização por setor ─────────────────────────────────────────────
  // Define o mesmo benefício para todos os colaboradores ativos de um setor.

  abrirModalPadronizar() {
    const form = this.$('#form-va-padronizar');
    if (!form) return;
    limparFormulario(form);

    const setores = [...new Set(
      this.COLABORADORES.filter(c => c.status !== 'inativo').map(c => c.setor).filter(Boolean)
    )].sort();
    const sel = this.$('#va-pad-setor');
    sel.innerHTML = setores.map(s => `<option value="${this.h(s)}">${this.h(s)}</option>`).join('');

    this.$('#va-pad-data').value = new Date().toISOString().slice(0, 10);
    this.alternarTipoPadronizar();
    this._atualizarContagemPadronizar();
    this.$('#modal-va-padronizar').classList.add('active');
  }

  fecharModalPadronizar() {
    this.$('#modal-va-padronizar')?.classList.remove('active');
  }

  alternarTipoPadronizar() {
    const tipo = this.$('#form-va-padronizar')?.elements['tipo']?.value;
    const grupoDias = this.$('#va-pad-dias-group');
    const lbl = this.$('#va-pad-label-valor');
    if (!grupoDias || !lbl) return;
    if (tipo === 'dia_util') {
      grupoDias.style.display = '';
      lbl.textContent = 'Valor por dia (R$)';
    } else {
      grupoDias.style.display = 'none';
      lbl.textContent = 'Valor mensal (R$)';
    }
  }

  _atualizarContagemPadronizar() {
    const setor = this.$('#va-pad-setor')?.value || '';
    const n = this.COLABORADORES.filter(c => c.status !== 'inativo' && c.setor === setor).length;
    const el = this.$('#va-pad-contagem');
    if (el) el.textContent = `${n} colaborador${n !== 1 ? 'es' : ''} no setor`;
  }

  async salvarPadronizar(ev) {
    ev.preventDefault();
    const form = this.$('#form-va-padronizar');
    const data = Object.fromEntries(new FormData(form));
    const setor = data.setor;
    if (!setor) return;

    const beneficio = {
      tipo:           data.tipo,
      valor:          parseFloat(data.valor) || 0,
      dias_uteis:     data.tipo === 'dia_util' ? (parseInt(data.dias_uteis, 10) || null) : null,
      data_alteracao: data.data_alteracao || new Date().toISOString().slice(0, 10),
      observacoes:    data.observacoes || '',
    };

    const alvos = this.COLABORADORES.filter(c => c.status !== 'inativo' && c.setor === setor);
    if (!alvos.length) {
      this.showToast('Nenhum colaborador ativo nesse setor', 'err');
      return;
    }
    if (!confirm(`Aplicar este vale a ${alvos.length} colaborador(es) do setor ${setor}? Os valores individuais existentes serão sobrescritos.`)) return;

    let ok = 0, falhas = 0;
    for (const c of alvos) {
      try {
        await this._persistir(c.id, beneficio);
        ok++;
      } catch (err) {
        falhas++;
        console.error('Falha ao padronizar VA para', c.nome, err);
      }
    }

    this.fecharModalPadronizar();
    this.render();
    this.showToast(
      falhas ? `${ok} aplicados, ${falhas} com erro` : `Vale padronizado para ${ok} colaborador(es)`,
      falhas ? 'err' : 'ok'
    );
  }
}

export default ValeAlimentacaoModule;
