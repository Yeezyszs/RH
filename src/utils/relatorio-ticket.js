// Leitura do "Demonstrativo de Créditos por Usuário por Pedido" — o PDF que a
// Ticket/Edenred emite a cada pedido de crédito do vale alimentação.
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
// Sem DOM, sem pdf.js, sem banco: entra texto, sai o relatório conferido.

import {
  normalizarTexto, numeroBR, valorBR, arredondar, moedaBR, dataBR,
} from './texto-pdf.js?v=dev';

// Linha de beneficiário: nome, CPF de 11 dígitos sem pontuação, valor.
// O nome sai truncado em ~28 caracteres pela largura da coluna ("GUILHERME
// VINICIUS M L MACED"), e é por isso que o CPF é a chave do cruzamento.
const RE_LINHA = /^(.+?)\s+(\d{11})\s+R\$\s*([\d.]+,\d{2})$/;

/** Valor de um campo "Rótulo: conteúdo" do cabeçalho. */
function campo(linhas, rotulo) {
  const alvo = rotulo.toLowerCase();
  for (const l of linhas) {
    const i = l.toLowerCase().indexOf(alvo + ':');
    if (i < 0) continue;
    const resto = l.slice(i + alvo.length + 1);
    // Duas colunas de cabeçalho podem sair na mesma linha impressa
    // ("Pedido: 99667080   Empresa: MATARUCO…"): corta no próximo rótulo.
    const proximo = /\s[A-Za-zÀ-ÿ][\w\-\sÀ-ÿ/]*?:\s/.exec(resto);
    return (proximo ? resto.slice(0, proximo.index) : resto).trim();
  }
  return '';
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

  const registros = [];
  for (const l of linhas) {
    const m = RE_LINHA.exec(l);
    if (!m) continue;
    registros.push({
      nome:  m[1].trim(),
      cpf:   m[2],
      valor: numeroBR(m[3]),
    });
  }

  if (!registros.length) {
    throw new Error('Não encontrei nenhum beneficiário neste PDF. '
      + 'Confira se é o demonstrativo de créditos por usuário que a operadora emite.');
  }

  const dataCredito = campo(linhas, 'Data do crédito');
  const emissao     = campo(linhas, 'Emissão');

  const relatorio = {
    emissao:     dataBR(emissao).iso,
    dataCredito: dataBR(dataCredito).iso,
    // A competência é a do CRÉDITO. Usar a emissão manda para o mês errado
    // todo pedido virado no fim do mês para creditar no seguinte.
    competencia: dataBR(dataCredito).competencia || dataBR(emissao).competencia,
    pedido:    campo(linhas, 'Pedido'),
    nfe:       campo(linhas, 'NF-e'),
    // Nomes compartilhados com o relatório do vale combustível: a tela de
    // importação é a mesma para os dois benefícios, e o que muda entre eles é
    // o leitor do arquivo, não o vocabulário da conferência.
    nota:         campo(linhas, 'Pedido'),
    emitidoBR:    emissao,
    totalCredito: valorBR(campo(linhas, 'Total de benefícios')),
    totalServico: valorBR(campo(linhas, 'Total de taxas')),
    beneficio: campo(linhas, 'Benefício'),
    empresa:   campo(linhas, 'Empresa'),
    cnpj:      campo(linhas, 'CNPJ'),
    contrato:  campo(linhas, 'Contrato'),
    totalBeneficiarios: parseInt(campo(linhas, 'Total de beneficiários'), 10) || 0,
    totalBeneficios:    valorBR(campo(linhas, 'Total de benefícios')),
    totalTaxas:         valorBR(campo(linhas, 'Total de taxas')),
    totalPedido:        valorBR(campo(linhas, 'Total do pedido')),
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
