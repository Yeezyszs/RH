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
