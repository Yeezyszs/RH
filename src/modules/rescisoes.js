// Rescisões Module
// A face financeira do desligamento: quanto a empresa pagou para encerrar cada
// contrato, quando pagou, e quanto isso soma no período.
//
// Não existe tabela nova. Cada desligamento gera uma rescisão, e as duas
// colunas que faltavam já estavam no banco desde o schema inicial, sem
// nenhuma tela que as alimentasse: `encargos_rescisao` (o valor) e
// `data_pagamento` (a data do acerto). Os mappers já traziam o valor como
// `valor`. Esta tela é, portanto, a interface que faltava — e por isso ela
// lista TODOS os desligamentos, inclusive os sem valor: um desligamento sem
// rescisão lançada é trabalho pendente do RH, não uma linha a esconder.

/**
 * Motivos de desligamento que admitem multa rescisória.
 *
 * Regra de negócio da empresa, definida aqui e em nenhum outro lugar: a tela,
 * o formulário e a gravação consultam esta lista. Fora dela o campo de multa
 * não aparece e, se vier preenchido de qualquer forma, é descartado na
 * gravação — travar só na interface deixaria passar valor por um formulário
 * já aberto quando o motivo mudasse.
 */
export const MOTIVOS_COM_MULTA = ['Justa causa', 'Sem justa causa'];

export function admiteMulta(motivo) {
  return MOTIVOS_COM_MULTA.includes(motivo);
}

