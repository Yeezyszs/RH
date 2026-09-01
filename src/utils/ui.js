// Padrões de interface repetidos entre módulos.
//
// Cada um destes existia copiado em vários módulos, com pequenas variações que
// só divergiam com o tempo — o `<select>` de colaboradores, por exemplo, tinha
// três versões praticamente idênticas em advertências, vale alimentação e vale
// combustível. Corrigir uma não corrigia as outras.

/**
 * Agrupa uma ação por `ms`, mantendo apenas a última chamada da rajada.
 * Usado nos campos de busca, para não re-renderizar a cada tecla.
 *
 * Devolve uma função com `.cancel()`, para o chamador poder abortar um
 * disparo pendente (ao fechar a tela, por exemplo).
 */
export function debounce(fn, ms = 250) {
  let t;
  const agendada = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  agendada.cancel = () => clearTimeout(t);
  return agendada;
}

/**
 * Options de um `<select>` de colaboradores: ativos em ordem alfabética e,
 * ao final, os inativos num optgroup separado.
 *
 * Os inativos continuam selecionáveis de propósito: é preciso poder lançar
 * ou corrigir registros de quem já saiu (advertência tardia, acerto de
 * benefício, auditoria de competência passada).
 *
 * @param {Array} colaboradores lista completa
 * @param {(s: string) => string} h função de escape HTML
 */
export function optionsColaboradores(colaboradores, h) {
  const porNome = (a, b) => a.nome.localeCompare(b.nome);
  const ativos   = colaboradores.filter(c => c.status !== 'inativo').sort(porNome);
  const inativos = colaboradores.filter(c => c.status === 'inativo').sort(porNome);

  const opt = (c, sufixo = '') =>
    `<option value="${c.id}">${h(c.nome)} — ${h(c.setor)}${sufixo}</option>`;

  let html = ativos.map(c => opt(c)).join('');
  if (inativos.length) {
    html += `<optgroup label="Inativos / Desligados">`
          + inativos.map(c => opt(c, ' (inativo)')).join('')
          + `</optgroup>`;
  }
  return html;
}

/**
 * Limpa um formulário de verdade — inclusive os campos ocultos.
 *
 * `form.reset()` NÃO limpa `<input type="hidden">`. Não é bug de navegador: no
 * HTML, o hidden usa "value mode default", ou seja, atribuir `.value` escreve o
 * ATRIBUTO do elemento — que é exatamente o valor para o qual o reset restaura.
 * Num campo de texto comum, `.value` mexe só na propriedade e o reset limpa.
 *
 * Consequência prática: o `id` do último registro aberto para edição sobrevive
 * ao reset, e o próximo "novo lançamento" é gravado como EDIÇÃO daquele — um
 * registro some e o outro toma seu lugar, sem erro nenhum.
 *
 * Chamar no lugar de `form.reset()`, antes de preencher os campos.
 */
export function limparFormulario(form) {
  if (!form) return;
  form.reset();
  form.querySelectorAll('input[type="hidden"]').forEach(campo => { campo.value = ''; });
}

/**
 * Competência (AAAA-MM) do mês corrente. Feita a partir da data local, e não
 * de `toISOString()`, que converte para UTC e vira o mês errado nos últimos
 * dias do mês em fusos negativos como o do Brasil.
 */
export function competenciaAtual(data = new Date()) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}
