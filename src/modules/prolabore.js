// Pró-labore dos Sócios
// Cartões de Pró-labore e Cartão Cooper por sócio, por competência (mês/ano),
// com descontos e cálculo do salário líquido.

import { limparFormulario } from '../utils/ui.js?v=dev';

const TIPO_LABEL = { prolabore: 'Pró-labore', cooper: 'Cooper' };

export class ProlaboreModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.fmtBRL = deps.fmtBRL;
    this.PROLABORE = deps.PROLABORE;
    this.Auth = deps.Auth;
    this.ProlaboreSocios = deps.ProlaboreSocios;
    this.showToast = deps.showToast;

    this._itensModal = [];  // itens do Cooper no modal em edição
    this._itemSeq = 0;
    this._compAlvo = null;  // competência a forçar na tela após salvar

    this.init();
  }

  init() {
    document.addEventListener('change', (e) => {
      if (['prolab-competencia', 'prolab-filter-socio'].includes(e.target.id)) this.render();
    });
    document.querySelectorAll('.nav-item[data-page="prolabore"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  _competenciaAtual() {
    // Sem Date.now proibido em workflows, mas aqui é browser normal.
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  _labelCompetencia(comp) {
    if (!comp) return '—';
    const [ano, mes] = comp.split('-');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${meses[parseInt(mes, 10) - 1] || mes}/${ano}`;
  }

  _itensDe(r) {
    return Array.isArray(r.itens) ? r.itens : [];
  }

  _descontos(r) {
    if (r.tipo === 'cooper') {
      return this._itensDe(r).reduce((s, it) => s + (parseFloat(it.valor) || 0), 0);
    }
    return (parseFloat(r.inss) || 0) + (parseFloat(r.unimed) || 0) + (parseFloat(r.adiantamento) || 0);
  }

  _liquido(r) {
    return (parseFloat(r.valor_base) || 0) - this._descontos(r);
  }

  render() {
    const grid = this.$('#prolab-grid');
    if (!grid) return;

    // Popula seletor de competências (as existentes + a atual)
    const sel = this.$('#prolab-competencia');
    const comps = [...new Set([this._competenciaAtual(), ...this.PROLABORE.map(r => r.competencia)])]
      .filter(Boolean).sort().reverse();
    // Prioriza a competência-alvo (recém-salva), depois a selecionada, depois a mais recente.
    const alvo = this._compAlvo;
    this._compAlvo = null;
    const compAtual = (alvo && comps.includes(alvo)) ? alvo
      : (sel?.value && comps.includes(sel.value)) ? sel.value
      : comps[0];
    if (sel) {
      sel.innerHTML = comps.map(c => `<option value="${c}">${this._labelCompetencia(c)}</option>`).join('');
      sel.value = compAtual;
    }

    // Popula o filtro de sócio (com os sócios que têm lançamento na competência)
    const selSoc = this.$('#prolab-filter-socio');
    const socios = [...new Set(this.PROLABORE.filter(r => r.competencia === compAtual).map(r => r.socio).filter(Boolean))].sort();
    let socioSel = selSoc?.value || '';
    if (selSoc) {
      if (socioSel && !socios.includes(socioSel)) socioSel = '';
      selSoc.innerHTML = '<option value="">Todos os sócios</option>' +
        socios.map(s => `<option value="${this.h(s)}">${this.h(s)}</option>`).join('');
      selSoc.value = socioSel;
    }

    const lista = this.PROLABORE
      .filter(r => r.competencia === compAtual)
      .filter(r => !socioSel || r.socio === socioSel)
      .sort((a, b) => (a.socio || '').localeCompare(b.socio || '') || a.tipo.localeCompare(b.tipo));

    const linha = (label, valor, opts = {}) => `
      <div style="display:flex; justify-content:space-between; align-items:baseline; padding:5px 12px; ${opts.borderTop ? 'border-top:1px solid var(--border);' : ''} ${opts.strong ? 'font-weight:700; background:var(--bluish-bg);' : ''}">
        <span style="${opts.strong ? 'color:var(--phthalo-dark);' : 'color:var(--text-muted); font-size:.86rem;'}">${this.h(label)}</span>
        <span class="cell-mono" style="${opts.strong ? 'color:var(--phthalo-dark);' : ''}${opts.neg ? 'color:var(--danger);' : ''}">${valor == null ? '—' : 'R$ ' + this.fmtBRL(valor).replace('R$', '').trim()}</span>
      </div>`;

    grid.innerHTML = lista.length ? lista.map(r => {
      const isCooper = r.tipo === 'cooper';
      const liquido = this._liquido(r);
      const baseLabel = isCooper ? 'Benefício' : 'Salário Base';
      const headerBg = isCooper ? 'linear-gradient(135deg,#166534,#14532D)' : 'linear-gradient(135deg,#1f2937,#111827)';

      const descontosHtml = isCooper
        ? (this._itensDe(r).length
            ? this._itensDe(r).map(it => linha(it.descricao || 'Item', (parseFloat(it.valor) || 0) || null)).join('')
            : linha('Sem descontos', null))
        : linha('INSS', r.inss || null) + linha('Unimed', r.unimed || null) + linha('Adiantamento', r.adiantamento || null);

      return `
        <div class="widget" style="padding:0; overflow:hidden;">
          <div style="background:${headerBg}; color:#fff; padding:10px 14px;">
            <div style="font-weight:700;">${TIPO_LABEL[r.tipo] || r.tipo}</div>
            <div style="font-size:.82rem; opacity:.85;">Sócio: ${this.h(r.socio)}</div>
          </div>
          ${linha(baseLabel, r.valor_base || 0)}
          ${descontosHtml}
          ${linha('Salário Bruto', r.valor_base || 0, { borderTop: true })}
          ${linha('Salário Líquido', liquido > 0 ? liquido : (liquido === 0 ? null : liquido), { strong: true, neg: liquido < 0 })}
          <div style="display:flex; justify-content:flex-end; gap:4px; padding:8px 10px; border-top:1px solid var(--border-soft);">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalProlabore(${r.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirProlabore(${r.id})">🗑</button>
          </div>
        </div>
      `;
    }).join('') : `<div class="empty" style="grid-column:1/-1; background:var(--white); border:1px solid var(--border); border-radius:12px;">Nenhum lançamento em ${this._labelCompetencia(compAtual)}. Clique em “+ Novo lançamento”.</div>`;

    // Stats
    const totLiquido = lista.reduce((s, r) => s + Math.max(0, this._liquido(r)), 0);
    const qtdSocios = new Set(lista.map(r => r.socio)).size;
    if (this.$('#prolab-stat-socios')) this.$('#prolab-stat-socios').textContent = qtdSocios;
    if (this.$('#prolab-stat-lancamentos')) this.$('#prolab-stat-lancamentos').textContent = lista.length;
    if (this.$('#prolab-stat-liquido')) this.$('#prolab-stat-liquido').textContent = this.fmtBRL(totLiquido);
  }

  abrirModal(id = null) {
    const form = this.$('#form-prolabore');
    limparFormulario(form);
    this._itensModal = [];
    if (id != null) {
      const r = this.PROLABORE.find(x => x.id === id);
      if (r) {
        this.$('#prolab-modal-title').textContent = 'Editar lançamento';
        for (const [k, v] of Object.entries(r)) {
          const f = form.elements[k];
          if (f && k !== 'itens') f.value = v ?? '';
        }
        this._itensModal = this._itensDe(r).map(it => ({ _sid: ++this._itemSeq, descricao: it.descricao || '', valor: it.valor ?? '' }));
      }
    } else {
      this.$('#prolab-modal-title').textContent = 'Novo lançamento';
      form.elements['competencia'].value = this.$('#prolab-competencia')?.value || this._competenciaAtual();
      form.elements['tipo'].value = 'prolabore';
    }
    this.atualizarCamposTipo();
    this.$('#modal-prolabore').classList.add('active');
  }

  // Mostra os campos de desconto conforme o tipo e ajusta o rótulo do valor base
  atualizarCamposTipo() {
    const tipo = this.$('#form-prolabore')?.elements['tipo']?.value || 'prolabore';
    const isCooper = tipo === 'cooper';
    const setDisplay = (id, show) => { const el = this.$('#' + id); if (el) el.style.display = show ? '' : 'none'; };
    // Pró-labore: campos fixos. Cooper: lista dinâmica de itens.
    setDisplay('prolab-grp-inss', !isCooper);
    setDisplay('prolab-grp-unimed', !isCooper);
    setDisplay('prolab-grp-adiant', !isCooper);
    setDisplay('prolab-itens-section', isCooper);
    const lbl = this.$('#prolab-lbl-base');
    if (lbl) lbl.textContent = isCooper ? 'Benefício (R$)' : 'Salário Base (R$)';
    // Ao mudar para Cooper sem itens, sugere Unimed e Telefone como base editável
    if (isCooper && this._itensModal.length === 0) {
      this._itensModal = [
        { _sid: ++this._itemSeq, descricao: 'Unimed', valor: '' },
        { _sid: ++this._itemSeq, descricao: 'Telefone', valor: '' },
      ];
    }
    if (isCooper) this.renderItensModal();
  }

  renderItensModal() {
    const cont = this.$('#prolab-itens-lista');
    if (!cont) return;
    cont.innerHTML = this._itensModal.map(it => `
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;" data-sid="${it._sid}">
        <input type="text" value="${this.h(it.descricao)}" placeholder="Descrição (ex.: Pá carregadeira)"
               oninput="prolabItemInput(${it._sid}, 'descricao', this.value)" style="flex:1;">
        <input type="number" step="0.01" min="0" value="${it.valor}" placeholder="0,00"
               oninput="prolabItemInput(${it._sid}, 'valor', this.value)" style="width:120px; text-align:right;">
        <button type="button" class="btn btn-ghost btn-sm btn-icon" title="Remover" onclick="prolabRemoverItem(${it._sid})">🗑</button>
      </div>
    `).join('') || `<div class="cell-person-sub" style="padding:4px 0;">Nenhum item — clique em “+ Adicionar item”.</div>`;
  }

  adicionarItem() {
    this._itensModal.push({ _sid: ++this._itemSeq, descricao: '', valor: '' });
    this.renderItensModal();
  }

  removerItem(sid) {
    this._itensModal = this._itensModal.filter(x => x._sid !== sid);
    this.renderItensModal();
  }

  itemInput(sid, campo, valor) {
    const it = this._itensModal.find(x => x._sid === sid);
    if (it) it[campo] = valor;
  }

  fecharModal() {
    this.$('#modal-prolabore').classList.remove('active');
  }

  async salvar(ev) {
    ev.preventDefault();
    const form = this.$('#form-prolabore');
    const data = Object.fromEntries(new FormData(form));
    const id = data.id ? parseInt(data.id, 10) : null;

    const num = (v) => parseFloat(String(v).replace(',', '.')) || 0;
    const isCooper = (data.tipo || 'prolabore') === 'cooper';
    const itens = isCooper
      ? this._itensModal
          .map(it => ({ descricao: (it.descricao || '').trim(), valor: num(it.valor) }))
          .filter(it => it.descricao || it.valor)
      : [];

    const payload = {
      socio:        (data.socio || '').trim(),
      competencia:  data.competencia,
      tipo:         data.tipo || 'prolabore',
      valor_base:   num(data.valor_base),
      inss:         isCooper ? 0 : num(data.inss),
      unimed:       isCooper ? 0 : num(data.unimed),
      adiantamento: isCooper ? 0 : num(data.adiantamento),
      telefone:     0,
      itens:        itens,
      observacoes:  data.observacoes || '',
    };

    if (!payload.socio) { this.showToast('Informe o sócio', 'err'); return; }
    if (!payload.competencia) { this.showToast('Informe a competência', 'err'); return; }

    const temSessao = this.ProlaboreSocios && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        if (id != null) {
          const saved = await this.ProlaboreSocios.atualizar(id, payload);
          const i = this.PROLABORE.findIndex(x => x.id === id);
          if (i >= 0) this.PROLABORE[i] = saved;
        } else {
          const saved = await this.ProlaboreSocios.criar(payload);
          if (saved) this.PROLABORE.unshift(saved);
        }
      } catch (err) { this.showToast('Erro ao salvar: ' + err.message, 'err'); return; }
    } else {
      if (id != null) {
        const i = this.PROLABORE.findIndex(x => x.id === id);
        if (i >= 0) this.PROLABORE[i] = { ...this.PROLABORE[i], ...payload };
      } else {
        const newId = Math.max(0, ...this.PROLABORE.map(x => x.id)) + 1;
        this.PROLABORE.unshift({ id: newId, ...payload });
      }
    }

    // Força a tela a exibir a competência do lançamento salvo (mesmo se for um
    // mês novo, que ainda não existia no seletor). Também limpa o filtro de
    // sócio para garantir que o lançamento apareça.
    this._compAlvo = payload.competencia;
    const selSoc = this.$('#prolab-filter-socio');
    if (selSoc && selSoc.value && selSoc.value !== payload.socio) selSoc.value = '';

    this.showToast(
      `${id != null ? 'Lançamento atualizado' : 'Lançamento cadastrado'} · ${this._labelCompetencia(payload.competencia)}`,
      'ok'
    );
    this.fecharModal();
    this.render();
  }

  async excluir(id) {
    if (!confirm('Excluir este lançamento?')) return;
    const temSessao = this.ProlaboreSocios && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try { await this.ProlaboreSocios.excluir(id); } catch (err) { this.showToast('Erro: ' + err.message, 'err'); return; }
    }
    const idx = this.PROLABORE.findIndex(x => x.id === id);
    if (idx >= 0) this.PROLABORE.splice(idx, 1);
    this.render();
    this.showToast('Lançamento excluído');
  }
}

export default ProlaboreModule;
