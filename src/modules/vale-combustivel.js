// Vale Combustível Module
// O benefício é um valor fixo mensal por colaborador (padrão configurável).
// Sobre ele entram dois tipos de lançamento: descontos (advertência, falta…)
// e adições (viagem, plantão, reembolso…).

import { optionsColaboradores, competenciaAtual, limparFormulario } from '../utils/ui.js?v=dev';

// Motivos de DESCONTO — tiram do saldo.
const MOTIVOS = {
  advertencia: { t: 'Advertência', cls: 'danger',  cor: '#DC2626' },
  falta:       { t: 'Falta',       cls: 'danger',  cor: '#EA580C' },
  atraso:      { t: 'Atraso',      cls: 'warn',    cor: '#F59E0B' },
  suspensao:   { t: 'Suspensão',   cls: 'danger',  cor: '#991B1B' },
  afastamento: { t: 'Afastamento', cls: 'info',    cor: '#0284C7' },
  outro:       { t: 'Outro',       cls: 'neutral', cor: '#94A3B8' },
};

// Motivos de ADIÇÃO — somam ao saldo.
const MOTIVOS_ADICAO = {
  viagem:    { t: 'Viagem',            cls: 'info', cor: '#0284C7' },
  plantao:   { t: 'Plantão / extra',   cls: 'info', cor: '#0EA5E9' },
  reembolso: { t: 'Reembolso',         cls: 'ok',   cor: '#0F766E' },
  bonus:     { t: 'Bonificação',       cls: 'ok',   cor: '#059669' },
  ajuste:    { t: 'Ajuste / correção', cls: 'neutral', cor: '#64748B' },
  outro:     { t: 'Outro',             cls: 'neutral', cor: '#94A3B8' },
};

/** Tabela de motivos conforme o tipo do lançamento. */
function motivosDe(tipo) {
  return tipo === 'adicao' ? MOTIVOS_ADICAO : MOTIVOS;
}

/** Rótulo e cor de um lançamento, seja desconto ou adição. */
function rotuloMotivo(lanc) {
  const tabela = motivosDe(lanc?.tipo);
  return tabela[lanc?.motivo] || tabela.outro;
}

