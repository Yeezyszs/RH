// Compliance de segurança do trabalho — as normas, os prazos e as contas.
//
// Sem DOM e sem banco: entra o que está gravado, sai o que a tela mostra.
// Fica à parte porque é a regra que diz se um treinamento está vencido, e
// errar isso é mandar gente para a máquina com a reciclagem fora do prazo.

/**
 * As normas que a empresa controla, na ordem da planilha do RH.
 *
 * `validade` é a periodicidade da reciclagem em meses, como a própria NR
 * define. Onde a norma não exige reciclagem periódica o campo é null — e aí
 * o treinamento não vence sozinho; sai da matriz só quando alguém o tira.
 */
export const NORMAS = [
  { chave: 'NR 01',      rotulo: 'NR 01',      descricao: 'Disposições gerais e gerenciamento de riscos', validade: 24 },
  { chave: 'NR 06',      rotulo: 'NR 06',      descricao: 'EPI — equipamento de proteção individual',     validade: null },
  { chave: 'NR 10',      rotulo: 'NR 10',      descricao: 'Segurança em instalações elétricas',           validade: 24 },
  { chave: 'NR 11/EN',   rotulo: 'NR 11/EN',   descricao: 'Empilhadeira',                                 validade: 12 },
  { chave: 'NR 11/TAL',  rotulo: 'NR 11/TAL',  descricao: 'Talha',                                        validade: 12 },
  { chave: 'NR 11/P',    rotulo: 'NR 11/P',    descricao: 'Ponte rolante',                                validade: 12 },
  { chave: 'NR 11/TRAT', rotulo: 'NR 11/TRAT', descricao: 'Trator',                                       validade: 12 },
  { chave: 'NR 12',      rotulo: 'NR 12',      descricao: 'Máquinas e equipamentos',                      validade: 24 },
  { chave: 'NR 13',      rotulo: 'NR 13',      descricao: 'Caldeiras e vasos de pressão',                 validade: 12 },
  { chave: 'NR 17',      rotulo: 'NR 17',      descricao: 'Ergonomia',                                    validade: 24 },
  { chave: 'NR 20',      rotulo: 'NR 20',      descricao: 'Inflamáveis e combustíveis',                   validade: 36 },
  { chave: 'NR 26',      rotulo: 'NR 26',      descricao: 'Sinalização de segurança',                     validade: null },
  { chave: 'NR 31',      rotulo: 'NR 31',      descricao: 'Trabalho rural',                               validade: 24 },
  { chave: 'NR 33',      rotulo: 'NR 33',      descricao: 'Espaço confinado',                             validade: 12 },
  { chave: 'NR 35',      rotulo: 'NR 35',      descricao: 'Trabalho em altura',                           validade: 24 },
  { chave: 'BRIGADA',    rotulo: 'Brigada',    descricao: 'Brigada de incêndio',                          validade: 12 },
  { chave: 'CIPA',       rotulo: 'CIPA',       descricao: 'Comissão interna de prevenção de acidentes',   validade: 12 },
];

export const NORMA_POR_CHAVE = Object.fromEntries(NORMAS.map(n => [n.chave, n]));

/** Tipos de acidente que a CAT distingue. */
export const TIPOS_ACIDENTE = {
  tipico:  'Típico (no trabalho)',
  trajeto: 'De trajeto',
  doenca:  'Doença ocupacional',
};

/** Programas e laudos que vão ao eSocial. */
export const TIPOS_PROGRAMA = ['PGR', 'LTCAT', 'PCMSO', 'PPR', 'PCA', 'LTIP', 'Outro'];

export const STATUS_PLANO = {
  pendente:  { rotulo: 'Pendente',    cls: 'warn' },
  andamento: { rotulo: 'Em andamento', cls: 'info' },
  concluido: { rotulo: 'Concluído',   cls: 'ok' },
};

/** Soma meses a uma data ISO. Devolve ISO. */
export function somarMeses(iso, meses) {
  if (!iso || !meses) return null;
  const [a, m, d] = iso.split('-').map(Number);
  const base = new Date(a, m - 1 + meses, d);
  // Dia que não existe no mês de destino (31/01 + 1 mês) cai no último dia
  // dele, em vez de pular para o mês seguinte.
  if (base.getDate() !== d) base.setDate(0);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
    + `-${String(base.getDate()).padStart(2, '0')}`;
}

/** Quando a reciclagem daquele treinamento vence. Null quando não vence. */
export function vencimentoDe(registro, hoje = undefined) {
  if (!registro?.data_realizacao) return null;
  const meses = registro.validade_meses
    ?? NORMA_POR_CHAVE[registro.nr]?.validade
    ?? null;
  if (!meses) return null;
  void hoje;
  return somarMeses(registro.data_realizacao, meses);
}

