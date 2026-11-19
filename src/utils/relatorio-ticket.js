// Leitura dos relatórios de crédito que a Ticket/Edenred emite a cada pedido
// do vale alimentação.
//
// São DOIS arquivos diferentes, e o RH usa os dois conforme de onde baixa:
// o "Demonstrativo de Créditos por Usuário por Pedido" e o "Relatório de
// Detalhes do Pedido". Trazem a mesma informação — quem recebeu quanto, em que
// crédito —, mas com outro cabeçalho e outra ordem de colunas. Este módulo lê
// os dois e devolve o mesmo relatório conferido, para que a tela de importação
// não precise saber qual deles o operador escolheu.
//
// É o segundo formato de relatório de benefício que o sistema lê. O do vale
// combustível vem de outra operadora e tem outro layout; o que os dois
// compartilham é o depois — cruzar beneficiário com cadastro —, que mora em
// `conciliacao-beneficio.js`. Aqui fica só a leitura deste arquivo.
//
// O PDF tem esta cara:
//
//   Relatório de Pedidos e Dados Fiscais
//   Emissão: 30/10/2026 11:50
//   Pedido: 99667080                  Empresa: MATARUCO COMERCIO ATACADISTA
//   Total de beneficiários: 46        CNPJ: 24.939.311/0001-89
//   Total de benefícios: R$ 15.637,23 Contrato: 4277850006091
//   Total de taxas: R$ 0,00           Benefício: Ticket Alimentação
//   Ajuste de crédito: R$ 0,00        NF-e: 131994258
//   Total do pedido: R$ 15.637,23     Data do crédito: 01/10/2026
//   Beneficiário            CPF / Matrícula     Crédito (R$)
//   ADAO RIBEIRO            57203237915          R$ 360,00
//   …
//   Total                                          R$ 0,00
//
// Três armadilhas deste arquivo:
//
//  1. A competência sai da DATA DO CRÉDITO, não da emissão. Crédito de
//     novembro pedido em 30/10 iria para o mês errado — e o arquivo de
//     exemplo é exatamente assim: emitido em 30/10, creditado em 01/10.
//  2. A conferência é contra "Total de benefícios", não contra "Total do
//     pedido": o segundo inclui taxas e ajustes, que não pertencem a ninguém.
//  3. A última linha da tabela é um "Total" que vem R$ 0,00 — não é
//     beneficiário e não é o total de nada. Exigir CPF na linha a descarta.
//
// O "Relatório de Detalhes do Pedido" tem esta cara:
//
//   RELATÓRIO DE DETALHES DO PEDIDO
//   Número do Pedido Enviado: 16687462   Realizado em: 29/01/2026
//   Valor (R$): 18.448,55                Método Pagamento: Boleto Bancário
//   Empresa: 24.939.311/0001-89 - MATARUCO COMERCIO ATACADISTA DE FARINHAS
//   Ticket Alimentação Eletrônico
//   Unidade de Entrega: L M MATARUCO   Valor dos Benefícios (R$): 18.448,55
//   Data de Crédito: 30/01/2026        Quantidade de Beneficiários: 47
//   CPF            MATRÍCULA     BENEFICIÁRIO    DEPARTAMENTO   VALOR DO BENEFÍCIO
//   572.032.379-15 57203237915   ADAO RIBEIRO    GERAL          R$ 441,92
//   …
//   Contrato: 4277850006091
//   …rodapé com TOTAL BENEFÍCIOS, TAXA, RESUMO DO PRODUTO
//
// As armadilhas são as mesmas, com outros rótulos: a competência sai da "Data
// de Crédito" (o pedido de 29/01 credita em 30/01, mas há pedido de fim de mês
// que credita no mês seguinte), a conferência é contra "Valor dos Benefícios"
// e o rodapé do produto repete totais que não são beneficiário nenhum —
// exigir CPF formatado no começo da linha os descarta.
//
// Sem DOM, sem pdf.js, sem banco: entra texto, sai o relatório conferido.

