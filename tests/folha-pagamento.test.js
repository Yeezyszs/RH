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

// ── O segundo layout da contabilidade ────────────────────────────────────
// A folha de janeiro/2026 chegou com cinco diferenças em relação à de
// setembro, e qualquer uma delas sozinha derrubava a importação inteira com
// "não encontrei nenhum holerite". O leitor passou a reconhecer as duas
// gerações do relatório; estes testes são o que impede uma de voltar a
// quebrar quando a outra for ajustada.

const viaNova = ({ codigo = '23', nome = 'ADAO RIBEIRO', cargo = 'OPERADOR DE FORNO',
  admissao = '10/09/2018', base = '3.674,64', venc = '3.998,84', desc = '1.768,88',
  liq = '2.229,96' } = {}) => [
  '0009-MATARUCO COMÉRCIO ATACADISTA DE FARINHAS Demonstrativo de Pagamento de Salário',
  'MATARUCO COMÉRCIO ATACADISTA DE FARINHAS LTDA Paranavaí - PR 01/2026 Mensal',
  'CNPJ 24.939.311/0001-89 CPF: 572.032.379-15',
  // "Cadastro" no lugar de "Código", e duas colunas a mais no fim.
  'Cadastro Nome do Funcionário CBO Empresa Local Departamento FL',
  `${codigo} ${nome} 821205 9 1 01.007 01`,
  `${cargo} Data Admissão: ${admissao}`,
  'Ev Descrição Referência Proventos Descontos',
  '1 Horas Normais Diurnas 220:00 hs 3.674,64',
  '1950 INSS 12,00 % 368,45',
  'Banco: 748 Sicredi - Agência: 718-8 Conta: 46576-7',
  `Total ${venc} ${desc}`,          // rótulo e valores na MESMA linha
  `Total Líquido ${liq}`,           // "Total Líquido", não "Valor Líquido"
  'Salário Base Sal Cont INSS Bas Cálc FGTS FGTS Mês Base IRRF C/Ded Simp Faixa Dep',
  `${base} 3.998,84 3.998,84 319,90 2.292,21 0,00 00`,
  'Recebi em: ____/____/____ Assinatura:_________________________',
];

const folhaNova = (...pessoas) => pessoas.flatMap(p => [...viaNova(p), ...viaNova(p)]);

describe('layout novo (janeiro/2026)', () => {
  it('lê o holerite inteiro', () => {
    const f = lerFolhaPagamento(folhaNova({}));
    expect(f.holerites).toHaveLength(1);
    expect(f.holerites[0]).toMatchObject({
      codigo: '23', nome: 'ADAO RIBEIRO', cbo: '821205',
      cargo: 'OPERADOR DE FORNO', admissao: '2018-09-10',
      salarioBase: 3674.64, vencimentos: 3998.84, descontos: 1768.88, liquido: 2229.96,
    });
    expect(f.problemas).toEqual([]);
  });

  it('a competência vem do cabeçalho em MM/AAAA', () => {
    expect(lerFolhaPagamento(folhaNova({})).competencia).toBe('2026-01');
  });

  it('as colunas extras de departamento e filial não atrapalham o nome', () => {
    const f = lerFolhaPagamento(folhaNova({ codigo: '106', nome: 'WALDECIR PAULINO ROSA' }));
    expect(f.holerites[0].nome).toBe('WALDECIR PAULINO ROSA');
    expect(f.holerites[0].codigo).toBe('106');
  });

  it('"Data Admissão" não vira parte do cargo', () => {
    const f = lerFolhaPagamento(folhaNova({ cargo: 'AUXILIAR DE PRODUÇÃO' }));
    expect(f.holerites[0].cargo).toBe('AUXILIAR DE PRODUÇÃO');
  });

  it('quem está afastado entra com líquido zero e salário base cheio', () => {
    // Auxílio-doença: proventos e descontos se anulam, o líquido é 0,00 e a
    // pessoa nem aparece na relação de líquidos a pagar. O salário contratual
    // continua valendo — e é ele que vai para o cadastro.
    const f = lerFolhaPagamento(folhaNova({
      codigo: '21', nome: 'ROGERIO RODRIGUES DOMINGUES',
      base: '3.006,52', venc: '2.710,24', desc: '2.710,24', liq: '0,00',
    }));
    expect(f.holerites[0].salarioBase).toBe(3006.52);
    expect(f.holerites[0].liquido).toBe(0);
    expect(f.problemas).toEqual([]);
  });

  it('as duas vias continuam virando um holerite só', () => {
    const f = lerFolhaPagamento(folhaNova({}, { codigo: '162', nome: 'ALESSANDRO RIBEIRO' }));
    expect(f.holerites).toHaveLength(2);
  });
});

