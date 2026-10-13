import { describe, it, expect } from 'vitest';
import {
  lerFolhaPagamento, conciliarFolha, competenciaDaFolha,
} from '../src/utils/folha-pagamento.js';

// O leitor da folha grava salário na ficha de dezenas de pessoas de uma vez.
// Os testes cobrem o formato real do PDF da contabilidade, incluindo as duas
// manhas que ele tem: cada holerite sai duas vezes (uma via para cada lado) e
// quem tem muitas verbas continua na página seguinte.

const via = ({ codigo = '5', nome = 'ADAO RIBEIRO', cargo = 'OPERADOR DE FORNO',
  admissao = '10/09/2018', base = '3.674,64', venc = '3.998,84', desc = '1.878,21',
  liq = '2.120,63', continua = false } = {}) => [
  'MATARUCO COMÉRCIO ATACADISTA DE FARINHAS LTDA',
  'CNPJ: 24.939.311/0001-89 CC: Produção Folha Mensal',
  'Mensalista Setembro de 2026',
  'Código Nome do Funcionário CBO Departamento Filial',
  `${codigo} ${nome} 821205 11 1`,
  `${cargo} Admissão: ${admissao}`,
  'Código Descrição Referência Vencimentos Descontos',
  '1 HORAS NORMAIS 220:00 3.674,64',
  '998 I.N.S.S. 9,21 367,20',
  'Total de Vencimentos Total de Descontos',
  continua ? 'A TRANSPORTAR ********* ********* Data' : `${venc} ${desc} Data`,
  continua ? 'Valor Líquido  *********' : `conta: 46576-7 Agência: 718 - Valor Líquido  ${liq}`,
  '____/____/_______',
  'Salário Base Sal. Contr. INSS Base Cálc. FGTS F.G.T.S do Mês Base Cálc. IRRF Faixa IRRF',
  ...(continua ? [] : [`${base} 3.988,48 3.988,48 319,07 2.181,63 0,00`]),
];

// Como sai de verdade: duas vias idênticas por pessoa.
const folhaDe = (...pessoas) => pessoas.flatMap(p => [...via(p), ...via(p)]);

describe('competência', () => {
  it('lê o mês por extenso', () => {
    expect(competenciaDaFolha('Mensalista Setembro de 2026')).toBe('2026-09');
    expect(competenciaDaFolha('Mensalista Janeiro de 2027')).toBe('2027-01');
  });

  it('lê mês com cedilha', () => {
    expect(competenciaDaFolha('Mensalista Março de 2026')).toBe('2026-03');
  });

  it('devolve vazio quando não acha', () => {
    expect(competenciaDaFolha('Folha Mensal')).toBe('');
  });
});

describe('leitura do holerite', () => {
  it('lê identificação, cargo e admissão', () => {
    const f = lerFolhaPagamento(folhaDe({}));
    expect(f.holerites).toHaveLength(1);
    expect(f.holerites[0]).toMatchObject({
      codigo: '5', nome: 'ADAO RIBEIRO', cbo: '821205',
      cargo: 'OPERADOR DE FORNO', admissao: '2018-09-10',
    });
  });

  it('o salário base é o primeiro valor da linha de bases', () => {
    // A linha tem 6 números; o segundo é o salário de contribuição do INSS,
    // que é maior e seria o erro fácil de cometer.
    expect(lerFolhaPagamento(folhaDe({})).holerites[0].salarioBase).toBe(3674.64);
  });

  it('lê os totais do mês e o líquido', () => {
    const h = lerFolhaPagamento(folhaDe({})).holerites[0];
    expect(h.vencimentos).toBe(3998.84);
    expect(h.descontos).toBe(1878.21);
    expect(h.liquido).toBe(2120.63);
  });

  it('não duplica quem aparece nas duas vias', () => {
    const f = lerFolhaPagamento(folhaDe({}));
    expect(f.holerites).toHaveLength(1);
  });

  it('junta o holerite que continua na página seguinte', () => {
    // A primeira parte fecha com "A TRANSPORTAR" e não traz salário base.
    const linhas = [
      ...via({ continua: true }), ...via({ continua: true }),
      ...via({}), ...via({}),
    ];
    const f = lerFolhaPagamento(linhas);
    expect(f.holerites).toHaveLength(1);
    expect(f.holerites[0].salarioBase).toBe(3674.64);
    expect(f.holerites[0].liquido).toBe(2120.63);
  });

  it('lê a folha inteira e soma os salários base', () => {
    const f = lerFolhaPagamento(folhaDe(
      {}, { codigo: '49', nome: 'ALESSANDRO RIBEIRO', base: '2.800,00' }));
    expect(f.holerites).toHaveLength(2);
    expect(f.totalBase).toBe(6474.64);
  });

  it('lê empresa e CNPJ do cabeçalho', () => {
    const f = lerFolhaPagamento(folhaDe({}));
    expect(f.empresa).toContain('MATARUCO');
    expect(f.cnpj).toBe('24.939.311/0001-89');
  });

  it('recusa um PDF que não é folha de pagamento', () => {
    expect(() => lerFolhaPagamento(['Contrato de trabalho', 'Cláusula primeira']))
      .toThrow(/nenhum holerite/i);
  });
});

