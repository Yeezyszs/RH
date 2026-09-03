// Leitura do relatório "Produto de Carga" — o PDF que a operadora emite a cada
// crédito de vale combustível.
//
// Está separado do módulo de tela de propósito: é a parte que precisa ser
// testada com afinco, porque um erro aqui grava valor errado para dezenas de
// pessoas de uma vez. Aqui não há DOM, nem pdf.js, nem banco — entra texto,
// sai o conteúdo do relatório conferido.
//
// O PDF tem esta cara (uma linha por beneficiário):
//
//   Emitido em: 03/07/2026
//   Número da nota: 824
//   Valor total da nota: R$ 6.395,00
//   Total de crédito: R$ 6.390,00
//   Total de serviço: R$ 5,00
//   Código do beneficiário Nome CPF Valor do crédito Taxa de Impressão ...
//   2388172 ADAO RIBEIRO 572.032.379-15 R$ 150,00 R$ R$ R$
//
// "Total de crédito" é o que vira benefício. "Total de serviço" é cobrança da
// operadora (reimpressão de cartão, por exemplo) e NÃO pertence a ninguém —
// por isso a conferência é contra o crédito, não contra o valor da nota.

const RE_CPF        = /\d{3}\.\d{3}\.\d{3}-\d{2}/;
const RE_CPF_SO     = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const RE_DINHEIRO   = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/;
const RE_DATA_BR    = /(\d{2})\/(\d{2})\/(\d{4})/;

// A fonte do PDF usa ligaduras tipográficas (ﬁ, ﬂ…). Sem desfazê-las,
// "beneficiário" não casa com nada e o cabeçalho passa despercebido.
const LIGADURAS = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl' };

