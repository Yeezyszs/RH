// Pesquisa de clima — o questionário da Bepi e a conta das notas.
//
// Transcrito de "PESQUISA DE CLIMA E DESENVOLVIMENTO ORGANIZACIONAL":
// 17 afirmações numa escala de 5 pontos, de "Discordo totalmente" a "Concordo
// totalmente". A tela antes guardava seis notas de 0 a 10 digitadas à mão,
// entre elas uma de remuneração que o questionário não pergunta.
//
// O que a pesquisa guarda agora é a distribuição de respostas por pergunta —
// o que o formulário de fato devolve. A nota da dimensão é derivada: entra o
// dado bruto, sai o resumo.

/** A escala, do pior para o melhor. O índice no array é a nota menos 1. */
export const ESCALA = [
  { nota: 1, rotulo: 'Discordo totalmente',  curto: 'Discordo tot.',  cor: '#B91C1C' },
  { nota: 2, rotulo: 'Discordo parcialmente', curto: 'Discordo parc.', cor: '#EF4444' },
  { nota: 3, rotulo: 'Indiferente / Neutro',  curto: 'Neutro',         cor: '#F59E0B' },
  { nota: 4, rotulo: 'Concordo parcialmente', curto: 'Concordo parc.', cor: '#34D399' },
  { nota: 5, rotulo: 'Concordo totalmente',   curto: 'Concordo tot.',  cor: '#059669' },
];

/** As dimensões em que as perguntas se agrupam, na ordem de exibição. */
export const DIMENSOES = [
  { chave: 'ambiente',       rotulo: 'Ambiente e respeito' },
  { chave: 'lideranca',      rotulo: 'Liderança' },
  { chave: 'comunicacao',    rotulo: 'Comunicação' },
  { chave: 'recursos',       rotulo: 'Recursos de trabalho' },
  { chave: 'seguranca',      rotulo: 'Segurança' },
  { chave: 'reconhecimento', rotulo: 'Reconhecimento' },
  { chave: 'carreira',       rotulo: 'Carreira' },
  { chave: 'pertencimento',  rotulo: 'Pertencimento' },
];

export const DIM_LABEL = Object.fromEntries(DIMENSOES.map(d => [d.chave, d.rotulo]));

/**
 * As 17 perguntas, na ordem do formulário.
 *
 * Duas aparecem repetidas no questionário original ("O ambiente de trabalho é
 * respeitoso" e "Tenho os recursos necessários"), com resultados diferentes —
 * são perguntas distintas do formulário, feitas em blocos diferentes, e por
 * isso continuam separadas aqui em vez de viradas numa só.
 */
export const PERGUNTAS = [
  { chave: 'ambiente_respeitoso',   dimensao: 'ambiente',       texto: 'O ambiente de trabalho é respeitoso?' },
  { chave: 'cooperacao_colegas',    dimensao: 'ambiente',       texto: 'Existe cooperação entre os colegas?' },
  { chave: 'recursos_atividades',   dimensao: 'recursos',       texto: 'Tenho os recursos necessários para realizar minhas atividades.' },
  { chave: 'lider_respeito',        dimensao: 'lideranca',      texto: 'Meu líder me trata com respeito.' },
  { chave: 'orientacoes_claras',    dimensao: 'lideranca',      texto: 'Recebo orientações claras sobre o meu trabalho.' },
  { chave: 'lider_disponivel',      dimensao: 'lideranca',      texto: 'Quando preciso de ajuda, meu líder está disponível.' },
  { chave: 'informacoes_trabalho',  dimensao: 'comunicacao',    texto: 'Recebo as informações necessárias para realizar meu trabalho.' },
  { chave: 'mudancas_comunicadas',  dimensao: 'comunicacao',    texto: 'As mudanças na empresa são comunicadas de forma clara.' },
  { chave: 'sinto_ambiente_respeito', dimensao: 'ambiente',     texto: 'Sinto que o ambiente de trabalho é respeitoso.' },
  { chave: 'recursos_atividades_2', dimensao: 'recursos',       texto: 'Tenho os recursos necessários para realizar minhas atividades (2).' },
  { chave: 'preocupacao_seguranca', dimensao: 'seguranca',      texto: 'A empresa demonstra preocupação com minha segurança.' },
  { chave: 'treinamentos_acidentes', dimensao: 'seguranca',     texto: 'Os treinamentos ajudam a prevenir acidentes.' },
  { chave: 'trabalho_reconhecido',  dimensao: 'reconhecimento', texto: 'Meu trabalho é reconhecido quando faço um bom serviço.' },
  { chave: 'aprender_crescer',      dimensao: 'carreira',       texto: 'Sinto que tenho oportunidade de aprender e crescer.' },
  { chave: 'orgulho_empresa',       dimensao: 'pertencimento',  texto: 'Tenho orgulho de trabalhar nesta empresa.' },
  { chave: 'recomendaria',          dimensao: 'pertencimento',  texto: 'Recomendaria esta empresa para um amigo trabalhar.' },
  { chave: 'continuar_proximos_anos', dimensao: 'pertencimento', texto: 'Pretendo continuar trabalhando aqui pelos próximos anos.' },
];

