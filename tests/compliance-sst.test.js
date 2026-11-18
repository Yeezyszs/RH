import { describe, it, expect } from 'vitest';
import {
  NORMAS, NORMA_POR_CHAVE, somarMeses, vencimentoDe, situacaoTreinamento,
  montarMatriz, resumoMatriz, diasAfastado, situacaoPrograma, progressoPlano,
  perfilDoSetor, painelDoColaborador,
} from '../src/utils/compliance-sst.js';

// A matriz de treinamentos de NR saiu de uma planilha onde a situação era cor
// de marca-texto. Aqui ela vira regra: a reciclagem vence pela periodicidade
// da própria norma, e errar isso é mandar gente para a máquina com o
// treinamento fora do prazo.

const HOJE = '2026-11-17';

describe('as normas controladas', () => {
  it('são as da planilha do RH, na mesma ordem', () => {
    expect(NORMAS.map(n => n.chave)).toEqual([
      'NR 01', 'NR 06', 'NR 10', 'NR 11/EN', 'NR 11/TAL', 'NR 11/P', 'NR 11/TRAT',
      'NR 12', 'NR 13', 'NR 17', 'NR 20', 'NR 26', 'NR 31', 'NR 33', 'NR 35',
      'BRIGADA', 'CIPA',
    ]);
  });

  it('cada norma diz sua periodicidade de reciclagem', () => {
    expect(NORMA_POR_CHAVE['NR 33'].validade).toBe(12);   // espaço confinado
    expect(NORMA_POR_CHAVE['NR 35'].validade).toBe(24);   // trabalho em altura
    // NR 06 e NR 26 não têm reciclagem periódica — e null não é zero.
    expect(NORMA_POR_CHAVE['NR 06'].validade).toBeNull();
  });
});

