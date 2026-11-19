import { describe, it, expect } from 'vitest';
import { lerRelatorioTicket, fechaComOTotal } from '../src/utils/relatorio-ticket.js';
import { conciliarRelatorio } from '../src/utils/conciliacao-beneficio.js';

// O relatório da Ticket/Edenred — "Demonstrativo de Créditos por Usuário por
// Pedido" — é o segundo formato de relatório de benefício que o sistema lê. O
// do vale combustível vem de outra operadora e tem outro layout; o que os dois
// compartilham é o depois, o cruzamento com o cadastro.
//
// Os números aqui saíram do arquivo real de outubro/2026: 46 beneficiários,
// R$ 15.637,23 de crédito, emitido em 30/10 para creditar em 01/10.

const CABECALHO = [
  'Relatório de Pedidos e Dados Fiscais',
  'Emissão: 30/10/2026 11:50',
  'Demonstrativo de Créditos por Usuário por Pedido',
  'Pedido: 99667080 Empresa: MATARUCO COMERCIO ATACADISTA',
  'Total de beneficiários: 3 DE FARINHAS LTDA',
  'Total de benefícios: R$ 900,00 CNPJ: 24.939.311/0001-89',
  'Total de taxas: R$ 0,00 Contrato: 4277850006091',
  'Ajuste de crédito: R$ 0,00 Benefício: Ticket Alimentação',
  'Total do pedido: R$ 900,00 NF-e: 131994258',
  'Data do crédito: 01/10/2026',
  'Beneficiário CPF / Matrícula Crédito (R$)',
];
const LINHA = (nome, cpf, valor) => `${nome} ${cpf} R$ ${valor}`;
const CORPO = [
  LINHA('ADAO RIBEIRO', '57203237915', '360,00'),
  LINHA('ALESSANDRO RIBEIRO', '07140994900', '360,00'),
  LINHA('GIOVANNA GIACOBBO ALVES', '08850662947', '180,00'),
];
// A tabela fecha com uma linha "Total" que vem zerada — não é beneficiário.
const RODAPE = ['Total R$ 0,00'];

const relatorio = (corpo = CORPO, cabecalho = CABECALHO) =>
  lerRelatorioTicket([...cabecalho, ...corpo, ...RODAPE]);

describe('cabeçalho do relatório', () => {
  it('lê pedido, nota fiscal, benefício e empresa', () => {
    const r = relatorio();
    expect(r.pedido).toBe('99667080');
    expect(r.nfe).toBe('131994258');
    expect(r.beneficio).toBe('Ticket Alimentação');
    expect(r.cnpj).toBe('24.939.311/0001-89');
    expect(r.contrato).toBe('4277850006091');
  });

  it('a competência vem da DATA DO CRÉDITO, não da emissão', () => {
    // O arquivo real é emitido em 30/10 para creditar em 01/10. Um pedido
    // virado no fim do mês para creditar no seguinte iria para o mês errado
    // se a emissão mandasse — e ninguém perceberia.
    const r = lerRelatorioTicket([
      ...CABECALHO.map(l => l.replace('Data do crédito: 01/10/2026', 'Data do crédito: 01/11/2026')),
      ...CORPO, ...RODAPE,
    ]);
    expect(r.emissao).toBe('2026-10-30');
    expect(r.dataCredito).toBe('2026-11-01');
    expect(r.competencia).toBe('2026-11');
  });

  it('sem data de crédito, cai na emissão em vez de ficar sem competência', () => {
    const r = relatorio(CORPO, CABECALHO.filter(l => !l.startsWith('Data do crédito')));
    expect(r.competencia).toBe('2026-10');
  });

  it('dois campos na mesma linha impressa não se misturam', () => {
    // "Pedido: 99667080   Empresa: MATARUCO…" sai numa linha só.
    expect(relatorio().pedido).toBe('99667080');
    expect(relatorio().empresa).toContain('MATARUCO');
  });
});

