// Avaliação de Engajamento
//
// O formulário de 11 itens que a Bepi aplica após o período de experiência e
// depois anualmente. Gestor e RH avaliam separadamente; a nota que vale é a
// média dos dois, item a item.
//
// Esta tela é a visão do RH: lista as avaliações recebidas, mostra a média
// consolidada por colaborador e dá o link que os gestores usam para responder.
// Quem recebe as respostas de fora é a RPC `engajamento_enviar`, não esta
// tela — a validação do que chega pela internet vive no banco.

import { limparFormulario } from '../utils/ui.js?v=dev';
import {
  ITENS_ENGAJAMENTO, NOTA_MAXIMA, PONTUACAO_MAXIMA, LEGENDA_NOTAS,
  pontuacao, consolidar, pctBR,
} from '../utils/engajamento.js?v=dev';

const ORIGEM_LABEL  = { gestor: 'Gestor', rh: 'RH' };
const PERIODO_LABEL = { experiencia: 'Pós-experiência', anual: 'Anual' };

export class EngajamentoModule {
  constructor(deps) {
    this.$        = deps.$;
    this.h        = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate  = deps.fmtDate;
    this.COLABORADORES = deps.COLABORADORES;
    this.ENGAJAMENTO   = deps.ENGAJAMENTO;
    this.CHART_COLORS  = deps.CHART_COLORS;
    this.Auth          = deps.Auth;
    this.AvaliacoesEngajamento = deps.AvaliacoesEngajamento;
    this.showToast     = deps.showToast;

    this._chart = null;
    this._drawerColabId = null;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'eng-search') {
        clearTimeout(this._searchT);
        this._searchT = setTimeout(() => this.render(), 250);
      }
    });
    document.addEventListener('change', (e) => {
      if (['eng-filter-periodo', 'eng-filter-classificacao', 'eng-filter-ano'].includes(e.target.id)) {
        this.render();
      }
    });
    document.querySelectorAll('.nav-item[data-page="engajamento"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  // ─── Agrupamento ──────────────────────────────────────────────────────────
  // Uma avaliação por avaliador, mas a nota que vale é a do par. O par é
  // (colaborador, período, ano): é assim que o formulário define o ciclo —
  // uma avaliação após a experiência e depois uma por ano.

  _ciclos() {
    const mapa = new Map();
    this.ENGAJAMENTO.forEach(a => {
      const ano = String(a.data_avaliacao || '').slice(0, 4);
      const chave = `${a.colaborador_id}|${a.periodo}|${ano}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave, ano, periodo: a.periodo,
          colab: this.COLABORADORES.find(c => c.id === a.colaborador_id) || null,
          colaborador_id: a.colaborador_id,
          avaliacoes: [],
        });
      }
      mapa.get(chave).avaliacoes.push(a);
    });

    return [...mapa.values()].map(c => {
      const consolidado = consolidar(c.avaliacoes);
      const data = c.avaliacoes
        .map(a => a.data_avaliacao).filter(Boolean).sort().slice(-1)[0] || '';
      return {
        ...c, data, consolidado,
        temGestor: c.avaliacoes.some(a => a.origem === 'gestor'),
        temRh:     c.avaliacoes.some(a => a.origem === 'rh'),
      };
    }).sort((a, b) => b.data.localeCompare(a.data));
  }

  _anos() {
    return [...new Set(this.ENGAJAMENTO
      .map(a => String(a.data_avaliacao || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  }

  _preencherAnos() {
    const sel = this.$('#eng-filter-ano');
    if (!sel) return;
    const anos = this._anos();
    const assinatura = anos.join(',');
    if (sel._assinatura === assinatura) return;
    const anterior = sel.value;
    sel.innerHTML = '<option value="">Todos os anos</option>'
      + anos.map(a => `<option value="${a}">${a}</option>`).join('');
    sel._assinatura = assinatura;
    if (anterior && anos.includes(anterior)) sel.value = anterior;
  }

  render() {
    const tb = this.$('#tb-engajamento');
    if (!tb) return;

    this._preencherAnos();

    const q     = (this.$('#eng-search')?.value || '').trim().toLowerCase();
    const fPer  = this.$('#eng-filter-periodo')?.value || '';
    const fCls  = this.$('#eng-filter-classificacao')?.value || '';
    const fAno  = this.$('#eng-filter-ano')?.value || '';

    const todos = this._ciclos();
    const lista = todos.filter(c => {
      if (fPer && c.periodo !== fPer) return false;
      if (fAno && c.ano !== fAno) return false;
      if (fCls && c.consolidado?.chave !== fCls) return false;
      if (q) {
        const hay = [c.colab?.nome, c.colab?.setor, ...c.avaliacoes.map(a => a.avaliador)]
          .join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    tb.innerHTML = lista.length
      ? this._renderLinhas(lista)
      : '<tr><td colspan="7" class="empty">Nenhuma avaliação encontrada</td></tr>';

    this._updateStats(lista);
    this._renderGrafico(lista);
  }

  _badgeClassificacao(consolidado) {
    if (!consolidado) return '<span class="badge neutral">—</span>';
    return `<span class="badge ${consolidado.cls}">${consolidado.rotulo}</span>`;
  }

  _renderLinhas(lista) {
    return lista.map(c => {
      const cons = c.consolidado;
      // Avaliação de um lado só não é a nota final: o formulário manda tirar
      // média do gestor com o RH, e a tela tem de deixar claro o que falta.
      const faltando = !c.temGestor ? 'falta o gestor' : !c.temRh ? 'falta o RH' : '';
      const nome = c.colab?.nome || `#${c.colaborador_id}`;
      return `
        <tr onclick="abrirDrawerEngajamento('${c.chave}')">
          <td>
            <div class="cell-person">
              <div class="cell-avatar">${this.h(this.iniciais(nome))}</div>
              <div>
                <div class="cell-person-name">${this.h(nome)}</div>
                <div class="cell-person-sub">${this.h(c.colab?.setor || '—')}</div>
              </div>
            </div>
          </td>
          <td>${PERIODO_LABEL[c.periodo] || c.periodo}<div class="cell-person-sub">${this.h(c.ano)}</div></td>
          <td class="cell-mono">${this.fmtDate(c.data)}</td>
          <td>
            ${c.avaliacoes.map(a => `<div class="cell-person-sub">${ORIGEM_LABEL[a.origem] || a.origem}: ${this.h(a.avaliador)}</div>`).join('')}
            ${faltando ? `<span class="badge warn" style="margin-top:3px">${faltando}</span>` : ''}
          </td>
          <td class="cell-mono" style="text-align:right">
            <strong>${cons ? cons.soma.toFixed(1).replace('.', ',') : '—'}</strong>
            <span style="color:var(--text-soft)">/${PONTUACAO_MAXIMA}</span>
          </td>
          <td class="cell-mono" style="text-align:right">${cons ? pctBR(cons.percentual) : '—'}</td>
          <td>${this._badgeClassificacao(cons)}</td>
        </tr>`;
    }).join('');
  }

  _updateStats(lista) {
    const def = (id, txt) => { const el = this.$(id); if (el) el.textContent = txt; };
    const comNota = lista.filter(c => c.consolidado);
    const media = comNota.length
      ? comNota.reduce((s, c) => s + c.consolidado.percentual, 0) / comNota.length : 0;
    const pendentes = lista.filter(c => !c.temGestor || !c.temRh).length;
    const excelentes = comNota.filter(c => c.consolidado.chave === 'excelente').length;
    const insatisfatorios = comNota.filter(c => c.consolidado.chave === 'insatisfatorio').length;

    def('#eng-stat-total',  String(lista.length));
    def('#eng-stat-media',  comNota.length ? pctBR(media) : '—');
    def('#eng-stat-exc',    `${excelentes}/${comNota.length || 0}`);
    def('#eng-stat-insat',  String(insatisfatorios));
    const sub = this.$('#eng-stat-pendentes-sub');
    if (sub) {
      sub.textContent = pendentes
        ? `${pendentes} aguardando a segunda avaliação`
        : 'todas com gestor e RH';
    }
  }

  /** Média da empresa em cada item — onde o time inteiro vai bem ou mal. */
  _renderGrafico(lista) {
    const canvas = this.$('#chart-engajamento');
    if (!canvas || typeof Chart === 'undefined') return;

    const medias = ITENS_ENGAJAMENTO.map((_, i) => {
      const notas = lista.map(c => c.consolidado?.notas?.[i]).filter(n => n != null);
      return notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
    });

    this._chart?.destroy();
    this._chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        // O texto completo do item não cabe no eixo; o número casa com a
        // ordem do formulário impresso, e o tooltip diz o resto.
        labels: ITENS_ENGAJAMENTO.map((_, i) => String(i + 1)),
        datasets: [{
          label: 'Média do item',
          data: medias,
          backgroundColor: medias.map(m =>
            m >= 2.5 ? '#10B981' : m >= 1.8 ? '#F59E0B' : '#EF4444'),
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (ctx) => ITENS_ENGAJAMENTO[ctx[0].dataIndex],
              label: (ctx) => `Média ${ctx.parsed.y.toFixed(2).replace('.', ',')} de ${NOTA_MAXIMA}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, max: NOTA_MAXIMA, grid: { color: this.CHART_COLORS.grid } },
        },
      },
    });
  }

  // ─── Drawer: o detalhe item a item ────────────────────────────────────────

  abrirDrawer(chave) {
    const ciclo = this._ciclos().find(c => c.chave === chave);
    if (!ciclo) return;
    this._drawerColabId = ciclo.colaborador_id;

    const nome = ciclo.colab?.nome || `#${ciclo.colaborador_id}`;
    this.$('#deng-avatar').textContent = this.iniciais(nome);
    this.$('#deng-name').textContent = nome;
    this.$('#deng-role').textContent =
      `${PERIODO_LABEL[ciclo.periodo] || ciclo.periodo} · ${ciclo.ano}`;

    const cons = ciclo.consolidado;
    this.$('#deng-resumo').innerHTML = cons ? `
      <div class="eng-resumo">
        <div>
          <div class="eng-resumo-nota">${cons.soma.toFixed(1).replace('.', ',')}<span>/${PONTUACAO_MAXIMA}</span></div>
          <div class="cell-person-sub">${pctBR(cons.percentual)} · média de ${cons.avaliadores} avaliação${cons.avaliadores === 1 ? '' : 'ões'}</div>
        </div>
        ${this._badgeClassificacao(cons)}
      </div>` : '';

    // Uma coluna por avaliador e a média ao lado: é exatamente a conta que o
    // formulário manda fazer, e ela tem de ficar visível, não escondida.
    const cab = ciclo.avaliacoes
      .map(a => `<th style="text-align:center">${ORIGEM_LABEL[a.origem] || a.origem}</th>`).join('');
    const linhas = ITENS_ENGAJAMENTO.map((texto, i) => {
      const notas = ciclo.avaliacoes.map(a => {
        const n = a.itens?.[i]?.nota;
        return Number.isFinite(Number(n)) ? Number(n) : null;
      });
      const apontamentos = ciclo.avaliacoes
        .map(a => (a.itens?.[i]?.apontamento || '').trim())
        .filter(Boolean);
      const media = cons?.notas?.[i];
      return `
        <tr>
          <td>
            ${i + 1}. ${this.h(texto)}
            ${apontamentos.map(t => `<div class="cell-person-sub">“${this.h(t)}”</div>`).join('')}
          </td>
          ${notas.map(n => `<td class="cell-mono" style="text-align:center">${n ?? '—'}</td>`).join('')}
          <td class="cell-mono" style="text-align:center; font-weight:700; color:var(--phthalo-dark)">
            ${media != null ? media.toFixed(1).replace('.', ',') : '—'}
          </td>
        </tr>`;
    }).join('');

    this.$('#deng-itens').innerHTML = `
      <table class="data">
        <thead><tr><th>Item</th>${cab}<th style="text-align:center">Média</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>`;

    const obs = ciclo.avaliacoes.filter(a => (a.observacoes || '').trim());
    this.$('#deng-observacoes').innerHTML = obs.length
      ? obs.map(a => `<div style="margin-bottom:8px"><strong>${ORIGEM_LABEL[a.origem] || a.origem} — ${this.h(a.avaliador)}</strong><div>${this.h(a.observacoes)}</div></div>`).join('')
      : '<div class="empty">Sem observações gerais.</div>';

    this.$('#deng-acoes').innerHTML = ciclo.avaliacoes.map(a => `
      <button class="btn btn-ghost btn-sm" onclick="excluirEngajamento(${a.id})">
        🗑 Excluir a avaliação do ${ORIGEM_LABEL[a.origem] || a.origem}
      </button>`).join('');

    this.$('#drawer-backdrop-eng').classList.add('active');
    this.$('#drawer-eng').classList.add('active');
  }

  fecharDrawer() {
    this.$('#drawer-backdrop-eng')?.classList.remove('active');
    this.$('#drawer-eng')?.classList.remove('active');
    this._drawerColabId = null;
  }

  // ─── Lançar uma avaliação pela própria tela (o lado do RH) ────────────────

  abrirModal() {
    const form = this.$('#form-engajamento');
    if (!form) return;
    limparFormulario(form);

    const sel = this.$('#eng-form-colab');
    sel.innerHTML = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => `<option value="${c.id}">${this.h(c.nome)} — ${this.h(c.setor || '—')}</option>`)
      .join('');

    form.elements['data_avaliacao'].value = new Date().toISOString().slice(0, 10);
    form.elements['origem'].value = 'rh';
    form.elements['periodo'].value = 'anual';

    this.$('#eng-form-itens').innerHTML = ITENS_ENGAJAMENTO.map((texto, i) => `
      <div class="eng-item">
        <div class="eng-item-texto">${i + 1}. ${this.h(texto)}</div>
        <div class="eng-item-notas">
          ${[1, 2, 3].map(n => `
            <label title="${this.h(LEGENDA_NOTAS[n])}">
              <input type="radio" name="nota_${i}" value="${n}" ${n === 2 ? 'checked' : ''}>
              <span>${n}</span>
            </label>`).join('')}
        </div>
        <input type="text" name="apontamento_${i}" class="eng-item-apont" placeholder="Apontamentos (opcional)" maxlength="1000">
      </div>`).join('');

    this.atualizarPreviaModal();
    this.$('#modal-engajamento').classList.add('active');
  }

  fecharModal() {
    this.$('#modal-engajamento')?.classList.remove('active');
  }

  /** Mostra a pontuação enquanto o RH preenche, não depois de salvar. */
  atualizarPreviaModal() {
    const form = this.$('#form-engajamento');
    const alvo = this.$('#eng-form-previa');
    if (!form || !alvo) return;
    const p = pontuacao({ itens: this._itensDoForm(form) });
    alvo.innerHTML = `Pontuação: <strong>${p.soma}</strong>/${p.maximo}`
      + ` · ${pctBR(p.percentual)} · <span class="badge ${p.cls}">${p.rotulo}</span>`;
  }

  _itensDoForm(form) {
    return ITENS_ENGAJAMENTO.map((_, i) => ({
      nota: parseInt(form.elements[`nota_${i}`]?.value, 10) || null,
      apontamento: (form.elements[`apontamento_${i}`]?.value || '').trim(),
    }));
  }

  async salvar(ev) {
    ev.preventDefault();
    const form = this.$('#form-engajamento');
    const dados = Object.fromEntries(new FormData(form));
    const itens = this._itensDoForm(form);

    if (itens.some(it => !it.nota)) {
      this.showToast?.('Dê uma nota a todos os 11 itens', 'err');
      return;
    }

    const payload = {
      colaborador_id: parseInt(dados.colaborador_id, 10),
      data_avaliacao: dados.data_avaliacao,
      avaliador:      (dados.avaliador || '').trim(),
      origem:         dados.origem,
      periodo:        dados.periodo,
      itens,
      observacoes:    (dados.observacoes || '').trim() || null,
    };

    if (!payload.colaborador_id) { this.showToast?.('Escolha o colaborador', 'err'); return; }
    if (payload.avaliador.length < 3) { this.showToast?.('Informe quem está avaliando', 'err'); return; }

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao && this.AvaliacoesEngajamento) {
      try {
        const saved = await this.AvaliacoesEngajamento.criar(payload);
        this.ENGAJAMENTO.unshift(saved);
      } catch (err) {
        this.showToast?.('Erro ao salvar: ' + err.message, 'err');
        return;
      }
    } else {
      const novoId = Math.max(0, ...this.ENGAJAMENTO.map(x => x.id)) + 1;
      this.ENGAJAMENTO.unshift({ id: novoId, ...payload });
    }

    this.fecharModal();
    this.render();
    this.showToast?.('Avaliação registrada', 'ok');
  }

  async excluir(id) {
    if (!confirm('Excluir esta avaliação?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao && this.AvaliacoesEngajamento) {
      try {
        await this.AvaliacoesEngajamento.excluir(id);
      } catch (err) {
        this.showToast?.('Erro ao excluir: ' + err.message, 'err');
        return;
      }
    }
    const i = this.ENGAJAMENTO.findIndex(x => x.id === id);
    if (i >= 0) this.ENGAJAMENTO.splice(i, 1);
    this.fecharDrawer();
    this.render();
    this.showToast?.('Avaliação excluída', 'ok');
  }

  // ─── O link que os gestores recebem ───────────────────────────────────────

  /** URL pública do formulário, derivada de onde o sistema está hospedado. */
  linkPublico() {
    const base = window.location.href.replace(/\/[^/]*$/, '/');
    return base + 'engajamento.html';
  }

  copiarLink() {
    const url = this.linkPublico();
    const campo = this.$('#eng-link-url');
    if (campo) campo.value = url;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => this.showToast?.('Link copiado', 'ok'))
        .catch(() => this.showToast?.('Copie o link do campo acima'));
    } else {
      this.showToast?.('Copie o link do campo acima');
    }
  }

  abrirModalLink() {
    const campo = this.$('#eng-link-url');
    if (campo) campo.value = this.linkPublico();
    this.$('#modal-eng-link')?.classList.add('active');
  }

  fecharModalLink() {
    this.$('#modal-eng-link')?.classList.remove('active');
  }
}

export default EngajamentoModule;
