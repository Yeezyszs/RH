import { describe, it, expect } from 'vitest';
import {
  NORMAS, NORMA_POR_CHAVE, somarMeses, vencimentoDe, situacaoTreinamento,
  montarMatriz, resumoMatriz, diasAfastado, situacaoPrograma, progressoPlano,
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
