// Utilitários base — plain script, carregado antes de app.js
// Expõe h(), diasAte(), fmtBRL() globalmente para dashboard.js e auth.js

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

window.h       = h;
window.diasAte = diasAte;
window.fmtBRL  = fmtBRL;
