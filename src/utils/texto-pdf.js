// Leitura de texto de PDF — as peças que servem a qualquer relatório.
//
// Nasceram dentro de `relatorio-vale.js`, para o relatório de crédito do vale
// combustível. Quando a folha de pagamento virou o segundo PDF que o sistema
// lê, ficou claro que reconstruir linhas, desfazer ligaduras e ler valor em
// real não têm nada de específico do vale. Vieram para cá em vez de virarem
// cópia no segundo leitor — cópia de código compartilhado é exatamente o que
// já fez este projeto ter teste verde com produção quebrada.
//
// `relatorio-vale.js` reexporta tudo daqui, então quem importava de lá
// continua funcionando.

const RE_DINHEIRO = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/;
const RE_NUMERO   = /\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/;
const RE_DATA_BR  = /(\d{2})\/(\d{2})\/(\d{4})/;

// A fonte do PDF usa ligaduras tipográficas (ﬁ, ﬂ…). Sem desfazê-las,
// "beneficiário" não casa com nada e o cabeçalho passa despercebido.
const LIGADURAS = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl' };

/** Desfaz ligaduras e normaliza espaços (inclusive os não-quebráveis). */
export function normalizarTexto(s) {
  return String(s ?? '')
    .replace(/[ﬀ-ﬄ]/g, (c) => LIGADURAS[c])
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * "R$ 1.234,50" → 1234.5. Devolve null quando não há número.
 *
 * Exige o "R$": no relatório do vale as colunas de taxa vazias saem como um
 * "R$" solto, e a coluna de referência traz número sem cifrão ("220:00",
 * "20,00"). Sem a exigência, a referência seria lida como se fosse o valor.
 */
export function valorBR(s) {
  const m = RE_DINHEIRO.exec(String(s ?? ''));
  if (!m) return null;
  return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
}

/** Primeiro número em formato brasileiro, com ou sem "R$". */
export function numeroBR(s) {
  const m = RE_NUMERO.exec(String(s ?? ''));
  if (!m) return null;
  return parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
}

/** Todos os números em formato brasileiro da linha, na ordem em que aparecem. */
export function valoresBR(s) {
  return (String(s ?? '').match(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/g) || [])
    .map(v => parseFloat(v.replace(/\./g, '').replace(',', '.')));
}

/** Nome em caixa alta, sem acento e sem espaço sobrando — chave de comparação. */
export function normalizarNome(s) {
  return normalizarTexto(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

/** Só os dígitos — é assim que CPF de origens diferentes se compara. */
export function soDigitos(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/** "03/07/2026" → { iso: '2026-07-03', competencia: '2026-07' }. */
export function dataBR(txt) {
  const m = RE_DATA_BR.exec(txt || '');
  if (!m) return { iso: '', competencia: '' };
  const [, d, mes, ano] = m;
  return { iso: `${ano}-${mes}-${d}`, competencia: `${ano}-${mes}` };
}

/** Duas casas — evita que a soma de centavos apareça como 6239.999999. */
export function arredondar(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

/** "R$ 1.234,56" a partir do número, para mensagens de conferência. */
export function moedaBR(v) {
  return 'R$ ' + arredondar(v).toFixed(2).replace('.', ',');
}

// Tolerância vertical ao agrupar células numa linha, em pontos.
//
// Não dá para agrupar por Y exato: as células de uma mesma linha saem com
// baselines levemente diferentes quando o texto é comprido — "GABRIEL MARTINS
// RIBEIRO BEDETI" veio em 282,54 / 280,74 / 278,94, e o agrupamento exato
// partia a linha em três, perdendo o beneficiário inteiro. O espaçamento entre
// linhas é de ~10 pt, então 4 pt separa com folga.
const TOLERANCIA_LINHA = 4;

/**
 * Reconstrói as linhas visuais a partir dos itens de texto de uma página do
 * pdf.js. O extrator devolve pedaços soltos com coordenadas; agrupar por Y e
 * ordenar por X devolve a linha como ela aparece impressa — que é o formato
 * que os leitores esperam.
 *
 * @param {{str: string, transform: number[]}[]} itens
 */
export function linhasDeItens(itens) {
  const celulas = (itens || [])
    .filter(it => it?.str && it.str.trim())
    .map(it => ({ y: it.transform[5], x: it.transform[4], s: it.str }))
    .sort((a, b) => b.y - a.y);               // do topo para o rodapé

  const linhas = [];
  let grupo = [], topo = null;
  const fechar = () => {
    if (!grupo.length) return;
    linhas.push(normalizarTexto(grupo.sort((a, b) => a.x - b.x).map(c => c.s).join(' ')));
    grupo = [];
  };
  for (const c of celulas) {
    if (topo == null || topo - c.y > TOLERANCIA_LINHA) { fechar(); topo = c.y; }
    grupo.push(c);
  }
  fechar();
  return linhas;
}
