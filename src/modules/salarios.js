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
          vencimentos:    h.vencimentos != null ? parseFloat(h.vencimentos) : null,
          descontos:      h.descontos   != null ? parseFloat(h.descontos)   : null,
          verbas:         Array.isArray(h.verbas) ? h.verbas : [],
          temSalario:     true,
          historico:      true,
          temVerbas:      Array.isArray(h.verbas) && h.verbas.length > 0,
        };
      }
      const s = this.SALARIOS[c.id];
      return {
        colab:          c,
        valor:          s?.valor || 0,
        data_alteracao: s?.data_alteracao || null,
        observacoes:    s?.observacoes || '',
        liquido:        null,
        vencimentos:    null,
        descontos:      null,
        verbas:         [],
        temSalario:     !!s,
        historico:      false,
        // Fora do histórico a tela mostra o cadastro, não um mês — e verba é
        // coisa de mês. O botão do holerite só aparece com uma folha à vista.
        temVerbas:      false,
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
    // Olhando uma folha, a faixa salarial importa menos do que saber por que
    // o líquido veio daquele tamanho. A coluna troca de assunto junto.
    const thFx = this.$('#sal-th-faixa');
    if (thFx) thFx.textContent = comp ? 'Descontos do mês' : 'Faixa';
    const aviso = this.$('#sal-aviso-historico');
    if (aviso) {
      aviso.style.display = comp ? '' : 'none';
      if (comp) {
        const liq  = linhas.reduce((s2, r) => s2 + (r.liquido || 0), 0);
        const venc = linhas.reduce((s2, r) => s2 + (r.vencimentos || 0), 0);
        const desc = linhas.reduce((s2, r) => s2 + (r.descontos || 0), 0);
        aviso.innerHTML = `Você está vendo a <strong>folha de ${this.h(this.mesLabel(comp))}</strong>, `
          + `como ela foi importada — não dá para editar o passado. `
          + `Proventos <strong>${this.fmtBRL(venc)}</strong> `
          + `− descontos <strong>${this.fmtBRL(desc)}</strong> `
          + `= líquido <strong>${this.fmtBRL(liq)}</strong>.`;
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
          // Na folha, a coluna responde "por que o líquido veio assim": o
          // total descontado e os maiores descontos pelo nome. Sem isso o RH
          // tem de abrir o holerite de cada um para descobrir.
          const descDisp = r.descontos == null
            ? '<span style="color:var(--text-soft)">—</span>'
            : `<span class="cell-mono" style="font-weight:600; color:var(--danger)">${this.fmtBRL(r.descontos)}</span>`
              + this._resumoDescontos(r.verbas);
          return `
            <tr${r.historico
              ? (r.temVerbas || r.liquido != null ? ` onclick="abrirHolerite(${c.id})" style="cursor:pointer"` : '')
              : ` onclick="abrirModalSalario(${c.id})"`}>
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
              <td>${r.historico ? descDisp : faixaDisp}</td>
              <td class="cell-mono">${r.historico
                ? (r.liquido != null
                    ? `<span style="font-weight:600">${this.fmtBRL(r.liquido)}</span>`
                      + (r.vencimentos != null
                          ? `<div class="cell-person-sub">de ${this.fmtBRL(r.vencimentos)} em proventos</div>` : '')
                    : '—')
                : (r.data_alteracao ? this.fmtDate(r.data_alteracao) : '—')}</td>
              <td class="actions" onclick="event.stopPropagation()">
                ${r.historico && (r.temVerbas || r.liquido != null)
                  ? `<button class="btn btn-ghost btn-sm btn-icon" title="Ver o holerite do mês" onclick="abrirHolerite(${c.id})">🧾</button>` : ''}
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

  /**
   * Os maiores descontos do mês, pelo nome.
   *
   * Três bastam: é o que cabe na linha e é onde mora a resposta na prática —
   * adiantamento, INSS, pensão. O resto vira "e mais N", que o holerite
   * detalha. Folha importada antes de o sistema guardar as verbas não tem o
   * que mostrar, e aí a célula fica só com o total.
   */
  _resumoDescontos(verbas, limite = 3) {
    const lista = (verbas || [])
      .filter(v => parseFloat(v.desconto) > 0)
      .sort((a, b) => parseFloat(b.desconto) - parseFloat(a.desconto));
    if (!lista.length) return '';

    const principais = lista.slice(0, limite)
      .map(v => `${this.h(this._nomeCurto(v.descricao))} ${this.fmtBRL(v.desconto)}`);
    const resto = lista.length - principais.length;
    return `<div class="cell-person-sub">${principais.join(' · ')}`
      + (resto > 0 ? ` · e mais ${resto}` : '') + '</div>';
  }

  /** Encurta o nome da verba para caber na linha, sem virar sigla. */
  _nomeCurto(descricao) {
    const texto = String(descricao || '').trim();
    const ABREVIA = [
      [/^Desconto Adiantamento Salarial$/i, 'Adiantamento'],
      [/^Antecipa[çc][ãa]o Salarial$/i,     'Antecipação'],
      [/^Pens[ãa]o Judicial\b.*/i,          'Pensão'],
      [/^Empr[ée]stimo.*/i,                 'Empréstimo'],
      [/^Taxa Assistencial$/i,              'Taxa assist.'],
    ];
    for (const [re, curto] of ABREVIA) if (re.test(texto)) return curto;
    return texto.length > 22 ? texto.slice(0, 21).trimEnd() + '…' : texto;
  }

  // ─── Holerite do mês: as verbas como vieram da folha ─────────────────────

  /**
   * Mostra o quadro de verbas daquele colaborador naquela competência.
   *
   * O que a lista responde é "quanto"; o que falta é "do que foi feito" —
   * quanto saiu de adiantamento, de insalubridade, de pensão, de consignado.
   * Essas linhas já vêm na folha importada; aqui elas aparecem como no papel,
   * com proventos de um lado e descontos do outro.
   */
  abrirHolerite(colabId) {
    const comp = this.$('#sal-competencia')?.value || '';
    const h = this.FOLHA_HIST.find(x => x.colaborador_id === colabId && x.competencia === comp);
    const c = this.COLABORADORES.find(x => x.id === colabId);
    if (!h || !c) return;

    const verbas = Array.isArray(h.verbas) ? h.verbas : [];
    const bases  = Array.isArray(h.bases)  ? h.bases  : [];
    this.$('#hol-title').textContent = `Demonstrativo de pagamento — ${this.mesLabel(comp)}`;

    const venc = h.vencimentos != null ? parseFloat(h.vencimentos) : null;
    const desc = h.descontos   != null ? parseFloat(h.descontos)   : null;
    const liq  = h.liquido     != null ? parseFloat(h.liquido)     : null;
    const somaProv = verbas.reduce((t, v) => t + (parseFloat(v.provento) || 0), 0);
    const somaDesc = verbas.reduce((t, v) => t + (parseFloat(v.desconto) || 0), 0);

    // Quando a soma das verbas não bate com o total impresso, a tela diz. Há
    // caso legítimo — auxílio-doença sai listado mas quem paga é o INSS, e o
    // total da empresa não o inclui —, mas quem olha precisa saber que as
    // duas contas diferem em vez de escolher uma sem saber.
    const difere = (venc != null && Math.abs(somaProv - venc) > 0.01)
                || (desc != null && Math.abs(somaDesc - desc) > 0.01);

    const campo = (rotulo, valor) => `
      <div class="hol-campo"><span>${this.h(rotulo)}</span><strong>${valor}</strong></div>`;

    const linhaVerba = (v) => `
      <tr>
        <td class="cell-mono" style="color:var(--text-soft)">${this.h(v.codigo || '')}</td>
        <td>${this.h(v.descricao || '—')}</td>
        <td class="cell-mono" style="color:var(--text-muted)">${this.h(v.referencia || '')}</td>
        <td class="cell-mono" style="text-align:right">${v.provento != null ? this.fmtBRL(v.provento) : ''}</td>
        <td class="cell-mono" style="text-align:right; color:var(--danger)">${v.desconto != null ? this.fmtBRL(v.desconto) : ''}</td>
      </tr>`;

    this.$('#hol-body').innerHTML = `
      <!-- Cabeçalho, como no papel: quem, em que cargo, desde quando. -->
      <div class="hol-cab">
        <div class="hol-cab-nome">${this.h(c.nome)}</div>
        <div class="hol-cab-sub">${this.h(h.cargo || c.cargo || '—')}</div>
      </div>
      <div class="hol-campos">
        ${campo('Cadastro', this.h(h.codigo_folha || '—'))}
        ${campo('CBO', this.h(h.cbo || '—'))}
        ${campo('Setor', this.h(c.setor || '—'))}
        ${campo('Centro de custo', this.h(h.departamento || '—'))}
        ${campo('Admissão', c.admissao ? this.fmtDate(c.admissao) : '—')}
      </div>

      <div class="fer-secao" style="margin-top:14px;">Verbas do mês</div>
      <div class="table-card" style="box-shadow:none;">
        <div class="table-wrapper">
          <table class="data">
            <thead><tr>
              <th style="width:64px">Ev</th>
              <th>Descrição</th>
              <th style="width:96px">Referência</th>
              <th style="width:118px; text-align:right">Proventos</th>
              <th style="width:118px; text-align:right">Descontos</th>
            </tr></thead>
            <tbody>
              ${verbas.length ? verbas.map(linhaVerba).join('')
                : '<tr><td colspan="5" class="empty">Esta folha foi importada antes de o sistema guardar as verbas. Reimporte o PDF do mês para preencher.</td></tr>'}
            </tbody>
            ${verbas.length ? `<tfoot><tr>
              <td colspan="3" style="text-align:right; font-weight:600">Total</td>
              <td class="cell-mono" style="text-align:right; font-weight:700">${venc != null ? this.fmtBRL(venc) : this.fmtBRL(somaProv)}</td>
              <td class="cell-mono" style="text-align:right; font-weight:700; color:var(--danger)">${desc != null ? this.fmtBRL(desc) : this.fmtBRL(somaDesc)}</td>
            </tr></tfoot>` : ''}
          </table>
        </div>
      </div>

      <div class="hol-liquido-faixa">
        <span>Líquido a receber</span>
        <strong>${liq != null ? this.fmtBRL(liq) : '—'}</strong>
      </div>

      ${difere ? `<div class="hol-aviso">
        As verbas listadas somam ${this.fmtBRL(somaProv)} de proventos e ${this.fmtBRL(somaDesc)} de descontos,
        diferente dos totais impressos. Acontece quando uma verba aparece no holerite sem entrar no total —
        auxílio-doença, por exemplo, que é pago pelo INSS.</div>` : ''}

      <!-- Rodapé do papel: as bases de cálculo. -->
      <div class="fer-secao" style="margin-top:16px;">Bases de cálculo</div>
      ${bases.length
        ? `<div class="hol-bases">${bases.map(b =>
            `<div><span>${this.h(b.rotulo)}</span><strong>${this.h(b.texto)}</strong></div>`).join('')}</div>`
        : `<div class="hol-bases"><div><span>Salário base</span><strong>${this.fmtBRL(parseFloat(h.salario_base) || 0)}</strong></div></div>
           <div class="fer-dica" style="margin-top:6px;">As demais bases (INSS, FGTS, IRRF) passaram a ser guardadas depois desta importação.</div>`}`;

    this.$('#modal-holerite').classList.add('active');
  }

  fecharHolerite() {
    this.$('#modal-holerite')?.classList.remove('active');
  }

  exportSalarios() {
    window.showToast?.('Exportação CSV será implementada na integração', 'ok');
  }
}

export default SalariosModule;
