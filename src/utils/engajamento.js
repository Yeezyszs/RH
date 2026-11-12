// Avaliação de engajamento — os itens do formulário e a conta da pontuação.
//
// Transcrito do "Formulário de avaliação dos colaboradores 2026" da Bepi:
// 11 itens, nota 1, 2 ou 3 cada um, mais um campo de apontamentos por item.
// A pontuação máxima é 33; a classificação sai do percentual.
//
// Mora aqui, e não dentro do módulo de tela, porque três lugares precisam da
// mesma conta: a tela do RH, o formulário público que os gestores respondem
// (engajamento.html) e os testes. Cada cópia dessa regra seria uma chance de a
// tela e o formulário discordarem sobre a nota da mesma pessoa.

/** Os 11 itens avaliados, na ordem do formulário impresso. */
export const ITENS_ENGAJAMENTO = [
  'Adaptação às regras e controles relacionados a qualidade e segurança dos produtos',
  'Agilidade para a função',
  'Satisfação com a função / comprometimento',
  'Assiduidade e pontualidade',
  'Relacionamento e trabalho em equipe',
  'Comportamento',
  'Facilidade de aprender e assimilar informações',
  'Planejamento e organização',
  'Qualidade do trabalho',
  'Cumprimento dos quesitos de Segurança do trabalho',
  'Cumprimento de metas do setor',
];

/** Nota máxima por item. */
export const NOTA_MAXIMA = 3;

/** Pontuação máxima do formulário: 11 itens × nota 3. */
export const PONTUACAO_MAXIMA = ITENS_ENGAJAMENTO.length * NOTA_MAXIMA;

/** O que cada nota quer dizer, para o gestor não ter que adivinhar. */
export const LEGENDA_NOTAS = {
  1: 'Abaixo do esperado',
  2: 'Atende ao esperado',
  3: 'Acima do esperado',
};

/**
 * Faixas de classificação, exatamente como o formulário define:
 * menor que 50% insatisfatório; de 50% a 70% satisfatório; 70% ou mais
 * excelente. O limite de baixo é exclusivo e o de cima inclusivo — 70% crava
 * "Excelente", e é por isso que a comparação é `>=`.
 */
export const CLASSIFICACOES = [
  { chave: 'excelente',      rotulo: 'Excelente',      minimo: 70, cls: 'ok'     },
  { chave: 'satisfatorio',   rotulo: 'Satisfatório',   minimo: 50, cls: 'warn'   },
  { chave: 'insatisfatorio', rotulo: 'Insatisfatório',  minimo: 0,  cls: 'danger' },
];

export function classificar(percentual) {
  return CLASSIFICACOES.find(c => percentual >= c.minimo) || CLASSIFICACOES[CLASSIFICACOES.length - 1];
}

/** Notas de uma avaliação, na ordem dos itens. Aceita o jsonb do banco. */
export function notasDe(avaliacao) {
  const itens = Array.isArray(avaliacao?.itens) ? avaliacao.itens : [];
  return ITENS_ENGAJAMENTO.map((_, i) => {
    const n = Number(itens[i]?.nota);
    return Number.isFinite(n) && n >= 1 && n <= NOTA_MAXIMA ? n : null;
  });
}

/**
 * Soma, percentual e classificação de uma avaliação.
 *
 * Item sem nota conta zero na soma mas NÃO reduz a pontuação máxima: um
 * formulário entregue pela metade tem que aparecer como pontuação baixa, não
 * como um percentual alto sobre os poucos itens respondidos.
 */
export function pontuacao(avaliacao) {
  const notas = notasDe(avaliacao);
  const soma = notas.reduce((s, n) => s + (n || 0), 0);
  const percentual = (soma / PONTUACAO_MAXIMA) * 100;
  const respondidos = notas.filter(n => n != null).length;
  return {
    soma,
    maximo: PONTUACAO_MAXIMA,
    percentual,
    respondidos,
    completa: respondidos === ITENS_ENGAJAMENTO.length,
    ...classificar(percentual),
  };
}

/**
 * Média entre as avaliações do gestor e do RH, que é como o formulário manda
 * fechar a nota: "o gestor e o responsável pelo RH devem avaliar separadamente
 * e depois tirar média das notas".
 *
 * A média é feita item a item, e não entre os totais: assim um item que só um
 * dos dois avaliou continua valendo a nota que recebeu, em vez de virar meia
 * nota. Com uma avaliação só, devolve a própria.
 */
export function consolidar(avaliacoes) {
  const lista = (avaliacoes || []).filter(Boolean);
  if (!lista.length) return null;

  const porItem = ITENS_ENGAJAMENTO.map((_, i) => {
    const notas = lista.map(a => notasDe(a)[i]).filter(n => n != null);
    if (!notas.length) return null;
    return notas.reduce((s, n) => s + n, 0) / notas.length;
  });

  const itens = porItem.map(nota => ({ nota }));
  const soma = porItem.reduce((s, n) => s + (n || 0), 0);
  const percentual = (soma / PONTUACAO_MAXIMA) * 100;
  return {
    itens,
    notas: porItem,
    soma,
    maximo: PONTUACAO_MAXIMA,
    percentual,
    avaliadores: lista.length,
    ...classificar(percentual),
  };
}

/** "66,7%" — percentual no formato do formulário. */
export function pctBR(v) {
  return (Math.round((Number(v) || 0) * 10) / 10).toFixed(1).replace('.', ',') + '%';
}