describe('conferência do que foi lido', () => {
  it('acusa quando vencimentos menos descontos não dá o líquido', () => {
    // Se a leitura sair torta, é aqui que aparece.
    const f = lerFolhaPagamento(folhaDe({ liq: '9.999,99' }));
    expect(f.problemas.join(' ')).toMatch(/líquido impresso/);
  });

  it('não reclama quando a conta fecha', () => {
    expect(lerFolhaPagamento(folhaDe({})).problemas).toEqual([]);
  });

  it('acusa folha sem competência', () => {
    const linhas = folhaDe({}).filter(l => !/Setembro de/.test(l));
    expect(lerFolhaPagamento(linhas).problemas.join(' ')).toMatch(/a que mês se refere/);
  });

  it('acusa o mesmo nome com dois códigos', () => {
    const f = lerFolhaPagamento(folhaDe({}, { codigo: '77' }));
    expect(f.problemas.join(' ')).toMatch(/mais de um código/);
  });
});

describe('cruzamento com o cadastro', () => {
  const PESSOAS = [
    { id: 1, nome: 'Adão Ribeiro',       status: 'ativo', admissao: '2018-09-10', cargo: 'OPERADOR DE FORNO' },
    { id: 2, nome: 'Alessandro Ribeiro', status: 'ativo', admissao: '2026-01-14', cargo: 'CALDEIRISTA' },
    { id: 9, nome: 'Zenaide Alves',      status: 'ativo', admissao: '2020-01-01', cargo: 'AUXILIAR' },
  ];
  const folha = () => lerFolhaPagamento(folhaDe(
    {}, { codigo: '49', nome: 'ALESSANDRO RIBEIRO', cargo: 'CALDEIRISTA', admissao: '14/01/2026', base: '2.800,00' }));

  it('casa pelo nome, ignorando acento e caixa', () => {
    const c = conciliarFolha(folha(), PESSOAS, {});
    expect(c.mudancas.map(m => m.colab.id).sort()).toEqual([1, 2]);
    expect(c.mudancas.every(m => m.via === 'nome')).toBe(true);
  });

  it('separa quem já está com o salário certo', () => {
    const c = conciliarFolha(folha(), PESSOAS, { 1: { valor: 3674.64 } });
    expect(c.iguais.map(x => x.colab.id)).toEqual([1]);
    expect(c.mudancas.map(m => m.colab.id)).toEqual([2]);
  });

  it('calcula a diferença e ordena pela maior', () => {
    const c = conciliarFolha(folha(), PESSOAS, { 1: { valor: 3000 }, 2: { valor: 2790 } });
    expect(c.mudancas[0].colab.id).toBe(1);
    expect(c.mudancas[0].diferenca).toBe(674.64);
    expect(c.mudancas[1].diferenca).toBe(10);
  });

  it('soma o antes e o depois do que muda', () => {
    const c = conciliarFolha(folha(), PESSOAS, { 1: { valor: 3000 }, 2: { valor: 2000 } });
    expect(c.somaAtual).toBe(5000);
    expect(c.somaNova).toBe(6474.64);
  });

  it('não adivinha quando dois cadastros têm o mesmo nome', () => {
    // Gravar salário na ficha do homônimo errado é pior do que pedir a ligação.
    const c = conciliarFolha(folha(), [...PESSOAS, { id: 4, nome: 'ADAO RIBEIRO', status: 'ativo' }], {});
    expect(c.mudancas.some(m => m.holerite.codigo === '5')).toBe(false);
    expect(c.semCadastro.some(x => /mais de um cadastro/.test(x.motivo))).toBe(true);
  });

  it('nome grafado diferente no sistema não casa sozinho', () => {
    // Caso real: o cadastro tem "VALDECIR GONÇALVEZ BUENO" e a folha traz
    // "VALDECIR GONCALVES BUENO". Z e S não são a mesma letra.
    const f = lerFolhaPagamento(folhaDe({ codigo: '14', nome: 'VALDECIR GONCALVES BUENO' }));
    const c = conciliarFolha(f, [{ id: 7, nome: 'VALDECIR GONÇALVEZ BUENO', status: 'ativo' }], {});
    expect(c.semCadastro).toHaveLength(1);
  });

  it('a ligação à mão resolve o nome grafado diferente', () => {
    const f = lerFolhaPagamento(folhaDe({ codigo: '14', nome: 'VALDECIR GONCALVES BUENO' }));
    const c = conciliarFolha(f, [{ id: 7, nome: 'VALDECIR GONÇALVEZ BUENO', status: 'ativo' }], {}, {
      vinculos: { 14: 7 },
    });
    expect(c.semCadastro).toHaveLength(0);
    expect(c.mudancas[0].via).toBe('manual');
    expect(c.mudancas[0].colab.id).toBe(7);
  });

  it('não deixa dois holerites caírem no mesmo colaborador', () => {
    const f = lerFolhaPagamento(folhaDe({}, { codigo: '49', nome: 'OUTRA PESSOA' }));
    const c = conciliarFolha(f, PESSOAS, {}, { vinculos: { 49: 1 } });
    expect(c.mudancas.filter(m => m.colab.id === 1)).toHaveLength(1);
    expect(c.semCadastro.some(x => /Já ligado/.test(x.motivo))).toBe(true);
  });

  it('lista os ativos que não vieram na folha', () => {
    expect(conciliarFolha(folha(), PESSOAS, {}).ausentes.map(a => a.id)).toEqual([9]);
  });

  it('não cobra presença de quem está desligado', () => {
    const c = conciliarFolha(folha(), [...PESSOAS, { id: 5, nome: 'Saiu', status: 'inativo' }], {});
    expect(c.ausentes.map(a => a.id)).toEqual([9]);
  });
});

