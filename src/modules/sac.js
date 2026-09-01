// SAC — Canal do Colaborador (leitura/gestão pelo RH)
// As mensagens chegam anônimas pela página pública sac.html.
// Duas abas: "Recebidas" (caixa de entrada) e "Tratativa" (gestão/resolução).

import { limparFormulario } from '../utils/ui.js?v=dev';

const SAC_CAT = {
  sugestao:   { t: 'Sugestão',   cls: 'info',    emoji: '💡' },
  reclamacao: { t: 'Reclamação', cls: 'danger',  emoji: '⚠️' },
  elogio:     { t: 'Elogio',     cls: 'ok',      emoji: '👏' },
  duvida:     { t: 'Dúvida',     cls: 'warn',    emoji: '❓' },
  outro:      { t: 'Outro',      cls: 'neutral', emoji: '✍️' },
};

const TRAT_STATUS = {
  aberta:       { t: 'Aberta',       cls: 'warn' },
  em_andamento: { t: 'Em andamento', cls: 'info' },
  resolvida:    { t: 'Resolvida',    cls: 'ok' },
};

export class SacModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.fmtDate = deps.fmtDate;
    this.SAC = deps.SAC;
    this.Auth = deps.Auth;
    this.SacMensagens = deps.SacMensagens;
    this.showToast = deps.showToast;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'sac-search') { clearTimeout(this._searchT); this._searchT = setTimeout(() => this.render(), 250); }
    });
    document.addEventListener('change', (e) => {
      if (['sac-filter-cat', 'sac-filter-lido'].includes(e.target.id)) this.render();
      if (['sac-trat-filter-status', 'sac-trat-filter-cat'].includes(e.target.id)) this.renderTratativas();
    });
    document.querySelectorAll('.nav-item[data-page="sac"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => { this.render(); this.renderTratativas(); }, 60));
    });
  }

  _dataHora(iso) {
    if (!iso) return '—';
    const s = String(iso).replace(' ', 'T');
    const d = new Date(s);
    if (isNaN(d)) return this.fmtDate(s.slice(0, 10));
    return `${this.fmtDate(s.slice(0, 10))} ${s.slice(11, 16)}`;
  }

  _cat(m)  { return SAC_CAT[m.categoria] || { t: m.categoria, cls: 'neutral', emoji: '•' }; }
  _trat(m) { return TRAT_STATUS[m.status_tratativa || 'aberta'] || TRAT_STATUS.aberta; }

  _protoTag(m) {
    if (!m.protocolo) return '';
    return `<span class="cell-mono" title="Nº de protocolo (o mesmo da tratativa)" style="font-size:.72rem; font-weight:700; color:var(--phthalo); letter-spacing:.03em;">${this.h(m.protocolo)}</span>`;
  }

  _corBorda(cls) {
    return cls === 'danger' ? 'var(--danger)' : cls === 'ok' ? 'var(--success)' : cls === 'warn' ? 'var(--warning)' : 'var(--phthalo-light)';
  }

  // ─── Aba "Recebidas" (caixa de entrada) ────────────────────────────────────

  render() {
    const grid = this.$('#sac-grid');
    if (!grid) return;

    const q     = (this.$('#sac-search')?.value || '').trim().toLowerCase();
    const fCat  = this.$('#sac-filter-cat')?.value || '';
    const fLido = this.$('#sac-filter-lido')?.value || '';

    const lista = [...this.SAC]
      .filter(m => {
        if (fCat && m.categoria !== fCat) return false;
        if (fLido === 'nao' && m.lido) return false;
        if (fLido === 'sim' && !m.lido) return false;
        if (q && !(m.mensagem || '').toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''));

    grid.innerHTML = lista.length ? lista.map(m => {
      const cat = this._cat(m);
      const trat = this._trat(m);
      return `
        <div class="widget" style="border-left:4px solid ${this._corBorda(cat.cls)}; ${m.lido ? 'opacity:.78;' : ''}">
          <div class="widget-header" style="align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.1rem;">${cat.emoji}</span>
              <span class="badge ${cat.cls}">${cat.t}</span>
              ${m.lido ? '' : '<span class="badge info" style="font-size:.6rem;">novo</span>'}
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
              ${this._protoTag(m)}
              <span class="widget-badge">${this._dataHora(m.criado_em)}</span>
            </div>
          </div>
          <div style="white-space:pre-wrap; font-size:.92rem; color:var(--text); line-height:1.5; padding:4px 2px 10px;">${this.h(m.mensagem)}</div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; border-top:1px solid var(--border-soft); padding-top:8px;">
            <span class="badge ${trat.cls}" title="Status da tratativa">${trat.t}</span>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary btn-sm" type="button" onclick="abrirModalTratativa(${m.id})">Dar tratativa</button>
              <button class="btn btn-ghost btn-sm btn-icon" title="${m.lido ? 'Marcar como não lida' : 'Marcar como lida'}" type="button" onclick="sacMarcarLido(${m.id}, ${m.lido ? 'false' : 'true'})">${m.lido ? '📩' : '✓'}</button>
              <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" type="button" onclick="excluirSac(${m.id})">🗑</button>
            </div>
          </div>
        </div>
      `;
    }).join('') : `<div class="empty" style="grid-column:1/-1; background:var(--white); border:1px solid var(--border); border-radius:12px;">Nenhuma mensagem recebida.</div>`;

    const naoLidas = this.SAC.filter(m => !m.lido).length;
    if (this.$('#sac-stat-total'))    this.$('#sac-stat-total').textContent    = this.SAC.length;
    if (this.$('#sac-stat-novas'))    this.$('#sac-stat-novas').textContent    = naoLidas;
    if (this.$('#sac-stat-exibidas')) this.$('#sac-stat-exibidas').textContent = lista.length;
  }

  // ─── Aba "Tratativa" (gestão/resolução) ────────────────────────────────────

  renderTratativas() {
    const grid = this.$('#sac-trat-grid');
    if (!grid) return;

    const fSt  = this.$('#sac-trat-filter-status')?.value || '';
    const fCat = this.$('#sac-trat-filter-cat')?.value || '';

    const lista = [...this.SAC]
      .filter(m => {
        if (fSt && (m.status_tratativa || 'aberta') !== fSt) return false;
        if (fCat && m.categoria !== fCat) return false;
        return true;
      })
      .sort((a, b) => {
        // Não resolvidas primeiro; dentro disso, mais recentes primeiro
        const ra = (a.status_tratativa === 'resolvida') ? 1 : 0;
        const rb = (b.status_tratativa === 'resolvida') ? 1 : 0;
        return ra - rb || (b.criado_em || '').localeCompare(a.criado_em || '');
      });

    grid.innerHTML = lista.length ? lista.map(m => {
      const cat = this._cat(m);
      const trat = this._trat(m);
      const temTrat = (m.tratativa && m.tratativa.trim()) || m.responsavel;
      return `
        <div class="widget" style="border-left:4px solid ${this._corBorda(trat.cls)};">
          <div class="widget-header" style="align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span>${cat.emoji}</span>
              <span class="badge ${cat.cls}">${cat.t}</span>
              <span class="badge ${trat.cls}">${trat.t}</span>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
              ${this._protoTag(m)}
              <span class="widget-badge">${this._dataHora(m.criado_em)}</span>
            </div>
          </div>
          <div style="white-space:pre-wrap; font-size:.9rem; color:var(--text-muted); line-height:1.45; padding:4px 2px 8px; border-bottom:1px dashed var(--border-soft);">${this.h(m.mensagem)}</div>
          <div style="padding:8px 2px;">
            ${m.responsavel ? `<div class="cell-person-sub" style="margin-bottom:4px;">Responsável: <strong style="color:var(--text)">${this.h(m.responsavel)}</strong>${m.tratado_em ? ' · ' + this._dataHora(m.tratado_em) : ''}</div>` : ''}
            <div style="white-space:pre-wrap; font-size:.9rem; color:var(--text); line-height:1.5;">${temTrat && m.tratativa ? this.h(m.tratativa) : '<span style="color:var(--text-soft)">Sem providências registradas.</span>'}</div>
          </div>
          <div style="display:flex; justify-content:flex-end; padding-top:8px; border-top:1px solid var(--border-soft);">
            <button class="btn btn-secondary btn-sm" type="button" onclick="abrirModalTratativa(${m.id})">${temTrat ? 'Editar tratativa' : 'Registrar tratativa'}</button>
          </div>
        </div>
      `;
    }).join('') : `<div class="empty" style="grid-column:1/-1; background:var(--white); border:1px solid var(--border); border-radius:12px;">Nenhuma mensagem para tratar.</div>`;

    const cont = (s) => this.SAC.filter(m => (m.status_tratativa || 'aberta') === s).length;
    if (this.$('#sac-trat-stat-abertas'))  this.$('#sac-trat-stat-abertas').textContent  = cont('aberta');
    if (this.$('#sac-trat-stat-andamento'))this.$('#sac-trat-stat-andamento').textContent= cont('em_andamento');
    if (this.$('#sac-trat-stat-resolvidas'))this.$('#sac-trat-stat-resolvidas').textContent= cont('resolvida');
  }

  // ─── Modal de tratativa ────────────────────────────────────────────────────

  abrirModalTratativa(id) {
    const m = this.SAC.find(x => x.id === id);
    if (!m) return;
    const form = this.$('#form-tratativa');
    limparFormulario(form);
    form.elements['id'].value = m.id;
    const cat = this._cat(m);
    this.$('#trat-msg-cat').innerHTML = `${cat.emoji} <span class="badge ${cat.cls}">${cat.t}</span> ${this._protoTag(m)} <span class="cell-person-sub">${this._dataHora(m.criado_em)}</span>`;
    this.$('#trat-msg-texto').textContent = m.mensagem || '';
    form.elements['status_tratativa'].value = m.status_tratativa || 'aberta';
    form.elements['responsavel'].value = m.responsavel || '';
    form.elements['tratativa'].value = m.tratativa || '';
    this.$('#modal-tratativa').classList.add('active');
  }

  fecharModalTratativa() {
    this.$('#modal-tratativa').classList.remove('active');
  }

  async salvarTratativa(ev) {
    ev.preventDefault();
    const form = this.$('#form-tratativa');
    const data = Object.fromEntries(new FormData(form));
    const id = parseInt(data.id, 10);
    const payload = {
      status_tratativa: data.status_tratativa || 'aberta',
      responsavel:      (data.responsavel || '').trim(),
      tratativa:        (data.tratativa || '').trim(),
    };

    const temSessao = this.SacMensagens && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try { await this.SacMensagens.atualizarTratativa(id, payload); }
      catch (err) { this.showToast('Erro ao salvar tratativa: ' + err.message, 'err'); return; }
    }
    const m = this.SAC.find(x => x.id === id);
    if (m) {
      Object.assign(m, payload, { tratado_em: new Date().toISOString(), lido: true });
    }
    this.showToast('Tratativa salva', 'ok');
    this.fecharModalTratativa();
    this.render();
    this.renderTratativas();
  }

  // ─── Ações da caixa de entrada ─────────────────────────────────────────────

  async marcarLido(id, lido) {
    const temSessao = this.SacMensagens && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try { await this.SacMensagens.marcarLido(id, lido); } catch (err) { this.showToast('Erro: ' + err.message, 'err'); return; }
    }
    const m = this.SAC.find(x => x.id === id);
    if (m) m.lido = lido;
    this.render();
  }

  async excluir(id) {
    if (!confirm('Excluir esta mensagem do SAC?')) return;
    const temSessao = this.SacMensagens && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try { await this.SacMensagens.excluir(id); } catch (err) { this.showToast('Erro: ' + err.message, 'err'); return; }
    }
    const i = this.SAC.findIndex(x => x.id === id);
    if (i >= 0) this.SAC.splice(i, 1);
    this.render();
    this.renderTratativas();
    this.showToast('Mensagem excluída');
  }

  copiarLink() {
    const url = new URL('sac.html', window.location.href).href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => this.showToast('Link do SAC copiado!', 'ok'),
        () => window.prompt('Copie o link do SAC:', url)
      );
    } else {
      window.prompt('Copie o link do SAC:', url);
    }
  }
}

export default SacModule;
