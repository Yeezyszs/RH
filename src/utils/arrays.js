// Mutação dos arrays globais compartilhados.
//
// Extraído de init.js: usado tanto pela carga inicial quanto pelo realtime, e
// a regra do _upsertArray (idempotência por id) merece teste próprio.
// Script clássico — expõe no window ao final.

// Os arrays globais (COLABORADORES, FERIAS, etc.) são compartilhados POR
// REFERÊNCIA com os módulos (cada módulo guarda `this.X = deps.X` no bootstrap).
// Por isso NÃO podemos reatribuir (`X = novo`) — isso criaria um array novo e os
// módulos continuariam apontando para o array vazio antigo, deixando as telas
// zeradas. As funções abaixo alteram o conteúdo MANTENDO a mesma referência.

function _preencherArray(arr, novo) {
  arr.length = 0;
  arr.push(...novo);
}

function _filtrarArray(arr, manter) {
  const mantidos = arr.filter(manter);
  arr.length = 0;
  arr.push(...mantidos);
}

// Upsert idempotente por id: se o item já existe (ex.: o módulo o adicionou
// otimisticamente após salvar), substitui no lugar; senão insere no topo.
// Evita registros duplicados quando o evento de realtime "ecoa" um insert que
// o próprio cliente acabou de fazer localmente.
function _upsertArray(arr, item) {
  const i = arr.findIndex(x => x.id === item.id);
  if (i >= 0) arr[i] = item;
  else arr.unshift(item);
}

window._preencherArray = _preencherArray;
window._filtrarArray   = _filtrarArray;
window._upsertArray    = _upsertArray;
