// Dashboard
// Navegação SPA, renderização do dashboard, popup de vencimentos e badge da sidebar

/* global Chart, COLABORADORES, DESLIGAMENTOS, ADVERTENCIAS, FERIAS, VENCIMENTOS, CHART_COLORS */

// ─── Helpers locais ──────────────────────────────────────────────────────────
// h(), diasAte(), fmtBRL() vêm de src/utils/base.js (carregado antes)

function $(sel) { return document.querySelector(sel); }

// ─── Navegação SPA ───────────────────────────────────────────────────────────

function goPage(name) {
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === name);
  });
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === 'page-' + name);
  });
  document.querySelector('.main')?.scrollTo({ top: 0 });
  window.scrollTo({ top: 0 });
}

document.querySelectorAll('.nav-item[data-page]').forEach(el => {
  el.addEventListener('click', () => {
    goPage(el.dataset.page);
    // Ao voltar ao dashboard, garante que os gráficos sejam (re)criados já com
    // o container visível e dimensionado.
    if (el.dataset.page === 'dashboard') setTimeout(renderDashboardCharts, 60);
  });
});

// ─── Toast ───────────────────────────────────────────────────────────────────

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = '';
  if (type === 'err') t.classList.add('toast-err');
  if (type === 'ok')  t.classList.add('toast-ok');
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── Sub-abas (view-tabs) ────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
  const tab = e.target.closest('.view-tab');
  if (!tab) return;
  const name  = tab.dataset.view;
  const scope = tab.closest('section.page') || document;
  scope.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t === tab));
  scope.querySelectorAll('.view-content').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
});

// ─── Chart.js defaults ───────────────────────────────────────────────────────

if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'Syne', sans-serif";
  Chart.defaults.color = CHART_COLORS.text;
}

// ─── Dashboard Charts ────────────────────────────────────────────────────────

let _chartRot, _chartHead;