describe('beneficiários', () => {
  it('lê nome, CPF e valor de cada linha', () => {
    const r = relatorio();
    expect(r.registros).toHaveLength(3);
    expect(r.registros[0]).toEqual({ nome: 'ADAO RIBEIRO', cpf: '57203237915', valor: 360 });
    expect(r.registros[2].valor).toBe(180);
  });

  it('a linha "Total" do rodapé não vira beneficiário', () => {
    // Ela vem R$ 0,00 e sem CPF. Entrar na lista significaria uma pessoa
    // fantasma com crédito zero em toda importação.
    const r = relatorio();
    expect(r.registros.some(x => x.nome.toLowerCase().includes('total'))).toBe(false);
  });

  it('nome truncado pela coluna é lido como está — o CPF é a chave', () => {
    const r = relatorio([LINHA('GUILHERME VINICIUS M L MACED', '10248708988', '360,00')]);
    expect(r.registros[0].nome).toBe('GUILHERME VINICIUS M L MACED');
    expect(r.registros[0].cpf).toBe('10248708988');
  });

  it('soma os créditos', () => {
    expect(relatorio().soma).toBe(900);
  });

  it('PDF que não é este relatório é recusado com mensagem clara', () => {
    expect(() => lerRelatorioTicket(['Nota fiscal', 'Produto X 10,00']))
      .toThrow(/beneficiário/i);
  });
});

describe('conferência contra o total', () => {
  it('a soma dos beneficiários fecha com o total de benefícios', () => {
    const f = fechaComOTotal(relatorio());
    expect(f.fecha).toBe(true);
    expect(f.diferenca).toBe(0);
  });

  it('a trava é contra o total de BENEFÍCIOS, não contra o do pedido', () => {
    // O total do pedido inclui taxas e ajuste — dinheiro que a operadora
    // cobra da empresa e que não pertence a nenhum beneficiário.
    const comTaxa = CABECALHO.map(l => l
      .replace('Total de taxas: R$ 0,00', 'Total de taxas: R$ 50,00')
      .replace('Total do pedido: R$ 900,00', 'Total do pedido: R$ 950,00'));
    const r = relatorio(CORPO, comTaxa);
    expect(r.totalServico).toBe(50);
    expect(r.totalPedido).toBe(950);
    expect(fechaComOTotal(r).fecha).toBe(true);
  });

  it('leitura incompleta não passa despercebida', () => {
    const r = relatorio(CORPO.slice(0, 2));          // perdeu uma linha
    const f = fechaComOTotal(r);
    expect(f.fecha).toBe(false);
    expect(f.diferenca).toBe(-180);
    expect(f.mensagem).toContain('não bate');
  });

  it('avisa quando a contagem do cabeçalho não bate com as linhas lidas', () => {
    const r = relatorio(CORPO.slice(0, 2));
    expect(r.problemas.join(' ')).toContain('3 beneficiários');
    expect(r.problemas.join(' ')).toContain('lidos 2');
  });

  it('CPF repetido é apontado — um gravaria por cima do outro', () => {
    const r = relatorio([...CORPO, LINHA('ADAO RIBEIRO', '57203237915', '360,00')]);
    expect(r.problemas.join(' ')).toContain('CPF repetido');
  });
});

describe('cruzamento com o cadastro', () => {
  // O CPF do relatório vem sem pontuação e o do cadastro com — a conciliação
  // normaliza os dois lados. Foi assim que 34 dos 46 do arquivo real casaram,
  // todos por CPF, sem nenhum palpite por nome.
  const CADASTRO = [
    { id: 1, nome: 'ADAO RIBEIRO', cpf: '572.032.379-15', status: 'ativo' },
    { id: 2, nome: 'ALESSANDRO RIBEIRO', cpf: '071.409.949-00', status: 'ativo' },
  ];

  it('casa por CPF mesmo com pontuação diferente dos dois lados', () => {
    const c = conciliarRelatorio(relatorio(), CADASTRO);
    expect(c.casados).toHaveLength(2);
    expect(c.casados.every(x => x.via === 'cpf')).toBe(true);
  });

  it('quem não está no cadastro fica de fora, com o valor somado à parte', () => {
    const c = conciliarRelatorio(relatorio(), CADASTRO);
    expect(c.semCadastro).toHaveLength(1);
    expect(c.semCadastro[0].registro.nome).toBe('GIOVANNA GIACOBBO ALVES');
    expect(c.somaSemCadastro).toBe(180);
  });

  it('a conta fecha: importado + fora = total do relatório', () => {
    const r = relatorio();
    const c = conciliarRelatorio(r, CADASTRO);
    expect(c.somaCasados + c.somaSemCadastro).toBeCloseTo(r.soma, 2);
  });
});

