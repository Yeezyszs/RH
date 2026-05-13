// Pagination Component
// Renderiza barra de paginação genérica

export class Pagination {
  constructor({ barId, infoId, controlsId, $, onPageChange, itemLabel = 'item' }) {
    this.$ = $;
    this.barId = barId;
    this.infoId = infoId;
    this.controlsId = controlsId;
    this.onPageChange = onPageChange;
    this.itemLabel = itemLabel;
  }

  render(page, totalPages, total) {
    const bar      = this.$(`#${this.barId}`);
    const info     = this.$(`#${this.infoId}`);
    const controls = this.$(`#${this.controlsId}`);
    if (!bar) return;

    if (totalPages <= 1) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'flex';
    if (info) {
      const label = total !== 1 ? this.itemLabel + 's' : this.itemLabel;
      info.textContent = `${total} ${label}`;
    }

    const btns = [];
    btns.push(`<button class="pagination-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Ant.</button>`);

    const inicio = Math.max(1, page - 2);
    const fim    = Math.min(totalPages, page + 2);

    if (inicio > 1)  btns.push(`<button class="pagination-btn" data-page="1">1</button>`);
    if (inicio > 2)  btns.push(`<span class="pagination-info">…</span>`);

    for (let p = inicio; p <= fim; p++) {
      btns.push(`<button class="pagination-btn${p === page ? ' current' : ''}" data-page="${p}">${p}</button>`);
    }

    if (fim < totalPages - 1) btns.push(`<span class="pagination-info">…</span>`);
    if (fim < totalPages)     btns.push(`<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`);

    btns.push(`<button class="pagination-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Próx. →</button>`);

    if (controls) {
      controls.innerHTML = btns.join('');
      controls.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = parseInt(btn.dataset.page, 10);
          if (!isNaN(p)) this.onPageChange(p);
        });
      });
    }
  }

  hide() {
    const bar = this.$(`#${this.barId}`);
    if (bar) bar.style.display = 'none';
  }
}

export default Pagination;