import {
  normalizarTexto, numeroBR, valorBR, arredondar, moedaBR, dataBR, soDigitos,
} from './texto-pdf.js?v=dev';

// Linha de beneficiário do demonstrativo: nome, CPF de 11 dígitos sem
// pontuação, valor. O nome sai truncado em ~28 caracteres pela largura da
// coluna ("GUILHERME VINICIUS M L MACED"), e é por isso que o CPF é a chave
// do cruzamento.
const RE_LINHA = /^(.+?)\s+(\d{11})\s+R\$\s*([\d.]+,\d{2})$/;

// Linha de beneficiário do relatório de detalhes: CPF pontuado, matrícula,
// nome, departamento, valor. Começar por CPF é o que separa o beneficiário do
// rodapé do produto, que tem linhas com nome de unidade e valor em real.
const RE_LINHA_DETALHE = /^(\d{3}\.\d{3}\.\d{3}-\d{2})\s+(\d+)\s+(.+?)\s+R\$\s*([\d.]+,\d{2})$/;

// Linha de beneficiário do "Relatório de Pedidos": nome, cartão novo (0 ou 1),
// CPF pontuado, matrícula, valor.
//
// Esta é a que exige cuidado. A coluna de nome é estreita e o nome QUEBRA em
// duas linhas — e o pdf.js devolve a linha de dados ENTRE as duas metades do
// nome, porque os dados ficam centrados verticalmente na célula:
//
//   "ANA CLAUDIA BATISTA"
//   "0 094.831.059-60 9483105960 R$ 360,00"
//   "BENV"
//
// Por isso o nome é remontado com a linha de cima e a de baixo (só quando a
// linha de dados vem sem nome). Nome de três linhas perderia o pedaço do meio;
// não chegou a acontecer, e o cruzamento é por CPF de qualquer jeito.
const RE_LINHA_PEDIDOS =
  /^(.*?)\s*(\d+)\s+(\d{3}\.\d{3}\.\d{3}-\d{2})\s+(\d+)\s+R\$\s*([\d.]+,\d{2})$/;

