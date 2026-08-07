// Pró-labore dos Sócios
// Cartões de Pró-labore e Cartão Cooper por sócio, por competência (mês/ano),
// com descontos e cálculo do salário líquido.

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

    this.init();
  }

  init() {
    document.addEventListener('change', (e) => {
      if (e.target.id === 'prolab-competencia') this.render();
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

  _descontos(r) {
    return r.tipo === 'cooper'
      ? (parseFloat(r.unimed) || 0) + (parseFloat(r.telefone) || 0)
      : (parseFloat(r.inss) || 0) + (parseFloat(r.unimed) || 0) + (parseFloat(r.adiantamento) || 0);
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
    const compAtual = sel?.value && comps.includes(sel.value) ? sel.value : comps[0];
    if (sel) {
      sel.innerHTML = comps.map(c => `<option value="${c}">${this._labelCompetencia(c)}</option>`).join('');
      sel.value = compAtual;
    }

    const lista = this.PROLABORE
      .filter(r => r.competencia === compAtual)
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
        ? linha('Unimed', r.unimed || null) + linha('Telefone', r.telefone || null)
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
    const socios = new Set(lista.map(r => r.socio)).size;
    if (this.$('#prolab-stat-socios')) this.$('#prolab-stat-socios').textContent = socios;
    if (this.$('#prolab-stat-lancamentos')) this.$('#prolab-stat-lancamentos').textContent = lista.length;
    if (this.$('#prolab-stat-liquido')) this.$('#prolab-stat-liquido').textContent = this.fmtBRL(totLiquido);
  }

  abrirModal(id = null) {
    const form = this.$('#form-prolabore');
    form.reset();
    if (id != null) {
      const r = this.PROLABORE.find(x => x.id === id);
      if (r) {
        this.$('#prolab-modal-title').textContent = 'Editar lançamento';
        for (const [k, v] of Object.entries(r)) {
          const f = form.elements[k];
          if (f) f.value = v ?? '';
        }
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
    setDisplay('prolab-grp-inss', !isCooper);
    setDisplay('prolab-grp-adiant', !isCooper);
    setDisplay('prolab-grp-telefone', isCooper);
    const lbl = this.$('#prolab-lbl-base');
    if (lbl) lbl.textContent = isCooper ? 'Benefício (R$)' : 'Salário Base (R$)';
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
    const payload = {
      socio:        (data.socio || '').trim(),
      competencia:  data.competencia,
      tipo:         data.tipo || 'prolabore',
      valor_base:   num(data.valor_base),
      inss:         num(data.inss),
      unimed:       num(data.unimed),
      adiantamento: num(data.adiantamento),
      telefone:     num(data.telefone),
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

    // Garante que a competência salva seja a exibida
    const sel = this.$('#prolab-competencia');
    if (sel && payload.competencia) sel.value = payload.competencia;

    this.showToast(id != null ? 'Lançamento atualizado' : 'Lançamento cadastrado', 'ok');
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