describe('os dois layouts convivem', () => {
  it('o formato de setembro continua sendo lido', () => {
    const f = lerFolhaPagamento(folhaDe({}));
    expect(f.holerites[0].salarioBase).toBe(3674.64);
    expect(f.competencia).toBe('2026-09');
  });

  it('a data de admissão não é confundida com a competência', () => {
    // "Admissão: 10/09/2018" contém "09/2018". Tomar isso como competência
    // mandaria a folha inteira para o mês errado, em silêncio.
    expect(competenciaDaFolha('OPERADOR DE FORNO Data Admissão: 10/09/2018')).toBe('');
    expect(lerFolhaPagamento(folhaNova({ admissao: '10/09/2018' })).competencia).toBe('2026-01');
  });

  it('MM/AAAA só vale como competência no cabeçalho do holerite', () => {
    // O arquivo da contabilidade vem com outros relatórios junto, cheios de
    // datas soltas. Sem a âncora do regime ("Mensal"), qualquer uma viraria
    // candidata a competência.
    expect(competenciaDaFolha('Compet 01/2026 Admissão 03/01/2018')).toBe('2026-01');
    const comRuido = [
      'Relação de Descontos de GRCS',
      '8 FABIO RODRIGUES CARREGADOR Trabalhando 07/2025 03/01/2018 0,00 21,75',
      ...folhaNova({}),
    ];
    expect(lerFolhaPagamento(comRuido).competencia).toBe('2026-01');
  });
});

describe('nome cortado pela largura da coluna', () => {
  // O holerite corta nomes compridos. Sem tratar isso, quem tem nome grande
  // cai em "sem cadastro" todo mês e o RH religa à mão sempre.
  const cadastro = [
    { id: 1, nome: 'GUILHERME VINICIUS MAEL LOURENCO DE MACEDO', status: 'ativo' },
    { id: 2, nome: 'ADAO RIBEIRO', status: 'ativo' },
  ];

  it('liga o nome cortado ao cadastro completo', () => {
    const f = lerFolhaPagamento(folhaNova({ codigo: '121', nome: 'GUILHERME VINICIUS MAEL LOURENCO DE' }));
    const c = conciliarFolha(f, cadastro, {});
    expect(c.semCadastro).toHaveLength(0);
    expect(c.mudancas[0].colab.id).toBe(1);
    expect(c.mudancas[0].via).toBe('nome-cortado');
  });

  it('avisa que o nome veio cortado, para o RH conferir a linha', () => {
    const f = lerFolhaPagamento(folhaNova({ codigo: '121', nome: 'GUILHERME VINICIUS MAEL LOURENCO DE' }));
    const c = conciliarFolha(f, cadastro, {});
    expect(c.mudancas[0].avisos.join(' ')).toContain('cortado');
  });

  it('não liga quando o começo serve a mais de um cadastro', () => {
    const dois = [
      { id: 1, nome: 'MARCOS ANTONIO TOMAZ FERREIRA', status: 'ativo' },
      { id: 2, nome: 'MARCOS ANTONIO TOMAZ SILVA', status: 'ativo' },
    ];
    const f = lerFolhaPagamento(folhaNova({ nome: 'MARCOS ANTONIO TOMAZ' }));
    const c = conciliarFolha(f, dois, {});
    expect(c.semCadastro).toHaveLength(1);
  });

  it('não liga por um começo curto — aqui o que se grava é salário', () => {
    const f = lerFolhaPagamento(folhaNova({ nome: 'ADAO' }));
    const c = conciliarFolha(f, cadastro, {});
    expect(c.semCadastro).toHaveLength(1);
    expect(c.mudancas).toHaveLength(0);
  });

  it('nome exato continua tendo prioridade sobre o começo', () => {
    const f = lerFolhaPagamento(folhaNova({ nome: 'ADAO RIBEIRO' }));
    const c = conciliarFolha(f, cadastro, {});
    expect(c.mudancas[0].colab.id).toBe(2);
    expect(c.mudancas[0].via).toBe('nome');
  });
});

