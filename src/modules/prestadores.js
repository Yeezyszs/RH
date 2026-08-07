// Prestadores de Serviço Module
// Controle de documentação de terceiros: ASO, treinamentos, ficha de EPI,
// certidões FGTS/INSS e requisitos de segurança de alimentos.

const CONFORME_BADGE = {
  conforme:     { t: 'Conforme',     cls: 'ok' },
  nao_conforme: { t: 'Não conforme', cls: 'danger' },
  pendente:     { t: 'Pendente',     cls: 'warn' },
  na:           { t: 'N/A',          cls: 'neutral' },
};

const CERTIDAO_BADGE = {
  negativa: { t: 'Negativa', cls: 'ok' },
  positiva: { t: 'Positiva', cls: 'danger' },
  pendente: { t: 'Pendente', cls: 'warn' },
};

export class PrestadoresModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.fmtDate = deps.fmtDate;
    this.diasAte = deps.diasAte;
    this.PRESTADORES = deps.PRESTADORES;
    this.Auth = deps.Auth;
    this.PrestadoresServico = deps.PrestadoresServico;
    this.showToast = deps.showToast;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'prest-search') { clearTimeout(this._searchT); this._searchT = setTimeout(() => this.render(), 250); }
    });
    document.addEventListener('change', (e) => {
      if (['prest-filter-empresa', 'prest-filter-status'].includes(e.target.id)) this.render();
    });
    document.querySelectorAll('.nav-item[data-page="prestadores"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  // Situação geral do prestador: irregular se qualquer doc reprova,
  // atenção se algo está pendente ou ASO vence em <=30d, senão regular.
  _situacao(p) {
    const reprovado = p.treinamentos === 'nao_conforme' || p.ficha_epi === 'nao_conforme'
      || p.seguranca_alimentos === 'nao_conforme' || p.fgts === 'positiva' || p.inss === 'positiva';
    const asoDias = p.aso_valido_ate ? this.diasAte(p.aso_valido_ate) : null;
    if (reprovado || (asoDias != null && asoDias < 0)) return 'irregular';
    const pendente = [p.treinamentos, p.ficha_epi, p.fgts, p.inss, p.seguranca_alimentos].includes('pendente')
      || asoDias == null || asoDias <= 30;
    return pendente ? 'atencao' : 'regular';
  }

  _situacaoBadge(s) {
    if (s === 'irregular') return `<span class="badge danger">Irregular</span>`;
    if (s === 'atencao')   return `<span class="badge warn">Atenção</span>`;
    return `<span class="badge ok">Regular</span>`;
  }

  _asoCell(p) {
    if (!p.aso_valido_ate) return `<span class="badge warn">Sem ASO</span>`;
    const dias = this.diasAte(p.aso_valido_ate);
    const data = this.fmtDate(p.aso_valido_ate);
    if (dias < 0)   return `<span class="badge danger" title="Vencido">${data}</span>`;
    if (dias <= 30) return `<span class="badge warn" title="${dias}d restantes">${data}</span>`;
    return `<span class="cell-mono">${data}</span>`;
  }

  _b(map, v) {
    const b = map[v] || { t: v || '—', cls: 'neutral' };
    return `<span class="badge ${b.cls}">${this.h(b.t)}</span>`;
  }

  render() {
    const tb = this.$('#tb-prestadores');
    if (!tb) return;

    // Popula filtro de empresas
    const selEmp = this.$('#prest-filter-empresa');
    if (selEmp) {
      const cur = selEmp.value;
      const empresas = [...new Set(this.PRESTADORES.map(p => p.empresa).filter(Boolean))].sort();
      selEmp.innerHTML = '<option value="">Todas as empresas</option>' +
        empresas.map(e => `<option value="${this.h(e)}">${this.h(e)}</option>`).join('');
      selEmp.value = cur;
    }

    const q    = (this.$('#prest-search')?.value || '').trim().toLowerCase();
    const fEmp = this.$('#prest-filter-empresa')?.value || '';
    const fSt  = this.$('#prest-filter-status')?.value || '';

    const enriched = this.PRESTADORES.map(p => ({ ...p, _sit: this._situacao(p) }));

    const lista = enriched.filter(p => {
      if (fEmp && p.empresa !== fEmp) return false;
      if (fSt && p._sit !== fSt) return false;
      if (q) {
        const hay = [p.nome, p.empresa, p.funcao, p.cpf].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (a.empresa || '').localeCompare(b.empresa || '') || (a.nome || '').localeCompare(b.nome || ''));

    tb.innerHTML = lista.length ? lista.map(p => `
      <tr>
        <td style="font-weight:600">${this.h(p.empresa)}</td>
        <td>
          <div class="cell-person-name">${this.h(p.nome)}</div>
          <div class="cell-person-sub">${this.h(p.cpf || '—')}</div>
        </td>
        <td>${this.h(p.funcao || '—')}</td>
        <td>${this._asoCell(p)}</td>
        <td>${this._b(CONFORME_BADGE, p.treinamentos)}</td>
        <td>${this._b(CONFORME_BADGE, p.ficha_epi)}</td>
        <td>${this._b(CERTIDAO_BADGE, p.fgts)}</td>
        <td>${this._b(CERTIDAO_BADGE, p.inss)}</td>
        <td>${this._b(CONFORME_BADGE, p.seguranca_alimentos)}</td>
        <td>${this._situacaoBadge(p._sit)}</td>
        <td class="actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalPrestador(${p.id})">✎</button>
          <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirPrestador(${p.id})">🗑</button>
        </td>
      </tr>
    `).join('') : `<tr><td colspan="11" class="empty">Nenhum prestador cadastrado</td></tr>`;

    const tot = (s) => enriched.filter(p => p._sit === s).length;
    this.$('#prest-stat-total').textContent     = enriched.length;
    this.$('#prest-stat-regular').textContent   = tot('regular');
    this.$('#prest-stat-atencao').textContent   = tot('atencao');
    this.$('#prest-stat-irregular').textContent = tot('irregular');
  }

  abrirModal(id = null) {
    const form = this.$('#form-prestador');
    form.reset();
    if (id != null) {
      const p = this.PRESTADORES.find(x => x.id === id);
      if (p) {
        this.$('#prest-modal-title').textContent = 'Editar prestador';
        for (const [k, v] of Object.entries(p)) {
          const f = form.elements[k];
          if (f) f.value = v ?? '';
        }
      }
    } else {
      this.$('#prest-modal-title').textContent = 'Novo prestador de serviço';
    }
    this.$('#modal-prestador').classList.add('active');
  }

  fecharModal() {
    this.$('#modal-prestador').classList.remove('active');
  }

  async salvar(ev) {
    ev.preventDefault();
    const form = this.$('#form-prestador');
    const data = Object.fromEntries(new FormData(form));
    const id = data.id ? parseInt(data.id, 10) : null;

    const payload = {
      empresa:             (data.empresa || '').trim(),
      nome:                (data.nome || '').trim(),
      cpf:                 data.cpf || '',
      funcao:              data.funcao || '',
      aso_valido_ate:      data.aso_valido_ate || null,
      treinamentos:        data.treinamentos || 'pendente',
      ficha_epi:           data.ficha_epi || 'pendente',
      fgts:                data.fgts || 'pendente',
      inss:                data.inss || 'pendente',
      seguranca_alimentos: data.seguranca_alimentos || 'pendente',
      observacoes:         data.observacoes || '',
    };

    if (!payload.empresa || !payload.nome) {
      this.showToast('Informe a empresa e o nome do colaborador', 'err');
      return;
    }

    const temSessao = this.PrestadoresServico && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        if (id != null) {
          const saved = await this.PrestadoresServico.atualizar(id, payload);
          const i = this.PRESTADORES.findIndex(x => x.id === id);
          if (i >= 0) this.PRESTADORES[i] = saved;
        } else {
          const saved = await this.PrestadoresServico.criar(payload);
          if (saved) this.PRESTADORES.unshift(saved);
        }
      } catch (err) { this.showToast('Erro ao salvar: ' + err.message, 'err'); return; }
    } else {
      if (id != null) {
        const i = this.PRESTADORES.findIndex(x => x.id === id);
        if (i >= 0) this.PRESTADORES[i] = { ...this.PRESTADORES[i], ...payload };
      } else {
        const newId = Math.max(0, ...this.PRESTADORES.map(x => x.id)) + 1;
        this.PRESTADORES.unshift({ id: newId, ...payload });
      }
    }

    this.showToast(id != null ? 'Prestador atualizado' : 'Prestador cadastrado', 'ok');
    this.fecharModal();
    this.render();
  }

  async excluir(id) {
    if (!confirm('Excluir este prestador?')) return;
    const temSessao = this.PrestadoresServico && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try { await this.PrestadoresServico.excluir(id); } catch (err) { this.showToast('Erro: ' + err.message, 'err'); return; }
    }
    const idx = this.PRESTADORES.findIndex(x => x.id === id);
    if (idx >= 0) this.PRESTADORES.splice(idx, 1);
    this.render();
    this.showToast('Prestador excluído');
  }
}

export default PrestadoresModule;
