// EPI Module
// Gerencia catálogo de EPIs, entregas por colaborador e kits por setor

export class EpiModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate = deps.fmtDate;
    this.diasAte = deps.diasAte;
    this.EPI_CATALOGO = deps.EPI_CATALOGO;
    this.EPI_ENTREGAS = deps.EPI_ENTREGAS;
    this.EPI_KITS = deps.EPI_KITS;
    this.COLABORADORES = deps.COLABORADORES;
    this.SETOR_ICON = deps.SETOR_ICON;
    this.Auth = deps.Auth;
    this.Epis = deps.Epis;

    this._kitEditando = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'epi-search') this.render();
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'epi-filter-tipo' || e.target.id === 'epi-filter-status') this.render();
    });

    document.querySelectorAll('.nav-item[data-page="epi"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => {
        this.render();
        this.renderCatalogo();
        this.renderKits();
      }, 60));
    });
  }

  // Grupo efetivo de um item do catálogo: o campo grupo, ou o próprio nome.
  // Usado para que variações (ex.: tamanhos de bota) contem como um único EPI
  // na configuração de kits por área.
  _grupoDe(item) {
    return (item && item.grupo && String(item.grupo).trim()) || (item ? item.nome : '');
  }

  render() {
    const tb = this.$('#tb-epi-entregas');
    if (!tb) return;

    const filtroTipo = this.$('#epi-filter-tipo');
    if (filtroTipo && filtroTipo.options.length <= 1) {
      this.EPI_CATALOGO.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.nome;
        filtroTipo.appendChild(opt);
      });
    }

    const q     = (this.$('#epi-search')?.value || '').trim().toLowerCase();
    const fTipo = this.$('#epi-filter-tipo')?.value   || '';
    const fSt   = this.$('#epi-filter-status')?.value || '';

    const enriched = this.EPI_ENTREGAS.map(e => {
      const colab = this.COLABORADORES.find(c => c.id === e.colaborador_id);
      const tipo  = this.EPI_CATALOGO.find(t => t.id === e.epi_tipo_id);
      return { ...e, _colab: colab, _tipo: tipo, _status: this._epiStatus(e) };
    });

    const lista = enriched.filter(e => {
      if (fTipo && e.epi_tipo_id !== parseInt(fTipo, 10)) return false;
      if (fSt   && e._status !== fSt) return false;
      if (q) {
        const hay = [e._colab?.nome, e._tipo?.nome, e._tipo?.ca].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (a.proxima_troca || '').localeCompare(b.proxima_troca || ''));

    tb.innerHTML = lista.length
      ? lista.map(e => {
          const c = e._colab;
          const t = e._tipo;
          return `
            <tr onclick="if(${c?.id || 0}) abrirDrawerColab(${c?.id || 0})">
              <td>
                ${c ? `
                  <div class="cell-person">
                    <div class="cell-avatar">${this.h(this.iniciais(c.nome))}</div>
                    <div>
                      <div class="cell-person-name">${this.h(c.nome)}</div>
                      <div class="cell-person-sub">${this.h(c.setor)}</div>
                    </div>
                  </div>
                ` : `<span style="color:var(--text-soft)">—</span>`}
              </td>
              <td style="font-weight:500;">${this.h(t?.nome || '—')}</td>
              <td class="cell-mono">${this.h(t?.ca || '—')}</td>
              <td class="cell-mono">${this.fmtDate(e.data_entrega)}</td>
              <td class="cell-mono">${this.fmtDate(e.proxima_troca)}</td>
              <td class="cell-mono">${e.quantidade}</td>
              <td>${this._epiBadge(e._status)}</td>
              <td class="actions" onclick="event.stopPropagation()">
                ${!e.devolvido ? `<button class="btn btn-ghost btn-sm btn-icon" title="Devolver" onclick="devolverEpi(${e.id})">&#8617;</button>` : ''}
                <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalEpiEntrega(${e.id})">✎</button>
                <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirEpi(${e.id})">🗑</button>
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="8" class="empty">Nenhuma entrega encontrada</td></tr>`;

    const tot = (st) => enriched.filter(e => e._status === st).length;
    this.$('#epi-stat-vigentes').textContent = tot('vigente');
    this.$('#epi-stat-trocar').textContent   = tot('trocar');
    this.$('#epi-stat-vencidos').textContent = tot('vencido');
    this.$('#epi-stat-catalogo').textContent = this.EPI_CATALOGO.length;
  }

  renderCatalogo() {
    const tb = this.$('#tb-epi-catalogo');
    if (!tb) return;

    tb.innerHTML = this.EPI_CATALOGO.length
      ? this.EPI_CATALOGO.map(t => {
          const diasCa = t.validade_ca ? this.diasAte(t.validade_ca) : null;
          const badgeCa = diasCa == null ? '' :
            diasCa < 0   ? `<span class="badge danger" style="margin-left:6px">CA venc.</span>` :
            diasCa <= 90 ? `<span class="badge warn"   style="margin-left:6px">${diasCa}d</span>` : '';
          const ativas = this.EPI_ENTREGAS.filter(e => e.epi_tipo_id === t.id && !e.devolvido).length;
          const q = t.quantidade ?? 0;
          const qBadge = q === 0
            ? `<span class="badge danger">0</span>`
            : q <= 5
              ? `<span class="badge warn">${q}</span>`
              : `<span class="badge ok">${q}</span>`;
          const sub = t.grupo
            ? `Grupo: ${this.h(t.grupo)}`
            : this.h(t.fabricante || '—');
          return `
            <tr>
              <td style="font-weight:500;">${this.h(t.nome)}<div class="cell-person-sub">${sub}</div></td>
              <td class="cell-mono">${this.h(t.ca || '—')}</td>
              <td class="cell-mono" style="text-align:center;">${qBadge}</td>
              <td class="cell-mono">${this.fmtDate(t.validade_ca)} ${badgeCa}</td>
              <td class="cell-mono">${t.vida_util_meses || '—'}m</td>
              <td class="cell-mono">${ativas}</td>
              <td class="actions">
                <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="editarEpiCatalogo(${t.id})">✎</button>
                <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirEpiCatalogo(${t.id})">🗑</button>
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="7" class="empty">Catálogo vazio — cadastre o primeiro item acima</td></tr>`;

    const badge = this.$('#epi-cat-total-badge');
    if (badge) badge.textContent = `${this.EPI_CATALOGO.length} ${this.EPI_CATALOGO.length === 1 ? 'item' : 'itens'}`;

    // Sugestões de grupos já existentes (datalist do formulário)
    const dl = this.$('#epi-grupos-list');
    if (dl) {
      const grupos = [...new Set(this.EPI_CATALOGO.map(t => t.grupo).filter(Boolean))].sort();
      dl.innerHTML = grupos.map(g => `<option value="${this.h(g)}"></option>`).join('');
    }
  }

  renderKits() {
    const grid = this.$('#epi-kits-grid');
    if (!grid) return;

    const SEM_AREA = '— sem área —';
    const ativos = this.COLABORADORES.filter(c => c.status !== 'inativo');

    // Agrupa as áreas por setor (a configuração de kit é por ÁREA)
    const setorAreas = {};
    ativos.forEach(c => {
      const setor = c.setor || '—';
      const area  = c.area  || SEM_AREA;
      if (!setorAreas[setor]) setorAreas[setor] = new Set();
      setorAreas[setor].add(area);
    });

    // Mapa: id do item do catálogo -> grupo efetivo (grupo ou próprio nome).
    const grupoPorItem = {};
    this.EPI_CATALOGO.forEach(t => { grupoPorItem[t.id] = this._grupoDe(t); });

    // Grupos de EPI que um colaborador já recebeu (entregas ativas).
    const gruposEntregues = (colabId) => new Set(
      this.EPI_ENTREGAS
        .filter(e => e.colaborador_id === colabId && !e.devolvido)
        .map(e => grupoPorItem[e.epi_tipo_id])
        .filter(Boolean)
    );

    // Pendências por colaborador — o kit é definido pela ÁREA, em GRUPOS de EPI
    const colabsPendencias = ativos.map(c => {
      const kit = this.EPI_KITS[c.area] || [];
      if (!kit.length) return null;
      const possui = gruposEntregues(c.id);
      const faltando = kit.filter(grupo => !possui.has(grupo));
      if (!faltando.length) return null;
      return { colab: c, faltando };
    }).filter(Boolean);

    const cardArea = (setor, area) => {
      const kit = this.EPI_KITS[area] || [];
      const colabsArea = ativos.filter(c => (c.area || SEM_AREA) === area && (c.setor || '—') === setor);
      const n = colabsArea.length;

      if (kit.length === 0) {
        return `
          <div class="widget">
            <div class="widget-header">
              <div class="widget-title">${this.h(area)}</div>
              <span class="widget-badge">${n} ${n === 1 ? 'colab.' : 'colabs.'}</span>
            </div>
            <div class="empty" style="padding:20px 12px">Nenhum EPI definido — configure o kit</div>
            <div style="display:flex; justify-content:flex-end; padding:0 2px;">
              <button class="btn btn-sm" type="button" onclick="abrirModalEpiKit('${this.h(area)}')">Configurar kit</button>
            </div>
          </div>
        `;
      }

      const itensHtml = kit.map(grupo => {
        const itensGrupo = this.EPI_CATALOGO.filter(t => this._grupoDe(t) === grupo);
        const entregues = colabsArea.filter(c => gruposEntregues(c.id).has(grupo)).length;
        const pendentes = n - entregues;
        const coberturaPct = n ? (entregues / n) * 100 : 100;
        const icon = pendentes === 0
          ? `<span class="badge ok" style="margin-left:auto">${entregues}/${n}</span>`
          : pendentes <= Math.ceil(n * 0.2)
            ? `<span class="badge warn" style="margin-left:auto">${entregues}/${n}</span>`
            : `<span class="badge danger" style="margin-left:auto">${entregues}/${n}</span>`;
        const sub = itensGrupo.length > 1
          ? `${itensGrupo.length} variações · ${coberturaPct.toFixed(0)}% cobertura`
          : `${itensGrupo[0]?.ca ? 'CA ' + this.h(itensGrupo[0].ca) + ' · ' : ''}${coberturaPct.toFixed(0)}% cobertura`;
        return `
          <div style="display:flex; align-items:center; gap:10px; padding:8px 2px; border-bottom:1px solid var(--border-soft);">
            <div style="flex:1; min-width:0;">
              <div style="font-size:.88rem; font-weight:500; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.h(grupo)}</div>
              <div class="cell-person-sub">${sub}</div>
            </div>
            ${icon}
          </div>
        `;
      }).join('');

      return `
        <div class="widget">
          <div class="widget-header">
            <div class="widget-title">${this.h(area)}</div>
            <span class="widget-badge">${n} ${n === 1 ? 'colab.' : 'colabs.'} · ${kit.length} ${kit.length === 1 ? 'EPI' : 'EPIs'}</span>
          </div>
          ${itensHtml}
          <div style="display:flex; justify-content:flex-end; padding:10px 2px 2px;">
            <button class="btn btn-secondary btn-sm" type="button" onclick="abrirModalEpiKit('${this.h(area)}')">Editar kit</button>
          </div>
        </div>
      `;
    };

    const setores = Object.keys(setorAreas).sort((a, b) => a.localeCompare(b));
    let totalAreas = 0, areasConfig = 0;

    grid.innerHTML = setores.map(setor => {
      const areas = [...setorAreas[setor]].sort((a, b) => a.localeCompare(b));
      totalAreas += areas.length;
      areasConfig += areas.filter(a => (this.EPI_KITS[a] || []).length > 0).length;
      const header = `
        <div style="grid-column:1/-1; display:flex; align-items:center; gap:8px; margin:6px 0 -4px; font-weight:700; color:var(--phthalo-dark); font-size:1.02rem;">
          <span>${this.SETOR_ICON[setor] || '◆'}</span><span>${this.h(setor)}</span>
          <span class="cell-person-sub" style="font-weight:500;">· ${areas.length} ${areas.length === 1 ? 'área' : 'áreas'}</span>
        </div>`;
      return header + areas.map(area => cardArea(setor, area)).join('');
    }).join('');

    const totalPendencias = colabsPendencias.reduce((s, x) => s + x.faltando.length, 0);

    let esperadoTotal = 0;
    ativos.forEach(c => { esperadoTotal += (this.EPI_KITS[c.area] || []).length; });
    const cobertura = esperadoTotal ? (1 - totalPendencias / esperadoTotal) * 100 : 100;

    this.$('#epi-kits-stat-setores').textContent    = `${areasConfig}/${totalAreas}`;
    this.$('#epi-kits-stat-pend').textContent       = colabsPendencias.length;
    this.$('#epi-kits-stat-total-pend').textContent = totalPendencias;
    this.$('#epi-kits-stat-cobertura').textContent  = `${cobertura.toFixed(0)}%`;

    const tb = this.$('#tb-epi-pendencias');
    if (tb) {
      tb.innerHTML = colabsPendencias.length
        ? colabsPendencias.map(p => {
            const c = p.colab;
            const faltantes = p.faltando.join(' · ');
            return `
              <tr onclick="abrirDrawerColab(${c.id})">
                <td>
                  <div class="cell-person">
                    <div class="cell-avatar">${this.h(this.iniciais(c.nome))}</div>
                    <div>
                      <div class="cell-person-name">${this.h(c.nome)}</div>
                      <div class="cell-person-sub">${this.h(c.setor)}${c.area ? ' · ' + this.h(c.area) : ''}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div>${this.h(c.setor)}</div>
                  ${c.area ? `<div class="cell-person-sub">${this.h(c.area)}</div>` : ''}
                </td>
                <td>
                  <span class="badge danger">${p.faltando.length}</span>
                  <span style="color:var(--text-muted); font-size:.8rem; margin-left:8px;">${this.h(faltantes)}</span>
                </td>
                <td class="actions" onclick="event.stopPropagation()">
                  <button class="btn btn-ghost btn-sm btn-icon" title="Nova entrega" onclick="abrirModalEpiEntrega(null, ${c.id})">+</button>
                </td>
              </tr>
            `;
          }).join('')
        : `<tr><td colspan="4" class="empty">Nenhuma pendência — todas as entregas estão em dia 🎉</td></tr>`;
    }

    const pendBadge = this.$('#epi-kits-pend-badge');
    if (pendBadge) pendBadge.textContent = `${colabsPendencias.length} ${colabsPendencias.length === 1 ? 'colab.' : 'colabs.'}`;
  }

  abrirModalEntrega(id = null, colabIdPre = null) {
    const form = this.$('#form-epi-entrega');
    form.reset();

    this.$('#form-epi-colab').innerHTML = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => `<option value="${c.id}">${this.h(c.nome)} — ${this.h(c.setor)}</option>`)
      .join('');

    this.$('#form-epi-tipo').innerHTML = this.EPI_CATALOGO
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(t => `<option value="${t.id}">${this.h(t.nome)} — CA ${this.h(t.ca)}</option>`)
      .join('');

    if (id != null) {
      const e = this.EPI_ENTREGAS.find(x => x.id === id);
      if (e) {
        this.$('#modal-epi-entrega-title').textContent = 'Editar entrega';
        for (const [k, v] of Object.entries(e)) {
          const f = form.elements[k];
          if (f) f.value = v ?? '';
        }
      }
    } else {
      this.$('#modal-epi-entrega-title').textContent = 'Nova entrega de EPI';
      if (colabIdPre) form.elements['colaborador_id'].value = colabIdPre;

      const tipoSel = this.$('#form-epi-tipo');
      const upd = () => {
        const t = this.EPI_CATALOGO.find(x => x.id === parseInt(tipoSel.value, 10));
        const dataEntrega = form.elements['data_entrega'].value;
        if (t && dataEntrega) {
          const d = new Date(dataEntrega + 'T00:00:00');
          d.setMonth(d.getMonth() + (t.vida_util_meses || 12));
          form.elements['proxima_troca'].value = d.toISOString().slice(0, 10);
        }
      };
      tipoSel.addEventListener('change', upd, { once: false });
      form.elements['data_entrega'].addEventListener('change', upd, { once: false });
    }

    this.$('#modal-epi-entrega').classList.add('active');
  }

  fecharModalEntrega() {
    this.$('#modal-epi-entrega').classList.remove('active');
  }

  async salvarEntrega(ev) {
    ev.preventDefault();
    const form = this.$('#form-epi-entrega');
    const data = Object.fromEntries(new FormData(form));
    const id = data.id ? parseInt(data.id, 10) : null;

    const payload = {
      colaborador_id: parseInt(data.colaborador_id, 10),
      epi_tipo_id:    parseInt(data.epi_tipo_id, 10),
      data_entrega:   data.data_entrega,
      quantidade:     parseInt(data.quantidade, 10) || 1,
      proxima_troca:  data.proxima_troca || null,
      recebido_por:   data.recebido_por || '',
      observacoes:    data.observacoes || '',
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        if (id != null) {
          await this.Epis.atualizar(id, payload);
        } else {
          await this.Epis.criar(payload);
        }
      } catch (err) {
        window.showToast?.('Erro ao salvar: ' + err.message, 'err');
        return;
      }
    } else {
      if (id != null) {
        const i = this.EPI_ENTREGAS.findIndex(x => x.id === id);
        if (i >= 0) this.EPI_ENTREGAS[i] = { ...this.EPI_ENTREGAS[i], ...payload };
      } else {
        const newId = Math.max(0, ...this.EPI_ENTREGAS.map(x => x.id)) + 1;
        this.EPI_ENTREGAS.unshift({ id: newId, devolvido: false, ...payload });
      }
    }
    this.fecharModalEntrega();
    this.render();
    this.renderKits();
  }

  async devolver(id) {
    const e = this.EPI_ENTREGAS.find(x => x.id === id);
    if (!e) return;
    if (!confirm('Registrar devolução deste EPI?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Epis.atualizar(id, { devolvido: true, data_devolucao: new Date().toISOString().slice(0,10) });
      } catch (err) {
        window.showToast?.('Erro ao registrar devolução: ' + err.message, 'err');
        return;
      }
    } else {
      e.devolvido = true;
    }
    this.render();
    this.renderKits();
  }

  async excluirEntrega(id) {
    if (!confirm('Excluir este registro de entrega?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Epis.excluir(id);
      } catch (err) {
        window.showToast?.('Erro ao excluir: ' + err.message, 'err');
        return;
      }
    } else {
      this.EPI_ENTREGAS = this.EPI_ENTREGAS.filter(x => x.id !== id);
    }
    this.render();
    this.renderKits();
  }

  resetCatalogoForm() {
    const f = this.$('#form-epi-catalogo-new');
    f.reset();
    f.elements['id'].value = '';
    const title = this.$('#epi-cat-form-title');
    if (title) title.textContent = 'Cadastrar novo item do catálogo';
  }

  editarCatalogo(id) {
    const t = this.EPI_CATALOGO.find(x => x.id === id);
    if (!t) return;
    const f = this.$('#form-epi-catalogo-new');
    for (const [k, v] of Object.entries(t)) {
      if (f.elements[k]) f.elements[k].value = v ?? '';
    }
    const title = this.$('#epi-cat-form-title');
    if (title) title.textContent = `Editando: ${t.nome}`;
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async salvarCatalogo(ev) {
    ev.preventDefault();
    const f = this.$('#form-epi-catalogo-new');
    const data = Object.fromEntries(new FormData(f));
    const id = data.id ? parseInt(data.id, 10) : null;

    if (!data.nome || !data.nome.trim()) {
      window.showToast?.('Informe o nome do EPI', 'err');
      return;
    }

    const payload = {
      nome:            data.nome.trim(),
      ca:              data.ca || '',
      validade_ca:     data.validade_ca || null,
      vida_util_meses: parseInt(data.vida_util_meses, 10) || null,
      fabricante:      data.fabricante || '',
      quantidade:      parseInt(data.quantidade, 10) || 0,
      grupo:           (data.grupo && data.grupo.trim()) || null,
    };

    const temSessao = this.Epis && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        if (id != null) {
          const saved = await this.Epis.atualizarCatalogo(id, payload);
          const i = this.EPI_CATALOGO.findIndex(x => x.id === id);
          if (i >= 0) this.EPI_CATALOGO[i] = saved;
        } else {
          const saved = await this.Epis.criarCatalogo(payload);
          if (saved) this.EPI_CATALOGO.unshift(saved);
        }
      } catch (err) {
        window.showToast?.('Erro ao salvar: ' + err.message, 'err');
        return;
      }
    } else {
      if (id != null) {
        const i = this.EPI_CATALOGO.findIndex(x => x.id === id);
        if (i >= 0) this.EPI_CATALOGO[i] = { ...this.EPI_CATALOGO[i], ...payload };
      } else {
        const newId = Math.max(0, ...this.EPI_CATALOGO.map(x => x.id)) + 1;
        this.EPI_CATALOGO.unshift({ id: newId, ...payload });
      }
    }

    window.showToast?.(id != null ? 'Item atualizado' : 'Item cadastrado', 'ok');
    this.resetCatalogoForm();
    this.renderCatalogo();
    this.render();
    this.renderKits();

    const f2 = this.$('#epi-filter-tipo');
    if (f2) {
      const cur = f2.value;
      f2.innerHTML = '<option value="">Todos os EPIs</option>' +
        this.EPI_CATALOGO.map(t => `<option value="${t.id}">${this.h(t.nome)}</option>`).join('');
      f2.value = cur;
    }
  }

  async excluirCatalogo(id) {
    const emUso = this.EPI_ENTREGAS.some(e => e.epi_tipo_id === id && !e.devolvido);
    if (emUso) {
      window.showToast?.('Não é possível excluir: EPI em uso em entregas ativas', 'err');
      return;
    }
    if (!confirm('Excluir este item do catálogo?')) return;

    const temSessao = this.Epis && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Epis.excluirCatalogo(id);
      } catch (err) {
        window.showToast?.('Erro ao excluir: ' + err.message, 'err');
        return;
      }
    }
    const idx = this.EPI_CATALOGO.findIndex(x => x.id === id);
    if (idx >= 0) this.EPI_CATALOGO.splice(idx, 1);
    // Kits referenciam GRUPOS (não itens). Mantêm-se válidos enquanto o grupo
    // tiver ao menos um item; logo, não há limpeza por id aqui.
    window.showToast?.('Item excluído');
    this.renderCatalogo();
    this.render();
    this.renderKits();
  }

  abrirModalKit(area) {
    this._kitEditando = area;
    this.$('#epi-kit-modal-title').textContent = `Kit da área · ${area}`;
    const atual = new Set(this.EPI_KITS[area] || []);
    const lista = this.$('#epi-kit-lista');

    // Monta a lista por GRUPO: variações (ex.: tamanhos de bota) viram 1 opção.
    const grupos = {};
    this.EPI_CATALOGO.forEach(t => {
      const g = this._grupoDe(t);
      if (!grupos[g]) grupos[g] = [];
      grupos[g].push(t);
    });
    const nomesGrupos = Object.keys(grupos).sort((a, b) => a.localeCompare(b));

    lista.innerHTML = nomesGrupos.length
      ? nomesGrupos.map(g => {
          const itens = grupos[g];
          const sub = itens.length > 1
            ? `${itens.length} variações`
            : (itens[0]?.ca ? `CA ${this.h(itens[0].ca)}` : '—');
          const val = g.replace(/"/g, '&quot;');
          return `
            <label class="toggle-row" style="cursor:pointer;">
              <input type="checkbox" value="${val}" ${atual.has(g) ? 'checked' : ''}>
              <span style="flex:1;">${this.h(g)}</span>
              <span class="cell-person-sub">${sub}</span>
            </label>
          `;
        }).join('')
      : `<div class="empty">Cadastre itens no catálogo primeiro</div>`;
    this.$('#modal-epi-kit').classList.add('active');
  }

  fecharModalKit() {
    this.$('#modal-epi-kit').classList.remove('active');
    this._kitEditando = null;
  }

  async salvarKit() {
    if (!this._kitEditando) return;
    const area = this._kitEditando;
    const grupos = [...this.$('#epi-kit-lista').querySelectorAll('input[type="checkbox"]:checked')]
      .map(i => i.value);

    const temSessao = this.Epis && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Epis.salvarKit(area, grupos);
      } catch (err) {
        window.showToast?.('Erro ao salvar kit: ' + err.message, 'err');
        return;
      }
    }
    this.EPI_KITS[area] = grupos;
    window.showToast?.('Kit salvo', 'ok');
    this.fecharModalKit();
    this.renderKits();
  }

  _epiStatus(e) {
    if (e.devolvido) return 'devolvido';
    if (!e.proxima_troca) return 'vigente';
    const dias = this.diasAte(e.proxima_troca);
    if (dias < 0)   return 'vencido';
    if (dias <= 30) return 'trocar';
    return 'vigente';
  }

  _epiBadge(status) {
    if (status === 'vencido')   return `<span class="badge danger">Vencido</span>`;
    if (status === 'trocar')    return `<span class="badge warn">Trocar</span>`;
    if (status === 'devolvido') return `<span class="badge neutral">Devolvido</span>`;
    return `<span class="badge ok">Vigente</span>`;
  }
}

export default EpiModule;