describe('soma de meses', () => {
  it('soma mantendo o dia', () => {
    expect(somarMeses('2026-01-15', 12)).toBe('2027-01-15');
    expect(somarMeses('2026-03-10', 24)).toBe('2028-03-10');
  });

  it('dia que não existe no mês de destino cai no último dia dele', () => {
    // 31/01 + 1 mês não pode virar 03/03.
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('sem data ou sem meses não inventa resultado', () => {
    expect(somarMeses('', 12)).toBeNull();
    expect(somarMeses('2026-01-15', null)).toBeNull();
  });
});

describe('vencimento da reciclagem', () => {
  it('usa a periodicidade da norma', () => {
    expect(vencimentoDe({ nr: 'NR 33', data_realizacao: '2026-01-10' })).toBe('2027-01-10');
    expect(vencimentoDe({ nr: 'NR 35', data_realizacao: '2026-01-10' })).toBe('2028-01-10');
  });

  it('a validade gravada no registro manda sobre a da norma', () => {
    // Treinamento com certificado de validade própria — acontece.
    expect(vencimentoDe({ nr: 'NR 35', data_realizacao: '2026-01-10', validade_meses: 6 }))
      .toBe('2026-07-10');
  });

  it('norma sem reciclagem periódica não vence', () => {
    expect(vencimentoDe({ nr: 'NR 06', data_realizacao: '2020-01-10' })).toBeNull();
  });

  it('sem data de realização não há vencimento', () => {
    expect(vencimentoDe({ nr: 'NR 33' })).toBeNull();
  });
});

describe('situação de cada célula da matriz', () => {
  const sit = (reg) => situacaoTreinamento(reg, HOJE).chave;

  it('em dia quando o prazo está longe', () => {
    expect(sit({ nr: 'NR 35', data_realizacao: '2026-06-01' })).toBe('ok');
  });

  it('vencido quando o prazo passou', () => {
    expect(sit({ nr: 'NR 13', data_realizacao: '2024-01-10' })).toBe('vencido');
  });

  it('avisa 60 dias antes — tempo de contratar instrutor e montar turma', () => {
    // NR 33 vale 12 meses: feito em 05/12/2025 vence em 05/12/2026, daqui a 18 dias.
    expect(sit({ nr: 'NR 33', data_realizacao: '2025-12-05' })).toBe('vencendo');
  });

  it('"a realizar" é diferente de "sem registro"', () => {
    // Na planilha os dois saíam em branco. O primeiro é o "REALIZAR" escrito
    // à mão: exigido e não feito, e é dele que o RH precisa de lista.
    expect(sit({ nr: 'NR 33', pendente: true })).toBe('realizar');
    expect(sit(null)).toBe('ausente');
    expect(sit({ nr: 'NR 33' })).toBe('ausente');
  });

  it('norma sem reciclagem fica "feito", nunca vencida', () => {
    const s = situacaoTreinamento({ nr: 'NR 06', data_realizacao: '2015-01-01' }, HOJE);
    expect(s.chave).toBe('sem_validade');
    expect(s.vencimento).toBeNull();
  });

  it('a célula carrega a data de vencimento, para a tela mostrar', () => {
    expect(situacaoTreinamento({ nr: 'NR 33', data_realizacao: '2026-01-10' }, HOJE).vencimento)
      .toBe('2027-01-10');
  });
});

describe('a matriz montada', () => {
  const PESSOAS = [
    { id: 1, nome: 'Adão Ribeiro', cargo: 'Operador', status: 'ativo' },
    { id: 2, nome: 'Celso Rubens', cargo: 'Caldeirista', status: 'ativo' },
  ];
  const REGISTROS = [
    { colaborador_id: 1, nr: 'NR 01', data_realizacao: '2026-06-01' },
    { colaborador_id: 1, nr: 'NR 33', pendente: true },
    { colaborador_id: 2, nr: 'NR 13', data_realizacao: '2024-01-10' },
  ];

  it('traz uma coluna por norma usada e uma linha por pessoa', () => {
    const m = montarMatriz(PESSOAS, REGISTROS, { hoje: HOJE });
    expect(m.normas.map(n => n.chave)).toEqual(['NR 01', 'NR 13', 'NR 33']);
    expect(m.linhas).toHaveLength(2);
    expect(m.linhas[0].celulas).toHaveLength(3);
  });

  it('as colunas saem na ordem da planilha, não na de cadastro', () => {
    const m = montarMatriz(PESSOAS, [
      { colaborador_id: 1, nr: 'NR 35', data_realizacao: '2026-01-01' },
      { colaborador_id: 1, nr: 'NR 01', data_realizacao: '2026-01-01' },
    ], { hoje: HOJE });
    expect(m.normas.map(n => n.chave)).toEqual(['NR 01', 'NR 35']);
  });

  it('`normasExtras` força colunas sem registro — é onde o RH começa a preencher', () => {
    const m = montarMatriz(PESSOAS, [], { hoje: HOJE, normasExtras: ['NR 12', 'NR 20'] });
    expect(m.normas.map(n => n.chave)).toEqual(['NR 12', 'NR 20']);
    expect(m.linhas[0].celulas.every(c => c.situacao.chave === 'ausente')).toBe(true);
  });

  it('cada linha conta os próprios vencidos e pendentes', () => {
    const m = montarMatriz(PESSOAS, REGISTROS, { hoje: HOJE });
    const adao = m.linhas.find(l => l.colab.id === 1);
    const celso = m.linhas.find(l => l.colab.id === 2);
    expect(adao.aRealizar).toBe(1);
    expect(adao.vencidos).toBe(0);
    expect(celso.vencidos).toBe(1);
  });

  it('o resumo soma a matriz inteira', () => {
    const r = resumoMatriz(montarMatriz(PESSOAS, REGISTROS, { hoje: HOJE }));
    expect(r.pessoas).toBe(2);
    expect(r.normas).toBe(3);
    expect(r.vencidos).toBe(1);
    expect(r.aRealizar).toBe(1);
    expect(r.emDia).toBe(1);
  });
});

describe('afastamento gerado pelo acidente', () => {
  it('conta os dias incluindo o primeiro e o último', () => {
    expect(diasAfastado({
      houve_afastamento: true, afastamento_inicio: '2026-05-14', afastamento_fim: '2026-05-28',
    })).toBe(15);
  });

  it('um dia só conta um dia', () => {
    expect(diasAfastado({
      houve_afastamento: true, afastamento_inicio: '2026-05-14', afastamento_fim: '2026-05-14',
    })).toBe(1);
  });

  it('ainda afastado devolve nulo, não zero', () => {
    // Zero diria "voltou no mesmo dia". Nulo diz "a conta não fechou".
    expect(diasAfastado({ houve_afastamento: true, afastamento_inicio: '2026-05-14' })).toBeNull();
  });

  it('acidente sem afastamento é zero', () => {
    expect(diasAfastado({ houve_afastamento: false })).toBe(0);
    expect(diasAfastado(null)).toBe(0);
  });
});

describe('situação do programa', () => {
  it('vigente quando a validade está longe', () => {
    expect(situacaoPrograma({ validade: '2027-06-01' }, HOJE).chave).toBe('ok');
  });

  it('vencido quando a validade passou', () => {
    expect(situacaoPrograma({ validade: '2026-01-01' }, HOJE).chave).toBe('vencido');
  });

  it('avisa com 90 dias — é o tempo de contratar quem refaz o laudo', () => {
    expect(situacaoPrograma({ validade: '2027-01-10' }, HOJE).chave).toBe('vencendo');
  });

  it('programa sem validade não é tratado como vencido', () => {
    expect(situacaoPrograma({}, HOJE).chave).toBe('sem_validade');
  });
});

describe('progresso do plano de ação', () => {
  const itens = [
    { status: 'concluido', prazo: '2026-06-30' },
    { status: 'pendente',  prazo: '2026-03-01' },   // prazo estourado
    { status: 'andamento', prazo: '2027-01-01' },
    { status: 'pendente',  prazo: null },
  ];

  it('conta por situação', () => {
    const p = progressoPlano(itens);
    expect([p.total, p.concluidos, p.andamento, p.pendentes]).toEqual([4, 1, 1, 2]);
  });

  it('aponta os atrasados — prazo vencido e não concluído', () => {
    // É a pergunta que a auditoria faz primeiro.
    expect(progressoPlano(itens).atrasados).toBe(1);
  });

  it('concluído com prazo vencido não conta como atrasado', () => {
    expect(progressoPlano([{ status: 'concluido', prazo: '2020-01-01' }]).atrasados).toBe(0);
  });

  it('plano vazio não divide por zero', () => {
    const p = progressoPlano([]);
    expect(p.percentual).toBe(0);
    expect(p.total).toBe(0);
  });
});

// ── Quais NR o setor exige ────────────────────────────────────────────────
// Não existe tabela dizendo "logística precisa de NR 11". Isso vive na cabeça
// do técnico de segurança — mas está escrito no histórico: se quase todo mundo
// do setor tem a norma, é porque a função exige. É daí que o painel do
// colaborador tira a lista.

const pessoa = (id, nome, setor) => ({ id, nome, setor, cargo: 'x', status: 'ativo' });
const reg = (cid, nr, data, pendente = false) =>
  ({ colaborador_id: cid, nr, data_realizacao: data || null, pendente });

const LOGISTICA = [pessoa(1, 'Um', 'Logística'), pessoa(2, 'Dois', 'Logística'),
  pessoa(3, 'Três', 'Logística'), pessoa(4, 'Quatro', 'Logística')];
const PRODUCAO = [pessoa(5, 'Cinco', 'Produção'), pessoa(6, 'Seis', 'Produção')];

const REGISTROS = [
  // Logística: os quatro têm NR 11/EN; três dos quatro têm NR 35.
  ...LOGISTICA.map(p => reg(p.id, 'NR 11/EN', '2026-05-01')),
  reg(1, 'NR 35', '2026-06-01'), reg(2, 'NR 35', '2026-06-01'), reg(4, 'NR 35', '2026-06-01'),
  // Um único da logística fez NR 33 — exceção, não exigência do setor.
  reg(1, 'NR 33', '2026-06-01'),
  // Produção: perfil diferente.
  ...PRODUCAO.flatMap(p => [reg(p.id, 'NR 12', '2026-05-01'), reg(p.id, 'NR 13', '2024-01-10')]),
];

describe('perfil de NR do setor', () => {
  it('a norma que a maioria do setor tem conta como exigida', () => {
    const perfil = perfilDoSetor([...LOGISTICA, ...PRODUCAO], REGISTROS, 'Logística');
    expect(perfil.map(e => e.chave)).toEqual(['NR 11/EN', 'NR 35']);
  });

  it('a exceção de uma pessoa não vira exigência do setor', () => {
    // Só o colaborador 1 fez NR 33: um em quatro, abaixo da metade.
    const perfil = perfilDoSetor([...LOGISTICA, ...PRODUCAO], REGISTROS, 'Logística');
    expect(perfil.map(e => e.chave)).not.toContain('NR 33');
  });

  it('cada setor tem o seu perfil', () => {
    const prod = perfilDoSetor([...LOGISTICA, ...PRODUCAO], REGISTROS, 'Produção');
    expect(prod.map(e => e.chave)).toEqual(['NR 12', 'NR 13']);
  });

  it('diz quantos do setor têm cada norma — é o que sustenta a conclusão', () => {
    const perfil = perfilDoSetor([...LOGISTICA, ...PRODUCAO], REGISTROS, 'Logística');
    const nr35 = perfil.find(e => e.chave === 'NR 35');
    expect([nr35.quantos, nr35.total]).toEqual([3, 4]);
  });

  it('"a realizar" também conta como exigência', () => {
    // Marcar REALIZAR é a empresa dizendo que a função pede aquela norma,
    // mesmo antes de alguém ter feito.
    const perfil = perfilDoSetor(PRODUCAO, [reg(5, 'NR 33', null, true), reg(6, 'NR 33', null, true)], 'Produção');
    expect(perfil.map(e => e.chave)).toContain('NR 33');
  });

  it('registro sem data e sem pendência não conta', () => {
    // Linha vazia na matriz não é exigência — é lixo de preenchimento.
    expect(perfilDoSetor(PRODUCAO, [reg(5, 'NR 33'), reg(6, 'NR 33')], 'Produção')).toEqual([]);
  });

  it('setor vazio ou inexistente não quebra', () => {
    expect(perfilDoSetor([], REGISTROS, 'Logística')).toEqual([]);
    expect(perfilDoSetor(LOGISTICA, REGISTROS, 'Setor Que Não Existe')).toEqual([]);
  });

  it('a ordem é a da planilha, não a de cadastro', () => {
    const perfil = perfilDoSetor(PRODUCAO, [
      ...PRODUCAO.map(p => reg(p.id, 'NR 35', '2026-01-01')),
      ...PRODUCAO.map(p => reg(p.id, 'NR 01', '2026-01-01')),
    ], 'Produção');
    expect(perfil.map(e => e.chave)).toEqual(['NR 01', 'NR 35']);
  });
});

describe('painel do colaborador', () => {
  const TODOS = [...LOGISTICA, ...PRODUCAO];
  const painel = (id) => painelDoColaborador(
    TODOS.find(p => p.id === id), TODOS, REGISTROS, HOJE);

  it('lista o que o setor exige, com a situação de cada norma', () => {
    const p = painel(1);
    expect(p.setor).toBe('Logística');
    expect(p.doSetor.map(l => l.norma.chave)).toEqual(['NR 11/EN', 'NR 35']);
    expect(p.doSetor.every(l => l.exigida)).toBe(true);
  });

  it('aponta o que falta — exigido no setor e sem registro nenhum', () => {
    // O colaborador 3 é o único da logística sem NR 35.
    const p = painel(3);
    expect(p.faltando.map(l => l.norma.chave)).toEqual(['NR 35']);
  });

  it('quem tem tudo do setor não aparece faltando nada', () => {
    expect(painel(2).faltando).toHaveLength(0);
  });

  it('norma que a pessoa tem além do setor fica numa lista à parte', () => {
    // A NR 33 do colaborador 1 não é exigência da logística, mas existe e
    // não pode sumir da tela.
    const p = painel(1);
    expect(p.extras.map(l => l.norma.chave)).toEqual(['NR 33']);
    expect(p.extras[0].exigida).toBe(false);
  });

  it('separa vencidos, vencendo e a realizar', () => {
    const p = painel(5);                       // produção: NR 13 de 2024
    expect(p.vencidos.map(l => l.norma.chave)).toEqual(['NR 13']);
    expect(p.emDia.map(l => l.norma.chave)).toEqual(['NR 12']);
  });

  it('o painel traz a descrição da norma, não só o código', () => {
    expect(painel(1).doSetor[0].norma.descricao).toContain('Empilhadeira');
  });

  it('colaborador sem setor não quebra o painel', () => {
    const solto = { id: 99, nome: 'Sem setor', status: 'ativo' };
    const p = painelDoColaborador(solto, [...TODOS, solto], REGISTROS, HOJE);
    expect(p.doSetor).toEqual([]);
    expect(p.faltando).toEqual([]);
  });
});
