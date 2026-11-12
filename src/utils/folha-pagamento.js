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
const RE_TOTAIS_NA_LINHA = /^Total\b(?!\s*L[íi]quido)/;
const RE_LIQUIDO   = /(?:Valor|Total)\s+L[íi]quido/;

// Identificação: código, nome, CBO e pelo menos duas colunas numéricas. O
// layout novo acrescenta departamento e filial no fim ("01.007 01"), então o
// que vier depois é aceito e descartado — prender a regra ao fim da linha era
// o que fazia o holerite inteiro ser ignorado.
const RE_IDENT     = /^(\d+)\s+(.+?)\s+(\d{4,8})\s+(\d+)\s+(\d+)(?:\s+[\d.]+)*\s*$/;
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

/** Quebra o texto nos blocos de holerite, um por via impressa. */
function blocos(linhas) {
  const inicios = [];
  linhas.forEach((l, i) => { if (RE_CAB_IDENT.test(l)) inicios.push(i); });
  return inicios.map((ini, k) => linhas.slice(ini, inicios[k + 1] ?? linhas.length));
}

/** Lê uma via. Devolve null quando o bloco não tem sequer identificação. */
function lerBloco(bloco) {
  const ident = RE_IDENT.exec(bloco[1] || '');
  if (!ident) return null;

  const h = {
    codigo:      ident[1],
    nome:        ident[2].trim(),
    cbo:         ident[3],
    cargo:       null,
    admissao:    null,
    salarioBase: null,
    vencimentos: null,
    descontos:   null,
    liquido:     null,
  };

  const adm = RE_ADMISSAO.exec(bloco[2] || '');
  if (adm) {
    h.cargo = adm[1].trim() || null;
    const [d, m, a] = adm[2].split('/');
    h.admissao = `${a}-${m}-${d}`;
  }

  bloco.forEach((linha, i) => {
    // Bases: a linha seguinte traz os valores na ordem do cabeçalho, e o
    // primeiro deles é o salário base.
    if (linha.startsWith(MARCA_BASES)) {
      const vals = valoresBR(bloco[i + 1] || '');
      if (vals.length >= 5) h.salarioBase = vals[0];
    }
    // Totais, em dois layouts: o antigo põe o rótulo numa linha
    // ("Total de Vencimentos Total de Descontos") e os valores na seguinte; o
    // novo põe rótulo e valores juntos ("Total 3.998,84 1.768,88"). Numa via
    // que continua na página seguinte vem "A TRANSPORTAR ********* *********",
    // sem número nenhum — e aí os totais ficam nulos, como devem ficar.
    if (RE_CAB_TOTAIS.test(linha)) {
      const vals = valoresBR(bloco[i + 1] || '');
      if (vals.length >= 2) { h.vencimentos = vals[0]; h.descontos = vals[1]; }
    } else if (RE_TOTAIS_NA_LINHA.test(linha)) {
      const vals = valoresBR(linha);
      if (vals.length >= 2) { h.vencimentos = vals[0]; h.descontos = vals[1]; }
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
  return partes.reduce((acc, p) => {
    for (const [k, v] of Object.entries(p)) if (acc[k] == null || acc[k] === '') acc[k] = v;
    return acc;
  }, {});
}

/**
 * Lê a folha a partir das linhas de texto do PDF.
 *
 * @param {string[]} linhasBrutas
 * @returns {{competencia: string, empresa: string, cnpj: string,
 *            holerites: object[], totalBase: number, problemas: string[]}}
 * @throws {Error} quando o arquivo não tem cara de folha de pagamento
 */
export function lerFolhaPagamento(linhasBrutas) {
  const linhas = (linhasBrutas || []).map(normalizarTexto).filter(Boolean);

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

  const competencia = competenciaDaFolha(linhas.find(temCompetencia) || '');
  const empresa = linhas[0] || '';
  // O layout novo escreve "CNPJ 24.939.311/0001-89", sem os dois-pontos.
  const cnpjLinha = linhas.find(l => /\bCNPJ\b/.test(l)) || '';
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