// Pedaço de nome que sobrou numa linha só: caixa alta, sem dígito. É o que
// separa "ANA CLAUDIA BATISTA" dos cabeçalhos da tabela ("Nome", "Novo",
// "Valor") e do rodapé ("Relatório de Pedidos", "© Ticket Serviços S.A.").
const RE_PEDACO_DE_NOME = /^[A-ZÀ-Ü][A-ZÀ-Ü\s.'-]*$/;

/**
 * Valor de um campo "Rótulo: conteúdo" do cabeçalho.
 *
 * `ate` é o rótulo da coluna seguinte, quando ela existe e o corte automático
 * não dá conta: ele procura o próximo "Alguma coisa:", e um valor que começa
 * por letra ("Produto: Ticket Alimentação Quantidade de colaboradores: 52")
 * faz a busca casar no começo do próprio valor, devolvendo vazio.
 */
function campo(linhas, rotulo, ate = '') {
  const alvo = rotulo.toLowerCase();
  for (const l of linhas) {
    const i = l.toLowerCase().indexOf(alvo + ':');
    if (i < 0) continue;
    let resto = l.slice(i + alvo.length + 1);
    if (ate) {
      const corte = resto.toLowerCase().indexOf(ate.toLowerCase() + ':');
      return (corte >= 0 ? resto.slice(0, corte) : resto).trim();
    }
    // Duas colunas de cabeçalho podem sair na mesma linha impressa
    // ("Pedido: 99667080   Empresa: MATARUCO…"): corta no próximo rótulo.
    const proximo = /\s[A-Za-zÀ-ÿ][\w\-\sÀ-ÿ/]*?:\s/.exec(resto);
    return (proximo ? resto.slice(0, proximo.index) : resto).trim();
  }
  return '';
}

/** Primeira linha inteira que casa com o padrão, ou ''. */
function linhaQueCasa(linhas, re) {
  return linhas.find(l => re.test(l)) || '';
}

/**
 * Separa "ADAO RIBEIRO GERAL" em nome e departamento.
 *
 * O texto do PDF chega com os espaços já colapsados, então a fronteira entre
 * as duas colunas se perdeu: o que sobra é que o departamento é a última
 * palavra. Vale para os departamentos da empresa ("GERAL", "PRODUCAO"); um
 * departamento de duas palavras colaria a primeira no fim do nome. Não é
 * grave — o cruzamento é por CPF, e o nome truncado já serve só de rótulo —,
 * mas é o limite desta leitura.
 */
function partirNomeDepartamento(meio) {
  const partes = meio.trim().split(' ');
  if (partes.length < 2) return { nome: meio.trim(), departamento: '' };
  return { nome: partes.slice(0, -1).join(' '), departamento: partes[partes.length - 1] };
}

/** Cabeçalho do "Demonstrativo de Créditos por Usuário por Pedido". */
function cabecalhoDemonstrativo(linhas) {
  const emissao = campo(linhas, 'Emissão');
  return {
    emissao,
    dataCredito: campo(linhas, 'Data do crédito'),
    pedido:      campo(linhas, 'Pedido'),
    nfe:         campo(linhas, 'NF-e'),
    beneficio:   campo(linhas, 'Benefício'),
    empresa:     campo(linhas, 'Empresa'),
    cnpj:        campo(linhas, 'CNPJ'),
    contrato:    campo(linhas, 'Contrato'),
    totalBeneficiarios: parseInt(campo(linhas, 'Total de beneficiários'), 10) || 0,
    totalBeneficios:    valorBR(campo(linhas, 'Total de benefícios')),
    totalTaxas:         valorBR(campo(linhas, 'Total de taxas')),
    totalPedido:        valorBR(campo(linhas, 'Total do pedido')),
  };
}

/** Cabeçalho do "Relatório de Pedidos". */
function cabecalhoPedidos(linhas) {
  return {
    emissao:     campo(linhas, 'Data do pedido'),
    // "Data DE crédito" aqui; "Data DO crédito" no demonstrativo. Mesma coisa,
    // outra preposição — e um rótulo que não casa deixa a competência vazia.
    dataCredito: campo(linhas, 'Data de crédito'),
    pedido:      campo(linhas, 'Nº do Pedido') || campo(linhas, 'N do Pedido'),
    nfe:         '',
    beneficio:   campo(linhas, 'Produto', 'Quantidade de colaboradores'),
    empresa:     campo(linhas, 'Razão social'),
    cnpj:        campo(linhas, 'CNPJ'),
    contrato:    campo(linhas, 'Contrato'),
    totalBeneficiarios: parseInt(campo(linhas, 'Quantidade de colaboradores'), 10) || 0,
    totalBeneficios:    valorBR(campo(linhas, 'Valor total')),
    totalTaxas:         null,
    totalPedido:        valorBR(campo(linhas, 'Valor total')),
  };
}

/** Cabeçalho do "Relatório de Detalhes do Pedido". */
function cabecalhoDetalhes(linhas) {
  // "Empresa: 24.939.311/0001-89 - MATARUCO COMERCIO ATACADISTA…" traz o CNPJ
  // grudado no nome; o demonstrativo os imprime em campos separados.
  const empresaBruta = campo(linhas, 'Empresa');
  const mEmpresa = /^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s*-\s*(.+)$/.exec(empresaBruta);

  // O produto não vem rotulado: é o título solto logo antes do bloco de
  // entrega ("Ticket Alimentação Eletrônico").
  const iUnidade = linhas.findIndex(l => /^Unidade de Entrega:/i.test(l));
  const titulo = iUnidade > 0 ? linhas[iUnidade - 1] : '';
  const beneficio = !titulo.includes(':') && titulo.length <= 60 ? titulo : '';

  return {
    emissao:     campo(linhas, 'Realizado em'),
    dataCredito: campo(linhas, 'Data de Crédito'),
    pedido:      campo(linhas, 'Número do Pedido Enviado'),
    nfe:         '',
    beneficio,
    empresa:  mEmpresa ? mEmpresa[2] : empresaBruta,
    cnpj:     mEmpresa ? mEmpresa[1] : campo(linhas, 'CNPJ'),
    contrato: campo(linhas, 'Contrato'),
    totalBeneficiarios: parseInt(campo(linhas, 'Quantidade de Beneficiários'), 10) || 0,
    // Estes dois saem sem "R$" no cabeçalho — o cifrão está no rótulo.
    totalBeneficios: numeroBR(campo(linhas, 'Valor dos Benefícios (R$)')),
    totalTaxas:      valorBR(linhaQueCasa(linhas, /total de taxas do produto/i)),
    totalPedido:     numeroBR(campo(linhas, 'Valor (R$)')),
  };
}

/**
 * Lê o relatório a partir das linhas de texto do PDF.
 *
 * @param {string[]} linhasBrutas
 * @returns {{emissao: string, competencia: string, dataCredito: string,
 *            pedido: string, nfe: string, beneficio: string, empresa: string,
 *            cnpj: string, registros: {nome: string, cpf: string, valor: number}[],
 *            totalBeneficios: number, totalTaxas: number, totalPedido: number,
 *            totalBeneficiarios: number, soma: number, problemas: string[]}}
 * @throws {Error} quando o arquivo não tem cara de relatório de créditos
 */
export function lerRelatorioTicket(linhasBrutas) {
  const linhas = (linhasBrutas || []).map(normalizarTexto).filter(Boolean);

  // Os três layouts são lidos na mesma passada, e vence quem encontrou gente.
  //
  // A ORDEM das expressões importa, e é o que estava errado antes: a linha do
  // "Relatório de Pedidos" também casa com a do demonstrativo — mas casando
  // pela MATRÍCULA no lugar do CPF, e só nas matrículas de 11 dígitos. O
  // arquivo de 52 pessoas entrava com 29, e sem nenhum aviso, porque aquele
  // layout não tem o total que a conferência compara. Por isso o padrão mais
  // específico é testado primeiro e a linha que ele reconhece não é oferecida
  // aos outros.
  const demonstrativo = [], detalhes = [], pedidos = [];
  const usada = new Set();

  const pedacoDeNome = (i) => {
    const l = linhas[i];
    return l && !usada.has(i) && RE_PEDACO_DE_NOME.test(l) ? l : '';
  };

  linhas.forEach((l, i) => {
    const d = RE_LINHA_DETALHE.exec(l);
    if (d) {
      detalhes.push({
        ...partirNomeDepartamento(d[3]),
        cpf:   soDigitos(d[1]),
        valor: numeroBR(d[4]),
      });
      return;
    }

    const p = RE_LINHA_PEDIDOS.exec(l);
    if (p) {
      usada.add(i);
      let nome = p[1].trim();
      if (!nome) {
        // Nome quebrado em duas linhas: a de cima e a de baixo desta.
        const antes  = pedacoDeNome(i - 1);
        const depois = pedacoDeNome(i + 1);
        if (antes)  usada.add(i - 1);
        if (depois) usada.add(i + 1);
        nome = [antes, depois].filter(Boolean).join(' ');
      }
      pedidos.push({ nome, cpf: soDigitos(p[3]), matricula: p[4], valor: numeroBR(p[5]) });
      return;
    }

    const m = RE_LINHA.exec(l);
    if (m) demonstrativo.push({ nome: m[1].trim(), cpf: m[2], valor: numeroBR(m[3]) });
  });

  const candidatos = [
    { layout: 'relatorio-de-pedidos', registros: pedidos,       cabecalho: cabecalhoPedidos },
    { layout: 'detalhes-do-pedido',   registros: detalhes,      cabecalho: cabecalhoDetalhes },
    { layout: 'demonstrativo',        registros: demonstrativo, cabecalho: cabecalhoDemonstrativo },
  ];
  const vencedor = candidatos.reduce((a, b) => (b.registros.length > a.registros.length ? b : a));
  const registros = vencedor.registros;

  if (!registros.length) {
    throw new Error('Não encontrei nenhum beneficiário neste PDF. '
      + 'Confira se é o demonstrativo de créditos por usuário, o relatório de '
      + 'detalhes do pedido ou o relatório de pedidos que a operadora emite.');
  }

  const cab = vencedor.cabecalho(linhas);

  const relatorio = {
    ...cab,
    layout:      vencedor.layout,
    emissao:     dataBR(cab.emissao).iso,
    dataCredito: dataBR(cab.dataCredito).iso,
    // A competência é a do CRÉDITO. Usar a emissão manda para o mês errado
    // todo pedido virado no fim do mês para creditar no seguinte.
    competencia: dataBR(cab.dataCredito).competencia || dataBR(cab.emissao).competencia,
    // Nomes compartilhados com o relatório do vale combustível: a tela de
    // importação é a mesma para os dois benefícios, e o que muda entre eles é
    // o leitor do arquivo, não o vocabulário da conferência.
    nota:         cab.pedido,
    emitidoBR:    cab.emissao,
    totalCredito: cab.totalBeneficios,
    totalServico: cab.totalTaxas,
    registros,
    soma: arredondar(registros.reduce((s, r) => s + (r.valor || 0), 0)),
    problemas: [],
  };

  const p = relatorio.problemas;
  if (!relatorio.competencia) {
    p.push('O relatório não diz a data do crédito — confira a competência antes de importar.');
  }
  if (relatorio.totalBeneficiarios && relatorio.totalBeneficiarios !== registros.length) {
    p.push(`O cabeçalho diz ${relatorio.totalBeneficiarios} beneficiários, `
      + `mas foram lidos ${registros.length}.`);
  }
  const semValor = registros.filter(r => !(r.valor > 0));
  if (semValor.length) {
    p.push(`${semValor.length} beneficiário(s) sem valor de crédito.`);
  }

  // Dois CPFs iguais no mesmo pedido: um deles seria gravado por cima do
  // outro na importação, e ninguém perceberia.
  const vistos = new Set(), repetidos = new Set();
  registros.forEach(r => (vistos.has(r.cpf) ? repetidos.add(r.cpf) : vistos.add(r.cpf)));
  if (repetidos.size) {
    p.push(`CPF repetido no relatório: ${[...repetidos].join(', ')}.`);
  }

  return relatorio;
}

/**
 * A soma dos beneficiários bate com o total de benefícios do cabeçalho?
 *
 * Esta é a trava da importação, e é contra o TOTAL DE BENEFÍCIOS — não contra
 * o total do pedido, que soma taxas e ajuste de crédito. Dinheiro que a
 * operadora cobra da empresa não pertence a nenhum beneficiário.
 */
export function fechaComOTotal(relatorio) {
  const esperado = relatorio?.totalBeneficios;
  if (esperado == null) return { fecha: true, esperado: null, diferenca: 0 };
  const diferenca = arredondar(relatorio.soma - esperado);
  return {
    fecha: Math.abs(diferenca) < 0.01,
    esperado,
    diferenca,
    mensagem: Math.abs(diferenca) < 0.01 ? ''
      : `A soma dos beneficiários (${moedaBR(relatorio.soma)}) não bate com o `
        + `total de benefícios do relatório (${moedaBR(esperado)}).`,
  };
}

export default { lerRelatorioTicket, fechaComOTotal };
