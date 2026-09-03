import { describe, it, expect } from 'vitest';
import {
  lerRelatorioVale, conciliarRelatorio, linhasDeItens,
  normalizarTexto, normalizarNome, valorBR, soDigitos, arredondar,
} from '../src/utils/relatorio-vale.js';

// O importador do vale combustível grava dezenas de valores de uma vez a partir
// de um PDF. Um erro de leitura aqui não aparece na tela como erro: aparece
// como o benefício errado na conta de alguém. Por isso o leitor é testado
// contra o formato real do relatório, incluindo as manhas dele.

// Cabeçalho igual ao do PDF da operadora. Os CPFs são inventados.
const CABECALHO = [
  'Pag: 1',
  'Usuário: FULANA DE TAL Emitido em: 03/07/2026',
  'Relatório Produto de Carga',
  'CNPJ: 24.939.311/0001-89',
  'Empresa: Empresa Exemplo Ltda',
  'Número da nota: 824',
  'Valor total da nota: R$ 455,00',
  'Total de crédito: R$ 450,00',
  'Total de serviço: R$ 5,00',
  'Código do beneficiário Nome CPF Valor do crédito Taxa de Impressão Taxa de reimpressão Taxa de Recarga',
];

const CORPO = [
  '2388172 ADAO RIBEIRO 111.111.111-11 R$ 150,00 R$ R$ R$',
  '2388173 BEATRIZ NUNES 222.222.222-22 R$ 105,00 R$ R$ R$',
  // Esta pessoa pagou reimpressão de cartão: a taxa vem DEPOIS do crédito.
  '2388174 CARLOS ANDRADE 333.333.333-33 R$ 195,00 R$ R$ 5,00 R$',
];

const RODAPE = ['Antes de imprimir, pense na sua responsabilidade e compromisso com o meio ambiente.'];

const relatorio = (corpo = CORPO) => lerRelatorioVale([...CABECALHO, ...corpo, ...RODAPE]);

describe('normalização do texto do PDF', () => {
  it('desfaz as ligaduras tipográficas da fonte', () => {
    // Sem isto "beneﬁciário" não casa com nada e o cabeçalho passa batido.
    expect(normalizarTexto('beneﬁciário')).toBe('beneficiário');
    expect(normalizarTexto('aﬂor')).toBe('aflor');
  });

  it('troca espaço não-quebrável e colapsa espaços repetidos', () => {
    expect(normalizarTexto('R$  150,00   por  mês')).toBe('R$ 150,00 por mês');
  });

  it('compara nomes sem acento e sem caixa', () => {
    expect(normalizarNome('José Antônio')).toBe(normalizarNome('JOSE ANTONIO'));
  });

  it('lê valor em formato brasileiro', () => {
    expect(valorBR('R$ 1.234,50')).toBe(1234.5);
    expect(valorBR('R$ 150,00')).toBe(150);
    expect(valorBR('R$')).toBeNull();
    expect(valorBR('')).toBeNull();
  });

  it('reduz CPF a dígitos', () => {
    expect(soDigitos('111.111.111-11')).toBe('11111111111');
  });
});

describe('reconstrução das linhas a partir do pdf.js', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });

  it('junta as células de uma linha na ordem em que estão impressas', () => {
    const linhas = linhasDeItens([
      item('572.032.379-15', 387, 500), item('ADAO RIBEIRO', 217, 500), item('2388172', 71, 500),
    ]);
    expect(linhas).toEqual(['2388172 ADAO RIBEIRO 572.032.379-15']);
  });

  it('devolve as linhas de cima para baixo', () => {
    expect(linhasDeItens([item('B', 10, 100), item('A', 10, 200)])).toEqual(['A', 'B']);
  });

  it('tolera baselines desalinhadas dentro da mesma linha', () => {
    // Caso real: com nome comprido o relatório imprime as células da mesma
    // linha em 282,54 / 280,74 / 278,94. Agrupar por Y exato perdia a pessoa.
    const linhas = linhasDeItens([
      item('2388186', 71, 280.74),
      item('GABRIEL MARTINS RIBEIRO BEDETI', 196, 278.94),
      item('128.902.269-05', 387, 282.54),
      item('R$ 150,00', 474, 282.54),
    ]);
    expect(linhas).toEqual(['2388186 GABRIEL MARTINS RIBEIRO BEDETI 128.902.269-05 R$ 150,00']);
  });

  it('não funde linhas vizinhas de verdade', () => {
    // O espaçamento entre linhas do relatório é de ~10 pt.
    expect(linhasDeItens([item('linha de cima', 10, 290), item('linha de baixo', 10, 280)]))
      .toEqual(['linha de cima', 'linha de baixo']);
  });

  it('descarta células vazias', () => {
    expect(linhasDeItens([item('  ', 10, 100), item('A', 20, 100)])).toEqual(['A']);
  });
});