/**
 * Situação de um treinamento, que é o que pinta a célula da matriz.
 *
 * Cinco estados, e a diferença entre dois deles é o que a planilha não
 * distinguia: "nunca foi exigido" e "exigido e não feito" saíam os dois em
 * branco. O segundo é o "REALIZAR" escrito à mão — e é dele que o RH precisa
 * de lista.
 */
export function situacaoTreinamento(registro, hoje = new Date().toISOString().slice(0, 10)) {
  if (!registro) return { chave: 'ausente', rotulo: '—', cls: 'ausente', vencimento: null };
  if (registro.pendente && !registro.data_realizacao) {
    return { chave: 'realizar', rotulo: 'REALIZAR', cls: 'realizar', vencimento: null };
  }
  if (!registro.data_realizacao) {
    return { chave: 'ausente', rotulo: '—', cls: 'ausente', vencimento: null };
  }

  const vencimento = vencimentoDe(registro);
  if (!vencimento) {
    return { chave: 'sem_validade', rotulo: 'Feito', cls: 'ok', vencimento: null };
  }
  if (vencimento < hoje) {
    return { chave: 'vencido', rotulo: 'Vencido', cls: 'vencido', vencimento };
  }
  // 60 dias é o aviso que dá tempo de contratar o instrutor e montar a turma.
  const alerta = somarMeses(hoje, 2);
  if (vencimento <= alerta) {
    return { chave: 'vencendo', rotulo: 'Vence em breve', cls: 'vencendo', vencimento };
  }
  return { chave: 'ok', rotulo: 'Em dia', cls: 'ok', vencimento };
}

/**
 * A matriz inteira: uma linha por colaborador, uma célula por norma.
 *
 * Só entram as normas que alguém da empresa tem — a planilha do RH tem
 * coluna de NR 13 porque existe caldeirista, e encher a tela de colunas
 * vazias esconde as que importam. `normasExtras` força a presença de uma
 * coluna mesmo sem registro, para o RH começar a preencher.
 */
export function montarMatriz(colaboradores, registros, opcoes = {}) {
  const porColab = new Map();
  for (const r of registros || []) {
    if (!porColab.has(r.colaborador_id)) porColab.set(r.colaborador_id, {});
    porColab.get(r.colaborador_id)[r.nr] = r;
  }

  const usadas = new Set(opcoes.normasExtras || []);
  (registros || []).forEach(r => usadas.add(r.nr));
  const normas = NORMAS.filter(n => usadas.has(n.chave));

  const hoje = opcoes.hoje || new Date().toISOString().slice(0, 10);
  const linhas = (colaboradores || []).map(colab => {
    const doColab = porColab.get(colab.id) || {};
    const celulas = normas.map(norma => ({
      norma,
      registro: doColab[norma.chave] || null,
      situacao: situacaoTreinamento(doColab[norma.chave], hoje),
    }));
    return {
      colab,
      celulas,
      vencidos:  celulas.filter(c => c.situacao.chave === 'vencido').length,
      vencendo:  celulas.filter(c => c.situacao.chave === 'vencendo').length,
      aRealizar: celulas.filter(c => c.situacao.chave === 'realizar').length,
    };
  });

  return { normas, linhas };
}

/**
 * As normas que o setor exige, deduzidas do próprio quadro.
 *
 * Não existe tabela dizendo "logística precisa de NR 11 e NR 35" — isso vive
 * na cabeça do técnico de segurança. Mas está escrito no histórico: se quase
 * todo mundo da logística tem NR 11, é porque a função exige. A regra é essa:
 * norma que METADE ou mais do setor tem registrada conta como exigida.
 *
 * Metade é um corte deliberado. Mais baixo, uma exceção (o único que operou
 * empilhadeira uma vez) viraria exigência do setor inteiro; mais alto, uma
 * norma recém-adotada demoraria meses para aparecer.
 *
 * @returns {{chave: string, quantos: number, total: number, pct: number}[]}
 */
export function perfilDoSetor(colaboradores, registros, setor) {
  const doSetor = (colaboradores || [])
    .filter(c => c.status !== 'inativo' && (c.setor || '') === (setor || ''));
  if (!doSetor.length) return [];

  const ids = new Set(doSetor.map(c => c.id));
  const contagem = new Map();
  for (const r of registros || []) {
    if (!ids.has(r.colaborador_id)) continue;
    // Conta quem tem a norma registrada — feita ou marcada para fazer. As
    // duas significam "esta função exige".
    if (!r.data_realizacao && !r.pendente) continue;
    contagem.set(r.nr, (contagem.get(r.nr) || 0) + 1);
  }

  return NORMAS
    .filter(n => (contagem.get(n.chave) || 0) >= doSetor.length / 2)
    .map(n => ({
      chave: n.chave,
      quantos: contagem.get(n.chave) || 0,
      total: doSetor.length,
      pct: ((contagem.get(n.chave) || 0) / doSetor.length) * 100,
    }));
}

