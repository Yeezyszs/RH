// SAC — Canal do Colaborador (leitura/gestão pelo RH)
// As mensagens chegam anônimas pela página pública sac.html.

const SAC_CAT = {
  sugestao:   { t: 'Sugestão',   cls: 'info',    emoji: '💡' },
  reclamacao: { t: 'Reclamação', cls: 'danger',  emoji: '⚠️' },
  elogio:     { t: 'Elogio',     cls: 'ok',      emoji: '👏' },
  duvida:     { t: 'Dúvida',     cls: 'warn',    emoji: '❓' },
  outro:      { t: 'Outro',      cls: 'neutral', emoji: '✍️' },
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
    });
    document.querySelectorAll('.nav-item[data-page="sac"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  _dataHora(iso) {
    if (!iso) return '—';
    const s = String(iso).replace(' ', 'T');
    const d = new Date(s);
    if (isNaN(d)) return this.fmtDate(s.slice(0, 10));
    return `${this.fmtDate(s.slice(0, 10))} ${s.slice(11, 16)}`;
  }

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
      const cat = SAC_CAT[m.categoria] || { t: m.categoria, cls: 'neutral', emoji: '•' };
      return `
        <div class="widget" style="border-left:4px solid var(--${cat.cls === 'danger' ? 'danger' : cat.cls === 'ok' ? 'success' : cat.cls === 'warn' ? 'warning' : 'phthalo-light'}); ${m.lido ? 'opacity:.72;' : ''}">
          <div class="widget-header" style="align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.1rem;">${cat.emoji}</span>
              <span class="badge ${cat.cls}">${cat.t}</span>
              ${m.lido ? '' : '<span class="badge info" style="font-size:.6rem;">novo</span>'}
            </div>
            <span class="widget-badge">${this._dataHora(m.criado_em)}</span>
          </div>
          <div style="white-space:pre-wrap; font-size:.92rem; color:var(--text); line-height:1.5; padding:4px 2px 10px;">${this.h(m.mensagem)}</div>
          <div style="display:flex; justify-content:flex-end; gap:6px; border-top:1px solid var(--border-soft); padding-top:8px;">
            <button class="btn btn-secondary btn-sm" type="button" onclick="sacMarcarLido(${m.id}, ${m.lido ? 'false' : 'true'})">${m.lido ? 'Marcar como não lida' : 'Marcar como lida'}</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" type="button" onclick="excluirSac(${m.id})">🗑</button>
          </div>
        </div>
      `;
    }).join('') : `<div class="empty" style="grid-column:1/-1; background:var(--white); border:1px solid var(--border); border-radius:12px;">Nenhuma mensagem recebida.</div>`;

    const naoLidas = this.SAC.filter(m => !m.lido).length;
    if (this.$('#sac-stat-total'))    this.$('#sac-stat-total').textContent    = this.SAC.length;
    if (this.$('#sac-stat-novas'))    this.$('#sac-stat-novas').textContent    = naoLidas;
    if (this.$('#sac-stat-exibidas')) this.$('#sac-stat-exibidas').textContent = lista.length;
  }

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
