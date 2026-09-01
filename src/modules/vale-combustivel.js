// Vale Combustível Module
// O benefício é um valor fixo mensal por colaborador (padrão configurável).
// Do valor base descontam-se ocorrências — advertência, falta, atraso, etc. —
// e a tela mostra quanto cada um recebe e quanto foi perdido em descontos.

import { optionsColaboradores, competenciaAtual, limparFormulario } from '../utils/ui.js?v=dev';

const MOTIVOS = {
  advertencia: { t: 'Advertência', cls: 'danger',  cor: '#DC2626' },
  falta:       { t: 'Falta',       cls: 'danger',  cor: '#EA580C' },
  atraso:      { t: 'Atraso',      cls: 'warn',    cor: '#F59E0B' },
  suspensao:   { t: 'Suspensão',   cls: 'danger',  cor: '#991B1B' },
  afastamento: { t: 'Afastamento', cls: 'info',    cor: '#0284C7' },
  outro:       { t: 'Outro',       cls: 'neutral', cor: '#94A3B8' },
};

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

  _descontosDe(colabId, mes) {
    return this.VALE_DESCONTOS.filter(d => d.colaborador_id === colabId && this._compet(d) === mes);
  }

  // Saldo de abertura fixado manualmente (null = calcular pelo histórico).
  _saldoInicialDe(colabId, mes) {
    const v = this.VALE_SALDO_INI[`${colabId}|${mes}`];
    return v == null ? null : parseFloat(v) || 0;
  }

  // O benefício é acumulativo: o que sobra num mês soma ao crédito do seguinte.
  //   saldo do mês = saldo anterior + crédito − descontos − utilizado
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
      const perdido = this._descontosDe(colabId, m).reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
      saldo += this._baseDe(colabId, m, mesesComValor) - perdido - this._utilizadoDe(colabId, m);
    }
    return Math.max(0, saldo);
  }

  // Base única da competência — usada pela tabela, pelos cards e pelo gráfico.
  _resumoDoMes(mes) {
    const descMes = this.VALE_DESCONTOS.filter(d => this._compet(d) === mes);
    const mesesComValor = this._mesesComValor();

    // Ativos + quem tem valor ou desconto no mês (inclui desligados, para que
    // competências passadas fechem com o que foi realmente pago).
    const pessoas = this.COLABORADORES.filter(c =>
      c.status !== 'inativo'
      || this.VALE_COTAS_MES[`${c.id}|${mes}`] != null
      || descMes.some(d => d.colaborador_id === c.id));

    return pessoas.map(c => {
      const descontos = descMes.filter(d => d.colaborador_id === c.id);
      const perdido   = descontos.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
      const credito   = c.status === 'inativo' && this.VALE_COTAS_MES[`${c.id}|${mes}`] == null
        ? 0
        : this._baseDe(c.id, mes, mesesComValor);
      const anterior  = this._saldoAnterior(c.id, mes, mesesComValor);
      const utilizado = this._utilizadoDe(c.id, mes);
      const saldo     = Math.max(0, anterior + credito - perdido - utilizado);
      // Disponível = tudo que ele podia gastar no mês (antes do consumo).
      const disponivel = Math.max(0, anterior + credito - perdido);
      return { colab: c, descontos, anterior, credito, perdido, utilizado, disponivel, saldo };
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
    const utilizadoMes = resumo.reduce((s, r) => s + r.utilizado, 0);
    const saldoMes     = resumo.reduce((s, r) => s + r.saldo, 0);

    const set = (sel, val) => { const el = this.$(sel); if (el) el.textContent = val; };
    set('#vale-stat-base',      this.fmtBRL(creditoMes));
    set('#vale-stat-perdido',   this.fmtBRL(perdidoMes));
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
        const statusBadge = r.credito === 0 && r.anterior === 0
          ? `<span class="badge neutral">Sem benefício</span>`
          : r.perdido === 0
            ? `<span class="badge ok">Integral</span>`
            : r.disponivel === 0
              ? `<span class="badge danger">Perdeu tudo</span>`
              : `<span class="badge warn">Parcial</span>`;
        const perdStyle = r.perdido > 0 ? 'color:var(--danger); font-weight:700;' : 'color:var(--text-soft);';
        const tags = r.descontos.length
          ? `<div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:3px;">` +
            r.descontos.map(d => {
              const m = MOTIVOS[d.motivo] || MOTIVOS.outro;
              return `<span class="badge ${m.cls}" style="font-size:.6rem;">${m.t}</span>`;
            }).join('') + `</div>`
          : '';
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
            <td class="cell-mono" style="text-align:right">${this.fmtBRL(r.credito)}</td>
            <td style="text-align:right">
              <div class="cell-mono" style="${perdStyle}">${r.perdido > 0 ? '− ' : ''}${this.fmtBRL(r.perdido)}</div>
              ${tags}
            </td>
            <td class="cell-mono" style="text-align:right; ${r.utilizado > 0 ? '' : 'color:var(--text-soft);'}">${r.utilizado > 0 ? '− ' : ''}${this.fmtBRL(r.utilizado)}</td>
            <td class="cell-mono" style="text-align:right; font-weight:700; color:var(--success);">${this.fmtBRL(r.saldo)}</td>
            <td>${statusBadge}</td>
            <td class="actions" onclick="event.stopPropagation()">
              <button class="btn btn-ghost btn-sm btn-icon" title="Lançar desconto" onclick="abrirModalValeDesconto(null, ${c.id})">−</button>
            </td>
          </tr>
        `;
      }).join('') : `<tr><td colspan="8" class="empty">Sem dados para ${this.mesLabel(mesAtual)}</td></tr>`;
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
        .filter(d => this._compet(d) === m && d.motivo === mot)
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

  abrirModalDesconto(id = null, preColabId = null) {
    const form = this.$('#form-vale-desconto');
    limparFormulario(form);
    this.$('#form-vdesc-colab').innerHTML = optionsColaboradores(this.COLABORADORES, this.h);

    const mes = this.$('#vale-mes')?.value || competenciaAtual();
    this.$('#vdesc-competencia').textContent = this.mesLabel(mes);
    form.elements['competencia'].value = mes;

    if (id != null) {
      const d = this.VALE_DESCONTOS.find(x => x.id === id);
      if (d) {
        this.$('#modal-vale-desconto-title').textContent = 'Editar desconto';
        form.elements['id'].value = d.id;
        form.elements['colaborador_id'].value = d.colaborador_id;
        form.elements['motivo'].value = d.motivo;
        form.elements['valor'].value = d.valor;
        form.elements['data_ocorrencia'].value = d.data_ocorrencia || '';
        form.elements['observacoes'].value = d.observacoes || '';
        const c = this._compet(d);
        form.elements['competencia'].value = c;
        this.$('#vdesc-competencia').textContent = this.mesLabel(c);
      }
    } else {
      this.$('#modal-vale-desconto-title').textContent = 'Lançar desconto';
      if (preColabId != null) form.elements['colaborador_id'].value = preColabId;
      form.elements['data_ocorrencia'].value = new Date().toISOString().slice(0, 10);
    }

    this.$('#modal-vale-desconto').classList.add('active');
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
    if (!MOTIVOS[data.motivo])  { this.showToast('Selecione o motivo', 'err'); return; }
    const valor = parseFloat(data.valor);
    if (isNaN(valor) || valor <= 0) { this.showToast('Informe um valor maior que zero', 'err'); return; }

    const [ano, mes] = (data.competencia || competenciaAtual()).split('-');
    const payload = {
      colaborador_id:  parseInt(data.colaborador_id, 10),
      mes:             parseInt(mes, 10),
      ano:             parseInt(ano, 10),
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
    this.showToast('Desconto salvo', 'ok');
    this.render();
    if (this._detalheColabId != null) this._renderDetalhe(this._detalheColabId, this._detalheMes);
  }

  async excluirDesconto(id) {
    if (!confirm('Excluir este desconto?')) return;
    const temSessao = this.ValeDescontos && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try { await this.ValeDescontos.excluir(id); }
      catch (err) { this.showToast('Erro ao excluir: ' + err.message, 'err'); return; }
    }
    const i = this.VALE_DESCONTOS.findIndex(x => x.id === id);
    if (i >= 0) this.VALE_DESCONTOS.splice(i, 1);
    this.showToast('Desconto excluído');
    this.render();
    if (this._detalheColabId != null) this._renderDetalhe(this._detalheColabId, this._detalheMes);
  }

  // ─── Detalhe do colaborador no mês ──────────────────────────────────────────

  abrirModalDetalhe(colabId, mes) {
    this._detalheColabId = colabId;
    this._detalheMes     = mes;
    this._renderDetalhe(colabId, mes);
    this.$('#btn-vale-det-novo').onclick = () => this.abrirModalDesconto(null, colabId);
    this.$('#modal-vale-detalhe').classList.add('active');
  }

  _renderDetalhe(colabId, mes) {
    const c = this.COLABORADORES.find(x => x.id === colabId);
    if (!c) return;
    const descontos = this.VALE_DESCONTOS
      .filter(d => d.colaborador_id === colabId && this._compet(d) === mes)
      .sort((a, b) => (a.data_ocorrencia || '').localeCompare(b.data_ocorrencia || ''));
    const perdido   = descontos.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const anterior  = this._saldoAnterior(colabId, mes);
    const credito   = this._baseDe(colabId, mes);
    const utilizado = this._utilizadoDe(colabId, mes);
    const saldo     = Math.max(0, anterior + credito - perdido - utilizado);

    this.$('#vale-det-title').textContent = `${c.nome} — ${this.mesLabel(mes)}`;
    this.$('#vale-det-summary').innerHTML = `
      <div class="info-item"><div class="info-label">Saldo anterior</div><div class="info-value mono">${this.fmtBRL(anterior)}</div></div>
      <div class="info-item"><div class="info-label">Crédito do mês</div><div class="info-value mono">+ ${this.fmtBRL(credito)}</div></div>
      <div class="info-item"><div class="info-label">Descontos</div><div class="info-value mono" style="${perdido > 0 ? 'color:var(--danger);font-weight:700' : ''}">− ${this.fmtBRL(perdido)}</div></div>
      <div class="info-item"><div class="info-label">Utilizado</div><div class="info-value mono">− ${this.fmtBRL(utilizado)}</div></div>
      <div class="info-item" style="grid-column:1/-1"><div class="info-label">Saldo acumulado (vai para o próximo mês)</div><div class="info-value mono" style="font-weight:700; color:var(--success); font-size:1.05rem;">${this.fmtBRL(saldo)}</div></div>
    `;

    const tb = this.$('#tb-vale-detalhe');
    tb.innerHTML = descontos.length ? descontos.map(d => {
      const m = MOTIVOS[d.motivo] || MOTIVOS.outro;
      return `
        <tr>
          <td class="cell-mono">${d.data_ocorrencia ? this.fmtDate(d.data_ocorrencia) : '—'}</td>
          <td><span class="badge ${m.cls}">${m.t}</span></td>
          <td class="cell-mono" style="text-align:right; color:var(--danger); font-weight:700;">− ${this.fmtBRL(d.valor)}</td>
          <td>${this.h(d.observacoes || '—')}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalValeDesconto(${d.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirValeDesconto(${d.id})">🗑</button>
          </td>
        </tr>`;
    }).join('') : `<tr><td colspan="5" class="empty">Nenhum desconto neste mês — benefício integral</td></tr>`;
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