// ─── O segundo arquivo da mesma operadora ───────────────────────────────────
//
// O RH também baixa o "Relatório de Detalhes do Pedido", que traz a mesma
// informação com outro cabeçalho e outra ordem de colunas. Os números aqui
// saíram do arquivo real de janeiro/2026: 47 beneficiários, R$ 18.448,55,
// pedido feito em 29/01 para creditar em 30/01.

const CAB_DETALHES = [
  'RELATÓRIO DE DETALHES DO PEDIDO',
  'Número do Pedido Enviado: 16687462 Realizado em: 29/01/2026',
  'Valor (R$): 900,00 Método Pagamento: Boleto Bancário',
  'Empresa: 24.939.311/0001-89 - MATARUCO COMERCIO ATACADISTA DE FARINHAS LTDA',
  'Solicitante: FARINHEIRA BEPI MATARUCO',
  'Ticket Alimentação Eletrônico',
  'Unidade de Entrega: L M MATARUCO Valor dos Benefícios (R$): 900,00',
  'Data de Crédito: 30/01/2026 Quantidade de Beneficiários: 3',
  'Data de Entrega: 10/02/2026',
  'CPF MATRÍCULA BENEFICIÁRIO DEPARTAMENTO VALOR DO BENEFÍCIO',
];
const DET = (cpf, matricula, nome, valor, setor = 'GERAL') =>
  `${cpf} ${matricula} ${nome} ${setor} R$ ${valor}`;
const CORPO_DETALHES = [
  DET('572.032.379-15', '57203237915', 'ADAO RIBEIRO', '360,00'),
  DET('071.409.949-00', '7140994900', 'ALESSANDRO RIBEIRO', '360,00'),
  DET('088.506.629-47', '8850662947', 'GIOVANNA GIACOBBO ALVES', '180,00'),
];
// O rodapé do produto repete os totais em linhas que também terminam em real.
const RODAPE_DETALHES = [
  'Contrato: 4277850006091',
  'UNIDADE DE ENTREGA DEPARTAMENTO DATA DE CRÉDITO DATA DE ENTREGA QUANTIDADE BENEFICIÁRIOS VALOR DO BENEFÍCIO',
  'L M MATARUCO GERAL 30/01/2026 10/02/2026 3 R$ 900,00',
  'TOTAL BENEFÍCIOS 3 R$ 900,00',
  'Taxa de Administração de Serviços 0,00% 900,00 R$ 0,00',
  'Taxa de Emissão do Benefício Social R$ 0,00 5 R$ 0,00',
  'TOTAL DE TAXAS DO PRODUTO R$ 0,00',
  'RESUMO DO PRODUTO SUB TOTAL',
  'Total de Benefícios R$ 900,00',
  'Taxas R$ 0,00',
  'TOTAL R$ 900,00',
  'Página 1 de 3',
];

const detalhes = (corpo = CORPO_DETALHES, cabecalho = CAB_DETALHES) =>
  lerRelatorioTicket([...cabecalho, ...corpo, ...RODAPE_DETALHES]);