export class RescisoesModule {
  constructor(deps) {
    this.$        = deps.$;
    this.h        = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate  = deps.fmtDate;
    this.fmtBRL   = deps.fmtBRL;
    this.mesLabel = deps.mesLabel;
    this.DESLIGAMENTOS = deps.DESLIGAMENTOS;
    this.CHART_COLORS  = deps.CHART_COLORS;
    this.Auth          = deps.Auth;
    this.Desligamentos = deps.Desligamentos;
    this.showToast     = deps.showToast;

    this._chart = null;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'resc-search') {
        clearTimeout(this._searchT);
        this._searchT = setTimeout(() => this.render(), 250);
      }
    });

    document.addEventListener('change', (e) => {
      if (['resc-filter-ano', 'resc-filter-motivo', 'resc-filter-situacao'].includes(e.target.id)) {
        this.render();
      }
    });

    document.querySelectorAll('.nav-item[data-page="rescisoes"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  /** Data que conta para a rescisão: o acerto, ou o desligamento se não houver. */
  _dataRescisao(d) {
    return d.data_rescisao || d.data_pagamento || d.data || '';
  }

  _valor(d) {
    const v = d.valor != null ? d.valor : d.encargos_rescisao;
    return v == null || v === '' ? null : parseFloat(v);
  }

  /** Multa vinculada, já respeitando o motivo: fora da regra, não existe. */
  _multa(d) {
    if (!admiteMulta(d?.motivo)) return null;
    const v = d.multa != null ? d.multa : d.multa_rescisoria;
    return v == null || v === '' ? null : parseFloat(v);
  }

  /** O que de fato saiu do caixa naquela rescisão: acerto + multa. */
  _totalPago(d) {
    const valor = this._valor(d);
    const multa = this._multa(d);
    if (valor == null && multa == null) return null;
    return (valor || 0) + (multa || 0);
  }

  /** Anos presentes nos registros, do mais recente para o mais antigo. */
  _anos() {
    const set = new Set();
    this.DESLIGAMENTOS.forEach(d => {
      const data = this._dataRescisao(d);
      if (data) set.add(data.slice(0, 4));
    });
    return [...set].sort().reverse();
  }

  _preencherAnos() {
    const sel = this.$('#resc-filter-ano');
    if (!sel) return;
    const anos = this._anos();
    const atual = String(new Date().getFullYear());
    const assinatura = anos.join(',');
    if (sel._assinatura === assinatura) return;     // nada mudou: preserva a escolha

    const anterior = sel.value;
    sel.innerHTML = '<option value="">Todos os anos</option>'
      + anos.map(a => `<option value="${a}">${a}</option>`).join('');
    sel._assinatura = assinatura;
    // Na primeira montagem abre no ano corrente, que é o recorte que o RH quer
    // ver; depois disso respeita o que estiver selecionado.
    const alvo = anterior || (anos.includes(atual) ? atual : '');
    if (alvo && [...sel.options].some(o => o.value === alvo)) sel.value = alvo;
  }

  render() {
    const tb = this.$('#tb-rescisoes');
    if (!tb) return;

    this._preencherAnos();

    const q    = (this.$('#resc-search')?.value || '').trim().toLowerCase();
    const fAno = this.$('#resc-filter-ano')?.value || '';
    const fMot = this.$('#resc-filter-motivo')?.value || '';
    const fSit = this.$('#resc-filter-situacao')?.value || '';

    const lista = this.DESLIGAMENTOS.filter(d => {
      const data  = this._dataRescisao(d);
      const valor = this._valor(d);
      if (fAno && data.slice(0, 4) !== fAno) return false;
      if (fMot && d.motivo !== fMot) return false;
      if (fSit === 'lancada'  && valor == null) return false;
      if (fSit === 'pendente' && valor != null) return false;
      if (q) {
        const hay = [d.nome, d.setor, d.area, d.motivo].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => this._dataRescisao(b).localeCompare(this._dataRescisao(a)));

    tb.innerHTML = lista.length
      ? this._renderLinhas(lista)
      : '<tr><td colspan="6" class="empty">Nenhuma rescisão encontrada</td></tr>';

    this._updateStats(lista);
    this._renderGrafico(lista, fAno);
  }

  _renderLinhas(lista) {
    return lista.map(d => {
      const valor = this._valor(d);
      const multa = this._multa(d);
      const acerto = d.data_rescisao || d.data_pagamento;
      const celulaValor = valor == null
        ? '<span class="badge warn">Não lançada</span>'
        : `<strong>${this.fmtBRL(valor)}</strong>`
          + (multa ? `<div class="cell-person-sub">com multa: ${this.fmtBRL(this._totalPago(d))}</div>` : '');
      // Quem não admite multa não mostra campo vazio: mostra que a regra não
      // se aplica, senão o branco parece lançamento esquecido.
      const celulaMulta = !admiteMulta(d.motivo)
        ? '<span class="cell-person-sub">não se aplica</span>'
        : multa == null
          ? '<span class="badge warn">A lançar</span>'
          : `<strong>${this.fmtBRL(multa)}</strong>`;
      return `
        <tr onclick="abrirModalRescisao(${d.id})">
          <td>
            <div class="cell-person">
              <div class="cell-avatar" style="background:linear-gradient(135deg,#991B1B,#7F1D1D);">${this.h(this.iniciais(d.nome))}</div>
              <div>
                <div class="cell-person-name">${this.h(d.nome)}</div>
                <div class="cell-person-sub">${this.h(d.setor || '—')}${d.area ? ' · ' + this.h(d.area) : ''}</div>
              </div>
            </div>
          </td>
          <td class="cell-mono">
            ${this.fmtDate(this._dataRescisao(d))}
            ${acerto ? '' : '<div class="cell-person-sub">data do desligamento</div>'}
          </td>
          <td>${this.h(d.motivo || '—')}</td>
          <td class="cell-mono">${celulaValor}</td>
          <td class="cell-mono">${celulaMulta}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="Lançar / editar rescisão" onclick="abrirModalRescisao(${d.id})">✎</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  _updateStats(lista) {
    const lancadas = lista.map(d => this._valor(d)).filter(v => v != null);
    const acertos  = lancadas.reduce((a, v) => a + v, 0);
    const multas   = lista.map(d => this._multa(d)).filter(v => v != null);
    const somaMulta = multas.reduce((a, v) => a + v, 0);
    const total    = acertos + somaMulta;
    // A média é do acerto, não do total: é o número comparável entre
    // rescisões, e a multa só existe em parte delas.
    const media    = lancadas.length ? acertos / lancadas.length : 0;

    const def = (id, txt) => { const el = this.$(id); if (el) el.textContent = txt; };
    def('#resc-stat-total',    this.fmtBRL(total));
    def('#resc-stat-qtd',      `${lancadas.length}/${lista.length}`);
    def('#resc-stat-media',    lancadas.length ? this.fmtBRL(media) : '—');
    def('#resc-stat-pendente', String(lista.length - lancadas.length));
    def('#resc-stat-multa',    this.fmtBRL(somaMulta));

    // O total é a soma de duas coisas diferentes; o card diz quais.
    const sub = this.$('#resc-stat-total-sub');
    if (sub) {
      sub.textContent = somaMulta
        ? `${this.fmtBRL(acertos)} de acerto + ${this.fmtBRL(somaMulta)} de multa`
        : 'nenhuma multa lançada no período';
    }
    const subMulta = this.$('#resc-stat-multa-sub');
    if (subMulta) {
      const elegiveis = lista.filter(d => admiteMulta(d.motivo)).length;
      subMulta.textContent = `${multas.length} de ${elegiveis} elegíveis lançadas`;
    }
  }

  /**
   * Gasto com rescisões ao longo do tempo.
   *
   * Com um ano selecionado o eixo são os 12 meses dele — incluindo os meses sem
   * rescisão, senão o gráfico mente sobre o ritmo do gasto. Sem recorte de ano,
   * o eixo passa a ser o ano.
   */
  _renderGrafico(lista, fAno) {
    const canvas = this.$('#chart-rescisoes');
    if (!canvas || typeof Chart === 'undefined') return;

    let rotulos, chaves;
    if (fAno) {
      chaves  = Array.from({ length: 12 }, (_, i) => `${fAno}-${String(i + 1).padStart(2, '0')}`);
      rotulos = chaves.map(c => this.mesLabel(c));
    } else {
      chaves  = [...new Set(lista.map(d => this._dataRescisao(d).slice(0, 4)).filter(Boolean))].sort();
      rotulos = chaves.slice();
    }

    const corte = fAno ? 7 : 4;                  // 'AAAA-MM' ou 'AAAA'
    // Barra empilhada: acerto embaixo, multa em cima. Somadas num valor só, a
    // multa desapareceria dentro do total — e saber quanto do gasto foi multa
    // é metade da razão de existir esta tela.
    const somar = (k, fn) => lista.reduce((acc, d) => {
      const v = fn(d);
      if (v == null) return acc;
      return this._dataRescisao(d).slice(0, corte) === k ? acc + v : acc;
    }, 0);
    const totais = chaves.map(k => somar(k, (d) => this._valor(d)));
    const multas = chaves.map(k => somar(k, (d) => this._multa(d)));

    this._chart?.destroy();
    this._chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: rotulos,
        datasets: [
          {
            label: 'Acerto rescisório',
            data: totais,
            backgroundColor: this.CHART_COLORS.phthaloLight,
            stack: 'g', borderRadius: 3,
          },
          {
            label: 'Multa rescisória',
            data: multas,
            backgroundColor: this.CHART_COLORS.vibrant?.[1] || '#E74C3C',
            stack: 'g', borderRadius: 3,
          },
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
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: this.CHART_COLORS.grid },
            ticks: { callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') },
          },
        },
      },
    });
  }

  abrirModal(id) {
    const d = this.DESLIGAMENTOS.find(x => x.id === id);
    if (!d) return;
    const form = this.$('#form-rescisao');
    if (!form) return;

    form.elements['desligamento_id'].value = d.id;
    this.$('#resc-modal-nome').textContent = d.nome;
    this.$('#resc-modal-sub').textContent =
      `${d.motivo || 'motivo não informado'} · desligamento em ${this.fmtDate(d.data)}`;

    const valor = this._valor(d);
    form.elements['valor'].value = valor == null ? '' : valor.toFixed(2);
    // Sem acerto lançado, a data já vem com a do desligamento: é o palpite
    // certo na esmagadora maioria dos casos e poupa digitação.
    form.elements['data'].value = d.data_rescisao || d.data_pagamento || d.data || '';

    // Multa: o campo só existe quando o motivo admite. Desabilitado também,
    // não só escondido — campo oculto mas habilitado volta no FormData.
    const podeMulta = admiteMulta(d.motivo);
    const multa     = this._multa(d);
    const grupo     = this.$('#resc-grupo-multa');
    const aviso     = this.$('#resc-multa-aviso');
    if (grupo) grupo.style.display = podeMulta ? '' : 'none';
    form.elements['multa'].disabled = !podeMulta;
    form.elements['multa'].value = podeMulta && multa != null ? multa.toFixed(2) : '';
    if (aviso) {
      aviso.textContent = podeMulta
        ? 'Multa vinculada a este desligamento. Soma-se ao valor do acerto no total do período.'
        : 'Multa não se aplica: a empresa vincula multa rescisória somente em '
          + MOTIVOS_COM_MULTA.join(' ou ').toLowerCase() + '.';
    }

    this.$('#modal-rescisao').classList.add('active');
  }

  fecharModal() {
    this.$('#modal-rescisao')?.classList.remove('active');
  }

  async salvar(ev) {
    ev.preventDefault();
    const form = this.$('#form-rescisao');
    const dados = Object.fromEntries(new FormData(form));
    const id = parseInt(dados.desligamento_id, 10);
    const d  = this.DESLIGAMENTOS.find(x => x.id === id);
    if (!d) return;

    const valor = dados.valor === '' || dados.valor == null ? null : parseFloat(dados.valor);
    if (valor != null && !(valor >= 0)) {
      this.showToast?.('Informe um valor válido para a rescisão', 'err');
      return;
    }

    // A regra do motivo manda, não o que chegou do formulário: multa em
    // desligamento que não a admite é descartada aqui, antes de virar dado.
    const podeMulta = admiteMulta(d.motivo);
    const multaBruta = dados.multa === '' || dados.multa == null ? null : parseFloat(dados.multa);
    if (podeMulta && multaBruta != null && !(multaBruta >= 0)) {
      this.showToast?.('Informe um valor válido para a multa', 'err');
      return;
    }
    const multa = podeMulta ? multaBruta : null;

    const payload = {
      encargos_rescisao: valor,
      data_pagamento:    dados.data || null,
      multa_rescisoria:  multa,
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Desligamentos.atualizar(id, payload);
      } catch (err) {
        this.showToast?.('Erro ao salvar rescisão: ' + err.message, 'err');
        return;
      }
    }

    // Mutação no próprio objeto: o array é compartilhado por referência com os
    // outros módulos, e trocar o item por um novo deixaria o drawer de
    // desligamentos apontando para o antigo.
    d.valor             = valor;
    d.encargos_rescisao = valor;
    d.data_rescisao     = payload.data_pagamento;
    d.data_pagamento    = payload.data_pagamento;
    d.multa             = multa;
    d.multa_rescisoria  = multa;

    this.fecharModal();
    this.render();
    this.showToast?.(valor == null ? 'Rescisão sem valor lançado' : 'Rescisão salva', 'ok');
  }
}

export default RescisoesModule;
