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
 * Como se lê a nota de uma dimensão.
 *
 * Os cortes estavam escritos dentro do gráfico de barras, e a cor era a única
 * coisa que saía deles. Agora que uma dimensão fora da meta abre um plano de
 * ação, o corte virou regra do sistema e precisa de um nome: a mesma conta
 * pinta a barra, decide se há plano a fazer e rotula o plano salvo.
 */
export const CLASSIFICACAO = {
  meta:     { chave: 'meta',     rotulo: 'Na meta',  cor: '#10B981', minimo: 7.5 },
  atencao:  { chave: 'atencao',  rotulo: 'Atenção',  cor: '#F59E0B', minimo: 6.0 },
  critico:  { chave: 'critico',  rotulo: 'Crítico',  cor: '#EF4444', minimo: 0 },
};

/** A classificação de uma nota de 0 a 10. */
export function classificarDimensao(nota) {
  // `null` vira 0 no Number(), e 0 é "crítico" — mas dimensão sem resposta não
  // é nota péssima, é ausência. É a mesma distinção que notasPorDimensao faz
  // ao deixar de fora a dimensão que ninguém respondeu.
  if (nota == null || nota === '') return null;
  const v = Number(nota);
  if (!Number.isFinite(v)) return null;
  if (v >= CLASSIFICACAO.meta.minimo)    return CLASSIFICACAO.meta;
  if (v >= CLASSIFICACAO.atencao.minimo) return CLASSIFICACAO.atencao;
  return CLASSIFICACAO.critico;
}

/** A dimensão pede plano de ação? Tudo que não está na meta pede. */
export function pedePlanoDeAcao(nota) {
  const c = classificarDimensao(nota);
  return !!c && c.chave !== 'meta';
}

/**
 * Os sete campos do 5W2H, na ordem do formulário que a empresa usa.
 *
 * Ficam aqui, e não na tela, porque é a definição do método: o rótulo em
 * português, a palavra em inglês que dá nome ao modelo e a pergunta que cada
 * campo responde. A tela monta o formulário a partir desta lista.
 */
export const CAMPOS_5W2H = [
  { campo: 'o_que',   w: 'What',     rotulo: 'O quê',      ajuda: 'A ação a ser feita' },
  { campo: 'por_que', w: 'Why',      rotulo: 'Por quê',    ajuda: 'O motivo — o que o resultado da pesquisa mostrou' },
  { campo: 'onde',    w: 'Where',    rotulo: 'Onde',       ajuda: 'Setor, turno ou local' },
  { campo: 'quando',  w: 'When',     rotulo: 'Quando',     ajuda: 'Prazo para concluir', tipo: 'date' },
  { campo: 'quem',    w: 'Who',      rotulo: 'Quem',       ajuda: 'Responsável pela ação' },
  { campo: 'como',    w: 'How',      rotulo: 'Como',       ajuda: 'Os passos — como será feito' },
  { campo: 'quanto',  w: 'How much', rotulo: 'Quanto custa', ajuda: 'Custo estimado, se houver', tipo: 'number' },
];

export const STATUS_PLANO_CLIMA = [
  // Rascunho é o plano que o sistema abriu sozinho e ninguém assumiu. Não
  // conta como plano ativo: número de plano sem dono é relatório bonito, e foi
  // falta de dono que produziu a nota baixa.
  { chave: 'rascunho',  rotulo: 'Rascunho',  badge: 'neutral', ativo: false },
  { chave: 'pendente',  rotulo: 'Pendente',  badge: 'warn',  ativo: true },
  { chave: 'andamento', rotulo: 'Em andamento', badge: 'info', ativo: true },
  { chave: 'concluido', rotulo: 'Concluído', badge: 'ok',    ativo: true },
];

export const STATUS_RASCUNHO = 'rascunho';

/**
 * Ações que costumam resolver cada dimensão.
 *
 * São SUGESTÕES, mostradas ao lado do campo para o responsável escolher ou
 * ignorar — nunca escritas dentro dele. A diferença não é detalhe: o valor do
 * 5W2H está em alguém digitar "eu, até março". Plano que se escreve sozinho
 * vira ritual sem dono, que é justamente o que faz a nota cair.
 */
export const ACOES_SUGERIDAS = {
  ambiente:       ['Rodada de conversas por setor sobre convivência',
                   'Canal de escuta com retorno em até 7 dias',
                   'Combinar e afixar acordos de convivência do turno'],
  lideranca:      ['Treinamento de liderança para encarregados',
                   'Reunião quinzenal de 15 min entre líder e equipe',
                   'Feedback individual trimestral registrado no sistema'],
  comunicacao:    ['Informativo mensal no quadro e no grupo da equipe',
                   'Comunicar toda mudança antes de ela acontecer, por escrito',
                   'Abertura de turno de 5 min com os avisos do dia'],
  recursos:       ['Levantamento do que falta por posto de trabalho',
                   'Prazo fixo para atender pedido de ferramenta ou EPI',
                   'Revisar manutenção preventiva dos equipamentos críticos'],
  seguranca:      ['DDS semanal com caso real do setor',
                   'Fechar as pendências do plano de ação do PGR',
                   'Revisar a matriz de treinamentos de NR do setor'],
  reconhecimento: ['Ritual mensal de reconhecimento por setor',
                   'Feedback individual trimestral registrado no sistema',
                   'Elogio registrado na hora, em Pontos fortes da ficha'],
  carreira:       ['Publicar o plano de carreira e os critérios de promoção',
                   'Priorizar vaga interna antes de abrir para fora',
                   'Plano de desenvolvimento individual para quem quer crescer'],
  pertencimento:  ['Divulgar resultados e metas da empresa ao time',
                   'Integração estruturada para quem entra',
                   'Encontro semestral com a diretoria'],
};

