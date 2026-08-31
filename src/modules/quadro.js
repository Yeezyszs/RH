// Quadro de Funcionários Module
// Visão por setor/área do efetivo ativo.
//
// Extraído de colaboradores.js, que passava de 1.100 linhas com seis assuntos
// no mesmo arquivo. Este era o único bloco sem amarras: não chama nenhum outro
// método do módulo de origem, só lê COLABORADORES e desenha.

import { debounce } from '../utils/ui.js?v=dev';

export class QuadroModule {
  constructor(deps) {
    this.$            = deps.$;
    this.h            = deps.h;
    this.iniciais     = deps.iniciais;
    this.COLABORADORES = deps.COLABORADORES;
    this.STATUS_LABEL = deps.STATUS_LABEL;
    this.SETOR_ICON   = deps.SETOR_ICON;

    this._buscar = debounce(() => this.renderQuadro(), 250);
    this._ouvirEventos();
    this.renderQuadro();
  }

  // Busca e filtros da própria tela do quadro. Estavam em colaboradores.js
  // junto com os da lista de colaboradores, o que misturava as duas telas.
  _ouvirEventos() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'quad-search') this._buscar();
    });
    document.addEventListener('change', (e) => {
      if (['quad-filter-status', 'quad-filter-turno'].includes(e.target.id)) this.renderQuadro();
    });
    document.querySelectorAll('.nav-item[data-page="quadro"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.renderQuadro(), 60));
    });
  }

  renderQuadro() {
    const grid = this.$('#setor-grid');
    if (!grid) return;

    const q       = (this.$('#quad-search')?.value || '').trim().toLowerCase();
    const fStatus = this.$('#quad-filter-status')?.value || '';
    const fTurno  = this.$('#quad-filter-turno')?.value || '';

    const filtrados = this.COLABORADORES.filter(c => {
      // Afastados nunca aparecem no quadro (continuam acessíveis na página de Colaboradores)
      if (c.status === 'afastado') return false;
      // Se nenhum filtro de status é aplicado, exclui inativos automaticamente
      if (!fStatus && c.status === 'inativo') return false;
      if (fStatus && c.status !== fStatus) return false;
      if (fTurno && (c.turno || 'diurno') !== fTurno) return false;
      if (q && !c.nome.toLowerCase().includes(q)) return false;
      return true;
    });

    const SEM_AREA = '— sem área definida —';
    const porSetor = {};
    filtrados.forEach(c => {
      const area = c.area || SEM_AREA;
      const turno = c.turno || 'diurno';
      if (!porSetor[c.setor])       porSetor[c.setor] = {};
      if (!porSetor[c.setor][area]) porSetor[c.setor][area] = {};
      if (!porSetor[c.setor][area][turno]) porSetor[c.setor][area][turno] = [];
      porSetor[c.setor][area][turno].push(c);
    });

    const setoresAtivos = Object.keys(porSetor);
    this.$('#quad-stat-total').textContent   = filtrados.length;
    this.$('#quad-stat-setores').textContent = setoresAtivos.length;

    const totalSetor = (s) => {
      let total = 0;
      Object.values(porSetor[s]).forEach(areaObj => {     // areaObj = { turno: [pessoas] }
        Object.values(areaObj).forEach(pessoasArr => {    // pessoasArr = [pessoas]
          total += pessoasArr.length;
        });
      });
      return total;
    };

    let maior = '—', maiorN = 0;
    setoresAtivos.forEach(s => {
      const n = totalSetor(s);
      if (n > maiorN) { maiorN = n; maior = `${s} (${n})`; }
    });
    this.$('#quad-stat-maior').textContent = maior;

    if (!setoresAtivos.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1; background:var(--white); border:1px solid var(--border); border-radius:12px;">Nenhum colaborador encontrado</div>`;
      return;
    }

    setoresAtivos.sort((a, b) => totalSetor(b) - totalSetor(a));

    grid.innerHTML = setoresAtivos.map(setor => {
      const areas = porSetor[setor];
      const total = totalSetor(setor);
      const areasOrdenadas = Object.keys(areas).sort((a, b) => {
        if (a === SEM_AREA) return 1;
        if (b === SEM_AREA) return -1;
        return a.localeCompare(b);
      });

      const areasHtml = areasOrdenadas.map(area => {
        const turnos = porSetor[setor][area];
        const turnosOrdenados = Object.keys(turnos).sort((a, b) => {
          const order = { diurno: 0, noturno: 1 };
          return (order[a] ?? 99) - (order[b] ?? 99);
        });

        const turnosHtml = turnosOrdenados.map(turno => {
          const pessoas = turnos[turno];
          const pessoasHtml = pessoas
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map(p => `
              <div class="func-mini" onclick="abrirDrawerColab(${p.id})">
                <div class="cell-avatar">${this.h(this.iniciais(p.nome))}</div>
                <div class="func-mini-name">${this.h(p.nome)}</div>
                <div class="func-mini-status ${this.h(p.status)}" title="${this.h(this.STATUS_LABEL[p.status]?.t || p.status)}"></div>
              </div>
            `).join('');

          const turnoLabel = turno === 'noturno' ? '🌙 Noturno' : '☀️ Diurno';
          return `
            <div style="margin-bottom:12px;">
              <div class="area-header" style="padding-left:12px; opacity:0.7; font-size:0.85rem;">
                <span>${turnoLabel}</span>
                <span class="area-count">${pessoas.length}</span>
              </div>
              <div class="func-list" style="margin-top:6px;">${pessoasHtml}</div>
            </div>
          `;
        }).join('');

        const totalArea = turnosOrdenados.reduce((sum, turno) => sum + turnos[turno].length, 0);
        const isSemArea = area === SEM_AREA;
        return `
          <div class="area-block">
            <div class="area-header">
              <span class="area-name${isSemArea ? ' sem-area' : ''}">${this.h(area)}</span>
              <span class="area-count">${totalArea}</span>
            </div>
            <div class="area-body">${turnosHtml}</div>
          </div>
        `;
      }).join('');

      // Setores com muitos colaboradores ocupam a linha inteira para
      // distribuir os nomes em várias colunas (menos crescimento vertical)
      const wide = total > 8 ? ' setor-card--wide' : '';

      return `
        <div class="setor-card${wide}">
          <div class="setor-header">
            <div class="setor-icon">${this.SETOR_ICON[setor] || '◆'}</div>
            <div class="setor-title-block">
              <div class="setor-name">${this.h(setor)}</div>
              <div class="setor-meta">${areasOrdenadas.filter(a => a !== SEM_AREA).length} ${areasOrdenadas.filter(a => a !== SEM_AREA).length === 1 ? 'área' : 'áreas'}</div>
            </div>
            <div class="setor-count">${total}</div>
          </div>
          <div class="setor-body">${areasHtml}</div>
        </div>
      `;
    }).join('');
  }
}

export default QuadroModule;
