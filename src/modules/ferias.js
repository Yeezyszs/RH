// Férias Module
// Gerencia renderização, timeline, cálculos e modal de agendamento de férias (CLT)

import { limparFormulario } from '../utils/ui.js?v=dev';

export class FeriasModule {
  constructor(deps) {
    this.Ferias = deps.Ferias;
    this.Colaboradores = deps.Colaboradores;
    this.$ = deps.$;
    this.h = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate = deps.fmtDate;
    this.fmtBRL = deps.fmtBRL;
    this.FERIAS = deps.FERIAS;
    this.COLABORADORES = deps.COLABORADORES;
    this.SALARIOS = deps.SALARIOS;
    this.Auth = deps.Auth;

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'fer-search') { clearTimeout(this._searchT); this._searchT = setTimeout(() => this.render(), 250); }
    });

    document.addEventListener('change', (e) => {
      if (['fer-filter-setor', 'fer-filter-status'].includes(e.target.id)) this.render();
    });

    // Atalhos de duração (30/20/15/10). Delegação interna: só preenchem o
    // campo de dias, então não precisam virar função global.
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-fer-dias]');
      if (!chip) return;
      const f = this.$('#form-ferias-periodo');
      if (!f) return;
      f.elements['dias'].value = chip.dataset.ferDias;
      this.atualizarPrevia();
    });

    document.querySelectorAll('.nav-item[data-page="ferias"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  // ─── Lista + timeline ─────────────────────────────────────────────────────

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
      const periodos = this.FERIAS.filter(f => f.colaborador_id === c.id);
      const diasUsados = periodos.reduce((s, p) => s + (p.dias + (p.abono || 0)), 0);
      // Ciclo mais antigo ainda em aberto — é dele que sai o prazo real.
      // Usar o ciclo corrente aqui tornava o status "Vencido" inalcançável.
      const aq = this._cicloEmAberto(c.admissao, diasUsados)
              || this._periodoAquisitivoAtual(c.admissao);
      const saldo = this._cicloEmAberto(c.admissao, diasUsados)?.saldo ?? 0;

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
                <div class="cell-person-sub">${this.h(c.setor)}${c.area ? ' · ' + this.h(c.area) : ''}</div>
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

  // ─── Modal de agendamento ─────────────────────────────────────────────────

  abrirModalFerias(colabId = null) {
    const sel = this.$('#fer-select-colab');
    sel.innerHTML = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => `<option value="${c.id}">${this.h(c.nome)} — ${this.h(c.setor)}</option>`).join('');
    if (colabId) sel.value = colabId;
    this.renderFeriasModal();
    this.$('#modal-ferias').classList.add('active');
  }

  fecharModalFerias() {
    this.$('#modal-ferias').classList.remove('active');
  }

  renderFeriasModal() {
    const sel = this.$('#fer-select-colab');
    const colabId = parseInt(sel.value, 10);
    const c = this.COLABORADORES.find(x => x.id === colabId);
    if (!c) return;

    this.$('#fer-modal-title').textContent = `Férias — ${c.nome}`;
    this.$('#form-ferias-periodo').elements['colaborador_id'].value = c.id;

    const sit = this._situacaoFerias(c);

    // Banner: a resposta prática, antes de qualquer detalhe.
    this.$('#fer-situacao').innerHTML = `
      <div class="fer-banner fer-${sit.cls}">
        <div class="fer-banner-topo">
          <span class="fer-banner-titulo">${this.h(sit.titulo)}</span>
          ${sit.aquisitivo && sit.tipo !== 'sem_direito'
            ? `<span class="fer-saldo">${sit.saldo}<span>/30 dias</span></span>` : ''}
        </div>
        <div class="fer-banner-detalhe">${this.h(sit.detalhe)}</div>
      </div>`;

    // Contexto: o detalhe legal e o financeiro, discretos. O bloco de dinheiro
    // só aparece quando há salário — antes eram quatro campos com "—".
    const sal = parseFloat(this.SALARIOS[c.id]?.valor || 0);
    const partes = [];
    if (sit.aquisitivo) {
      partes.push(`Direito adquirido no período de <strong>${this.fmtDate(sit.aquisitivo.inicio)}</strong> a <strong>${this.fmtDate(sit.aquisitivo.fim)}</strong>`);
    }
    partes.push(`Admitido em <strong>${this.fmtDate(c.admissao)}</strong>`);
    if (sal && sit.saldo > 0) {
      const bruto = (sal / 30) * sit.saldo;
      const total = bruto + bruto / 3;
      partes.push(`A pagar por ${sit.saldo} dias: <strong>${this.fmtBRL(total)}</strong> <span class="fer-dica">(${this.fmtBRL(bruto)} + 1/3)</span>`);
    } else if (!sal) {
      partes.push(`<span class="fer-dica">Salário não cadastrado — o valor das férias não pode ser calculado.</span>`);
    }
    this.$('#fer-contexto').innerHTML = `<div class="fer-contexto">${partes.join(' · ')}</div>`;

    const periodos = this.FERIAS.filter(f => f.colaborador_id === c.id)
      .sort((a, b) => a.inicio.localeCompare(b.inicio));

    const tbP = this.$('#tb-fer-periodos');
    tbP.innerHTML = periodos.length ? periodos.map(p => {
      const st = this._periodoStatus(p);
      const stBadge = {
        planejada: `<span class="badge ok">A sair</span>`,
        em_curso:  `<span class="badge info">Em férias</span>`,
        concluida: `<span class="badge neutral">Já saiu</span>`,
      }[st];
      const volta = this._addDays(p.fim, 1);
      const valorTxt = p.valor != null
        ? `<span class="cell-mono" style="font-weight:600; color:var(--phthalo-dark)">${this.fmtBRL(p.valor)}</span>`
        : `<span style="color:var(--text-soft)">—</span>`;
      return `
        <tr>
          <td>
            <div class="cell-mono">${this.fmtDate(p.inicio)} a ${this.fmtDate(p.fim)}</div>
            <div class="fer-dica">volta em ${this.fmtDate(volta)}</div>
          </td>
          <td class="cell-mono" style="text-align:right">
            ${p.dias}${p.abono ? `<div class="fer-dica">+${p.abono} vendidos</div>` : ''}
          </td>
          <td style="text-align:right">${valorTxt}</td>
          <td>${stBadge}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar valor pago" onclick="editarValorFerias(${p.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirFerias(${p.id})">🗑</button>
          </td>
        </tr>`;
    }).join('') : `<tr><td colspan="5" class="empty">Nenhum período agendado ainda</td></tr>`;

    this.atualizarPrevia();
  }

  /**
   * Recalcula o resumo do período que está sendo montado e os avisos.
   * Roda a cada digitação: o usuário vê o resultado antes de salvar, em vez
   * de descobrir por um alert depois de clicar em agendar.
   */
  atualizarPrevia() {
    const f = this.$('#form-ferias-periodo');
    if (!f) return;

    const inicio = f.elements['inicio'].value;
    const dias   = parseInt(f.elements['dias'].value, 10) || 0;
    const vender = parseInt(f.elements['vender'].value, 10) || 0;
    const colabId = parseInt(f.elements['colaborador_id'].value, 10);

    // Destaca o atalho que corresponde ao valor digitado.
    this.$('#fer-chips-dias')?.querySelectorAll('[data-fer-dias]').forEach(b => {
      b.classList.toggle('ativo', parseInt(b.dataset.ferDias, 10) === dias);
    });

    const previa = this.$('#fer-previa');
    const calc = this._fimEVolta(inicio, dias);
    if (previa) {
      previa.innerHTML = calc
        ? `Último dia de férias: <strong>${this.fmtDate(calc.fim)}</strong>`
          + ` &nbsp;·&nbsp; Volta ao trabalho: <strong>${this.fmtDate(calc.volta)}</strong>`
          + (vender > 0 ? ` &nbsp;·&nbsp; <span class="fer-dica">${vender} dias vendidos</span>` : '')
        : 'Escolha a data de início e a quantidade de dias.';
      previa.classList.toggle('vazia', !calc);
    }

    const avisos = colabId ? this._avisosDoPeriodo({ colabId, inicio, dias, vender }) : [];
    const cxAvisos = this.$('#fer-avisos');
    if (cxAvisos) {
      cxAvisos.innerHTML = avisos.map(a =>
        `<div class="fer-aviso fer-aviso-${a.nivel}">${this.h(a.texto)}</div>`).join('');
    }

    // Erro de regra bloqueia o botão; "atenção" só informa.
    const btn = this.$('#fer-btn-agendar');
    if (btn) btn.disabled = avisos.some(a => a.nivel === 'erro');
  }

  limparFormPeriodo() {
    const f = this.$('#form-ferias-periodo');
    if (!f) return;
    const colabId = f.elements['colaborador_id'].value;
    limparFormulario(f);
    f.elements['colaborador_id'].value = colabId;
    f.elements['vender'].value = 0;
    this.atualizarPrevia();
  }

  async salvarFeriasPeriodo(ev) {
    ev.preventDefault();
    const f = this.$('#form-ferias-periodo');
    const data = Object.fromEntries(new FormData(f));
    const colabId = parseInt(data.colaborador_id, 10);
    const dias  = parseInt(data.dias, 10) || 0;
    const abono = parseInt(data.vender, 10) || 0;
    // O fim deixa de ser digitado: sai de início + duração, que é como a
    // pessoa pensa ("15 dias a partir de tal data").
    const calc  = this._fimEVolta(data.inicio, dias);
    data.fim = calc?.fim;
    const valorPago = data.valor_pago !== '' && data.valor_pago != null
      ? parseFloat(String(data.valor_pago).replace(',', '.')) : null;

    if (!data.inicio || !data.fim || dias <= 0) {
      window.showToast?.('Informe a data de início e quantos dias', 'err');
      return;
    }

    // As regras já aparecem em tempo real no formulário; aqui é a última
    // barreira, para o caso de alguém burlar o botão desabilitado.
    const impedimento = this._avisosDoPeriodo({ colabId, inicio: data.inicio, dias, vender: abono })
      .find(a => a.nivel === 'erro');
    if (impedimento) {
      window.showToast?.(impedimento.texto, 'err');
      return;
    }

    const payload = {
      colaborador_id:   colabId,
      data_inicio:      data.inicio,
      data_termino:     data.fim,
      dias_usados:      dias,
      dias_saldo:       30 - dias,
      abono_pecuniario: abono,
      aprovado:         true,
      observacoes:      data.observacoes || '',
    };
    // Só envia valor_pago quando informado (mantém o agendamento normal
    // funcionando mesmo antes de a coluna existir no banco).
    if (valorPago != null) payload.valor_pago = valorPago;

    const temSessao = this.Ferias && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Ferias.criar(payload);
        const hoje = new Date().toISOString().slice(0, 10);
        if (data.inicio <= hoje && data.fim >= hoje) {
          await this.Colaboradores?.atualizar(colabId, { status: 'ferias' }).catch(() => null);
        }
        window.showToast?.('Período agendado', 'ok');
      } catch (err) {
        window.showToast?.('Erro ao agendar: ' + err.message, 'err');
        return;
      }
    } else {
      const newId = Math.max(0, ...this.FERIAS.map(x => x.id)) + 1;
      this.FERIAS.push({
        id: newId, colaborador_id: colabId,
        inicio: data.inicio, fim: data.fim, dias, abono, valor: valorPago,
        observacoes: data.observacoes || '',
        status: data.inicio > new Date().toISOString().slice(0, 10) ? 'planejada' : 'em_curso',
      });
      const c = this.COLABORADORES.find(x => x.id === colabId);
      const hoje = new Date().toISOString().slice(0, 10);
      if (c && data.inicio <= hoje && data.fim >= hoje && c.status === 'ativo') c.status = 'ferias';
      window.showToast?.('Período agendado', 'ok');
    }

    this.limparFormPeriodo();
    this.renderFeriasModal();
    this.render();
    window.renderColaboradores?.();
  }

  async excluirFerias(id) {
    if (!confirm('Excluir este período?')) return;
    const temSessao = this.Ferias && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Ferias.excluir(id);
        window.showToast?.('Período excluído');
      } catch (err) {
        window.showToast?.('Erro ao excluir: ' + err.message, 'err');
        return;
      }
    } else {
      this.FERIAS = this.FERIAS.filter(x => x.id !== id);
      window.FERIAS = this.FERIAS;
      window.showToast?.('Período excluído');
    }
    this.renderFeriasModal();
    this.render();
  }

  async editarValorFerias(id) {
    const p = this.FERIAS.find(x => x.id === id);
    if (!p) return;
    const atual = p.valor != null ? String(p.valor) : '';
    const entrada = window.prompt('Valor pago das férias (R$):', atual);
    if (entrada === null) return; // cancelou
    const txt = entrada.trim();
    const valorPago = txt === '' ? null : parseFloat(txt.replace(',', '.'));
    if (txt !== '' && (isNaN(valorPago) || valorPago < 0)) {
      window.showToast?.('Valor inválido', 'err');
      return;
    }

    const temSessao = this.Ferias && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Ferias.atualizar(id, { valor_pago: valorPago });
      } catch (err) {
        window.showToast?.('Erro ao salvar valor: ' + err.message, 'err');
        return;
      }
    }
    p.valor = valorPago;
    window.showToast?.('Valor atualizado', 'ok');
    this.renderFeriasModal();
    this.render();
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

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

  // ─── Situação e regras, em linguagem de quem usa ──────────────────────────
  // "Aquisitivo", "concessivo" e "abono pecuniário" são os termos da lei, mas
  // não são a pergunta que o RH tem na cabeça. A pergunta é: esta pessoa pode
  // sair, quantos dias, e até quando eu tenho que resolver isso. É o que estas
  // funções respondem.

  /**
   * Ciclo aquisitivo mais ANTIGO que ainda tem dias a tirar — é dele que sai o
   * prazo real e o risco de pagar em dobro.
   *
   * `_periodoAquisitivoAtual` devolve sempre o ciclo mais recente, cujo prazo
   * está sempre a até 12 meses no futuro. Com ela, quem passou anos sem tirar
   * férias nunca aparecia como vencido — o alerta mais importante da tela era
   * inalcançável.
   *
   * Como os períodos gravados não dizem a que ciclo pertencem, os dias são
   * alocados do ciclo mais antigo para o mais novo, que é a ordem em que a lei
   * manda conceder.
   */
  _cicloEmAberto(admissao, diasUsados = 0) {
    if (!admissao) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const adm = new Date(admissao + 'T00:00:00');
    const ciclosCompletos = Math.floor((hoje - adm) / (1000 * 60 * 60 * 24 * 365.25));
    if (ciclosCompletos < 1) return null;

    // Cada ciclo dá 30 dias; quantos já foram inteiramente consumidos.
    const consumidos = Math.floor(diasUsados / 30);
    if (consumidos >= ciclosCompletos) return null;   // tudo quitado

    const k = consumidos;                              // índice do ciclo aberto
    const inicio = this._addYears(admissao, k);
    const fim    = this._addDays(this._addYears(admissao, k + 1), -1);
    return {
      inicio, fim,
      concessivoLimite: this._addYears(fim, 1),
      saldo: 30 - (diasUsados % 30),
      ciclosVencidos: ciclosCompletos - consumidos,
    };
  }

  /**
   * Situação de férias do colaborador. Função de leitura, sem DOM.
   * @returns {{tipo, titulo, detalhe, cls, saldo, diasUsados, aquisitivo, prazo, diasAteOPrazo}}
   */
  _situacaoFerias(colab) {
    const periodos = this.FERIAS.filter(f => f.colaborador_id === colab?.id);
    const diasUsados = periodos.reduce((s, p) => s + (p.dias + (p.abono || 0)), 0);
    const aq = this._cicloEmAberto(colab?.admissao, diasUsados);
    const temCiclo = !!this._periodoAquisitivoAtual(colab?.admissao);
    const saldo = aq ? aq.saldo : 0;
    const base = { saldo, diasUsados, aquisitivo: aq, prazo: aq?.concessivoLimite || null };

    // Sem ciclo aberto, mas já com direito adquirido: tudo tirado.
    if (!aq && temCiclo) {
      const atual = this._periodoAquisitivoAtual(colab.admissao);
      return {
        ...base, tipo: 'quitado', cls: 'ok', diasAteOPrazo: null,
        aquisitivo: atual, prazo: atual.concessivoLimite,
        titulo: 'Férias em dia',
        detalhe: `Todos os dias a que tem direito já foram usados. `
               + `O próximo período vence em ${this.fmtDate(atual.concessivoLimite)}.`,
      };
    }

    if (!aq) {
      const umAno = colab?.admissao ? this._addYears(colab.admissao, 1) : null;
      return {
        ...base, tipo: 'sem_direito', cls: 'neutro',
        titulo: 'Ainda não tem direito a férias',
        detalhe: umAno
          ? `Completa 1 ano de casa em ${this.fmtDate(umAno)}.`
          : 'Data de admissão não cadastrada.',
        diasAteOPrazo: null,
      };
    }

    const hoje = this._isoNow();
    const diasAteOPrazo = this._diasEntre(hoje, aq.concessivoLimite) - 1;

    if (aq.concessivoLimite < hoje) {
      const atraso = Math.abs(diasAteOPrazo);
      const acumulados = aq.ciclosVencidos > 1
        ? ` Há ${aq.ciclosVencidos} períodos acumulados sem tirar.` : '';
      return {
        ...base, tipo: 'vencido', cls: 'critico', diasAteOPrazo,
        titulo: `Prazo vencido há ${atraso} dia${atraso === 1 ? '' : 's'}`,
        detalhe: `As férias deveriam ter saído até ${this.fmtDate(aq.concessivoLimite)}. `
               + `Fora do prazo, a lei manda pagar o período em dobro.${acumulados} Agende o quanto antes.`,
      };
    }

    if (diasAteOPrazo <= 60) {
      return {
        ...base, tipo: 'urgente', cls: 'alerta', diasAteOPrazo,
        titulo: `Precisa sair em até ${diasAteOPrazo} dia${diasAteOPrazo === 1 ? '' : 's'}`,
        detalhe: `Prazo final: ${this.fmtDate(aq.concessivoLimite)}. `
               + `Depois disso o período passa a ser pago em dobro.`,
      };
    }

    return {
      ...base, tipo: 'em_dia', cls: 'tranquilo', diasAteOPrazo,
      titulo: `${saldo} dia${saldo === 1 ? '' : 's'} disponíveis`,
      detalhe: `Pode agendar com calma — o prazo vai até ${this.fmtDate(aq.concessivoLimite)}.`,
    };
  }

  /**
   * Avisos sobre o período que está sendo montado. Devolve frases prontas, do
   * mais grave para o menos. `nivel` 'erro' impede o agendamento.
   */
  _avisosDoPeriodo({ colabId, inicio, dias, vender = 0 }) {
    const avisos = [];
    const existentes = this.FERIAS.filter(f => f.colaborador_id === colabId);
    const situacao = this._situacaoFerias(this.COLABORADORES.find(c => c.id === colabId));

    if (!dias || dias < 1) return avisos;

    const total = dias + vender;
    if (total > situacao.saldo) {
      avisos.push({
        nivel: 'erro',
        texto: `Restam ${situacao.saldo} dias neste período e você está lançando ${total}.`,
      });
    }

    // CLT art. 134: até 3 períodos, um deles com 14 dias ou mais, os demais
    // com pelo menos 5.
    if (existentes.length >= 3) {
      avisos.push({
        nivel: 'erro',
        texto: `Já existem ${existentes.length} períodos. A lei permite dividir as férias em no máximo 3.`,
      });
    }

    if (dias < 5 && existentes.length > 0) {
      avisos.push({ nivel: 'erro', texto: 'Ao dividir as férias, nenhuma parte pode ter menos de 5 dias.' });
    }

    const maiorExistente = existentes.reduce((m, p) => Math.max(m, p.dias), 0);
    if (Math.max(maiorExistente, dias) < 14 && (existentes.length + 1) > 1) {
      avisos.push({
        nivel: 'atencao',
        texto: 'Nenhum dos períodos tem 14 dias ou mais — a lei exige que um deles tenha.',
      });
    }

    if (inicio && situacao.prazo && inicio > situacao.prazo) {
      avisos.push({
        nivel: 'atencao',
        texto: `Este período começa depois do prazo (${this.fmtDate(situacao.prazo)}), o que obriga a pagar em dobro.`,
      });
    }

    return avisos;
  }

  /** Último dia e volta ao trabalho, a partir do primeiro dia e da duração. */
  _fimEVolta(inicio, dias) {
    if (!inicio || !dias || dias < 1) return null;
    const fim = this._addDays(inicio, dias - 1);
    return { fim, volta: this._addDays(fim, 1) };
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