describe('avisos que a folha revela sobre o cadastro', () => {
  it('aponta admissão diferente da do sistema', () => {
    const c = conciliarFolha(lerFolhaPagamento(folhaDe({})),
      [{ id: 1, nome: 'ADAO RIBEIRO', status: 'ativo', admissao: '2019-01-01' }], {});
    expect(c.mudancas[0].avisos.join(' ')).toContain('10/09/2018');
  });

  it('aponta cargo diferente do sistema', () => {
    const c = conciliarFolha(lerFolhaPagamento(folhaDe({})),
      [{ id: 1, nome: 'ADAO RIBEIRO', status: 'ativo', cargo: 'AUXILIAR' }], {});
    expect(c.mudancas[0].avisos.join(' ')).toContain('OPERADOR DE FORNO');
  });

  it('aponta quem recebeu na folha mas está desligado no sistema', () => {
    const c = conciliarFolha(lerFolhaPagamento(folhaDe({})),
      [{ id: 1, nome: 'ADAO RIBEIRO', status: 'inativo' }], {});
    expect(c.mudancas[0].avisos.join(' ')).toContain('desligado');
  });

  it('cadastro em dia não gera aviso', () => {
    const c = conciliarFolha(lerFolhaPagamento(folhaDe({})),
      [{ id: 1, nome: 'ADAO RIBEIRO', status: 'ativo', admissao: '2018-09-10', cargo: 'OPERADOR DE FORNO' }], {});
    expect(c.mudancas[0].avisos).toEqual([]);
  });
});