describe('leitura do relatório', () => {
  it('lê o cabeçalho mesmo com dois campos na mesma linha impressa', () => {
    // "Usuário: … Emitido em: 03/07/2026" sai numa linha só.
    const r = relatorio();
    expect(r.emitidoBR).toBe('03/07/2026');
    expect(r.competencia).toBe('2026-07');
    expect(r.nota).toBe('824');
    expect(r.empresa).toBe('Empresa Exemplo Ltda');
  });

  it('separa o crédito da taxa de serviço', () => {
    // A taxa é cobrança da operadora e não é benefício de ninguém.
    const r = relatorio();
    expect(r.totalNota).toBe(455);
    expect(r.totalCredito).toBe(450);
    expect(r.totalServico).toBe(5);
  });

  it('lê cada beneficiário com nome, CPF e crédito', () => {
    const r = relatorio();
    expect(r.registros).toHaveLength(3);
    expect(r.registros[0]).toEqual({
      codigo: '2388172', nome: 'ADAO RIBEIRO', cpf: '111.111.111-11', valor: 150,
    });
  });

  it('pega o crédito, não a taxa que vem depois dele na mesma linha', () => {
    expect(relatorio().registros[2].valor).toBe(195);
  });

  it('a conferência fecha quando a soma bate com o total de crédito', () => {
    const r = relatorio();
    expect(r.soma).toBe(450);
    expect(r.problemas).toEqual([]);
  });

  it('acusa quando a soma não bate com o total de crédito', () => {
    const r = relatorio([...CORPO, '2388175 DINA PIRES 444.444.444-44 R$ 10,00 R$ R$ R$']);
    expect(r.problemas.join(' ')).toMatch(/não bate com o total de crédito/);
  });

  it('acusa beneficiário repetido', () => {
    const r = relatorio([...CORPO, '2388176 ADAO RIBEIRO 111.111.111-11 R$ 0,00 R$ R$ R$']);
    expect(r.problemas.join(' ')).toMatch(/aparece mais de uma vez/);
  });

  it('acusa relatório sem data de emissão em vez de chutar a competência', () => {
    const semData = CABECALHO.filter(l => !l.includes('Emitido em'));
    const r = lerRelatorioVale([...semData, ...CORPO]);
    expect(r.competencia).toBe('');
    expect(r.problemas.join(' ')).toMatch(/data de emissão/);
  });

  it('recusa um PDF que não é o relatório de crédito', () => {
    expect(() => lerRelatorioVale(['Contrato de trabalho', 'Cláusula primeira']))
      .toThrow(/nenhum beneficiário/i);
  });

  it('lê também o formato de uma célula por linha', () => {
    // Outros extratores de PDF devolvem o mesmo arquivo assim.
    const r = lerRelatorioVale([
      ...CABECALHO,
      '2388172', 'ADAO RIBEIRO', '111.111.111-11', 'R$ 150,00', 'R$', 'R$', 'R$',
      '2388173', 'BEATRIZ NUNES', '222.222.222-22', 'R$ 300,00', 'R$', 'R$', 'R$',
    ]);
    expect(r.registros.map(x => [x.nome, x.valor]))
      .toEqual([['ADAO RIBEIRO', 150], ['BEATRIZ NUNES', 300]]);
  });

  it('soma centavos sem sobra de ponto flutuante', () => {
    expect(arredondar(0.1 + 0.2)).toBe(0.3);
  });
});

