// Relatórios — Impressão de relatórios por módulo (auditoria)
// Script clássico. Depende de showToast (dashboard.js) carregado antes.
//
// Estratégia: clona o conteúdo da página ativa (respeitando filtros e a
// sub-aba ativa), converte os gráficos (canvas) em imagens, remove elementos
// interativos (toolbars, botões, coluna de ações) e abre uma janela de
// impressão limpa com cabeçalho de relatório.

(function () {
  const ORG = 'Bepi Mataruco · Recursos Humanos';

  // Módulos que ganham botão de impressão (id da página = page-<chave>)
  const MODULOS = {
    dashboard:         'Relatório — Visão Geral (Dashboard)',
    colaboradores:     'Relatório de Colaboradores',
    quadro:            'Relatório — Quadro de Funcionários',
    rotatividade:      'Relatório de Rotatividade',
    desligamentos:     'Relatório de Desligamentos',
    vencimentos:       'Relatório de Vencimentos',
    epi:               'Relatório de EPIs',
    'vale-combustivel':'Relatório de Vale Combustível',
    'vale-alimentacao':'Relatório de Vale Alimentação',
    ferias:            'Relatório de Férias',
    salarios:          'Relatório de Salários',
    advertencias:      'Relatório de Advertências',
    'feedback-clima':  'Relatório Organizacional',
    cronograma:        'Relatório de Cronograma',
    'plano-carreiras': 'Relatório de Plano de Carreiras',
  };

  const ESTILO_RELATORIO = `
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #1a2430; margin: 28px; }
    .rpt-head { border-bottom: 2px solid #123e6b; padding-bottom: 12px; margin-bottom: 20px; }
    .rpt-org { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #2e7ab8; font-weight: 600; }
    .rpt-head h1 { font-size: 22px; margin: 6px 0 4px; color: #123e6b; }
    .rpt-meta { font-size: 12px; color: #667; }
    h2.rpt-sub { font-size: 14px; color: #123e6b; margin: 22px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; }
    th, td { border: 1px solid #cdd6e0; padding: 6px 9px; font-size: 11.5px; text-align: left; vertical-align: top; }
    thead th { background: #eef3f8; color: #123e6b; font-weight: 700; }
    tbody tr:nth-child(even) { background: #f7fafc; }
    .badge { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 10.5px; border: 1px solid #cdd6e0; }
    img { max-width: 100%; height: auto; }
    .stats-row { display: flex; flex-wrap: wrap; gap: 12px; margin: 10px 0 18px; }
    .stat, .kpi-card { border: 1px solid #cdd6e0; border-radius: 8px; padding: 10px 14px; min-width: 150px; }
    .stat-label, .kpi-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: #667; }
    .stat-value, .kpi-value { font-size: 20px; font-weight: 700; color: #123e6b; }
    .widget { margin: 8px 0 18px; page-break-inside: avoid; }
    .widget-title { font-weight: 700; font-size: 13px; color: #123e6b; margin-bottom: 6px; }
    .widget-badge, .kpi-trend { font-size: 11px; color: #667; }
    .cell-person { display: flex; align-items: center; gap: 8px; }
    .cell-avatar { display: none; }
    .cell-person-name { font-weight: 600; }
    .cell-person-sub { font-size: 10px; color: #667; }
    .rpt-foot { margin-top: 24px; border-top: 1px solid #cdd6e0; padding-top: 8px; font-size: 10.5px; color: #889; text-align: center; }
    .empty { color: #889; font-style: italic; }
    @media print { body { margin: 12mm; } .widget, table, tr { page-break-inside: avoid; } }
  `;

  function escopoDaPagina(page) {
    // Se a página tem sub-abas, considera só a(s) view(s) ativa(s); senão a página toda.
    const ativas = [...page.querySelectorAll('.view-content')].filter(v => v.classList.contains('active'));
    return ativas.length ? ativas : [page];
  }

  function limparClone(wrapper, escopos) {
    // Converte gráficos (canvas) em imagens — clone não copia o bitmap do canvas.
    const origs = [];
    escopos.forEach(e => origs.push(...e.querySelectorAll('canvas')));
    const clones = wrapper.querySelectorAll('canvas');
    clones.forEach((c, i) => {
      const orig = origs[i];
      try {
        if (orig && orig.width) {
          const img = document.createElement('img');
          img.src = orig.toDataURL('image/png');
          c.replaceWith(img);
        } else { c.remove(); }
      } catch (e) { c.remove(); }
    });

    // Remove elementos interativos e não relevantes ao relatório.
    wrapper.querySelectorAll(
      '.toolbar, .actions, button, input, select, textarea, .pagination, .page-header, .view-tabs, .chart-toolbar'
    ).forEach(el => el.remove());

    // Remove o cabeçalho da coluna "Ações" (a célula de dados já foi removida).
    wrapper.querySelectorAll('th').forEach(th => {
      if (th.textContent.trim().toLowerCase() === 'ações') th.remove();
    });
  }

  function imprimirRelatorio(modulo) {
    const page = document.getElementById('page-' + modulo);
    if (!page) { window.showToast?.('Módulo não encontrado para impressão', 'err'); return; }

    const titulo = MODULOS[modulo] || 'Relatório';
    const escopos = escopoDaPagina(page);

    const wrapper = document.createElement('div');
    escopos.forEach(e => wrapper.appendChild(e.cloneNode(true)));
    limparClone(wrapper, escopos);

    const agora = new Date().toLocaleString('pt-BR');
    const html =
      '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
      '<title>' + titulo + '</title><style>' + ESTILO_RELATORIO + '</style></head><body>' +
      '<header class="rpt-head">' +
        '<div class="rpt-org">' + ORG + '</div>' +
        '<h1>' + titulo + '</h1>' +
        '<div class="rpt-meta">Gerado em ' + agora + '</div>' +
      '</header>' +
      '<main>' + wrapper.innerHTML + '</main>' +
      '<div class="rpt-foot">Documento gerado automaticamente pelo Sistema de RH para fins de auditoria.</div>' +
      '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print();},250);};</scr' + 'ipt>' +
      '</body></html>';

    const win = window.open('', '_blank');
    if (!win) { window.showToast?.('Permita pop-ups para gerar o relatório', 'err'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function injetarBotoes() {
    Object.keys(MODULOS).forEach(modulo => {
      const page = document.getElementById('page-' + modulo);
      if (!page) return;
      const header = page.querySelector('.page-header');
      if (!header || header.querySelector('.btn-imprimir-relatorio')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary btn-sm btn-imprimir-relatorio';
      btn.innerHTML = '🖨 Imprimir relatório';
      btn.addEventListener('click', () => imprimirRelatorio(modulo));
      header.appendChild(btn);
    });
  }

  window.imprimirRelatorio = imprimirRelatorio;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injetarBotoes);
  } else {
    injetarBotoes();
  }
})();
