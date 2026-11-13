// Leitura da folha de pagamento — o PDF de recibos que a contabilidade exporta.
//
// O arquivo é uma sequência de holerites, dois por página (a via da empresa e
// a do funcionário), cada um com esta cara:
//
//   MATARUCO COMÉRCIO ATACADISTA DE FARINHAS LTDA
//   CNPJ: 24.939.311/0001-89 CC: Produção Folha Mensal
//   Mensalista Setembro de 2026
//   Código Nome do Funcionário CBO Departamento Filial
//   5 ADAO RIBEIRO 821205 11 1
//   OPERADOR DE FORNO Admissão: 10/09/2018
//   Código Descrição Referência Vencimentos Descontos
//   1 HORAS NORMAIS 220:00 3.674,64
//   …
//   Total de Vencimentos Total de Descontos
//   3.998,84 1.878,21 Data
//   Valor Líquido  2.120,63
//   Salário Base Sal. Contr. INSS Base Cálc. FGTS F.G.T.S do Mês …
//   3.674,64 3.988,48 3.988,48 319,07 2.181,63 0,00
//
// O número que interessa ao cadastro é o **Salário Base** — o salário
// contratual. Os totais do mês (vencimentos, descontos, líquido) variam com
// horas extras, faltas e adiantamentos, e por isso não servem como salário.
//
// Duas manhas do arquivo que o leitor precisa saber:
//
//  1. Cada holerite aparece DUAS vezes, uma via para cada lado. São idênticos.
//  2. Quando as verbas não cabem na página, o holerite segue na seguinte e a
//     primeira parte fecha com "A TRANSPORTAR *********" — sem totais e sem
//     salário base. As duas partes têm o mesmo código de funcionário.
//
// Os dois casos se resolvem da mesma forma: agrupar por código e juntar os
// campos, ficando com o primeiro valor que não for nulo.
//
// Sem DOM, sem rede, sem pdf.js: entra texto, sai folha conferida.

import {
  normalizarTexto, normalizarNome, numeroBR, valoresBR, arredondar, moedaBR,
} from './texto-pdf.js?v=dev';

// Quão longe do título da coluna um valor ainda pertence a ela, em pontos.
// As duas colunas de dinheiro do holerite ficam a mais de 100 pt uma da
// outra; 60 separa com folga e ainda descarta a coluna de referência.
const TOLERANCIA_COLUNA = 60;

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// A contabilidade exporta o mesmo relatório em mais de um layout, e eles
// mudam sem aviso. A folha de janeiro/2026 chegou com cinco diferenças em
// relação à de setembro/2026 — coluna "Cadastro" no lugar de "Código", duas
// colunas a mais na linha de identificação, "Data Admissão" no lugar de
// "Admissão", os totais na mesma linha do rótulo e "Total Líquido" no lugar
// de "Valor Líquido". Qualquer uma delas sozinha derrubava a importação
// inteira com "não encontrei nenhum holerite".
//
// Por isso os marcadores são expressões, não texto fixo: o leitor reconhece
// as duas gerações do relatório, e o arquivo antigo continua importável.
const RE_CAB_IDENT = /^(?:C[óo]digo|Cadastro)\s+Nome do Funcion[áa]rio/;
const MARCA_BASES  = 'Salário Base';
const RE_CAB_TOTAIS = /^Total\s+de\s+Vencimentos/;
// Totais do layout novo: "Total 3.998,84 1.768,88". O rótulo não fica
// necessariamente no começo da linha — a folha imprime recados ali, e uma
// mensagem de aniversário à esquerda já bastava para os totais do mês da
// pessoa sumirem em silêncio ("Parabens ! Feliz Aniversario 05/02   Total
// 3.979,84   1.232,35"). Por isso o reconhecimento é pelo rótulo seguido de
// dois valores, onde quer que ele esteja na linha.
const RE_TOTAIS_NA_LINHA =
  /\bTotal\b(?!\s*L[íi]quido)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/;