describe('relatório de detalhes do pedido', () => {
  it('é reconhecido como o outro layout da mesma operadora', () => {
    expect(detalhes().layout).toBe('detalhes-do-pedido');
    expect(relatorio().layout).toBe('demonstrativo');
  });

  it('lê os três beneficiários, sem confundir com o rodapé do produto', () => {
    // O rodapé tem linhas que terminam em real — total de benefícios, taxas,
    // resumo. Lidas como gente, inventariam crédito que ninguém recebeu.
    const r = detalhes();
    expect(r.registros).toHaveLength(3);
    expect(r.soma).toBe(900);
  });

  it('separa o nome do departamento', () => {
    const r = detalhes();
    expect(r.registros[0].nome).toBe('ADAO RIBEIRO');
    expect(r.registros[0].departamento).toBe('GERAL');
  });

  it('o CPF sai da coluna de CPF, com o zero à esquerda', () => {
    // A matrícula ao lado é o mesmo número sem o zero — usá-la perderia o
    // cruzamento de todo mundo cujo CPF começa com zero.
    expect(detalhes().registros[1].cpf).toBe('07140994900');
  });

  it('a competência vem da DATA DE CRÉDITO, não do dia do pedido', () => {
    const r = lerRelatorioTicket([
      ...CAB_DETALHES.map(l => l.replace('Data de Crédito: 30/01/2026', 'Data de Crédito: 02/02/2026')),
      ...CORPO_DETALHES, ...RODAPE_DETALHES,
    ]);
    expect(r.emissao).toBe('2026-01-29');
    expect(r.dataCredito).toBe('2026-02-02');
    expect(r.competencia).toBe('2026-02');
  });

  it('lê pedido, produto, contrato e separa CNPJ do nome da empresa', () => {
    const r = detalhes();
    expect(r.pedido).toBe('16687462');
    expect(r.nota).toBe('16687462');
    expect(r.beneficio).toBe('Ticket Alimentação Eletrônico');
    expect(r.contrato).toBe('4277850006091');
    expect(r.cnpj).toBe('24.939.311/0001-89');
    expect(r.empresa).toBe('MATARUCO COMERCIO ATACADISTA DE FARINHAS LTDA');
  });

  it('lê os totais do cabeçalho, que vêm sem cifrão', () => {
    const r = detalhes();
    expect(r.totalBeneficiarios).toBe(3);
    expect(r.totalBeneficios).toBe(900);
    expect(r.totalTaxas).toBe(0);
    expect(r.totalPedido).toBe(900);
    expect(r.totalCredito).toBe(900);
  });

  it('a conferência é contra o valor dos benefícios', () => {
    expect(fechaComOTotal(detalhes()).fecha).toBe(true);
    const faltando = detalhes(CORPO_DETALHES.slice(0, 2));
    expect(fechaComOTotal(faltando).fecha).toBe(false);
    expect(fechaComOTotal(faltando).diferenca).toBe(-180);
  });

  it('avisa quando a quantidade do cabeçalho não bate com o que foi lido', () => {
    const r = detalhes(CORPO_DETALHES.slice(0, 2));
    expect(r.problemas.join(' ')).toContain('3 beneficiários');
  });

  it('cruza com o cadastro do mesmo jeito que o outro layout', () => {
    const c = conciliarRelatorio(detalhes(), [
      { id: 1, nome: 'ADAO RIBEIRO', cpf: '572.032.379-15', status: 'ativo' },
      { id: 2, nome: 'ALESSANDRO RIBEIRO', cpf: '071.409.949-00', status: 'ativo' },
    ]);
    expect(c.casados).toHaveLength(2);
    expect(c.casados.every(x => x.via === 'cpf')).toBe(true);
    expect(c.semCadastro).toHaveLength(1);
  });

  it('um PDF que não é nenhum dos dois ainda é recusado', () => {
    expect(() => lerRelatorioTicket(['Nota fiscal de serviço', 'Total R$ 10,00']))
      .toThrow(/beneficiário/i);
  });
});

// ─── O terceiro arquivo da mesma operadora ──────────────────────────────────
//
// O "Relatório de Pedidos" era lido ERRADO, não recusado — que é pior. A linha
// dele ("NOME 0 CPF MATRÍCULA R$ valor") também casa com a do demonstrativo,
// só que casando pela MATRÍCULA no lugar do CPF e apenas quando a matrícula
// tem 11 dígitos. Um arquivo de 52 pessoas entrava com 29, sem nenhum aviso,
// porque este layout não traz o total que a conferência compara.
//
// Os números saíram do arquivo real de abril/2026: 52 colaboradores,
// R$ 17.713,23, pedido em 29/04 para creditar em 30/04.

const CAB_PEDIDOS = [
  'Relatório de Pedidos',
  'Perfil',
  'CNPJ: 24.939.311/0001-89',
  'Razão social: MATARUCO COMERCIO ATACADISTA DE FARINHAS LTDA',
  'Contrato: 4277850006091',
  'Detalhe do Pedido',
  'Nº do Pedido: 92651899 Data de crédito: 30/04/2026',
  'Data do pedido: 29/04/2026 Data de vencimento: 29/04/2026',
  'Produto: Ticket Alimentação Quantidade de colaboradores: 4',
  'Valor total: R$ 900,00 Quantidade de cartões novos: 1',
  'Colaboradores (4)',
  'Nome Cartão CPF Matrícula Valor',
  'Novo',
];
// Com matrícula de 10 dígitos (a 2ª) e de 11 (a 1ª) — era essa diferença que
// fazia metade do arquivo sumir. E com nome quebrado em duas linhas: o pdf.js
// devolve a linha de dados ENTRE as duas metades, porque elas ficam centradas.
const CORPO_PEDIDOS = [
  'ADAO RIBEIRO 0 572.032.379-15 57203237915 R$ 360,00',
  'ALESSANDRO RIBEIRO 0 071.409.949-00 7140994900 R$ 180,00',
  'ANA CLAUDIA BATISTA',
  '0 094.831.059-60 9483105960 R$ 360,00',
  'BENV',
  'LUCAS GABRIEL DA SILVA',
  '0 134.317.689-11 13431768911 R$ 0,00',
  'PIRES',
];
const RODAPE_PEDIDOS = ['© Ticket Serviços S.A. Página 1 de 4', 'CNPJ 47.866.934/0001-74'];

