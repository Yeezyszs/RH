import { describe, it, expect } from 'vitest';
import {
  ESCALA, DIMENSOES, PERGUNTAS,
  perguntasDe, totalRespostas, mediaPergunta, nota10, notaPergunta,
  notasPorDimensao, scoreGeral, dimensaoMaisFraca, favorabilidade, pctParticipacao,
} from '../src/utils/clima.js';

// A tela antes guardava seis notas de 0 a 10 digitadas à mão — entre elas uma
// de remuneração, que o questionário da Bepi nem pergunta. Agora o que entra é
// a distribuição de respostas e a nota é derivada. Estes testes fixam a
// conversão e usam a pesquisa real de 2026 como gabarito.

const perg = (respostas, dimensao = 'ambiente') => ({
  chave: 'x', texto: 'x', dimensao, respostas,
});

describe('o questionário transcrito do PDF', () => {
  it('tem 17 perguntas e a escala de 5 pontos', () => {
    expect(PERGUNTAS).toHaveLength(17);
    expect(ESCALA).toHaveLength(5);
    expect(ESCALA[0].rotulo).toBe('Discordo totalmente');
    expect(ESCALA[4].rotulo).toBe('Concordo totalmente');
  });

  it('toda pergunta aponta para uma dimensão que existe', () => {
    const chaves = DIMENSOES.map(d => d.chave);
    PERGUNTAS.forEach(p => {
      expect(chaves, `pergunta ${p.chave}`).toContain(p.dimensao);
    });
  });

  it('não existe mais dimensão de remuneração — o questionário não pergunta', () => {
    expect(DIMENSOES.map(d => d.chave)).not.toContain('remuneracao');
  });

  it('as chaves das perguntas são únicas', () => {
    const chaves = PERGUNTAS.map(p => p.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('pesquisa sem perguntas cai no questionário padrão, zerado', () => {
    const p = perguntasDe({});
    expect(p).toHaveLength(17);
    expect(totalRespostas(p[0])).toBe(0);
  });
});

describe('conversão da escala para nota de 0 a 10', () => {
  it('todo mundo discordando totalmente é 0', () => {
    expect(notaPergunta(perg([28, 0, 0, 0, 0]))).toBe(0);
  });

  it('todo mundo concordando totalmente é 10', () => {
    expect(notaPergunta(perg([0, 0, 0, 0, 28]))).toBe(10);
  });

  it('neutro no meio da escala é 5', () => {
    expect(notaPergunta(perg([0, 0, 28, 0, 0]))).toBe(5);
  });

  it('a média de 1 a 5 vira nota antes de virar média de dimensão', () => {
    const p = perg([0, 0, 0, 14, 14]);        // metade 4, metade 5
    expect(mediaPergunta(p)).toBe(4.5);
    expect(nota10(4.5)).toBeCloseTo(8.75, 2);
  });

  it('pergunta sem resposta não vira zero — vira ausência', () => {
    expect(mediaPergunta(perg([0, 0, 0, 0, 0]))).toBeNull();
    expect(notaPergunta(perg([0, 0, 0, 0, 0]))).toBeNull();
  });
});

describe('favorabilidade', () => {
  it('conta quem concorda parcial ou totalmente', () => {
    expect(favorabilidade(perg([0, 0, 0, 14, 14]))).toBe(100);
    expect(favorabilidade(perg([0, 0, 28, 0, 0]))).toBe(0);
    expect(favorabilidade(perg([0, 7, 7, 7, 7]))).toBe(50);
  });

  it('sem resposta não inventa percentual', () => {
    expect(favorabilidade(perg([0, 0, 0, 0, 0]))).toBeNull();
  });
});

// ── A pesquisa real, como carregada no banco ──────────────────────────────
// Números lidos dos gráficos do PDF de 2026 (28 respostas em cada pergunta).
const PESQUISA_2026 = {
  titulo: 'Pesquisa de Clima e Desenvolvimento Organizacional 2026',
  convidados: 34, responderam: 28,
  perguntas: [
    { chave: 'ambiente_respeitoso', dimensao: 'ambiente', texto: 'O ambiente de trabalho é respeitoso?', respostas: [0, 1, 2, 11, 14] },
    { chave: 'cooperacao_colegas', dimensao: 'ambiente', texto: 'Existe cooperação entre os colegas?', respostas: [1, 3, 2, 9, 13] },
    { chave: 'recursos_atividades', dimensao: 'recursos', texto: 'Tenho os recursos necessários.', respostas: [0, 1, 2, 17, 8] },
    { chave: 'lider_respeito', dimensao: 'lideranca', texto: 'Meu líder me trata com respeito.', respostas: [0, 0, 2, 4, 22] },
    { chave: 'orientacoes_claras', dimensao: 'lideranca', texto: 'Recebo orientações claras.', respostas: [1, 0, 5, 12, 10] },
    { chave: 'lider_disponivel', dimensao: 'lideranca', texto: 'Meu líder está disponível.', respostas: [1, 0, 2, 8, 17] },
    { chave: 'informacoes_trabalho', dimensao: 'comunicacao', texto: 'Recebo as informações necessárias.', respostas: [0, 1, 0, 14, 13] },
    { chave: 'mudancas_comunicadas', dimensao: 'comunicacao', texto: 'As mudanças são comunicadas.', respostas: [3, 4, 4, 5, 12] },
    { chave: 'sinto_ambiente_respeito', dimensao: 'ambiente', texto: 'Sinto que o ambiente é respeitoso.', respostas: [0, 1, 2, 8, 17] },
    { chave: 'recursos_atividades_2', dimensao: 'recursos', texto: 'Tenho os recursos necessários (2).', respostas: [1, 3, 2, 11, 11] },
    { chave: 'preocupacao_seguranca', dimensao: 'seguranca', texto: 'A empresa se preocupa com minha segurança.', respostas: [1, 4, 3, 6, 14] },
    { chave: 'treinamentos_acidentes', dimensao: 'seguranca', texto: 'Os treinamentos previnem acidentes.', respostas: [0, 1, 3, 8, 16] },
    { chave: 'trabalho_reconhecido', dimensao: 'reconhecimento', texto: 'Meu trabalho é reconhecido.', respostas: [1, 3, 7, 7, 10] },
    { chave: 'aprender_crescer', dimensao: 'carreira', texto: 'Tenho oportunidade de crescer.', respostas: [2, 0, 3, 11, 12] },
    { chave: 'orgulho_empresa', dimensao: 'pertencimento', texto: 'Tenho orgulho da empresa.', respostas: [0, 0, 1, 8, 19] },
    { chave: 'recomendaria', dimensao: 'pertencimento', texto: 'Recomendaria a empresa.', respostas: [0, 0, 5, 7, 16] },
    { chave: 'continuar_proximos_anos', dimensao: 'pertencimento', texto: 'Pretendo continuar aqui.', respostas: [0, 0, 2, 6, 20] },
  ],
};

describe('pesquisa de 2026 — os números que entraram no sistema', () => {
  it('todas as 17 perguntas fecham com as 28 respostas', () => {
    expect(PESQUISA_2026.perguntas).toHaveLength(17);
    PESQUISA_2026.perguntas.forEach(p => {
      expect(totalRespostas(p), `pergunta ${p.chave}`).toBe(28);
    });
  });

  it('a participação sai de 28 em 34 convidados', () => {
    expect(pctParticipacao(PESQUISA_2026)).toBeCloseTo(82.35, 1);
  });

  it('"Meu líder me trata com respeito" é a pergunta mais bem avaliada', () => {
    const notas = PESQUISA_2026.perguntas
      .map(p => ({ chave: p.chave, nota: notaPergunta(p) }))
      .sort((a, b) => b.nota - a.nota);
    expect(notas[0].chave).toBe('lider_respeito');
    expect(notas[0].nota).toBeCloseTo(9.29, 1);   // (6+16+110)/28 = 4,714 na escala
  });

  it('"As mudanças são comunicadas" é a pior, e puxa Comunicação para baixo', () => {
    const notas = PESQUISA_2026.perguntas
      .map(p => ({ chave: p.chave, nota: notaPergunta(p) }))
      .sort((a, b) => a.nota - b.nota);
    expect(notas[0].chave).toBe('mudancas_comunicadas');

    const porDim = notasPorDimensao(PESQUISA_2026);
    expect(porDim.comunicacao).toBeLessThan(porDim.pertencimento);
  });

  it('a dimensão mais fraca é Reconhecimento', () => {
    const pior = dimensaoMaisFraca(PESQUISA_2026);
    expect(pior.chave).toBe('reconhecimento');
    expect(pior.rotulo).toBe('Reconhecimento');
  });

  it('o score geral fica na faixa boa, sem chegar ao teto', () => {
    const score = scoreGeral(PESQUISA_2026);
    expect(score).toBeGreaterThan(7);
    expect(score).toBeLessThan(9);
  });

  it('todas as oito dimensões têm nota', () => {
    const notas = notasPorDimensao(PESQUISA_2026);
    DIMENSOES.forEach(d => {
      expect(notas[d.chave], `dimensão ${d.chave}`).toBeTypeOf('number');
    });
  });
});
