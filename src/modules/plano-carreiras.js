// Plano de Carreiras Module
// Manages career structure (cargo grid by trilha) and individual development plans

const PC_NIVEL_LABEL = ['Trainee', 'Júnior', 'Pleno', 'Sênior', 'Especialista', 'Coordenador', 'Gerente'];

export class PlanoCarreirasModule {
  constructor(deps) {
    this.$             = deps.$;
    this.h             = deps.h;
    this.iniciais      = deps.iniciais;
    this.fmtDate       = deps.fmtDate;
    this.fmtBRL        = deps.fmtBRL;
    this.tempoCasa     = deps.tempoCasa;
    this.COLABORADORES = deps.COLABORADORES;
    this.SALARIOS      = deps.SALARIOS;
    this.PC_CARGOS     = deps.PC_CARGOS;
    this.PC_PLANOS     = deps.PC_PLANOS;
    this.Auth          = deps.Auth;
    this.PlanoCarreiras = deps.PlanoCarreiras;
    this.showToast     = deps.showToast;

    this._editandoCargoId      = null;
    this._editandoPlanoColabId = null;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'pc-search') this._renderIndividuais();
    });
    document.addEventListener('change', (e) => {
      if (e.target.id === 'pc-filter-trilha' || e.target.id === 'pc-filter-status') this._renderIndividuais();
    });
    document.querySelectorAll('.nav-item[data-page="plano-carreiras"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  render() {
    this._renderEstrutura();
    this._renderIndividuais();
  }

  _renderEstrutura() {
    const grid = this.$('#pc-trilhas-grid');
    if (!grid) return;

    const porTrilha = {};
    this.PC_CARGOS.forEach(c => {
      if (!porTrilha[c.trilha]) porTrilha[c.trilha] = [];
      porTrilha[c.trilha].push(c);
    });
    const trilhas = Object.keys(porTrilha).sort();

    const ativos = this.COLABORADORES.filter(c => c.status !== 'inativo');
    const vinc   = ativos.filter(c => this.PC_PLANOS[c.id]).length;
    this.$('#pc-stat-trilhas').textContent = trilhas.length;
    this.$('#pc-stat-cargos').textContent  = this.PC_CARGOS.length;
    this.$('#pc-stat-vinc').textContent    = vinc;
    this.$('#pc-stat-sem').textContent     = ativos.length - vinc;

    grid.innerHTML = trilhas.length ? trilhas.map(trilha => {
      const cargos = porTrilha[trilha].sort((a, b) => a.nivel - b.nivel);
      const colabsTrilha = ativos.filter(c => {
        const p     = this.PC_PLANOS[c.id];
        if (!p) return false;
        const cargo = this.PC_CARGOS.find(x => x.id === p.cargo_atual_id);
        return cargo && cargo.trilha === trilha;
      });
      const cargosHtml = cargos.map(cg => {
        const ocupantes = ativos.filter(c => this.PC_PLANOS[c.id]?.cargo_atual_id === cg.id).length;
        const faixa = (cg.salario_min || cg.salario_max)
          ? `${cg.salario_min ? this.fmtBRL(cg.salario_min) : '?'} – ${cg.salario_max ? this.fmtBRL(cg.salario_max) : '?'}`
          : '—';
        return `
          <div style="display:flex; align-items:center; gap:10px; padding:10px 4px; border-bottom:1px solid var(--border-soft); cursor:pointer;" onclick="abrirModalPcCargo(${cg.id})">
            <div style="font-family:var(--mono); font-size:.66rem; padding:3px 8px; border-radius:10px; background:var(--bluish-bg); color:var(--phthalo); font-weight:600; flex-shrink:0; min-width:90px; text-align:center;">${PC_NIVEL_LABEL[cg.nivel] || '—'}</div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:.88rem; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.h(cg.nome)}</div>
              <div class="cell-person-sub">${faixa}</div>
            </div>
            <span class="badge ${ocupantes > 0 ? 'ok' : 'neutral'}">${ocupantes}</span>
          </div>
        `;
      }).join('');
      return `
        <div class="widget">
          <div class="widget-header">
            <div class="widget-title">${this.h(trilha)}</div>
            <span class="widget-badge">${cargos.length} cargos · ${colabsTrilha.length} colabs</span>
          </div>
          ${cargosHtml}
        </div>
      `;
    }).join('') : `<div class="empty" style="grid-column:1/-1; background:var(--white); border:1px solid var(--border); border-radius:12px;">Nenhuma trilha cadastrada — clique em "+ Novo cargo"</div>`;
  }

  _renderIndividuais() {
    const tb = this.$('#tb-pc-individuais');
    if (!tb) return;

    const filtroTrilha = this.$('#pc-filter-trilha');
    if (filtroTrilha && filtroTrilha.options.length <= 1) {
      [...new Set(this.PC_CARGOS.map(c => c.trilha))].sort().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        filtroTrilha.appendChild(opt);
      });
    }

    const q   = (this.$('#pc-search')?.value || '').trim().toLowerCase();
    const fT  = this.$('#pc-filter-trilha')?.value || '';
    const fSt = this.$('#pc-filter-status')?.value || '';

    const ativos = this.COLABORADORES.filter(c => c.status !== 'inativo');
    const linhas = ativos.map(c => {
      const p         = this.PC_PLANOS[c.id];
      const cargoAtual = p ? this.PC_CARGOS.find(x => x.id === p.cargo_atual_id) : null;
      const cargoAlvo  = p?.cargo_alvo_id ? this.PC_CARGOS.find(x => x.id === p.cargo_alvo_id) : null;
      return { colab: c, plano: p, cargoAtual, cargoAlvo };
    });

    const filtradas = linhas.filter(r => {
      if (fT  && r.cargoAtual?.trilha !== fT)     return false;
      if (fSt === 'com_plano' && !r.plano)         return false;
      if (fSt === 'sem_plano' &&  r.plano)         return false;
      if (q && !r.colab.nome.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => {
      if (a.plano && !b.plano) return -1;
      if (!a.plano && b.plano) return 1;
      if (a.plano && b.plano) return (b.plano.progresso || 0) - (a.plano.progresso || 0);
      return a.colab.nome.localeCompare(b.colab.nome);
    });

    tb.innerHTML = filtradas.length ? filtradas.map(r => {
      const c = r.colab;
      const cargoAtualTxt = r.cargoAtual
        ? `<div style="font-weight:600">${this.h(r.cargoAtual.nome)}</div><div class="cell-person-sub">${PC_NIVEL_LABEL[r.cargoAtual.nivel]}</div>`
        : `<span style="color:var(--text-soft)">—</span>`;
      const trilhaTxt = r.cargoAtual ? `<span class="badge info">${this.h(r.cargoAtual.trilha)}</span>` : '—';
      const alvoTxt = r.cargoAlvo
        ? `<div>${this.h(r.cargoAlvo.nome)}</div><div class="cell-person-sub">prazo ${r.plano.prazo ? this.fmtDate(r.plano.prazo) : '—'}</div>`
        : (r.plano ? '<span style="color:var(--text-soft)">— sem alvo —</span>' : '<span style="color:var(--text-soft)">—</span>');
      const progresso = r.plano?.progresso ?? 0;
      const progressoBar = r.plano
        ? `<div style="display:flex; align-items:center; gap:8px;">
             <div style="flex:1; height:6px; background:var(--bluish-bg); border-radius:3px; overflow:hidden; max-width:100px;">
               <div style="height:100%; width:${progresso}%; background:${progresso >= 80 ? 'var(--success)' : progresso >= 40 ? 'var(--phthalo-light)' : 'var(--warning)'};"></div>
             </div>
             <span class="cell-mono" style="font-size:.78rem;">${progresso}%</span>
           </div>`
        : '<span class="badge neutral">Sem plano</span>';
      return `
        <tr onclick="abrirModalPcPlano(${c.id})">
          <td>
            <div class="cell-person">
              <div class="cell-avatar">${this.h(this.iniciais(c.nome))}</div>
              <div>
                <div class="cell-person-name">${this.h(c.nome)}</div>
                <div class="cell-person-sub">${this.h(c.cargo)}</div>
              </div>
            </div>
          </td>
          <td>
            <div>${this.h(c.setor)}</div>
            ${c.area ? `<div class="cell-person-sub">${this.h(c.area)}</div>` : ''}
          </td>
          <td>${cargoAtualTxt}</td>
          <td>${trilhaTxt}</td>
          <td>${alvoTxt}</td>
          <td>${progressoBar}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="${r.plano ? 'Editar plano' : 'Criar plano'}" onclick="abrirModalPcPlano(${c.id})">${r.plano ? '✎' : '+'}</button>
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="7" class="empty">Nenhum colaborador encontrado</td></tr>`;
  }

  abrirModalCargo(id = null) {
    this._editandoCargoId = id;
    const form = this.$('#form-pc-cargo');
    form.reset();
    if (id != null) {
      const c = this.PC_CARGOS.find(x => x.id === id);
      if (c) {
        this.$('#pc-cargo-title').textContent = `Editar cargo · ${c.nome}`;
        for (const [k, v] of Object.entries(c)) {
          const f = form.elements[k];
          if (f) f.value = v ?? '';
        }
        this.$('#btn-pc-cargo-excluir').style.display = '';
      }
    } else {
      this.$('#pc-cargo-title').textContent = 'Novo cargo';
      this.$('#btn-pc-cargo-excluir').style.display = 'none';
    }
    this.$('#modal-pc-cargo').classList.add('active');
  }

  fecharModalCargo() {
    this.$('#modal-pc-cargo').classList.remove('active');
    this._editandoCargoId = null;
  }

  salvarCargo(ev) {
    ev.preventDefault();
    const form = this.$('#form-pc-cargo');
    const data = Object.fromEntries(new FormData(form));
    const id   = data.id ? parseInt(data.id, 10) : null;

    const payload = {
      trilha:       data.trilha,
      nivel:        parseInt(data.nivel, 10) || 0,
      nome:         data.nome,
      salario_min:  data.salario_min ? parseFloat(data.salario_min) : null,
      salario_max:  data.salario_max ? parseFloat(data.salario_max) : null,
      competencias: data.competencias || '',
      descricao:    data.descricao || '',
    };

    if (id != null) {
      const i = this.PC_CARGOS.findIndex(x => x.id === id);
      if (i >= 0) this.PC_CARGOS[i] = { ...this.PC_CARGOS[i], ...payload };
      this.showToast('Cargo atualizado', 'ok');
    } else {
      const newId = Math.max(0, ...this.PC_CARGOS.map(x => x.id)) + 1;
      this.PC_CARGOS.unshift({ id: newId, ...payload });
      this.showToast('Cargo cadastrado', 'ok');
    }
    this.fecharModalCargo();
    this.render();
  }

  excluirCargoAtual() {
    if (this._editandoCargoId == null) return;
    const emUso = Object.values(this.PC_PLANOS).some(p =>
      p.cargo_atual_id === this._editandoCargoId || p.cargo_alvo_id === this._editandoCargoId);
    if (emUso) {
      this.showToast('Existem planos individuais referenciando este cargo', 'err');
      return;
    }
    if (!confirm('Excluir este cargo?')) return;
    const idx = this.PC_CARGOS.findIndex(x => x.id === this._editandoCargoId);
    if (idx >= 0) this.PC_CARGOS.splice(idx, 1);
    this.fecharModalCargo();
    this.render();
    this.showToast('Cargo excluído');
  }

  abrirModalPlano(colabId) {
    const c = this.COLABORADORES.find(x => x.id === colabId);
    if (!c) return;
    this._editandoPlanoColabId = colabId;

    const form = this.$('#form-pc-plano');
    form.reset();
    form.elements['colaborador_id'].value = colabId;

    this.$('#pc-plano-title').textContent = `Plano · ${c.nome}`;

    const sal = this.SALARIOS[c.id]?.valor;
    this.$('#pc-plano-resumo').innerHTML = `
      <div class="info-item"><div class="info-label">Setor / Área</div><div class="info-value">${this.h(c.setor)}${c.area ? ` · ${this.h(c.area)}` : ''}</div></div>
      <div class="info-item"><div class="info-label">Cargo (cadastro)</div><div class="info-value">${this.h(c.cargo || '—')}</div></div>
      <div class="info-item"><div class="info-label">Salário atual</div><div class="info-value mono">${sal ? this.fmtBRL(sal) : '<span style="color:var(--text-soft)">—</span>'}</div></div>
      <div class="info-item"><div class="info-label">Tempo de casa</div><div class="info-value mono">${this.tempoCasa(c.admissao)}</div></div>
    `;

    const opcoesAtual = this.PC_CARGOS
      .sort((a, b) => a.trilha.localeCompare(b.trilha) || a.nivel - b.nivel)
      .map(cg => `<option value="${cg.id}">${this.h(cg.trilha)} · ${PC_NIVEL_LABEL[cg.nivel]} · ${this.h(cg.nome)}</option>`).join('');
    form.elements['cargo_atual_id'].innerHTML = '<option value="">— selecione —</option>' + opcoesAtual;
    form.elements['cargo_alvo_id'].innerHTML  = '<option value="">— sem alvo definido —</option>' + opcoesAtual;

    const p = this.PC_PLANOS[colabId];
    if (p) {
      form.elements['cargo_atual_id'].value = p.cargo_atual_id || '';
      form.elements['cargo_alvo_id'].value  = p.cargo_alvo_id  || '';
      form.elements['prazo'].value          = p.prazo || '';
      form.elements['progresso'].value      = p.progresso ?? 0;
      form.elements['plano_acao'].value     = p.plano_acao || '';
      this.$('#btn-pc-plano-excluir').style.display = '';
    } else {
      this.$('#btn-pc-plano-excluir').style.display = 'none';
    }
    this.$('#modal-pc-plano').classList.add('active');
  }

  fecharModalPlano() {
    this.$('#modal-pc-plano').classList.remove('active');
    this._editandoPlanoColabId = null;
  }

  async salvarPlano(ev) {
    ev.preventDefault();
    const form    = this.$('#form-pc-plano');
    const data    = Object.fromEntries(new FormData(form));
    const colabId = parseInt(data.colaborador_id, 10);
    if (!colabId) return;
    if (!data.cargo_atual_id) {
      this.showToast('Defina o cargo atual', 'err');
      return;
    }

    const payload = {
      cargo_atual_id: parseInt(data.cargo_atual_id, 10),
      cargo_alvo_id:  data.cargo_alvo_id ? parseInt(data.cargo_alvo_id, 10) : null,
      prazo:          data.prazo || null,
      progresso:      parseInt(data.progresso, 10) || 0,
      plano_acao:     data.plano_acao || '',
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        const saved = await this.PlanoCarreiras.upsertPlano(colabId, payload);
        this.PC_PLANOS[colabId] = { ...payload, _dbId: saved.id };
      } catch (err) { this.showToast('Erro ao salvar: ' + err.message, 'err'); return; }
    } else {
      this.PC_PLANOS[colabId] = payload;
    }
    this.showToast('Plano salvo', 'ok');
    this.fecharModalPlano();
    this.render();
  }

  async excluirPlanoAtual() {
    if (!this._editandoPlanoColabId) return;
    if (!confirm('Remover o plano deste colaborador?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.PlanoCarreiras.excluirPlano(this._editandoPlanoColabId);
      } catch (err) { this.showToast('Erro ao excluir: ' + err.message, 'err'); return; }
    }
    delete this.PC_PLANOS[this._editandoPlanoColabId];
    this.fecharModalPlano();
    this.render();
    this.showToast('Plano removido');
  }
}

export default PlanoCarreirasModule;