describe('recados impressos junto dos totais', () => {
  // A folha imprime mensagens na linha dos totais. "Parabens ! Feliz
  // Aniversario 05/02   Total   3.979,84   1.232,35" fazia os totais do mês
  // daquela pessoa sumirem — sem erro, sem aviso, só campos vazios no
  // histórico. E cai num aniversariante diferente a cada mês.
  const comRecado = (recado) => viaNova({}).map(l =>
    l.startsWith('Total ') && !l.includes('Líquido') ? `${recado} ${l}` : l);

  it('o aniversário à esquerda não engole os totais', () => {
    const f = lerFolhaPagamento([
      ...comRecado('Parabens ! Feliz Aniversario 05/02'),
      ...comRecado('Parabens ! Feliz Aniversario 05/02'),
    ]);
    expect(f.holerites[0].vencimentos).toBe(3998.84);
    expect(f.holerites[0].descontos).toBe(1768.88);
    expect(f.problemas).toEqual([]);
  });

  it('números do recado não são confundidos com os totais', () => {
    // "05/02" e "1.234,00" do recado vêm ANTES dos totais na linha; ler os
    // dois primeiros números da linha pegaria o recado.
    const f = lerFolhaPagamento([
      ...comRecado('Aviso: vale de 1.234,00 em 05/02'),
      ...comRecado('Aviso: vale de 1.234,00 em 05/02'),
    ]);
    expect(f.holerites[0].vencimentos).toBe(3998.84);
    expect(f.holerites[0].descontos).toBe(1768.88);
  });

  it('"Total Líquido" continua sendo só o líquido', () => {
    const f = lerFolhaPagamento(folhaNova({}));
    expect(f.holerites[0].liquido).toBe(2229.96);
    expect(f.holerites[0].vencimentos).toBe(3998.84);
  });
});

describe('adiantamento não mexe no salário do cadastro', () => {
  // O que vai para a ficha é o salário contratual. Adiantamento, antecipação
  // e desconto do mês entram no líquido, não no salário — confundir os dois
  // rebaixaria o salário de quem pediu adiantamento.
  it('o salário base ignora as verbas de adiantamento', () => {
    const f = lerFolhaPagamento([
      ...viaNova({ base: '3.674,64', venc: '3.998,84', desc: '1.768,88', liq: '2.229,96' }),
      ...viaNova({ base: '3.674,64', venc: '3.998,84', desc: '1.768,88', liq: '2.229,96' }),
    ]);
    const h = f.holerites[0];
    expect(h.salarioBase).toBe(3674.64);      // vai para o cadastro
    expect(h.liquido).toBe(2229.96);          // só histórico do mês
    expect(h.salarioBase).toBeGreaterThan(h.liquido);
  });

  it('a conciliação compara o cadastro com o salário base, não com o líquido', () => {
    const f = lerFolhaPagamento([
      ...viaNova({ base: '3.674,64', liq: '2.229,96' }),
      ...viaNova({ base: '3.674,64', liq: '2.229,96' }),
    ]);
    const c = conciliarFolha(f, [{ id: 1, nome: 'ADAO RIBEIRO', status: 'ativo' }],
      { 1: { valor: 3674.64 } });
    // Mesmo salário contratual: nada a mudar, mesmo com líquido bem menor.
    expect(c.iguais).toHaveLength(1);
    expect(c.mudancas).toHaveLength(0);
  });
});

// ── Verbas do holerite ────────────────────────────────────────────────────
// A coluna é a informação: o texto "89 P.A.T 1,00" não diz se o real foi pago
// ou descontado. Por isso o leitor aceita linhas com as células posicionadas,
// e estes testes montam as posições como o pdf.js as entrega.

const X = { ev: 20, desc: 36, ref: 354, prov: 448, descontos: 547 };

/** Monta uma linha de verba já posicionada nas colunas do holerite. */
const verba = (codigo, descricao, { ref = null, provento = null, desconto = null } = {}) => {
  const celulas = [{ x: X.ev, s: codigo }, { x: X.desc, s: descricao }];
  if (ref != null)      celulas.push({ x: X.ref, s: ref });
  if (provento != null) celulas.push({ x: X.prov + 5, s: provento });
  if (desconto != null) celulas.push({ x: X.descontos + 14, s: desconto });
  return { texto: celulas.map(c => c.s).join(' '), celulas };
};

const comVerbas = (linhasVerba, extra = {}) => {
  const base = viaNova(extra);
  const iCab = base.findIndex(l => l.startsWith('Ev '));
  const cabecalho = {
    texto: 'Ev Descrição Referência Proventos Descontos',
    celulas: [
      { x: X.ev, s: 'Ev' }, { x: X.desc, s: 'Descrição' }, { x: X.ref, s: 'Referência' },
      { x: X.prov, s: 'Proventos' }, { x: X.descontos, s: 'Descontos' },
    ],
  };
  return [
    ...base.slice(0, iCab),
    cabecalho,
    ...linhasVerba,
    ...base.slice(iCab + 3),   // pula o cabeçalho antigo e as duas verbas de exemplo
  ];
};

