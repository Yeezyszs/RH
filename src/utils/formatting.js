// Formatting and DOM-escaping utilities shared across all modules

export function h(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function iniciais(nome) {
  const parts = (nome || '').trim().split(/\s+/);
  const a = parts[0]?.[0] || '';
  const b = parts[parts.length - 1]?.[0] || '';
  return (a + b).toUpperCase();
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function fmtBRL(n) {
  return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function tempoCasa(iso) {
  if (!iso) return '—';
  const start = new Date(iso + 'T00:00:00');
  const now = new Date();
  let anos = now.getFullYear() - start.getFullYear();
  let meses = now.getMonth() - start.getMonth();
  if (meses < 0) { anos--; meses += 12; }
  if (anos <= 0 && meses <= 0) return 'menos de 1 mês';
  if (anos === 0) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  if (meses === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  return `${anos}a ${meses}m`;
}

export function diasAte(isoVenc) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(isoVenc + 'T00:00:00');
  return Math.round((v - hoje) / (1000 * 60 * 60 * 24));
}

export function vencStatus(dias) {
  if (dias < 0)   return 'vencido';
  if (dias <= 7)  return 'critico';
  if (dias <= 30) return 'alerta';
  return 'ok';
}

export function vencBadge(dias) {
  const st = vencStatus(dias);
  if (st === 'vencido') return `<span class="badge danger">Vencido</span>`;
  if (st === 'critico') return `<span class="badge warn">Crítico</span>`;
  if (st === 'alerta')  return `<span class="badge info">Atenção</span>`;
  return `<span class="badge ok">OK</span>`;
}

export function mesChave(iso) {
  return iso ? iso.slice(0, 7) : '';
}

export function mesLabel(chave) {
  if (!chave) return '';
  const [y, m] = chave.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[parseInt(m, 10) - 1]}/${y}`;
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