const RE_LIQUIDO   = /(?:Valor|Total)\s+L[íi]quido/;

// Cabeçalho do quadro de verbas. É ele que diz onde começam as colunas de
// provento e de desconto — e sem saber a coluna não dá para dizer se "1,00"
// numa linha de verba foi pago ou descontado.
const RE_CAB_VERBAS = /^(?:Ev|C[óo]digo)\s+Descri[çc][ãa]o/;
const RE_COL_PROVENTO = /^(?:Proventos|Vencimentos)$/i;
const RE_COL_DESCONTO = /^Descontos$/i;
const RE_COL_REFERENCIA = /^Refer[êe]ncia$/i;

// Linha de verba: código do evento, descrição, e um ou dois valores.
//
// O código pode ter sublinha: a pensão judicial sai como "1830 Pensão
// Judicial" sem valor e "1830.1 - GAEL CARVALHAES DA SILVA ... 791,65" com o
// valor na linha de baixo. Exigir código inteiro perdia a pensão inteira, e
// o desconto sumia da conta sem nenhum aviso.
const RE_VERBA = /^(\d{1,4}(?:\.\d+)?)\s+(.+)$/;
const RE_VALOR = /^[\d.]+,\d{2}$/;
// Na linha de bases há colunas que não são dinheiro ("Dep" sai como "00").
const RE_VALOR_BASE = /^[\d.]*\d(?:,\d{2})?$/;

// Onde o quadro de verbas termina.
const RE_FIM_VERBAS = /^(?:Banco:|Total\b|A TRANSPORTAR|Continua\.\.\.|Sal[áa]rio Base|Recebi em)/;