const VALOR_PADRAO_FALLBACK = 150;

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
    this.VALE_COTAS           = deps.VALE_COTAS;
    this.VALE_COTAS_MES       = deps.VALE_COTAS_MES || {};
    this.VALE_DESCONTOS       = deps.VALE_DESCONTOS || [];
    this.VALE_USO_MES         = deps.VALE_USO_MES || {};
    this.VALE_SALDO_INI       = deps.VALE_SALDO_INI || {};
    this.CONFIG               = deps.CONFIG || {};
    this.CHART_COLORS         = deps.CHART_COLORS;
    this.Auth                 = deps.Auth;
    this.ValeCombustivel      = deps.ValeCombustivel;
    this.ValeDescontos        = deps.ValeDescontos;
    this.Configuracoes        = deps.Configuracoes;
    this.showToast            = deps.showToast;

    this._chartValeEvo    = null;
    this._detalheColabId  = null;
    this._detalheMes      = null;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'vale-search') { clearTimeout(this._searchT); this._searchT = setTimeout(() => this.render(), 250); }
    });
    document.addEventListener('change', (e) => {
      if (e.target.id === 'vale-mes' || e.target.id === 'vale-filter-setor') this.render();
    });
    document.querySelectorAll('.nav-item[data-page="vale-combustivel"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  // ─── Base de cálculo ────────────────────────────────────────────────────────

  _valorPadrao() {
    const v = parseFloat(this.CONFIG['vale_combustivel_valor_padrao']);
    return isNaN(v) ? VALOR_PADRAO_FALLBACK : v;
  }

  // Meses com movimento (valores creditados e/ou descontos) + o mês corrente,
  // que fica sempre disponível mesmo antes de existir qualquer registro.
  _mesesDisponiveis() {
    const meses = new Set([competenciaAtual()]);
    Object.keys(this.VALE_COTAS_MES).forEach(k => meses.add(k.split('|')[1]));
    this.VALE_DESCONTOS.forEach(d => meses.add(this._compet(d)));
    return [...meses].sort().reverse();
  }

  _compet(d) {
    return `${d.ano}-${String(d.mes).padStart(2, '0')}`;
  }

  // Competências que já têm valores gravados.
  _mesesComValor() {
    return new Set(Object.keys(this.VALE_COTAS_MES).map(k => k.split('|')[1]));
  }

  // Valor base do colaborador na competência.
  _baseDe(colabId, mes, mesesComValor = this._mesesComValor()) {
    const doMes = this.VALE_COTAS_MES[`${colabId}|${mes}`];
    if (doMes != null) return parseFloat(doMes) || 0;
    // Competência já fechada: quem não consta nela não recebeu nada.
    if (mesesComValor.has(mes)) return 0;
    // Competência ainda aberta: vale o valor padrão.
    return this._valorPadrao();
  }

  _utilizadoDe(colabId, mes) {
    return parseFloat(this.VALE_USO_MES[`${colabId}|${mes}`]) || 0;
  }

  /** Lançamentos do colaborador na competência, dos dois tipos. */
  _lancamentosDe(colabId, mes) {
    return this.VALE_DESCONTOS.filter(d => d.colaborador_id === colabId && this._compet(d) === mes);
  }

  /** Soma os valores de um tipo. Sem `tipo` gravado, o registro é desconto. */
  _somaPorTipo(lancamentos, tipo) {
    return lancamentos
      .filter(d => (d.tipo || 'desconto') === tipo)
      .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
  }

  // Saldo de abertura fixado manualmente (null = calcular pelo histórico).
  _saldoInicialDe(colabId, mes) {
    const v = this.VALE_SALDO_INI[`${colabId}|${mes}`];
    return v == null ? null : parseFloat(v) || 0;
  }

  // O benefício é acumulativo: o que sobra num mês soma ao crédito do seguinte.
  //   saldo = saldo anterior + crédito + adições − descontos − utilizado
  // Devolve o saldo com que o colaborador ENTRA na competência `mes`. Um saldo
  // de abertura gravado corta o histórico: nada antes dele é somado.
  _saldoAnterior(colabId, mes, mesesComValor = this._mesesComValor()) {
    const fixado = this._saldoInicialDe(colabId, mes);
    if (fixado != null) return Math.max(0, fixado);

    const anteriores = this._mesesDisponiveis().filter(m => m < mes).sort();
    // Recomeça do último mês que tenha saldo de abertura definido.
    let inicio = 0, saldo = 0;
    for (let i = anteriores.length - 1; i >= 0; i--) {
      const ini = this._saldoInicialDe(colabId, anteriores[i]);
      if (ini != null) { inicio = i; saldo = Math.max(0, ini); break; }
    }
    for (let i = inicio; i < anteriores.length; i++) {
      const m = anteriores[i];
      const lancs = this._lancamentosDe(colabId, m);
      const perdido    = this._somaPorTipo(lancs, 'desconto');
      const adicionado = this._somaPorTipo(lancs, 'adicao');
      saldo += this._baseDe(colabId, m, mesesComValor)
             + adicionado - perdido - this._utilizadoDe(colabId, m);
    }
    return Math.max(0, saldo);
  }

  // Base única da competência — usada pela tabela, pelos cards e pelo gráfico.
  _resumoDoMes(mes) {
    const descMes = this.VALE_DESCONTOS.filter(d => this._compet(d) === mes);
    const mesesComValor = this._mesesComValor();

    // Ativos + quem tem valor ou lançamento no mês (inclui desligados, para que
    // competências passadas fechem com o que foi realmente pago).
    const pessoas = this.COLABORADORES.filter(c =>
      c.status !== 'inativo'
      || this.VALE_COTAS_MES[`${c.id}|${mes}`] != null
      || descMes.some(d => d.colaborador_id === c.id));

    return pessoas.map(c => {
      const lancamentos = descMes.filter(d => d.colaborador_id === c.id);
      const perdido     = this._somaPorTipo(lancamentos, 'desconto');
      const adicionado  = this._somaPorTipo(lancamentos, 'adicao');
      const credito   = c.status === 'inativo' && this.VALE_COTAS_MES[`${c.id}|${mes}`] == null
        ? 0
        : this._baseDe(c.id, mes, mesesComValor);
      const anterior  = this._saldoAnterior(c.id, mes, mesesComValor);
      const utilizado = this._utilizadoDe(c.id, mes);
      const saldo     = Math.max(0, anterior + credito + adicionado - perdido - utilizado);
      // Disponível = tudo que ele podia gastar no mês (antes do consumo).
      const disponivel = Math.max(0, anterior + credito + adicionado - perdido);
      return {
        colab: c, lancamentos, descontos: lancamentos,
        anterior, credito, adicionado, perdido, utilizado, disponivel, saldo,
      };
    });
  }

  // ─── Tela ───────────────────────────────────────────────────────────────────

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

    const resumo = this._resumoDoMes(mesAtual);

    const filtrados = resumo.filter(r => {
      if (fSet && r.colab.setor !== fSet) return false;
      if (q && !r.colab.nome.toLowerCase().includes(q)) return false;
      return true;
    });

    const creditoMes   = resumo.reduce((s, r) => s + r.credito, 0);
    const perdidoMes   = resumo.reduce((s, r) => s + r.perdido, 0);
    const adicionadoMes = resumo.reduce((s, r) => s + r.adicionado, 0);
    const utilizadoMes = resumo.reduce((s, r) => s + r.utilizado, 0);
    const saldoMes     = resumo.reduce((s, r) => s + r.saldo, 0);

    const set = (sel, val) => { const el = this.$(sel); if (el) el.textContent = val; };
    set('#vale-stat-base',      this.fmtBRL(creditoMes));
    set('#vale-stat-perdido',   this.fmtBRL(perdidoMes));
    set('#vale-stat-adicionado', this.fmtBRL(adicionadoMes));
    set('#vale-stat-utilizado', this.fmtBRL(utilizadoMes));
    set('#vale-stat-saldo',     this.fmtBRL(saldoMes));

    const tb = this.$('#tb-vale-resumo');
    if (tb) {
      const lista = filtrados.sort((a, b) => {
        // Quem teve desconto primeiro — é o que precisa de conferência.
        if (a.perdido !== b.perdido) return b.perdido - a.perdido;
        // Depois quem recebe o benefício; quem não recebe nada vai para o fim.
        const ma = (a.credito > 0 || a.anterior > 0) ? 0 : 1;
        const mb = (b.credito > 0 || b.anterior > 0) ? 0 : 1;
        if (ma !== mb) return ma - mb;
        return a.colab.nome.localeCompare(b.colab.nome);
      });

      tb.innerHTML = lista.length ? lista.map(r => {
        const c = r.colab;
        const statusBadge = r.credito === 0 && r.anterior === 0 && r.adicionado === 0
          ? `<span class="badge neutral">Sem benefício</span>`
          : r.disponivel === 0
            ? `<span class="badge danger">Perdeu tudo</span>`
            : r.perdido > 0
              ? `<span class="badge warn">Parcial</span>`
              : r.adicionado > 0
                ? `<span class="badge ok">Com adição</span>`
                : `<span class="badge ok">Integral</span>`;
        return `
          <tr onclick="abrirModalValeDetalhe(${c.id}, '${mesAtual}')">
            <td>
              <div class="cell-person">
                <div class="cell-avatar">${this.h(this.iniciais(c.nome))}</div>
                <div>
                  <div class="cell-person-name">${this.h(c.nome)}${c.status === 'inativo' ? ' <span class="badge neutral" style="font-size:.62rem;">inativo</span>' : ''}</div>
                  <div class="cell-person-sub">${this.h(c.setor)}${c.area ? ' · ' + this.h(c.area) : ''}</div>
                </div>
              </div>
            </td>
            <td class="cell-mono" style="text-align:right; color:var(--text-muted)">${this.fmtBRL(r.anterior)}</td>
            <td class="cell-mono" style="text-align:right">
              ${this.fmtBRL(r.credito)}
              ${r.adicionado > 0
                ? `<div style="font-size:.72rem; color:var(--success); font-weight:600;">+ ${this.fmtBRL(r.adicionado)}</div>`
                : ''}
            </td>
            <td>${statusBadge}</td>
          </tr>
        `;
      }).join('') : `<tr><td colspan="4" class="empty">Sem dados para ${this.mesLabel(mesAtual)}</td></tr>`;
    }

    this._renderEvolucao();
  }

  // Gráfico: quanto foi perdido em descontos por mês, separado por motivo.
  _renderEvolucao() {
    const ctx = this.$('#chart-vale-evolucao');
    if (!ctx || typeof Chart === 'undefined') return;

    const meses = this._mesesDisponiveis().slice(0, 6).reverse();
    const motivos = Object.keys(MOTIVOS);

    const porMotivo = motivos.map(mot => ({
      label: MOTIVOS[mot].t,
      data: meses.map(m => this.VALE_DESCONTOS
        .filter(d => this._compet(d) === m && d.motivo === mot
                  && (d.tipo || 'desconto') === 'desconto')
        .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0)),
      backgroundColor: MOTIVOS[mot].cor,
      stack: 'd',
      borderRadius: 3,
    }));

    // Motivo sem nenhum valor no período não polui a legenda.
    const datasets = porMotivo.filter(ds => ds.data.some(v => v > 0));

    this._chartValeEvo?.destroy();
    this._chartValeEvo = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: meses.map(m => this.mesLabel(m)),
        datasets: datasets.length ? datasets : [{
          label: 'Sem descontos', data: meses.map(() => 0),
          backgroundColor: '#CBD5E1', stack: 'd', borderRadius: 3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${this.fmtBRL(c.parsed.y)}` } },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: this.CHART_COLORS.grid }, ticks: { callback: v => 'R$ ' + v } },
        },
      },
    });
  }

  // ─── Descontos ──────────────────────────────────────────────────────────────

  /**
   * Abre o modal de lançamento. `tipo` decide o sinal e a lista de motivos —
   * é o mesmo formulário porque é o mesmo registro: valor, motivo, competência.
   */
  abrirModalDesconto(id = null, preColabId = null, tipo = 'desconto') {
    const form = this.$('#form-vale-desconto');
    limparFormulario(form);
    this.$('#form-vdesc-colab').innerHTML = optionsColaboradores(this.COLABORADORES, this.h);

    const mes = this.$('#vale-mes')?.value || competenciaAtual();
    this.$('#vdesc-competencia').textContent = this.mesLabel(mes);
    form.elements['competencia'].value = mes;

    let editando = null;
    if (id != null) editando = this.VALE_DESCONTOS.find(x => x.id === id) || null;

    const tipoFinal = editando ? (editando.tipo || 'desconto') : tipo;
    form.elements['tipo'].value = tipoFinal;
    this.atualizarCamposLancamento();

    if (editando) {
      this.$('#modal-vale-desconto-title').textContent =
        tipoFinal === 'adicao' ? 'Editar adição' : 'Editar desconto';
      form.elements['id'].value = editando.id;
      form.elements['colaborador_id'].value = editando.colaborador_id;
      form.elements['motivo'].value = editando.motivo;
      form.elements['valor'].value = editando.valor;
      form.elements['data_ocorrencia'].value = editando.data_ocorrencia || '';
      form.elements['observacoes'].value = editando.observacoes || '';
      const c = this._compet(editando);
      form.elements['competencia'].value = c;
      this.$('#vdesc-competencia').textContent = this.mesLabel(c);
    } else {
      if (preColabId != null) form.elements['colaborador_id'].value = preColabId;
      form.elements['data_ocorrencia'].value = new Date().toISOString().slice(0, 10);
    }

    this.$('#modal-vale-desconto').classList.add('active');
  }

  /**
   * Ajusta o modal ao tipo escolhido: título, lista de motivos e rótulo do
   * valor. Sem isto, "Advertência" apareceria como opção de adição.
   */
  atualizarCamposLancamento() {
    const form = this.$('#form-vale-desconto');
    if (!form) return;
    const tipo = form.elements['tipo'].value || 'desconto';
    const adicao = tipo === 'adicao';
    const editando = !!form.elements['id'].value;

    const titulo = this.$('#modal-vale-desconto-title');
    if (titulo) {
      titulo.textContent = editando
        ? (adicao ? 'Editar adição' : 'Editar desconto')
        : (adicao ? 'Lançar adição' : 'Lançar desconto');
    }

    const lbl = this.$('#vdesc-lbl-valor');
    if (lbl) lbl.textContent = adicao ? 'Valor a acrescentar (R$)' : 'Valor descontado (R$)';

    const sel = form.elements['motivo'];
    const atual = sel.value;
    const tabela = motivosDe(tipo);
    sel.innerHTML = Object.entries(tabela)
      .map(([k, v]) => `<option value="${k}">${this.h(v.t)}</option>`).join('');
    if (tabela[atual]) sel.value = atual;

    const box = this.$('#modal-vale-desconto')?.querySelector('.modal-box');
    if (box) box.classList.toggle('lanc-adicao', adicao);
  }

  fecharModalDesconto() {
    this.$('#modal-vale-desconto').classList.remove('active');
  }

  async salvarDesconto(ev) {
    ev.preventDefault();
    const form = this.$('#form-vale-desconto');
    const data = Object.fromEntries(new FormData(form));
    const id = data.id ? parseInt(data.id, 10) : null;

    if (!data.colaborador_id) { this.showToast('Selecione um colaborador', 'err'); return; }
    const tipo = data.tipo === 'adicao' ? 'adicao' : 'desconto';
    if (!motivosDe(tipo)[data.motivo]) { this.showToast('Selecione o motivo', 'err'); return; }
    const valor = parseFloat(data.valor);
    if (isNaN(valor) || valor <= 0) { this.showToast('Informe um valor maior que zero', 'err'); return; }

    const [ano, mes] = (data.competencia || competenciaAtual()).split('-');
    const payload = {
      colaborador_id:  parseInt(data.colaborador_id, 10),
      mes:             parseInt(mes, 10),
      ano:             parseInt(ano, 10),
      tipo,
      motivo:          data.motivo,
      valor,
      data_ocorrencia: data.data_ocorrencia || null,
      observacoes:     (data.observacoes || '').trim() || null,
    };

    const temSessao = this.ValeDescontos && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        const saved = id != null
          ? await this.ValeDescontos.atualizar(id, payload)
          : await this.ValeDescontos.criar(payload);
        if (saved) {
          const i = this.VALE_DESCONTOS.findIndex(x => x.id === saved.id);
          if (i >= 0) this.VALE_DESCONTOS[i] = saved;
          else this.VALE_DESCONTOS.unshift(saved);
        }
      } catch (err) {
        this.showToast('Erro ao salvar desconto: ' + err.message, 'err');
        return;
      }
    } else {
      if (id != null) {
        const i = this.VALE_DESCONTOS.findIndex(x => x.id === id);
        if (i >= 0) this.VALE_DESCONTOS[i] = { ...this.VALE_DESCONTOS[i], ...payload };
      } else {
        const novoId = Math.max(0, ...this.VALE_DESCONTOS.map(x => x.id)) + 1;
        this.VALE_DESCONTOS.unshift({ id: novoId, ...payload });
      }
    }

    this.fecharModalDesconto();
    this.showToast(tipo === 'adicao' ? 'Adição lançada' : 'Desconto lançado', 'ok');
    this.render();
    if (this._detalheColabId != null) this._renderDetalhe(this._detalheColabId, this._detalheMes);
  }

  async excluirDesconto(id) {
    const alvo = this.VALE_DESCONTOS.find(x => x.id === id);
    const oQue = (alvo?.tipo === 'adicao') ? 'esta adição' : 'este desconto';
    if (!confirm(`Excluir ${oQue}?`)) return;
    const temSessao = this.ValeDescontos && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try { await this.ValeDescontos.excluir(id); }
      catch (err) { this.showToast('Erro ao excluir: ' + err.message, 'err'); return; }
    }
    const i = this.VALE_DESCONTOS.findIndex(x => x.id === id);
    if (i >= 0) this.VALE_DESCONTOS.splice(i, 1);
    this.showToast('Lançamento excluído');
    this.render();
    if (this._detalheColabId != null) this._renderDetalhe(this._detalheColabId, this._detalheMes);
  }

  // ─── Detalhe do colaborador no mês ──────────────────────────────────────────

  abrirModalDetalhe(colabId, mes) {
    this._detalheColabId = colabId;
    this._detalheMes     = mes;
    this._renderDetalhe(colabId, mes);
    this.$('#btn-vale-det-novo').onclick = () => this.abrirModalDesconto(null, colabId, 'desconto');
    const btnAdd = this.$('#btn-vale-det-adicao');
    if (btnAdd) btnAdd.onclick = () => this.abrirModalDesconto(null, colabId, 'adicao');
    this.$('#modal-vale-detalhe').classList.add('active');
  }

  _renderDetalhe(colabId, mes) {
    const c = this.COLABORADORES.find(x => x.id === colabId);
    if (!c) return;
    const lancamentos = this._lancamentosDe(colabId, mes)
      .sort((a, b) => (a.data_ocorrencia || '').localeCompare(b.data_ocorrencia || ''));
    const perdido    = this._somaPorTipo(lancamentos, 'desconto');
    const adicionado = this._somaPorTipo(lancamentos, 'adicao');
    const anterior   = this._saldoAnterior(colabId, mes);
    const credito    = this._baseDe(colabId, mes);
    const utilizado  = this._utilizadoDe(colabId, mes);
    const saldo      = Math.max(0, anterior + credito + adicionado - perdido - utilizado);

    this.$('#vale-det-title').textContent = `${c.nome} — ${this.mesLabel(mes)}`;
    this.$('#vale-det-summary').innerHTML = `
      <div class="info-item"><div class="info-label">Saldo anterior</div><div class="info-value mono">${this.fmtBRL(anterior)}</div></div>
      <div class="info-item"><div class="info-label">Crédito do mês</div><div class="info-value mono">+ ${this.fmtBRL(credito)}</div></div>
      <div class="info-item"><div class="info-label">Adições</div><div class="info-value mono" style="${adicionado > 0 ? 'color:var(--success);font-weight:700' : ''}">+ ${this.fmtBRL(adicionado)}</div></div>
      <div class="info-item"><div class="info-label">Descontos</div><div class="info-value mono" style="${perdido > 0 ? 'color:var(--danger);font-weight:700' : ''}">− ${this.fmtBRL(perdido)}</div></div>
      <div class="info-item"><div class="info-label">Utilizado</div><div class="info-value mono">− ${this.fmtBRL(utilizado)}</div></div>
      <div class="info-item" style="grid-column:1/-1"><div class="info-label">Saldo acumulado (vai para o próximo mês)</div><div class="info-value mono" style="font-weight:700; color:var(--success); font-size:1.05rem;">${this.fmtBRL(saldo)}</div></div>
    `;

    const tb = this.$('#tb-vale-detalhe');
    tb.innerHTML = lancamentos.length ? lancamentos.map(d => {
      const m = rotuloMotivo(d);
      const adicao = (d.tipo || 'desconto') === 'adicao';
      const cor = adicao ? 'var(--success)' : 'var(--danger)';
      return `
        <tr>
          <td class="cell-mono">${d.data_ocorrencia ? this.fmtDate(d.data_ocorrencia) : '—'}</td>
          <td>
            <span class="badge ${m.cls}">${m.t}</span>
            <div class="cell-person-sub">${adicao ? 'adição' : 'desconto'}</div>
          </td>
          <td class="cell-mono" style="text-align:right; color:${cor}; font-weight:700;">${adicao ? '+' : '−'} ${this.fmtBRL(d.valor)}</td>
          <td>${this.h(d.observacoes || '—')}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalValeDesconto(${d.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirValeDesconto(${d.id})">🗑</button>
          </td>
        </tr>`;
    }).join('') : `<tr><td colspan="5" class="empty">Nenhum lançamento neste mês — benefício integral</td></tr>`;
  }

  fecharModalDetalhe() {
    this.$('#modal-vale-detalhe').classList.remove('active');
    this._detalheColabId = null;
    this._detalheMes     = null;
  }

  // ─── Valores do benefício ───────────────────────────────────────────────────

  abrirModalCotas() {
    const mes = this.$('#vale-mes')?.value || competenciaAtual();
    this._cotasMes = mes;
    this.$('#vale-cota-competencia').textContent = this.mesLabel(mes);

    const padraoInput = this.$('#vale-valor-padrao');
    if (padraoInput) padraoInput.value = this._valorPadrao();

    const mesesComValor = this._mesesComValor();
    const ativos = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome));
    // Desligados só aparecem se já tiverem valor gravado nessa competência.
    const inativos = this.COLABORADORES
      .filter(c => c.status === 'inativo' && this.VALE_COTAS_MES[`${c.id}|${mes}`] != null)
      .sort((a, b) => a.nome.localeCompare(b.nome));

    const linha = (c, inativo = false) => `
        <tr data-setor="${this.h(c.setor || '')}"${inativo ? ' style="opacity:.72"' : ''}>
          <td>${this.h(c.nome)}${inativo ? ' <span class="badge neutral" style="font-size:.62rem;">inativo</span>' : ''}</td>
          <td>${this.h(c.setor)}</td>
          <td style="text-align:right">
            <input type="number" step="0.01" min="0" value="${this._saldoAnterior(c.id, mes, mesesComValor)}"
                   data-saldo="${c.id}"
                   style="width:110px; text-align:right; background:var(--bluish-bg); border:1px solid var(--border); border-radius:6px; padding:6px 10px; font-family:var(--mono); font-size:.85rem;">
          </td>
          <td style="text-align:right">
            <input type="number" step="0.01" min="0" value="${this._baseDe(c.id, mes, mesesComValor)}"
                   id="cota-input-${c.id}" data-colab="${c.id}"
                   style="width:110px; text-align:right; background:var(--bluish-bg); border:1px solid var(--border); border-radius:6px; padding:6px 10px; font-family:var(--mono); font-size:.85rem;">
          </td>
          <td style="text-align:right">
            <input type="number" step="0.01" min="0" value="${this._utilizadoDe(c.id, mes)}"
                   data-uso="${c.id}"
                   style="width:110px; text-align:right; background:var(--bluish-bg); border:1px solid var(--border); border-radius:6px; padding:6px 10px; font-family:var(--mono); font-size:.85rem;">
          </td>
        </tr>`;

    this.$('#tb-vale-cotas').innerHTML =
      ativos.map(c => linha(c)).join('') + inativos.map(c => linha(c, true)).join('');

    const setores = [...new Set(ativos.map(c => c.setor).filter(Boolean))].sort();
    const sel = this.$('#vale-cota-pad-setor');
    if (sel) sel.innerHTML = setores.map(s => `<option value="${this.h(s)}">${this.h(s)}</option>`).join('');

    this.$('#modal-vale-cotas').classList.add('active');
  }

  // Aplica o valor informado a todos os colaboradores do setor escolhido.
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

  // Preenche todos os campos com o valor padrão.
  aplicarValorPadraoTodos() {
    const valor = parseFloat(this.$('#vale-valor-padrao')?.value);
    if (isNaN(valor) || valor < 0) { this.showToast('Informe um valor válido', 'err'); return; }
    const inputs = this.$('#tb-vale-cotas').querySelectorAll('input[data-colab]');
    inputs.forEach(i => { i.value = valor; });
    this.showToast(`Valor padrão aplicado a ${inputs.length} colaborador(es)`, 'ok');
  }

  // Grava a competência inteira: o mês passa a ter o conjunto completo de
  // valores, então ninguém fica herdando o padrão por engano.
  async salvarCotas() {
    const mes = this._cotasMes || competenciaAtual();
    const [ano, mesNum] = mes.split('-').map(n => parseInt(n, 10));
    const hoje = new Date().toISOString().slice(0, 10);

    const tb = this.$('#tb-vale-cotas');
    const linhas = [...tb.querySelectorAll('input[data-colab]')].map(input => {
      const colabId = parseInt(input.dataset.colab, 10);
      const uso   = tb.querySelector(`input[data-uso="${colabId}"]`);
      const saldo = tb.querySelector(`input[data-saldo="${colabId}"]`);
      return {
        colaborador_id: colabId,
        mes:            mesNum,
        ano,
        valor_mensal:   parseFloat(input.value) || 0,
        utilizado:      parseFloat(uso?.value) || 0,
        saldo_inicial:  parseFloat(saldo?.value) || 0,
        data_concessao: hoje,
        status:         'ativo',
      };
    });

    const padrao = parseFloat(this.$('#vale-valor-padrao')?.value);
    const padraoMudou = !isNaN(padrao) && padrao >= 0 && padrao !== this._valorPadrao();

    const temSessao = this.ValeCombustivel && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.ValeCombustivel.upsertCotasEmLote(linhas);
        if (padraoMudou) await this.Configuracoes.definir('vale_combustivel_valor_padrao', padrao);
      } catch (err) {
        this.showToast('Erro ao salvar valores: ' + err.message, 'err');
        return;
      }
    }

    // Estado local
    linhas.forEach(l => {
      this.VALE_COTAS_MES[`${l.colaborador_id}|${mes}`] = l.valor_mensal;
      this.VALE_USO_MES[`${l.colaborador_id}|${mes}`]   = l.utilizado;
      this.VALE_SALDO_INI[`${l.colaborador_id}|${mes}`] = l.saldo_inicial;
      this.VALE_COTAS[l.colaborador_id] = l.valor_mensal;
    });
    if (padraoMudou) this.CONFIG['vale_combustivel_valor_padrao'] = String(padrao);

    this.fecharModalCotas();
    this.render();
    this.showToast(`Valores de ${this.mesLabel(mes)} salvos`, 'ok');
  }

  fecharModalCotas() {
    this.$('#modal-vale-cotas').classList.remove('active');
  }
}

export default ValeCombustivelModule;
