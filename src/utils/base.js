// Utilitários base — plain script, carregado antes de app.js
// Expõe h(), diasAte(), fmtBRL() e o conceito de "efetivo" globalmente.

function h(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function diasAte(isoVenc) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(isoVenc + 'T00:00:00') - hoje) / 86400000);
}

function fmtBRL(n) {
  return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Quem tem contrato em vigor com a empresa.
//
// Afastado entra: o afastamento suspende o contrato, não o encerra — a pessoa
// continua sendo funcionária, e é assim que ela tem de aparecer no cadastro,
// no quadro e nos relatórios impressos dos dois. Férias, pela mesma razão. Só
// o desligado fica fora.
//
// Fica aqui, num script clássico carregado antes de tudo, porque quem precisa
// da regra está espalhado: a API que filtra a lista, o módulo do cadastro, o
// do quadro e a preparação do relatório. Tendo cópias da lista em cada um, uma
// delas ia divergir.
const STATUS_EFETIVO = ['ativo', 'ferias', 'afastado'];

function noEfetivo(colab) {
  return STATUS_EFETIVO.includes(colab?.status);
}

/**
 * O colaborador casa com o filtro de status escolhido?
 *
 * '' — sem filtro, passa todo mundo (inclusive desligado).
 * 'efetivo' — o efetivo da empresa.
 * qualquer outro — o status exato.
 */
function statusCasa(colab, filtro) {
  if (!filtro) return true;
  if (filtro === 'efetivo') return noEfetivo(colab);
  return colab?.status === filtro;
}

window.h       = h;
window.diasAte = diasAte;
window.fmtBRL  = fmtBRL;
window.STATUS_EFETIVO = STATUS_EFETIVO;
window.noEfetivo      = noEfetivo;
window.statusCasa     = statusCasa;