/**
 * O painel de um colaborador: o que o setor dele exige, o que ele tem e o
 * que falta.
 *
 * Separa em três listas porque são três ações diferentes: o que falta é para
 * agendar, o que está vencido é para refazer, e o que ele tem além do setor
 * não é problema nenhum — mas some da conta se não for mostrado.
 */
export function painelDoColaborador(colab, colaboradores, registros, hoje = undefined) {
  const meus = (registros || []).filter(r => r.colaborador_id === colab?.id);
  const porNr = Object.fromEntries(meus.map(r => [r.nr, r]));
  const exigidas = perfilDoSetor(colaboradores, registros, colab?.setor).map(e => e.chave);

  const linha = (chave, exigida) => {
    const registro = porNr[chave] || null;
    return {
      norma: NORMA_POR_CHAVE[chave] || { chave, rotulo: chave, descricao: '' },
      registro,
      exigida,
      situacao: situacaoTreinamento(registro, hoje),
    };
  };

  const doSetor = exigidas.map(c => linha(c, true));
  const extras = meus
    .filter(r => !exigidas.includes(r.nr))
    .map(r => linha(r.nr, false))
    .sort((a, b) => NORMAS.findIndex(n => n.chave === a.norma.chave)
                  - NORMAS.findIndex(n => n.chave === b.norma.chave));

  const todas = [...doSetor, ...extras];
  return {
    setor: colab?.setor || '—',
    doSetor,
    extras,
    // O que o setor exige e esta pessoa não tem registro nenhum.
    faltando: doSetor.filter(l => l.situacao.chave === 'ausente'),
    vencidos:  todas.filter(l => l.situacao.chave === 'vencido'),
    vencendo:  todas.filter(l => l.situacao.chave === 'vencendo'),
    aRealizar: todas.filter(l => l.situacao.chave === 'realizar'),
    emDia:     todas.filter(l => ['ok', 'sem_validade'].includes(l.situacao.chave)),
  };
}

/** Os números do topo da aba de treinamentos. */
export function resumoMatriz(matriz) {
  const todas = matriz.linhas.flatMap(l => l.celulas);
  const conta = (chave) => todas.filter(c => c.situacao.chave === chave).length;
  return {
    pessoas:   matriz.linhas.length,
    normas:    matriz.normas.length,
    emDia:     conta('ok') + conta('sem_validade'),
    vencendo:  conta('vencendo'),
    vencidos:  conta('vencido'),
    aRealizar: conta('realizar'),
  };
}

/** Dias de afastamento gerados por um acidente. */
export function diasAfastado(cat) {
  if (!cat?.houve_afastamento || !cat.afastamento_inicio) return 0;
  const fim = cat.afastamento_fim;
  if (!fim) return null;   // ainda afastado: a conta não fechou
  const ms = new Date(fim + 'T00:00:00') - new Date(cat.afastamento_inicio + 'T00:00:00');
  return Math.round(ms / 86400000) + 1;
}

/**
 * Situação de um programa (PGR, LTCAT…) pela validade.
 *
 * Programa vencido é o que tira a empresa da conformidade no eSocial, então
 * o aviso começa cedo: 90 dias, que é o tempo de contratar quem refaz o laudo.
 */
export function situacaoPrograma(programa, hoje = new Date().toISOString().slice(0, 10)) {
  if (!programa?.validade) return { chave: 'sem_validade', rotulo: 'Sem validade', cls: 'neutral' };
  if (programa.validade < hoje) return { chave: 'vencido', rotulo: 'Vencido', cls: 'danger' };
  if (programa.validade <= somarMeses(hoje, 3)) {
    return { chave: 'vencendo', rotulo: 'Vence em breve', cls: 'warn' };
  }
  return { chave: 'ok', rotulo: 'Vigente', cls: 'ok' };
}

/** Quanto do plano de ação já foi feito. */
export function progressoPlano(itens) {
  const lista = itens || [];
  const concluidos = lista.filter(i => i.status === 'concluido').length;
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    total: lista.length,
    concluidos,
    andamento: lista.filter(i => i.status === 'andamento').length,
    pendentes: lista.filter(i => i.status === 'pendente').length,
    // Prazo estourado e não concluído: é o que a auditoria pergunta.
    atrasados: lista.filter(i => i.status !== 'concluido' && i.prazo && i.prazo < hoje).length,
    percentual: lista.length ? (concluidos / lista.length) * 100 : 0,
  };
}

export default {
  NORMAS, NORMA_POR_CHAVE, TIPOS_ACIDENTE, TIPOS_PROGRAMA, STATUS_PLANO,
  somarMeses, vencimentoDe, situacaoTreinamento, montarMatriz, resumoMatriz,
  perfilDoSetor, painelDoColaborador,
  diasAfastado, situacaoPrograma, progressoPlano,
};