describe('verbas do holerite', () => {
  const PADRAO = [
    verba('1', 'Horas Normais Diurnas', { ref: '220:00 hs', provento: '3.674,64' }),
    verba('62', 'Insalubridade S/Salário Mínimo', { ref: '20,00 %', provento: '324,20' }),
    verba('89', 'P.A.T', { desconto: '1,00' }),
    verba('318', 'Antecipação Salarial', { desconto: '300,00' }),
    verba('820', 'Desconto Adiantamento Salarial', { desconto: '1.099,43' }),
    verba('1950', 'INSS', { ref: '12,00 %', desconto: '368,45' }),
  ];

  const ler = (linhas) => lerFolhaPagamento([...comVerbas(linhas), ...comVerbas(linhas)]);

  it('separa provento de desconto pela coluna em que o valor foi impresso', () => {
    const h = ler(PADRAO).holerites[0];
    expect(h.verbas).toHaveLength(6);
    expect(h.verbas[0]).toMatchObject({ codigo: '1', provento: 3674.64, desconto: null, tipo: 'provento' });
    // O caso que o texto sozinho não resolve: "89 P.A.T 1,00" é desconto.
    expect(h.verbas[2]).toMatchObject({ codigo: '89', descricao: 'P.A.T', desconto: 1, tipo: 'desconto' });
    expect(h.verbas[4]).toMatchObject({ descricao: 'Desconto Adiantamento Salarial', desconto: 1099.43 });
  });

  it('a referência sai da coluna de referência, não do valor', () => {
    const h = ler(PADRAO).holerites[0];
    expect(h.verbas[0].referencia).toBe('220:00 hs');
    expect(h.verbas[1].referencia).toBe('20,00 %');
    // P.A.T não tem referência — tomar o 1,00 como "1,00 hora" seria inventar.
    expect(h.verbas[2].referencia).toBeNull();
  });

  it('as verbas somam os totais impressos', () => {
    const h = ler(PADRAO).holerites[0];
    const prov = h.verbas.reduce((s, v) => s + (v.provento || 0), 0);
    const desc = h.verbas.reduce((s, v) => s + (v.desconto || 0), 0);
    expect(prov).toBeCloseTo(h.vencimentos, 2);
    expect(desc).toBeCloseTo(h.descontos, 2);
  });

  it('a pensão judicial vem da sublinha e junta a descrição da mãe', () => {
    // "1830 Pensão Judicial" não tem valor; o valor está em "1830.1".
    // Exigir código inteiro fazia a pensão sumir da conta, sem aviso.
    const h = ler([
      verba('1', 'Horas Normais Diurnas', { ref: '220:00 hs', provento: '3.674,64' }),
      verba('1830', 'Pensão Judicial'),
      verba('1830.1', '- GAEL CARVALHAES DA SILVA', { ref: '20%', desconto: '791,65' }),
    ]).holerites[0];

    const pensao = h.verbas.find(v => v.codigo === '1830.1');
    expect(pensao.desconto).toBe(791.65);
    expect(pensao.descricao).toContain('Pensão Judicial');
    expect(pensao.descricao).toContain('GAEL CARVALHAES DA SILVA');
    expect(pensao.referencia).toBe('20%');
    // A linha-mãe, sem valor, não vira uma verba vazia.
    expect(h.verbas.some(v => v.codigo === '1830')).toBe(false);
  });

  it('as duas vias não duplicam as verbas', () => {
    const h = ler(PADRAO).holerites[0];
    expect(h.verbas.filter(v => v.codigo === '89')).toHaveLength(1);
  });

  it('sem as posições, o leitor não chuta de que lado está o valor', () => {
    // Texto puro: o valor é guardado, mas sem afirmar provento ou desconto.
    const f = lerFolhaPagamento(folhaNova({}));
    const v = f.holerites[0].verbas.find(x => x.codigo === '1950');
    expect(v.valor).toBe(368.45);
    expect(v.tipo).toBeNull();
    expect(v.provento).toBeNull();
    expect(v.desconto).toBeNull();
  });

  it('holerite sem quadro de verbas devolve lista vazia, não quebra', () => {
    const semQuadro = folhaNova({}).filter(l => !/^(Ev |1 Horas|1950 INSS)/.test(l));
    expect(lerFolhaPagamento(semQuadro).holerites[0].verbas).toEqual([]);
  });
});
