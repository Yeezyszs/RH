// Painel de Benefícios (consolidado)
// Visão única por colaborador — INCLUI inativos/desligados para auditoria.
// Junta: Vale Combustível (cota), Vale Alimentação, Férias e Salário.

const BEN_STATUS_BADGE = {
  ativo:    { t: 'Ativo',    cls: 'ok' },
  ferias:   { t: 'Férias',   cls: 'info' },
  afastado: { t: 'Afastado', cls: 'warn' },
  inativo:  { t: 'Desligado', cls: 'neutral' },
};

export class BeneficiosModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtBRL = deps.fmtBRL;
    this.fmtDate = deps.fmtDate;
    this.COLABORADORES = deps.COLABORADORES;
    this.VALE_COTAS = deps.VALE_COTAS;
    this.VA_BENEFICIOS = deps.VA_BENEFICIOS;
    this.SALARIOS = deps.SALARIOS;
    this.FERIAS = deps.FERIAS;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'ben-search') { clearTimeout(this._searchT); this._searchT = setTimeout(() => this.render(), 250); }
    });
    document.addEventListener('change', (e) => {
      if (['ben-filter-setor', 'ben-filter-status'].includes(e.target.id)) this.render();
    });
    document.querySelectorAll('.nav-item[data-page="beneficios"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  _vaMensal(b) {
    if (!b) return 0;
    if (b.tipo === 'fixo') return parseFloat(b.valor) || 0;
    const dias = b.dias_uteis || 22;
    return (parseFloat(b.valor) || 0) * dias;
  }

  // Situação de férias do colaborador: período vigente > próximo > último.
  _ferias(colabId) {
    const hoje = new Date().toISOString().slice(0, 10);
    const periodos = (this.FERIAS || []).filter(f => f.colaborador_id === colabId);
    if (!periodos.length) return null;
    const vigente = periodos.find(p => p.inicio <= hoje && p.fim >= hoje);
    if (vigente) return { p: vigente, estado: 'em_curso' };
    const futuros = periodos.filter(p => p.inicio > hoje).sort((a, b) => a.inicio.localeCompare(b.inicio));
    if (futuros.length) return { p: futuros[0], estado: 'planejada' };
    const passados = [...periodos].sort((a, b) => b.fim.localeCompare(a.fim));
    return { p: passados[0], estado: 'concluida' };
  }

  _feriasCell(colabId) {
    const f = this._ferias(colabId);
    if (!f) return `<span style="color:var(--text-soft)">—</span>`;
    const periodo = `${this.fmtDate(f.p.inicio)} → ${this.fmtDate(f.p.fim)}`;
    const badge = f.estado === 'em_curso'  ? `<span class="badge info">Em curso</span>`
                : f.estado === 'planejada' ? `<span class="badge warn">Planejada</span>`
                                           : `<span class="badge neutral">Concluída</span>`;
    return `<div>${badge}</div><div class="cell-person-sub cell-mono">${periodo}</div>`;
  }

  render() {
    const tb = this.$('#tb-beneficios');
    if (!tb) return;

    // Popula filtro de setor
    const selSet = this.$('#ben-filter-setor');
    if (selSet) {
      const cur = selSet.value;
      const setores = [...new Set(this.COLABORADORES.map(c => c.setor).filter(Boolean))].sort();
      selSet.innerHTML = '<option value="">Todos os setores</option>' +
        setores.map(s => `<option value="${this.h(s)}">${this.h(s)}</option>`).join('');
      selSet.value = cur;
    }

    const q     = (this.$('#ben-search')?.value || '').trim().toLowerCase();
    const fSet  = this.$('#ben-filter-setor')?.value || '';
    const fSt   = this.$('#ben-filter-status')?.value || '';

    const linhas = this.COLABORADORES.map(c => {
      const vc = parseFloat(this.VALE_COTAS[c.id] || 0);
      const va = this._vaMensal(this.VA_BENEFICIOS[c.id]);
      const sal = parseFloat(this.SALARIOS[c.id]?.valor || 0);
      return { c, vc, va, sal };
    });

    const filtradas = linhas.filter(r => {
      if (fSet && r.c.setor !== fSet) return false;
      if (fSt && (r.c.status || 'ativo') !== fSt) return false;
      if (q) {
        const hay = [r.c.nome, r.c.setor, r.c.area].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      // Ativos primeiro, depois por nome
      const ai = a.c.status === 'inativo' ? 1 : 0;
      const bi = b.c.status === 'inativo' ? 1 : 0;
      return ai - bi || a.c.nome.localeCompare(b.c.nome);
    });

    tb.innerHTML = filtradas.length ? filtradas.map(r => {
      const c = r.c;
      const st = BEN_STATUS_BADGE[c.status] || { t: c.status || '—', cls: 'neutral' };
      const inativo = c.status === 'inativo';
      const deslig = inativo && c.data_desligamento
        ? `<div class="cell-person-sub cell-mono">deslig. ${this.fmtDate(c.data_desligamento)}</div>` : '';
      const valOrDash = (v) => v > 0
        ? `<span class="cell-mono">${this.fmtBRL(v)}</span>`
        : `<span style="color:var(--text-soft)">—</span>`;
      return `
        <tr onclick="if(${c.id}) abrirDrawerColab(${c.id})" style="${inativo ? 'opacity:.72;' : ''}">
          <td>
            <div class="cell-person">
              <div class="cell-avatar">${this.h(this.iniciais(c.nome))}</div>
              <div>
                <div class="cell-person-name">${this.h(c.nome)}</div>
                <div class="cell-person-sub">${this.h(c.setor || '—')}${c.area ? ' · ' + this.h(c.area) : ''}</div>
              </div>
            </div>
          </td>
          <td><span class="badge ${st.cls}">${st.t}</span>${deslig}</td>
          <td style="text-align:right">${valOrDash(r.vc)}</td>
          <td style="text-align:right">${valOrDash(r.va)}</td>
          <td>${this._feriasCell(c.id)}</td>
          <td style="text-align:right">${valOrDash(r.sal)}</td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="6" class="empty">Nenhum colaborador encontrado</td></tr>`;

    const ativos   = filtradas.filter(r => r.c.status !== 'inativo').length;
    const deslig   = filtradas.filter(r => r.c.status === 'inativo').length;
    const custoVcVa = filtradas.reduce((s, r) => s + r.vc + r.va, 0);

    this.$('#ben-stat-total').textContent    = filtradas.length;
    this.$('#ben-stat-ativos').textContent   = ativos;
    this.$('#ben-stat-deslig').textContent   = deslig;
    this.$('#ben-stat-custo').textContent    = this.fmtBRL(custoVcVa);
  }
}

export default BeneficiosModule;