// Identificação: código, nome, CBO e pelo menos duas colunas numéricas. O
// layout novo acrescenta departamento e filial no fim ("01.007 01"), então o
// que vier depois é aceito e descartado — prender a regra ao fim da linha era
// o que fazia o holerite inteiro ser ignorado.
const RE_IDENT     = /^(\d+)\s+(.+?)\s+(\d{4,8})\s+(\d+)\s+(\d+)((?:\s+[\d.]+)*)\s*$/;
const RE_ADMISSAO  = /^(.*?)\s*(?:Data\s+)?Admiss[ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/;
const RE_COMPET    = /\b(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i;
// "01/2026" solto. Exige espaço (ou início de linha) antes e depois para não
// casar com o fim de uma data completa: em "Admissão: 10/09/2018" o trecho
// "09/2018" viraria a competência da folha inteira.
const RE_COMPET_NUM = /(?:^|\s)(0[1-9]|1[0-2])\/(\d{4})(?=\s|$)/;

/** Reconhece a competência nos dois formatos: "Setembro de 2026" e "09/2026". */
export function competenciaDaFolha(texto) {
  const linha = normalizarTexto(texto);

  const porExtenso = RE_COMPET.exec(linha);
  if (porExtenso) {
    const mes = MESES.findIndex(x => normalizarNome(x) === normalizarNome(porExtenso[1]));
    if (mes >= 0) return `${porExtenso[2]}-${String(mes + 1).padStart(2, '0')}`;
  }

  const numerico = RE_COMPET_NUM.exec(linha);
  if (numerico) return `${numerico[2]}-${numerico[1]}`;

  return '';
}

/** Uma linha anuncia a competência da folha? */
function temCompetencia(linha) {
  // O formato numérico só vale no cabeçalho do holerite, que diz o regime
  // ("Mensal"). Sem essa âncora, qualquer data solta do relatório viraria
  // candidata — e o arquivo da contabilidade vem com outros relatórios junto.
  return RE_COMPET.test(linha) || (RE_COMPET_NUM.test(linha) && /\bMensal/i.test(linha));
}

/**
 * Normaliza a entrada: o leitor aceita linhas de texto puro (como nos testes
 * e em qualquer extrator simples) ou linhas com as células posicionadas, que
 * é o que `linhasComCelulas` devolve a partir do pdf.js.
 *
 * Sem as células o leitor funciona igual, menos numa coisa: não consegue
 * dizer se uma verba foi provento ou desconto, porque essa informação está na
 * coluna, não no texto. Nesse caso a verba sai com `tipo: null` em vez de um
 * palpite — chutar aqui é inventar dinheiro no lugar errado.
 */
function normalizarEntrada(linhasBrutas) {
  return (linhasBrutas || []).map(l => (typeof l === 'string'
    ? { texto: normalizarTexto(l), celulas: null }
    : { texto: normalizarTexto(l?.texto), celulas: l?.celulas || null }))
    .filter(l => l.texto);
}

/** Quebra o texto nos blocos de holerite, um por via impressa. */
function blocos(linhas) {
  const inicios = [];
  linhas.forEach((l, i) => { if (RE_CAB_IDENT.test(l.texto)) inicios.push(i); });
  return inicios.map((ini, k) => linhas.slice(ini, inicios[k + 1] ?? linhas.length));
}

/**
 * Verbas do holerite: cada linha do quadro "Ev / Descrição / Referência /
 * Proventos / Descontos".
 *
 * A coluna é que diz o tipo. O cabeçalho do quadro dá o x de "Proventos" e de
 * "Descontos"; cada valor vai para a coluna cujo título estiver mais perto.
 * É assim que "89 P.A.T 1,00" vira desconto de R$ 1,00 e não provento.
 */
function lerVerbas(bloco) {
  const iCab = bloco.findIndex(l => RE_CAB_VERBAS.test(l.texto));
  if (iCab < 0) return [];

  // Onde ficam as colunas, quando o PDF trouxe as posições.
  let xProvento = null, xDesconto = null, xReferencia = null;
  for (const c of bloco[iCab].celulas || []) {
    if (RE_COL_PROVENTO.test(c.s)) xProvento = c.x;
    if (RE_COL_DESCONTO.test(c.s)) xDesconto = c.x;
    if (RE_COL_REFERENCIA.test(c.s)) xReferencia = c.x;
  }
  const temColunas = xProvento != null && xDesconto != null;

  const verbas = [];
  // Verba cujo valor vem na sublinha: guarda a descrição-mãe para compor.
  let mae = null;
  for (let i = iCab + 1; i < bloco.length; i++) {
    const linha = bloco[i];
    if (RE_FIM_VERBAS.test(linha.texto)) break;

    const m = RE_VERBA.exec(linha.texto);
    if (!m) continue;

    // Descrição. Com as colunas conhecidas é o que estiver impresso à
    // esquerda da coluna de referência, descontado o código — é o recorte
    // exato, e não sobra o "20%" da referência grudado no nome de quem
    // recebe a pensão. Sem elas, recorta no primeiro número da linha.
    let descricao;
    if (xReferencia != null && linha.celulas) {
      descricao = linha.celulas
        .filter(c => c.x < xReferencia - TOLERANCIA_COLUNA && c.s !== m[1])
        .map(c => c.s).join(' ').trim();
    }
    if (!descricao) {
      const primeiro = m[2].search(/[\d.]+,\d{2}|\d+[:,]\d+\s*(?:hs|%)/);
      descricao = (primeiro > 0 ? m[2].slice(0, primeiro) : m[2]).trim();
    }

    // Linha de código sem valor nenhum: é a mãe de uma sublinha, como
    // "1830 Pensão Judicial" seguida de "1830.1 - GAEL ... 791,65".
    if (!valoresBR(m[2]).length) {
      mae = { codigo: m[1], descricao };
      continue;
    }
    if (mae && m[1].startsWith(mae.codigo + '.')) {
      descricao = `${mae.descricao} ${descricao}`.replace(/\s*-\s*$/, '').trim();
    }

    const verba = {
      codigo: m[1],
      descricao,
      referencia: null,
      provento: null,
      desconto: null,
      tipo: null,
    };

    if (temColunas && linha.celulas) {
      for (const c of linha.celulas) {
        if (!RE_VALOR.test(c.s)) continue;
        const dProv = Math.abs(c.x - xProvento);
        const dDesc = Math.abs(c.x - xDesconto);
        if (Math.min(dProv, dDesc) > TOLERANCIA_COLUNA) continue;
        if (dProv <= dDesc) { verba.provento = numeroBR(c.s); verba.tipo = 'provento'; }
        else                { verba.desconto = numeroBR(c.s); verba.tipo = 'desconto'; }
      }
      // Referência: o que estiver impresso na coluna de referência, seja hora
      // ("220:00 hs") ou percentual ("20,00 %"). Ler pela posição evita o
      // erro de tomar o próprio valor como referência quando não há nenhuma:
      // em "89 P.A.T 1,00" o 1,00 é dinheiro, não "1,00 hora".
      if (xReferencia != null) {
        const refs = linha.celulas
          .filter(c => Math.abs(c.x - xReferencia) <= TOLERANCIA_COLUNA)
          .map(c => c.s);
        if (refs.length) verba.referencia = refs.join(' ');
      }
    } else {
      // Sem colunas: guarda o valor sem afirmar de que lado ele está.
      const valores = valoresBR(m[2]);
      verba.valor = valores[valores.length - 1];
    }

    if (verba.provento != null || verba.desconto != null || verba.valor != null) {
      verbas.push(verba);
      mae = null;
    }
  }
  return verbas;
}

/**
 * A faixa de bases do rodapé: salário base, salário de contribuição do INSS,
 * base de cálculo do FGTS, FGTS do mês, base de IRRF, faixa e dependentes.
 *
 * São duas linhas — os rótulos e, embaixo, os valores — e cada rótulo ocupa
 * várias palavras ("Base IRRF C/Ded Simp"). Para casar um com o outro, cada
 * palavra do cabeçalho vai para o valor cuja coluna estiver mais perto; o
 * agrupamento sai sozinho disso, sem depender de onde o layout quebra os
 * rótulos — e é ele que muda entre as versões do relatório.
 *
 * Sem as posições não há como parear rótulo e valor, e aí a função devolve
 * lista vazia em vez de um pareamento inventado. O salário base continua
 * sendo lido à parte, que é o número que o cadastro usa.
 */
function lerBases(bloco) {
  const i = bloco.findIndex(l => l.texto.startsWith(MARCA_BASES));
  if (i < 0) return [];
  const cab = bloco[i], val = bloco[i + 1];
  if (!cab?.celulas?.length || !val?.celulas?.length) return [];

  const valores = val.celulas.filter(c => RE_VALOR_BASE.test(c.s));
  if (!valores.length) return [];

  const rotulos = valores.map(() => []);
  for (const palavra of cab.celulas) {
    let melhor = 0;
    valores.forEach((v, k) => {
      if (Math.abs(palavra.x - v.x) < Math.abs(palavra.x - valores[melhor].x)) melhor = k;
    });
    rotulos[melhor].push(palavra.s);
  }

  return valores.map((v, k) => ({
    rotulo: rotulos[k].join(' ') || null,
    // `texto` é como está impresso; `valor` serve para conta. "00" de
    // dependentes não é dinheiro, e por isso valor fica nulo.
    texto: v.s,
    valor: numeroBR(v.s),
  })).filter(b => b.rotulo);
}

/** Lê uma via. Devolve null quando o bloco não tem sequer identificação. */
function lerBloco(bloco) {
  const ident = RE_IDENT.exec(bloco[1]?.texto || '');
  if (!ident) return null;

  // A cauda da linha de identificação, no layout novo, traz o centro de custo
  // e a filial ("01.007 01"). No antigo ela não existe.
  const cauda = (ident[6] || '').trim().split(/\s+/).filter(Boolean);

  const h = {
    codigo:      ident[1],
    nome:        ident[2].trim(),
    cbo:         ident[3],
    departamento: cauda[0] || null,
    filial:       cauda[1] || null,
    bases:       lerBases(bloco),
    cargo:       null,
    admissao:    null,
    salarioBase: null,
    vencimentos: null,
    descontos:   null,
    liquido:     null,
    verbas:      lerVerbas(bloco),
  };

  const adm = RE_ADMISSAO.exec(bloco[2]?.texto || '');
  if (adm) {
    h.cargo = adm[1].trim() || null;
    const [d, m, a] = adm[2].split('/');
    h.admissao = `${a}-${m}-${d}`;
  }

  bloco.forEach(({ texto: linha }, i) => {
    // Bases: a linha seguinte traz os valores na ordem do cabeçalho, e o
    // primeiro deles é o salário base.
    if (linha.startsWith(MARCA_BASES)) {
      const vals = valoresBR(bloco[i + 1]?.texto || '');
      if (vals.length >= 5) h.salarioBase = vals[0];
    }
    // Totais, em dois layouts: o antigo põe o rótulo numa linha
    // ("Total de Vencimentos Total de Descontos") e os valores na seguinte; o
    // novo põe rótulo e valores juntos ("Total 3.998,84 1.768,88"). Numa via
    // que continua na página seguinte vem "A TRANSPORTAR ********* *********",
    // sem número nenhum — e aí os totais ficam nulos, como devem ficar.
    if (RE_CAB_TOTAIS.test(linha)) {
      const vals = valoresBR(bloco[i + 1]?.texto || '');
      if (vals.length >= 2) { h.vencimentos = vals[0]; h.descontos = vals[1]; }
    } else {
      const naLinha = RE_TOTAIS_NA_LINHA.exec(linha);
      if (naLinha) {
        // Os dois valores vêm do próprio casamento, não de `valoresBR(linha)`:
        // o recado à esquerda pode trazer números (uma data, por exemplo) e
        // eles entrariam na frente dos totais.
        h.vencimentos = numeroBR(naLinha[1]);
        h.descontos   = numeroBR(naLinha[2]);
      }
    }

    const liq = RE_LIQUIDO.exec(linha);
    if (liq) {
      const v = numeroBR(linha.slice(liq.index + liq[0].length));
      if (v != null) h.liquido = v;
    }
  });

  return h;
}

/** Junta as vias e as continuações: fica o primeiro valor não nulo de cada campo. */
function juntar(partes) {
  const junto = partes.reduce((acc, p) => {
    for (const [k, v] of Object.entries(p)) {
      if (k === 'verbas') continue;
      // Lista vazia é ausência, não resposta: quem continua na página
      // seguinte traz o rodapé de bases só na segunda parte.
      if (k === 'bases') {
        if (!acc.bases?.length) acc.bases = v;
        continue;
      }
      if (acc[k] == null || acc[k] === '') acc[k] = v;
    }
    return acc;
  }, {});

  // Verbas não seguem a regra do "primeiro não nulo": uma via vazia é lista
  // vazia, não ausência, e quem continua na página seguinte traz a outra
  // metade das verbas. Junta tudo e tira as repetidas — as duas vias da mesma
  // página são cópias uma da outra.
  const vistas = new Set();
  junto.verbas = [];
  for (const parte of partes) {
    for (const v of parte.verbas || []) {
      const chave = `${v.codigo}|${v.descricao}|${v.provento}|${v.desconto}|${v.valor ?? ''}`;
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      junto.verbas.push(v);
    }
  }
  return junto;
}

/**
 * Lê a folha a partir das linhas do PDF.
 *
 * Aceita linhas de texto puro ou linhas com as células posicionadas
 * (`linhasComCelulas`). Só com as posições é possível dizer de que coluna
 * veio cada valor das verbas — ver `lerVerbas`.
 *
 * @param {(string|{texto: string, celulas: {x: number, s: string}[]})[]} linhasBrutas
 * @returns {{competencia: string, empresa: string, cnpj: string,
 *            holerites: object[], totalBase: number, problemas: string[]}}
 * @throws {Error} quando o arquivo não tem cara de folha de pagamento
 */
export function lerFolhaPagamento(linhasBrutas) {
  const linhas = normalizarEntrada(linhasBrutas);

  const vias = blocos(linhas).map(lerBloco).filter(Boolean);
  if (!vias.length) {
    throw new Error('Não encontrei nenhum holerite neste PDF. '
      + 'Confira se é o arquivo da folha de pagamento exportado pela contabilidade.');
  }

  // Agrupa por código: junta as duas vias e as partes de quem continuou na
  // página seguinte. A ordem de leitura é preservada.
  const porCodigo = new Map();
  for (const v of vias) {
    if (!porCodigo.has(v.codigo)) porCodigo.set(v.codigo, []);
    porCodigo.get(v.codigo).push(v);
  }
  const holerites = [...porCodigo.values()].map(juntar);

  const textos = linhas.map(l => l.texto);
  const competencia = competenciaDaFolha(textos.find(temCompetencia) || '');
  const empresa = textos[0] || '';
  // O layout novo escreve "CNPJ 24.939.311/0001-89", sem os dois-pontos.
  const cnpjLinha = textos.find(l => /\bCNPJ\b/.test(l)) || '';
  const cnpj = (/CNPJ:?\s*([\d./-]+)/.exec(cnpjLinha) || [])[1] || '';

  const problemas = [];
  if (!competencia) {
    problemas.push('A folha não diz a que mês se refere — confira a competência antes de importar.');
  }

  for (const h of holerites) {
    if (h.salarioBase == null) {
      problemas.push(`${h.nome}: não foi possível ler o salário base.`);
      continue;
    }
    if (h.salarioBase <= 0) {
      problemas.push(`${h.nome}: salário base lido como ${moedaBR(h.salarioBase)}.`);
    }
    // A conta do holerite tem que fechar; se não fecha, a leitura saiu torta.
    if (h.vencimentos != null && h.descontos != null && h.liquido != null) {
      const esperado = arredondar(h.vencimentos - h.descontos);
      if (Math.abs(esperado - h.liquido) > 0.01) {
        problemas.push(`${h.nome}: vencimentos menos descontos dá ${moedaBR(esperado)}, `
          + `mas o líquido impresso é ${moedaBR(h.liquido)}.`);
      }
    }
  }

  const nomes = new Set();
  for (const h of holerites) {
    const k = normalizarNome(h.nome);
    if (nomes.has(k)) problemas.push(`${h.nome} aparece com mais de um código na folha.`);
    nomes.add(k);
  }

  return {
    competencia, empresa, cnpj, holerites,
    totalBase: arredondar(holerites.reduce((s, h) => s + (h.salarioBase || 0), 0)),
    problemas,
  };
}

/**
 * Cruza a folha com o cadastro e diz o que mudaria.
 *
 * O holerite não traz CPF, então o cruzamento é pelo nome. Nome que casa com
 * duas pessoas NÃO é adivinhado: vira pendência, porque gravar salário na
 * ficha do homônimo errado é pior do que pedir a ligação.
 *
 * @param {{holerites: object[]}} folha
 * @param {{id: number, nome: string, status?: string}[]} colaboradores
 * @param {Record<number, {valor: number}>} salarios  salário atual por id
 * @param {{vinculos?: Record<string, number>}} [opcoes]  código da folha → id
 */
export function conciliarFolha(folha, colaboradores = [], salarios = {}, opcoes = {}) {
  const vinculos = opcoes.vinculos || {};

  const porNome = new Map();
  for (const c of colaboradores) {
    const k = normalizarNome(c.nome);
    if (!k) continue;
    if (!porNome.has(k)) porNome.set(k, []);
    porNome.get(k).push(c);
  }

  const mudancas = [], iguais = [], semCadastro = [];
  const usados = new Set();

  for (const h of folha.holerites) {
    const forcado = vinculos[h.codigo];
    let colab = forcado != null ? colaboradores.find(c => c.id === Number(forcado)) : null;
    let via = colab ? 'manual' : '';

    if (!colab) {
      const iguaisNome = porNome.get(normalizarNome(h.nome)) || [];
      if (iguaisNome.length === 1) { colab = iguaisNome[0]; via = 'nome'; }
      else if (iguaisNome.length > 1) {
        semCadastro.push({ holerite: h, motivo: 'Há mais de um cadastro com esse nome' });
        continue;
      }
    }

    // Nome cortado pela largura da coluna do holerite: "GUILHERME VINICIUS
    // MAEL LOURENCO DE" é o mesmo "GUILHERME VINICIUS MAEL LOURENCO DE
    // MACEDO" do cadastro. Sem isto, quem tem nome comprido cai em "sem
    // cadastro" todo mês e o RH religa à mão sempre.
    //
    // A ligação só vale se o nome da folha for começo de UM cadastro só, e
    // com no mínimo 12 caracteres — prefixo curto encontra gente demais, e
    // aqui o que se grava é salário. Mesmo assim vai com aviso: a tela mostra
    // a linha antes de o RH confirmar.
    if (!colab) {
      const alvo = normalizarNome(h.nome);
      if (alvo.length >= 12) {
        const porPrefixo = colaboradores.filter(c =>
          normalizarNome(c.nome).startsWith(alvo) && normalizarNome(c.nome) !== alvo);
        if (porPrefixo.length === 1) { colab = porPrefixo[0]; via = 'nome-cortado'; }
      }
    }

    if (!colab) { semCadastro.push({ holerite: h, motivo: 'Sem cadastro correspondente' }); continue; }
    if (usados.has(colab.id)) {
      semCadastro.push({ holerite: h, motivo: `Já ligado a ${colab.nome} nesta importação` });
      continue;
    }
    usados.add(colab.id);

    const atual = parseFloat(salarios[colab.id]?.valor) || 0;
    const novo  = h.salarioBase || 0;
    const item  = {
      holerite: h, colab, via, atual, novo,
      diferenca: arredondar(novo - atual),
      avisos: avisosDoHolerite(h, colab),
    };
    if (Math.abs(item.diferenca) < 0.01) iguais.push(item);
    else mudancas.push(item);
  }

  // Quem está no sistema e não veio na folha. Não é erro — pode ser desligado
  // no meio do mês, estagiário, sócio —, mas o RH precisa ver o número.
  const naFolha = new Set([...mudancas, ...iguais].map(x => x.colab.id));
  const ausentes = colaboradores.filter(c => c.status !== 'inativo' && !naFolha.has(c.id));

  return {
    mudancas: mudancas.sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca)),
    iguais, semCadastro, ausentes,
    somaAtual: arredondar(mudancas.reduce((s, x) => s + x.atual, 0)),
    somaNova:  arredondar(mudancas.reduce((s, x) => s + x.novo, 0)),
  };
}

/** Divergências de cadastro que a folha revela — informam, não bloqueiam. */
function avisosDoHolerite(h, colab) {
  const avisos = [];
  if (h.admissao && colab.admissao && h.admissao !== colab.admissao) {
    avisos.push(`admissão na folha é ${h.admissao.split('-').reverse().join('/')}`);
  }
  if (h.cargo && colab.cargo && colab.cargo !== '—'
      && normalizarNome(h.cargo) !== normalizarNome(colab.cargo)) {
    avisos.push(`cargo na folha é "${h.cargo}"`);
  }
  if (normalizarNome(h.nome) !== normalizarNome(colab.nome)) {
    avisos.push(`o nome vem cortado na folha ("${h.nome}")`);
  }
  if (colab.status === 'inativo') avisos.push('está como desligado no sistema');
  return avisos;
}

export default { lerFolhaPagamento, conciliarFolha, competenciaDaFolha };
