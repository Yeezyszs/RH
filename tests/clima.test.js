import { describe, it, expect } from 'vitest';
import {
  ESCALA, DIMENSOES, PERGUNTAS,
  perguntasDe, totalRespostas, mediaPergunta, nota10, notaPergunta,
  notasPorDimensao, scoreGeral, dimensaoMaisFraca, favorabilidade, pctParticipacao,
  contagemDimensao, justificativaDimensao, pesquisaAnterior, evolucaoDaDimensao,
  planoAtrasado, ACOES_SUGERIDAS,
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

// ─── O que o sistema escreve sozinho ────────────────────────────────────────
// O "por quê" do plano de ação é o único campo do 5W2H que não é julgamento:
// é transcrição dos números da pesquisa. Transcrever à mão é onde entra erro,
// então quem transcreve é o sistema — e estes testes fixam o texto.

const umaPergunta = (dimensao, respostas, chave = 'x') => ({
  chave, texto: chave, dimensao, respostas,
});
const pesquisaCom = (perguntas, extra = {}) => ({ id: 1, perguntas, ...extra });

describe('contagem de favoráveis, neutros e desfavoráveis', () => {
  it('soma as perguntas da dimensão inteira', () => {
    const p = pesquisaCom([
      umaPergunta('ambiente', [1, 1, 2, 3, 3], 'a'),
      umaPergunta('ambiente', [0, 0, 1, 4, 5], 'b'),
    ]);
    const c = contagemDimensao(p, 'ambiente');
    expect(c.total).toBe(20);
    expect(c.desfavoraveis).toBe(2);
    expect(c.neutros).toBe(3);
    expect(c.favoraveis).toBe(15);
    expect(c.pctFavoravel).toBe(75);
    expect(c.perguntas).toBe(2);
  });

  it('dimensão sem resposta não divide por zero', () => {
    const c = contagemDimensao(pesquisaCom([umaPergunta('ambiente', [0, 0, 0, 0, 0])]), 'ambiente');
    expect(c.total).toBe(0);
    expect(c.pctFavoravel).toBe(null);
  });
});

describe('o "por quê" escrito a partir dos números', () => {
  const baixa = umaPergunta('reconhecimento', [1, 3, 7, 7, 10], 'trabalho_reconhecido');
  const alta  = umaPergunta('pertencimento', [0, 0, 1, 8, 19], 'orgulho_empresa');

  it('abre com a dimensão, a nota e a meta', () => {
    const txt = justificativaDimensao(
      pesquisaCom([baixa, alta], { titulo: 'Clima 2026' }), 'reconhecimento');
    expect(txt).toContain('Reconhecimento ficou em 7,0 na Clima 2026');
    expect(txt).toContain('abaixo da meta de 7,5');
  });

  it('sem título da pesquisa, a frase continua correndo', () => {
    const txt = justificativaDimensao(pesquisaCom([baixa, alta]), 'reconhecimento');
    expect(txt).toContain('Reconhecimento ficou em 7,0, abaixo da meta');
  });

  it('diz "a única" quando é só uma fora da meta', () => {
    const txt = justificativaDimensao(pesquisaCom([baixa, alta]), 'reconhecimento');
    expect(txt).toContain('É a única dimensão fora da meta');
  });

  it('e conta quantas são quando há mais de uma', () => {
    const txt = justificativaDimensao(
      pesquisaCom([baixa, umaPergunta('carreira', [0, 0, 10, 0, 0], 'aprender_crescer')]),
      'reconhecimento');
    expect(txt).toContain('É uma das 2 dimensões fora da meta');
  });

  it('traz a distribuição em português correto no plural e no singular', () => {
    const muitos = justificativaDimensao(pesquisaCom([baixa]), 'reconhecimento');
    expect(muitos).toContain('De 28 respostas, 17 favoráveis (60,7%), 7 neutras e 4 desfavoráveis.');

    const um = justificativaDimensao(
      pesquisaCom([umaPergunta('reconhecimento', [0, 1, 0, 0, 0], 'trabalho_reconhecido')]),
      'reconhecimento');
    expect(um).toContain('De 1 resposta, 0 favoráveis (0,0%), 0 neutras e 1 desfavorável.');
  });

  it('compara com a pesquisa anterior, para cima e para baixo', () => {
    const atual = pesquisaCom([baixa]);
    const pior  = pesquisaCom([umaPergunta('reconhecimento', [0, 0, 10, 0, 0], 'trabalho_reconhecido')], { id: 0 });
    expect(justificativaDimensao(atual, 'reconhecimento', pior)).toContain('(+2,0)');

    const melhor = pesquisaCom([umaPergunta('reconhecimento', [0, 0, 0, 0, 10], 'trabalho_reconhecido')], { id: 0 });
    expect(justificativaDimensao(atual, 'reconhecimento', melhor)).toContain('(−3,0)');
  });

  it('nota parada é dita como parada, não como "+0,0"', () => {
    const atual = pesquisaCom([baixa]);
    const igual = pesquisaCom([{ ...baixa }], { id: 0 });
    expect(justificativaDimensao(atual, 'reconhecimento', igual)).toContain('não se moveu');
  });

  it('dimensão sem resposta não gera justificativa', () => {
    expect(justificativaDimensao(pesquisaCom([baixa]), 'carreira')).toBe('');
  });
});

describe('a pesquisa anterior', () => {
  const a = { id: 1, inicio: '2025-01-01' };
  const b = { id: 2, inicio: '2026-01-01' };
  const c = { id: 3, inicio: '2027-01-01' };

  it('é a imediatamente anterior pela data de início', () => {
    expect(pesquisaAnterior([a, b, c], c).id).toBe(2);
  });

  it('a primeira de todas não tem anterior', () => {
    expect(pesquisaAnterior([a, b, c], a)).toBe(null);
  });

  it('sem pesquisa, nada a comparar', () => {
    expect(pesquisaAnterior([a, b], null)).toBe(null);
    expect(pesquisaAnterior(null, b)).toBe(null);
  });
});

describe('a nota da pesquisa seguinte', () => {
  const resp = (n) => [[0, 0, 10, 0, 0], [0, 0, 2, 8, 0], [0, 0, 0, 6, 4]][n];
  const serie = [
    pesquisaCom([umaPergunta('reconhecimento', resp(0), 'trabalho_reconhecido')], { id: 1, inicio: '2025-01-01' }),
    pesquisaCom([umaPergunta('reconhecimento', resp(1), 'trabalho_reconhecido')], { id: 2, inicio: '2026-01-01' }),
    pesquisaCom([umaPergunta('reconhecimento', resp(2), 'trabalho_reconhecido')], { id: 3, inicio: '2027-01-01' }),
  ];

  it('mede do plano para a pesquisa seguinte', () => {
    const ev = evolucaoDaDimensao(serie, 2, 'reconhecimento');
    expect(ev.de).toBeCloseTo(7, 2);
    expect(ev.para).toBeCloseTo(8.5, 2);
    expect(ev.delta).toBeCloseTo(1.5, 2);
    expect(ev.pesquisa.id).toBe(3);
  });

  it('usa a nota que o plano guardou, não a recalculada', () => {
    expect(evolucaoDaDimensao(serie, 2, 'reconhecimento', 6).de).toBe(6);
  });

  it('a última pesquisa ainda não tem seguinte', () => {
    expect(evolucaoDaDimensao(serie, 3, 'reconhecimento')).toBe(null);
  });

  it('pesquisa que não existe na lista não mede nada', () => {
    expect(evolucaoDaDimensao(serie, 99, 'reconhecimento')).toBe(null);
  });

  it('dimensão que a pesquisa de origem não respondeu não mede nada', () => {
    expect(evolucaoDaDimensao(serie, 2, 'carreira')).toBe(null);
  });

  it('pula a pesquisa seguinte que não perguntou daquela dimensão', () => {
    const comBuraco = [
      serie[1],
      pesquisaCom([umaPergunta('carreira', resp(2), 'aprender_crescer')], { id: 9, inicio: '2026-06-01' }),
      serie[2],
    ];
    expect(evolucaoDaDimensao(comBuraco, 2, 'reconhecimento').pesquisa.id).toBe(3);
  });
});

describe('o plano atrasado', () => {
  const hoje = '2026-11-19';
  const base = { status: 'pendente', quando: '2026-11-18' };

  it('prazo vencido e não concluído está atrasado', () => {
    expect(planoAtrasado(base, hoje)).toBe(true);
  });

  it('prazo de hoje ainda não venceu', () => {
    expect(planoAtrasado({ ...base, quando: hoje }, hoje)).toBe(false);
  });

  it('concluído não é cobrado, mesmo fora do prazo', () => {
    expect(planoAtrasado({ ...base, status: 'concluido' }, hoje)).toBe(false);
  });

  it('rascunho não é cobrado — o que falta ali é dono, não prazo', () => {
    expect(planoAtrasado({ ...base, status: 'rascunho' }, hoje)).toBe(false);
  });

  it('plano sem prazo não está atrasado', () => {
    expect(planoAtrasado({ ...base, quando: null }, hoje)).toBe(false);
    expect(planoAtrasado(null, hoje)).toBe(false);
  });
});

describe('sugestões de ação', () => {
  it('toda dimensão tem sugestões', () => {
    DIMENSOES.forEach(d => {
      expect(ACOES_SUGERIDAS[d.chave], `dimensão ${d.chave}`).toBeTruthy();
      expect(ACOES_SUGERIDAS[d.chave].length).toBeGreaterThan(0);
    });
  });
});