/** Desfaz ligaduras e normaliza espaços (inclusive os não-quebráveis). */
export function normalizarTexto(s) {
  return String(s ?? '')
    .replace(/[\uFB00-\uFB04]/g, (c) => LIGADURAS[c])
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "R$ 1.234,50" → 1234.5. Devolve null quando não há número. */
export function valorBR(s) {
  const m = RE_DINHEIRO.exec(String(s ?? ''));
  if (!m) return null;
  return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
}

/** Nome em caixa alta, sem acento e sem espaço sobrando — chave de comparação. */
export function normalizarNome(s) {
  return normalizarTexto(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/** Só os dígitos — é assim que CPF de origens diferentes se compara. */
export function soDigitos(s) {
  return String(s ?? '').replace(/\D/g, '');
}

// Tolerância vertical ao agrupar células numa linha, em pontos.
//
// Não dá para agrupar por Y exato: neste relatório as células de uma mesma
// linha saem com baselines levemente diferentes quando o nome é comprido —
// "GABRIEL MARTINS RIBEIRO BEDETI" veio em 282,54 / 280,74 / 278,94, e o
// agrupamento exato partia a linha em três, perdendo o beneficiário inteiro.
// O espaçamento entre linhas é de ~10 pt, então 4 pt separa com folga.
const TOLERANCIA_LINHA = 4;

/**
 * Reconstrói as linhas visuais a partir dos itens de texto de uma página do
 * pdf.js. O extrator devolve pedaços soltos com coordenadas; agrupar por Y e
 * ordenar por X devolve a linha como ela aparece impressa — que é o formato
 * que `lerRelatorioVale` espera.
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

/**
 * Valor de um campo "Rótulo: conteúdo" do cabeçalho.
 *
 * Não basta olhar o começo da linha: dois campos podem sair impressos lado a
 * lado ("Usuário: FULANA  Emitido em: 03/07/2026"). Por isso a busca é por
 * cada ":" da linha, comparando o rótulo que vem imediatamente antes dele e
 * cortando o conteúdo no próximo rótulo da mesma linha.
 */
function campo(linhas, rotulo) {
  const alvo = normalizarNome(rotulo);
  const nPalavras = alvo.split(' ').length;
  for (const l of linhas) {
    for (const m of l.matchAll(/:\s*/g)) {
      const antes = l.slice(0, m.index).split(' ');
      if (normalizarNome(antes.slice(-nPalavras).join(' ')) !== alvo) continue;
      const resto = l.slice(m.index + m[0].length);
      const proximo = /\s[^\s:]+(?:\s[^\s:]+){0,3}:\s/.exec(resto);
      return (proximo ? resto.slice(0, proximo.index) : resto).trim();
    }
  }
  return '';
}

/** "03/07/2026" → { iso: '2026-07-03', competencia: '2026-07' }. */
function dataBR(txt) {
  const m = RE_DATA_BR.exec(txt || '');
  if (!m) return { iso: '', competencia: '' };
  const [, d, mes, ano] = m;
  return { iso: `${ano}-${mes}-${d}`, competencia: `${ano}-${mes}` };
}

/**
 * Extrai um beneficiário de uma linha inteira:
 *   "2388172 ADAO RIBEIRO 572.032.379-15 R$ 150,00 R$ R$ R$"
 * O crédito é o PRIMEIRO valor depois do CPF — as colunas seguintes são taxas,
 * e existe linha com taxa preenchida (reimpressão de cartão).
 */
function registroDaLinha(linha) {
  const m = /^(\d+)\s+(.+?)\s+(\d{3}\.\d{3}\.\d{3}-\d{2})\s+(.*)$/.exec(linha);
  if (!m) return null;
  const valor = valorBR(m[4]);
  if (valor == null) return null;
  return { codigo: m[1], nome: m[2].trim(), cpf: m[3], valor };
}

/**
 * Extrator alternativo, para o caso de o PDF vir com uma célula por linha
 * (foi assim que outro leitor devolveu o mesmo arquivo). Âncora no CPF: o nome
 * é a linha anterior, o crédito é o primeiro valor nas linhas seguintes.
 */
function registroPorAncora(linhas, i) {
  const nome = (linhas[i - 1] || '').trim();
  const codigo = (linhas[i - 2] || '').trim();
  if (!nome || RE_CPF.test(nome)) return null;
  for (let j = i + 1; j < Math.min(i + 4, linhas.length); j++) {
    const v = valorBR(linhas[j]);
    if (v != null) return { codigo: /^\d+$/.test(codigo) ? codigo : '', nome, cpf: linhas[i].trim(), valor: v };
  }
  return null;
}

/**
 * Lê o relatório a partir das linhas de texto do PDF.
 *
 * @param {string[]} linhasBrutas
 * @returns {{emitidoBR: string, emitido: string, competencia: string,
 *            nota: string, empresa: string, totalNota: number|null,
 *            totalCredito: number|null, totalServico: number|null,
 *            registros: {codigo: string, nome: string, cpf: string, valor: number}[],
 *            soma: number, problemas: string[]}}
 * @throws {Error} quando o arquivo não tem cara de relatório de crédito
 */
export function lerRelatorioVale(linhasBrutas) {
  const linhas = (linhasBrutas || []).map(normalizarTexto).filter(Boolean);

  const emitidoBR = campo(linhas, 'Emitido em');
  const { iso: emitido, competencia } = dataBR(emitidoBR);

  const registros = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (!RE_CPF.test(l)) continue;
    const reg = RE_CPF_SO.test(l) ? registroPorAncora(linhas, i) : registroDaLinha(l);
    if (reg) registros.push(reg);
  }

  if (!registros.length) {
    throw new Error('Não encontrei nenhum beneficiário neste PDF. '
      + 'Confira se é o relatório de crédito da operadora do vale combustível.');
  }

  const totalNota    = valorBR(campo(linhas, 'Valor total da nota'));
  const totalCredito = valorBR(campo(linhas, 'Total de crédito'));
  const totalServico = valorBR(campo(linhas, 'Total de serviço'));
  const soma = arredondar(registros.reduce((s, r) => s + r.valor, 0));

  const problemas = [];
  if (!competencia) {
    problemas.push('O relatório não traz a data de emissão — confira a competência antes de importar.');
  }
  if (totalCredito != null && arredondar(totalCredito) !== soma) {
    problemas.push(`A soma dos beneficiários (${moeda(soma)}) não bate com o total de crédito `
      + `do relatório (${moeda(totalCredito)}).`);
  }
  const vistos = new Set();
  for (const r of registros) {
    const k = soDigitos(r.cpf);
    if (vistos.has(k)) problemas.push(`${r.nome} aparece mais de uma vez no relatório.`);
    vistos.add(k);
  }

  return {
    emitidoBR, emitido, competencia,
    nota: campo(linhas, 'Número da nota'),
    empresa: campo(linhas, 'Empresa'),
    totalNota, totalCredito, totalServico,
    registros, soma, problemas,
  };
}

/** Duas casas — evita que a soma de centavos apareça como 6239.999999. */
export function arredondar(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function moeda(v) {
  return 'R$ ' + arredondar(v).toFixed(2).replace('.', ',');
}

/**
 * Cruza o relatório com o cadastro. O CPF é a chave forte; o nome só entra
 * quando o cadastro está sem CPF, e um nome que casa com duas pessoas é
 * tratado como não encontrado — adivinhar aqui seria pagar o benefício errado.
 *
 * @param {{registros: object[]}} relatorio
 * @param {{id: number, nome: string, cpf?: string, status?: string}[]} colaboradores
 * @param {{ignorados?: string[], vinculos?: Record<string, number>}} [opcoes]
 *   `ignorados` — CPFs que o RH marcou para nunca importar.
 *   `vinculos`  — CPF → id, ligações feitas à mão na tela de conferência.
 */
export function conciliarRelatorio(relatorio, colaboradores = [], opcoes = {}) {
  const ignorados = new Set((opcoes.ignorados || []).map(soDigitos).filter(Boolean));
  const vinculos  = opcoes.vinculos || {};

  const porCpf = new Map();
  const porNome = new Map();
  for (const c of colaboradores) {
    const cpf = soDigitos(c.cpf);
    if (cpf && !porCpf.has(cpf)) porCpf.set(cpf, c);
    const nome = normalizarNome(c.nome);
    if (!nome) continue;
    if (!porNome.has(nome)) porNome.set(nome, []);
    porNome.get(nome).push(c);
  }

  const casados = [], listaIgnorados = [], semCadastro = [];
  const usados = new Set();

  for (const reg of relatorio.registros) {
    const cpf = soDigitos(reg.cpf);

    if (ignorados.has(cpf)) { listaIgnorados.push({ registro: reg }); continue; }

    const forcado = vinculos[cpf] ?? vinculos[reg.cpf];
    let colab = forcado != null ? colaboradores.find(c => c.id === Number(forcado)) : null;
    let via = colab ? 'manual' : '';

    if (!colab && cpf && porCpf.has(cpf)) { colab = porCpf.get(cpf); via = 'cpf'; }

    if (!colab) {
      const iguais = porNome.get(normalizarNome(reg.nome)) || [];
      if (iguais.length === 1) { colab = iguais[0]; via = 'nome'; }
      else if (iguais.length > 1) {
        semCadastro.push({ registro: reg, motivo: 'Há mais de um cadastro com esse nome' });
        continue;
      }
    }

    if (!colab) { semCadastro.push({ registro: reg, motivo: 'Sem cadastro correspondente' }); continue; }

    if (usados.has(colab.id)) {
      semCadastro.push({ registro: reg, motivo: `Já casado com ${colab.nome} nesta importação` });
      continue;
    }
    usados.add(colab.id);
    casados.push({ registro: reg, colab, via });
  }

  const somar = (lista, get) => arredondar(lista.reduce((s, x) => s + get(x), 0));

  // Quem está ativo no sistema e não aparece no relatório: não recebeu neste
  // crédito. Não é erro, mas o RH precisa ver o número antes de confirmar.
  const noRelatorio = new Set(casados.map(c => c.colab.id));
  const ausentes = colaboradores.filter(c => c.status !== 'inativo' && !noRelatorio.has(c.id));

  return {
    casados,
    ignorados: listaIgnorados,
    semCadastro,
    ausentes,
    somaCasados:     somar(casados,        x => x.registro.valor),
    somaIgnorados:   somar(listaIgnorados, x => x.registro.valor),
    somaSemCadastro: somar(semCadastro,    x => x.registro.valor),
  };
}

export default { lerRelatorioVale, conciliarRelatorio, linhasDeItens };
