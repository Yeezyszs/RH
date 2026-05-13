// Table Component
// Utilitário para renderização de tabelas com estado vazio

/**
 * Renderiza linhas em um tbody.
 * @param {HTMLElement} tbody
 * @param {Array} rows - dados filtrados
 * @param {Function} renderRow - fn(row) → string HTML de <tr>
 * @param {string} emptyMsg - mensagem exibida quando rows está vazio
 * @param {number} colspan - número de colunas para a célula de estado vazio
 */
export function renderTable(tbody, rows, renderRow, emptyMsg = 'Nenhum item encontrado', colspan = 99) {
  if (!tbody) return;
  tbody.innerHTML = rows.length
    ? rows.map(renderRow).join('')
    : `<tr><td colspan="${colspan}" class="empty">${emptyMsg}</td></tr>`;
}

/**
 * Retorna HTML de linha de carregamento.
 */
export function loadingRow(colspan = 99, msg = 'Carregando…') {
  return `<tr><td colspan="${colspan}" class="empty" style="color:var(--text-muted)">${msg}</td></tr>`;
}

/**
 * Retorna HTML de linha de erro.
 */
export function errorRow(colspan = 99, msg = 'Erro ao carregar dados') {
  return `<tr><td colspan="${colspan}" class="empty" style="color:var(--danger)">${msg}</td></tr>`;
}

export default { renderTable, loadingRow, errorRow };