describe('cruzamento com o cadastro', () => {
  const PESSOAS = [
    { id: 1, nome: 'Adão Ribeiro',   cpf: '111.111.111-11', status: 'ativo' },
    { id: 2, nome: 'BEATRIZ NUNES',  cpf: '',               status: 'ativo' },
    { id: 3, nome: 'Zenaide Alves',  cpf: '999.999.999-99', status: 'ativo' },
  ];

  it('casa pelo CPF mesmo com o nome grafado diferente', () => {
    const c = conciliarRelatorio(relatorio(), PESSOAS);
    const adao = c.casados.find(x => x.colab.id === 1);
    expect(adao.via).toBe('cpf');
    expect(adao.registro.valor).toBe(150);
  });

  it('cai para o nome quando o cadastro está sem CPF', () => {
    const c = conciliarRelatorio(relatorio(), PESSOAS);
    expect(c.casados.find(x => x.colab.id === 2).via).toBe('nome');
  });

  it('não adivinha quando dois cadastros têm o mesmo nome', () => {
    // Pagar o benefício para o homônimo errado é pior que pedir a ligação.
    const duplicado = [...PESSOAS, { id: 4, nome: 'Beatriz Nunes', status: 'ativo' }];
    const c = conciliarRelatorio(relatorio(), duplicado);
    expect(c.casados.some(x => x.registro.nome === 'BEATRIZ NUNES')).toBe(false);
    expect(c.semCadastro.some(x => /mais de um cadastro/.test(x.motivo))).toBe(true);
  });

  it('separa quem não tem cadastro nenhum', () => {
    const c = conciliarRelatorio(relatorio(), PESSOAS);
    expect(c.semCadastro.map(x => x.registro.nome)).toEqual(['CARLOS ANDRADE']);
    expect(c.somaSemCadastro).toBe(195);
  });

  it('respeita a ligação feita à mão na conferência', () => {
    const c = conciliarRelatorio(relatorio(), PESSOAS, { vinculos: { '33333333333': 3 } });
    expect(c.semCadastro).toHaveLength(0);
    expect(c.casados.find(x => x.colab.id === 3).via).toBe('manual');
  });

  it('não importa quem o RH mandou ignorar', () => {
    const c = conciliarRelatorio(relatorio(), PESSOAS, { ignorados: ['111.111.111-11'] });
    expect(c.casados.some(x => x.colab.id === 1)).toBe(false);
    expect(c.somaIgnorados).toBe(150);
  });

  it('não deixa dois registros caírem no mesmo colaborador', () => {
    const c = conciliarRelatorio(relatorio(), PESSOAS, {
      vinculos: { '33333333333': 1 },   // Carlos apontado para o Adão
    });
    expect(c.casados.filter(x => x.colab.id === 1)).toHaveLength(1);
    expect(c.semCadastro.some(x => /Já casado/.test(x.motivo))).toBe(true);
  });

  it('lista os ativos que ficaram de fora do relatório', () => {
    const c = conciliarRelatorio(relatorio(), PESSOAS);
    expect(c.ausentes.map(x => x.id)).toEqual([3]);
  });

  it('não cobra presença de quem está inativo', () => {
    const comInativo = [...PESSOAS, { id: 5, nome: 'Antigo', status: 'inativo' }];
    expect(conciliarRelatorio(relatorio(), comInativo).ausentes.map(x => x.id)).toEqual([3]);
  });

  it('tudo do relatório cai em algum balde — nada some no caminho', () => {
    const c = conciliarRelatorio(relatorio(), PESSOAS, { ignorados: ['111.111.111-11'] });
    expect(arredondar(c.somaCasados + c.somaIgnorados + c.somaSemCadastro))
      .toBe(relatorio().soma);
  });
});