function renderDashboardCharts() {
  // Não cria gráficos enquanto o painel estiver oculto (#app display:none).
  // Criar um Chart num container 0×0 deixa o canvas quebrado mesmo depois de
  // exibir o app — por isso adiamos até o dashboard estar realmente visível.
  const appEl = document.getElementById('app');
  if (appEl && appEl.style.display === 'none') return;

  const ctxRot = document.getElementById('chart-rotatividade');
  if (ctxRot && typeof Chart !== 'undefined') {
    _chartRot?.destroy();
    const agora = new Date();
    const labelsRot = [], taxasRot = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const chave = d.getFullYear() * 100 + d.getMonth();
      const admMes = COLABORADORES.filter(c => {
        if (!c.admissao) return false;
        const da = new Date(c.admissao);
        return da.getFullYear() * 100 + da.getMonth() === chave;
      }).length;
      const desMes = DESLIGAMENTOS.filter(dl => {
        if (!dl.data) return false;
        const dd = new Date(dl.data);
        return dd.getFullYear() * 100 + dd.getMonth() === chave;
      }).length;
      const hc = COLABORADORES.filter(c => c.status !== 'inativo').length || 1;
      labelsRot.push(d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''));
      taxasRot.push(parseFloat(((admMes + desMes) / 2 / hc * 100).toFixed(1)));
    }
    _chartRot = new Chart(ctxRot, {
      type: 'line',
      data: {
        labels: labelsRot,
        datasets: [{
          label: 'Rotatividade %',
          data: taxasRot,
          borderColor: CHART_COLORS.phthalo,
          backgroundColor: 'rgba(46,122,184,.12)',
          borderWidth: 2.5,
          tension: .35,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: CHART_COLORS.phthaloBright,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: CHART_COLORS.grid }, ticks: { callback: v => v + '%' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  const ctxHead = document.getElementById('chart-headcount');
  if (ctxHead && typeof Chart !== 'undefined') {
    _chartHead?.destroy();
    const porSetor = {};
    COLABORADORES.filter(c => c.status !== 'inativo').forEach(c => {
      porSetor[c.setor] = (porSetor[c.setor] || 0) + 1;
    });
    const setoresHead = Object.keys(porSetor).sort((a, b) => porSetor[b] - porSetor[a]);
    _chartHead = new Chart(ctxHead, {
      type: 'doughnut',
      data: {
        labels: setoresHead,
        datasets: [{
          data: setoresHead.map(s => porSetor[s]),
          backgroundColor: [
            CHART_COLORS.phthalo, CHART_COLORS.phthaloLight, CHART_COLORS.phthaloBright,
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
        plugins: { legend: { position: 'right', labels: { padding: 12, boxWidth: 12, font: { size: 11 } } } },
      },
    });
  }
}

// ─── Dashboard KPIs + Atividade ──────────────────────────────────────────────

function renderDashboard() {
  const ativos    = COLABORADORES.filter(c => c.status !== 'inativo');
  const headcount = ativos.length;
  const hoje      = new Date();
  const mes       = hoje.getMonth() + 1;
  const semFim    = new Date(hoje); semFim.setDate(hoje.getDate() + 6);

  const anivMes = ativos.filter(c => {
    if (!c.nascimento) return false;
    return (new Date(c.nascimento + 'T00:00:00').getMonth() + 1) === mes;
  });

  const anivSemana = anivMes.filter(c => {
    const d = new Date(c.nascimento + 'T00:00:00');
    const dEsteAno = new Date(hoje.getFullYear(), d.getMonth(), d.getDate());
    return dEsteAno >= hoje && dEsteAno <= semFim;
  });

  const vencCriticos = VENCIMENTOS.filter(v => diasAte(v.vencimento) <= 7);
  const vencVencidos  = vencCriticos.filter(v => diasAte(v.vencimento) < 0);

  const el = id => document.getElementById(id);

  if (el('dash-kpi-headcount'))       el('dash-kpi-headcount').textContent = headcount;
  if (el('dash-headcount-badge'))     el('dash-headcount-badge').textContent = `${headcount} total`;
  if (el('dash-kpi-headcount-trend')) {
    el('dash-kpi-headcount-trend').textContent = `${headcount} colaboradores ativos`;
    el('dash-kpi-headcount-trend').className = 'kpi-trend';
  }
  if (el('dash-kpi-aniv'))       el('dash-kpi-aniv').textContent = anivMes.length;
  if (el('dash-kpi-aniv-trend')) el('dash-kpi-aniv-trend').textContent = anivSemana.length
    ? `${anivSemana.length} nesta semana` : 'nenhum nesta semana';

  if (el('dash-kpi-venc'))       el('dash-kpi-venc').textContent = vencCriticos.length;
  if (el('dash-kpi-venc-trend')) el('dash-kpi-venc-trend').textContent =
    `${vencVencidos.length} já vencido${vencVencidos.length !== 1 ? 's' : ''}`;

  const corte30 = new Date(); corte30.setDate(corte30.getDate() - 30);
  const adm30   = COLABORADORES.filter(c => c.admissao && new Date(c.admissao) >= corte30).length;
  const des30   = DESLIGAMENTOS.filter(d => d.data && new Date(d.data) >= corte30).length;
  const taxa30  = headcount > 0 ? ((adm30 + des30) / 2 / headcount * 100) : 0;
  if (el('dash-kpi-rot')) el('dash-kpi-rot').innerHTML = `${taxa30.toFixed(1).replace('.', ',')}<span class="unit">%</span>`;
  if (el('dash-kpi-rot-trend')) {
    el('dash-kpi-rot-trend').textContent = `${adm30} admissões · ${des30} desligamentos`;
    el('dash-kpi-rot-trend').className = taxa30 > 5 ? 'kpi-trend down' : 'kpi-trend';
  }

  // Atividade recente (últimos 7 dias)
  const corte7     = new Date(); corte7.setDate(corte7.getDate() - 7);
  const atividades = [];

  COLABORADORES.filter(c => c.admissao && new Date(c.admissao) >= corte7).forEach(c => {
    atividades.push({ tipo: 'admissao', data: new Date(c.admissao), label: 'Admissão',
      texto: `<strong>${h(c.nome)}</strong> admitido em ${h(c.setor)} ${c.area ? `· ${h(c.area)}` : ''}` });
  });
  DESLIGAMENTOS.filter(d => d.data && new Date(d.data) >= corte7).forEach(d => {
    const col = COLABORADORES.find(x => x.id === d.colaborador_id);
    atividades.push({ tipo: 'desligamento', data: new Date(d.data), label: 'Desligamento',
      texto: `<strong>${h(col ? col.nome : '—')}</strong> desligado — ${h(d.tipo_saida || 'saída')}` });
  });
  ADVERTENCIAS.filter(a => a.data && new Date(a.data) >= corte7).forEach(a => {
    const col = COLABORADORES.find(x => x.id === a.colaborador_id);
    atividades.push({ tipo: 'advertencia', data: new Date(a.data), label: 'Advertência',
      texto: `<strong>${h(col ? col.nome : '—')}</strong> recebeu advertência — ${h(a.tipo || '')}` });
  });
  FERIAS.filter(f => f.inicio && new Date(f.inicio) >= corte7).forEach(f => {
    const col = COLABORADORES.find(x => x.id === f.colaborador_id);
    atividades.push({ tipo: 'ferias', data: new Date(f.inicio), label: 'Férias',
      texto: `<strong>${h(col ? col.nome : '—')}</strong> iniciou período de férias` });
  });
  atividades.sort((a, b) => b.data - a.data);

  const actList = el('dash-activity-list');
  if (actList) {
    actList.innerHTML = atividades.length === 0
      ? `<li style="padding:12px; color:var(--text-soft); font-size:.85rem">Nenhuma atividade nos últimos 7 dias</li>`
      : atividades.slice(0, 8).map(a => {
          const dias = Math.round((Date.now() - a.data) / 86400000);
          const tempo = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `${dias} dias`;
          return `<li class="activity-item">
            <span class="activity-chip ${a.tipo}">${h(a.label)}</span>
            <span class="activity-text">${a.texto}</span>
            <span class="activity-time">${tempo}</span>
          </li>`;
        }).join('');
  }

  // Alertas de vencimentos críticos
  const alertsList  = el('dash-alerts-list');
  const alertsBadge = el('dash-alerts-badge');
  if (alertsList) {
    alertsList.innerHTML = vencCriticos.length > 0
      ? [...vencCriticos]
          .sort((a, b) => diasAte(a.vencimento) - diasAte(b.vencimento))
          .slice(0, 6)
          .map(v => {
            const c    = COLABORADORES.find(x => x.id === v.colaborador_id);
            const d    = diasAte(v.vencimento);
            const cls  = d < 0 ? 'danger' : d <= 7 ? 'warn' : 'info';
            const data = v.vencimento ? v.vencimento.slice(5).replace('-', '/') : '—';
            const msg  = d < 0
              ? `<strong>${h(v.item)}</strong>${c ? ` de ${h(c.nome)}` : ''} venceu há ${Math.abs(d)} dia${Math.abs(d) !== 1 ? 's' : ''}`
              : `<strong>${h(v.item)}</strong>${c ? ` de ${h(c.nome)}` : ''} vence em ${d} dia${d !== 1 ? 's' : ''}`;
            return `<li class="alert-item"><span class="alert-dot ${cls}"></span><span class="alert-text">${msg}</span><span class="alert-meta">${data}</span></li>`;
          }).join('')
      : `<li style="padding:12px; color:var(--text-soft); font-size:.85rem">Nenhum vencimento crítico</li>`;
    if (alertsBadge) alertsBadge.textContent = `${vencCriticos.length} ${vencCriticos.length === 1 ? 'item' : 'itens'}`;
  }

  // Aniversariantes da semana
  const bdayList  = el('dash-bday-list');
  const bdayBadge = el('dash-bday-badge');
  if (bdayList) {
    bdayList.innerHTML = anivSemana.length > 0
      ? anivSemana.map(c => {
          const d    = new Date(c.nascimento + 'T00:00:00');
          const dFmt = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
          const role = c.area ? `${h(c.setor)} · ${h(c.area)}` : h(c.setor);
          return `<li class="bday-item">
            <div class="bday-avatar">${h(window.iniciais ? window.iniciais(c.nome) : c.nome.charAt(0))}</div>
            <div class="bday-name">${h(c.nome)}<div class="bday-role">${role}</div></div>
            <div class="bday-date">${dFmt}</div>
          </li>`;
        }).join('')
      : `<li style="padding:12px; color:var(--text-soft); font-size:.85rem">Nenhum aniversariante nesta semana</li>`;
    if (bdayBadge) bdayBadge.textContent = anivSemana.length;
  }

  renderDashboardCharts();
}

// ─── renderAll ───────────────────────────────────────────────────────────────

function renderAll() {
  renderDashboard();
  if (typeof renderColaboradores  === 'function') renderColaboradores();
  if (typeof renderQuadro         === 'function') renderQuadro();
  if (typeof renderRotatividade   === 'function') renderRotatividade();
  if (typeof renderDesligamentos  === 'function') renderDesligamentos();
  if (typeof renderVencimentos    === 'function') renderVencimentos();
  if (typeof renderEpi            === 'function') renderEpi();
  if (typeof renderEpiCatalogo    === 'function') renderEpiCatalogo();
  if (typeof renderEpiKits        === 'function') renderEpiKits();
  if (typeof renderVale           === 'function') renderVale();
  if (typeof renderValeAlimentacao === 'function') renderValeAlimentacao();
  if (typeof renderFerias         === 'function') renderFerias();
  if (typeof renderSalarios       === 'function') renderSalarios();
  if (typeof renderAdvertencias   === 'function') renderAdvertencias();
  if (typeof renderFeedback       === 'function') renderFeedback();
  if (typeof renderClima          === 'function') renderClima();
  if (typeof renderCronograma     === 'function') renderCronograma();
  if (typeof renderPlanoCarreiras === 'function') renderPlanoCarreiras();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderAll);
} else {
  renderAll();
}

// ─── Popup de Vencimentos ────────────────────────────────────────────────────

let _popupVencDismissed = false;

function vencimentosUrgentes() {
  return VENCIMENTOS
    .map(v => ({ ...v, _dias: diasAte(v.vencimento), _colab: COLABORADORES.find(c => c.id === v.colaborador_id) }))
    .filter(v => v._dias <= 30 && v._colab && v._colab.status !== 'inativo')
    .sort((a, b) => a._dias - b._dias);
}

function mostrarPopupVencimentos() {
  if (_popupVencDismissed) return;
  const urgentes = vencimentosUrgentes();
  if (!urgentes.length) return;

  const vencidos = urgentes.filter(v => v._dias < 0).length;
  const hoje7d   = urgentes.filter(v => v._dias >= 0 && v._dias <= 7).length;

  $('#alert-popup-title').innerHTML = vencidos
    ? `<span style="color:var(--danger)">${vencidos} vencido${vencidos > 1 ? 's' : ''}</span> · ${urgentes.length} no total`
    : `${urgentes.length} documento${urgentes.length > 1 ? 's' : ''} vencendo em breve`;

  const visibles = urgentes.slice(0, 5);
  const extras   = urgentes.length - visibles.length;

  $('#alert-popup-body').innerHTML = `
    <div style="font-family:var(--mono); font-size:.7rem; color:var(--text-muted); margin-bottom:6px; letter-spacing:.04em;">
      ${vencidos > 0 ? `🔴 ${vencidos} vencido${vencidos > 1 ? 's' : ''} · ` : ''}${hoje7d > 0 ? `🟡 ${hoje7d} em ≤7 dias` : ''}
    </div>
    ${visibles.map(v => {
      const dTxt = v._dias < 0
        ? `<span class="badge danger">${Math.abs(v._dias)}d atrás</span>`
        : v._dias === 0
          ? `<span class="badge warn">Hoje</span>`
          : v._dias <= 7
            ? `<span class="badge warn">${v._dias}d</span>`
            : `<span class="badge info">${v._dias}d</span>`;
      return `<div class="alert-popup-item" onclick="irParaVencimento(${v.id})" style="cursor:pointer;">
        <div style="flex:1; overflow:hidden;">
          <div><strong>${h(v._colab.nome)}</strong></div>
          <div class="cell-person-sub">${h(v.categoria)} · ${h(v.item)}</div>
        </div>
        ${dTxt}
      </div>`;
    }).join('')}
    ${extras > 0 ? `<div class="alert-popup-item" style="color:var(--text-muted); font-family:var(--mono); font-size:.75rem; justify-content:center;">+${extras} outros</div>` : ''}
  `;

  $('#alert-popup-vencimentos').classList.add('show');
}

function fecharPopupVencimentos() {
  _popupVencDismissed = true;
  $('#alert-popup-vencimentos').classList.remove('show');
}

function abrirVencimentosDoPopup() {
  fecharPopupVencimentos();
  goPage('vencimentos');
}

function irParaVencimento(vencId) {
  fecharPopupVencimentos();
  goPage('vencimentos');
  setTimeout(() => {
    const tr = Array.from(document.querySelectorAll('#tb-vencimentos tr'))
      .find(r => r.getAttribute('onclick')?.includes('abrirDrawerColab('));
    if (tr) tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 150);
}

// ─── Badge de Vencimentos (sidebar) ─────────────────────────────────────────

function atualizarBadgeVencimentos() {
  const urgentes = vencimentosUrgentes();
  const vencidos = urgentes.filter(v => v._dias < 0).length;
  const navItem  = document.querySelector('.nav-item[data-page="vencimentos"]');
  if (!navItem) return;

  let badge = navItem.querySelector('.nav-badge');
  if (urgentes.length === 0) { badge?.remove(); return; }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'nav-badge';
    navItem.appendChild(badge);
  }
  badge.textContent = urgentes.length;
  badge.className   = 'nav-badge' + (vencidos > 0 ? ' urgent' : '');
  badge.title = vencidos > 0
    ? `${vencidos} documento${vencidos > 1 ? 's' : ''} vencido${vencidos > 1 ? 's' : ''}`
    : `${urgentes.length} documento${urgentes.length > 1 ? 's' : ''} vencendo em breve`;
}

// Abre popup ao entrar na aba Colaboradores
document.querySelectorAll('.nav-item[data-page="colaboradores"]').forEach(el => {
  el.addEventListener('click', () => setTimeout(mostrarPopupVencimentos, 200));
});

// Expõe para módulos chamarem após salvar/deletar
window.atualizarBadgeVencimentos = atualizarBadgeVencimentos;
window.renderDashboard           = renderDashboard;
window.goPage                    = goPage;
window.showToast                 = showToast;

setTimeout(() => atualizarBadgeVencimentos(), 100);