/** Perguntas de uma pesquisa, caindo no questionário padrão quando vazia. */
export function perguntasDe(pesquisa) {
  const gravadas = Array.isArray(pesquisa?.perguntas) ? pesquisa.perguntas : [];
  if (gravadas.length) return gravadas;
  return PERGUNTAS.map(p => ({ ...p, respostas: [0, 0, 0, 0, 0] }));
}

/** Quantas respostas uma pergunta recebeu. */
export function totalRespostas(pergunta) {
  return (pergunta?.respostas || []).reduce((s, n) => s + (Number(n) || 0), 0);
}

/** Média de 1 a 5 de uma pergunta. Null quando ninguém respondeu. */
export function mediaPergunta(pergunta) {
  const total = totalRespostas(pergunta);
  if (!total) return null;
  const soma = (pergunta.respostas || [])
    .reduce((s, n, i) => s + (Number(n) || 0) * (i + 1), 0);
  return soma / total;
}

/**
 * Converte a média da escala (1 a 5) para a nota de 0 a 10 que a tela usa.
 * "Discordo totalmente" em todas vira 0; "Concordo totalmente", 10.
 */
export function nota10(media) {
  if (media == null) return null;
  return ((media - 1) / 4) * 10;
}

/** Nota 0-10 de uma pergunta. */
export function notaPergunta(pergunta) {
  return nota10(mediaPergunta(pergunta));
}

/**
 * Nota de cada dimensão: média das notas das perguntas dela.
 * Dimensão sem nenhuma resposta fica de fora, em vez de virar zero — zero é
 * uma nota péssima, e "ninguém respondeu" não é uma nota.
 */
export function notasPorDimensao(pesquisa) {
  const perguntas = perguntasDe(pesquisa);
  const saida = {};
  DIMENSOES.forEach(({ chave }) => {
    const notas = perguntas
      .filter(p => p.dimensao === chave)
      .map(notaPergunta)
      .filter(n => n != null);
    if (notas.length) saida[chave] = notas.reduce((a, b) => a + b, 0) / notas.length;
  });
  return saida;
}

/** Nota geral da pesquisa: média das perguntas respondidas. */
export function scoreGeral(pesquisa) {
  const notas = perguntasDe(pesquisa).map(notaPergunta).filter(n => n != null);
  if (!notas.length) return 0;
  return notas.reduce((a, b) => a + b, 0) / notas.length;
}

/** A dimensão com a pior nota — o ponto que o RH tem de atacar primeiro. */
export function dimensaoMaisFraca(pesquisa) {
  const notas = notasPorDimensao(pesquisa);
  let pior = null;
  Object.entries(notas).forEach(([chave, nota]) => {
    if (!pior || nota < pior.nota) pior = { chave, nota, rotulo: DIM_LABEL[chave] };
  });
  return pior;
}

/**
 * Percentual de respostas favoráveis (concordo parcial ou totalmente) — o
 * número que a literatura de clima chama de favorabilidade, e o que o RH
 * costuma reportar para a diretoria.
 */
export function favorabilidade(pergunta) {
  const total = totalRespostas(pergunta);
  if (!total) return null;
  const favoraveis = (Number(pergunta.respostas?.[3]) || 0) + (Number(pergunta.respostas?.[4]) || 0);
  return (favoraveis / total) * 100;
}

/** Participação na pesquisa, em percentual. */
export function pctParticipacao(pesquisa) {
  return pesquisa?.convidados ? (pesquisa.responderam / pesquisa.convidados) * 100 : 0;
}