/** Favoráveis, neutros e desfavoráveis de uma dimensão inteira. */
export function contagemDimensao(pesquisa, dimensao) {
  const perguntas = perguntasDe(pesquisa).filter(p => p.dimensao === dimensao);
  const soma = (i) => perguntas.reduce((s, p) => s + (Number(p.respostas?.[i]) || 0), 0);
  const desfavoraveis = soma(0) + soma(1);
  const neutros       = soma(2);
  const favoraveis    = soma(3) + soma(4);
  const total = desfavoraveis + neutros + favoraveis;
  return {
    total, favoraveis, neutros, desfavoraveis,
    pctFavoravel: total ? (favoraveis / total) * 100 : null,
    perguntas: perguntas.length,
  };
}

const umaCasa = (v) => Number(v).toFixed(1).replace('.', ',');

/**
 * O "por quê" do 5W2H, escrito a partir dos números da pesquisa.
 *
 * Este é o campo que NÃO é julgamento: nota, favorabilidade, distribuição,
 * posição entre as outras dimensões e comparação com a pesquisa anterior são
 * todos derivados do que foi respondido. Escrever isso à mão é transcrever o
 * gráfico, e transcrever à mão é onde entra erro.
 *
 * @param {object} pesquisa
 * @param {string} dimensao
 * @param {object} [anterior] a pesquisa imediatamente anterior, se houver
 */
export function justificativaDimensao(pesquisa, dimensao, anterior = null) {
  const notas = notasPorDimensao(pesquisa);
  const nota  = notas[dimensao];
  if (nota == null) return '';

  const rotulo = DIM_LABEL[dimensao] || dimensao;
  const c = contagemDimensao(pesquisa, dimensao);
  const partes = [];

  const titulo = pesquisa?.titulo ? ` na ${pesquisa.titulo}` : '';
  partes.push(`${rotulo} ficou em ${umaCasa(nota)}${titulo}, abaixo da meta de `
    + `${umaCasa(CLASSIFICACAO.meta.minimo)}.`);

  const fora = Object.values(notas).filter(n => n < CLASSIFICACAO.meta.minimo).length;
  const geral = scoreGeral(pesquisa);
  partes.push(fora === 1
    ? `É a única dimensão fora da meta, contra um score geral de ${umaCasa(geral)}.`
    : `É uma das ${fora} dimensões fora da meta, contra um score geral de ${umaCasa(geral)}.`);

  if (c.total) {
    // "favorável" → "favoráveis": o plural troca o -l, não soma um sufixo.
    const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;
    partes.push(`De ${plural(c.total, 'resposta', 'respostas')}, `
      + `${plural(c.favoraveis, 'favorável', 'favoráveis')} (${umaCasa(c.pctFavoravel)}%), `
      + `${plural(c.neutros, 'neutra', 'neutras')} e `
      + `${plural(c.desfavoraveis, 'desfavorável', 'desfavoráveis')}.`);
  }

  const antes = anterior ? notasPorDimensao(anterior)[dimensao] : null;
  if (antes != null) {
    const delta = nota - antes;
    partes.push(Math.abs(delta) < 0.05
      ? `Estava em ${umaCasa(antes)} na pesquisa anterior — não se moveu.`
      : `Estava em ${umaCasa(antes)} na pesquisa anterior (${delta > 0 ? '+' : '−'}`
        + `${umaCasa(Math.abs(delta))}).`);
  }

  return partes.join(' ');
}

/** A pesquisa imediatamente anterior a esta, pela data de início. */
export function pesquisaAnterior(pesquisas, pesquisa) {
  if (!pesquisa) return null;
  return [...(pesquisas || [])]
    .filter(p => p.id !== pesquisa.id && (p.inicio || '') < (pesquisa.inicio || ''))
    .sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''))[0] || null;
}

/**
 * Como a dimensão saiu depois do plano: a nota da pesquisa seguinte.
 *
 * É a única pergunta que importa no fim — e ela só pode ser respondida pelo
 * sistema, porque depende de uma pesquisa que ainda não existia quando o plano
 * foi escrito.
 *
 * @returns {{de: number, para: number, delta: number, pesquisa: object}|null}
 */
export function evolucaoDaDimensao(pesquisas, pesquisaId, dimensao, notaOrigem = null) {
  const lista = [...(pesquisas || [])].sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
  const i = lista.findIndex(p => Number(p.id) === Number(pesquisaId));
  if (i < 0) return null;

  const de = notaOrigem != null ? Number(notaOrigem) : notasPorDimensao(lista[i])[dimensao];
  if (de == null || !Number.isFinite(de)) return null;

  for (const seguinte of lista.slice(i + 1)) {
    const para = notasPorDimensao(seguinte)[dimensao];
    if (para != null) return { de, para, delta: para - de, pesquisa: seguinte };
  }
  return null;
}

/**
 * Prazo vencido e ainda não concluído.
 *
 * Rascunho fica de fora: ninguém assumiu, então não há de quem cobrar — o que
 * falta ali é dono, e isso o alerta de prazo não resolve.
 */
export function planoAtrasado(plano, hojeIso = new Date().toISOString().slice(0, 10)) {
  if (!plano || plano.status === STATUS_RASCUNHO || plano.status === 'concluido') return false;
  return !!plano.quando && plano.quando < hojeIso;
}

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