const pedidos = (corpo = CORPO_PEDIDOS, cabecalho = CAB_PEDIDOS) =>
  lerRelatorioTicket([...cabecalho, ...corpo, ...RODAPE_PEDIDOS]);

describe('relatório de pedidos', () => {
  it('é reconhecido como o terceiro layout, e não como o demonstrativo', () => {
    expect(pedidos().layout).toBe('relatorio-de-pedidos');
  });

  it('lê TODO mundo, com matrícula de 10 ou de 11 dígitos', () => {
    // A matrícula é o CPF sem o zero à esquerda, então ela tem 10 dígitos
    // para quem tem CPF começando em zero. A leitura antiga só enxergava as
    // de 11 — e a conta ainda "fechava", porque fechava contra a própria soma.
    const r = pedidos();
    expect(r.registros).toHaveLength(4);
    expect(r.soma).toBe(900);
    expect(fechaComOTotal(r).fecha).toBe(true);
  });

  it('o CPF sai da coluna de CPF, não da matrícula', () => {
    const alessandro = pedidos().registros.find(x => x.nome.startsWith('ALESSANDRO'));
    expect(alessandro.cpf).toBe('07140994900');
    expect(alessandro.matricula).toBe('7140994900');
  });

  it('remonta o nome que o PDF quebrou em duas linhas', () => {
    const nomes = pedidos().registros.map(r => r.nome);
    expect(nomes).toContain('ANA CLAUDIA BATISTA BENV');
    expect(nomes).toContain('LUCAS GABRIEL DA SILVA PIRES');
  });

  it('o cabeçalho da tabela não vira nome de ninguém', () => {
    // "Nome Cartão CPF Matrícula Valor" / "Novo" ficam logo antes da primeira
    // linha de dados de cada página.
    expect(pedidos().registros.map(r => r.nome).join(' ')).not.toContain('Novo');
  });

  it('a competência vem da DATA DE CRÉDITO — outra preposição, mesmo campo', () => {
    const r = pedidos();
    expect(r.emissao).toBe('2026-04-29');
    expect(r.dataCredito).toBe('2026-04-30');
    expect(r.competencia).toBe('2026-04');
  });

  it('lê pedido, produto, empresa, contrato e os totais do cabeçalho', () => {
    const r = pedidos();
    expect(r.pedido).toBe('92651899');
    expect(r.beneficio).toBe('Ticket Alimentação');
    expect(r.empresa).toBe('MATARUCO COMERCIO ATACADISTA DE FARINHAS LTDA');
    expect(r.cnpj).toBe('24.939.311/0001-89');
    expect(r.contrato).toBe('4277850006091');
    expect(r.totalBeneficiarios).toBe(4);
    expect(r.totalBeneficios).toBe(900);
  });

  it('agora a conferência tem contra o que fechar', () => {
    // Era isto que faltava: sem total no cabeçalho, a trava comparava a soma
    // com ela mesma e aprovava qualquer leitura parcial.
    const faltando = pedidos(CORPO_PEDIDOS.slice(0, 2));
    expect(fechaComOTotal(faltando).fecha).toBe(false);
    expect(faltando.problemas.join(' ')).toContain('4 beneficiários');
  });

  it('aponta quem veio sem valor', () => {
    expect(pedidos().problemas.join(' ')).toContain('1 beneficiário');
  });

  it('não rouba as linhas dos outros dois layouts', () => {
    expect(relatorio().layout).toBe('demonstrativo');
    expect(detalhes().layout).toBe('detalhes-do-pedido');
  });
});
