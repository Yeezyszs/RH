// A ficha de feedback impressa.
//
// A conversa de feedback termina em papel assinado pelos dois lados, e a MESMA
// folha serve nos dois momentos: preenchida, saindo de um registro salvo, e em
// branco, para o gestor levar à conversa e escrever à mão. É por isso que campo
// vazio vira linha pautada em vez de sumir — uma ficha que some com o que não
// foi digitado não serve para ser preenchida no papel.
//
// O desenho segue a ficha que o RH aprovou: marca da casa no topo, seções em
// verde, competências com a nota circulada e o plano de ação em três colunas
// (o que fazer, quem faz, até quando). Fica aqui, fora do módulo da tela,
// porque é documento: entra o conteúdo, sai o HTML. Sem DOM, sem janela.

// As três competências avaliadas, com a frase que explica cada uma. A ordem é
// a da ficha e a dos campos do formulário.
export const COMPETENCIAS = [
  { campo: 'nota_entrega',       titulo: 'Entrega e desempenho',          ajuda: 'Qualidade, produtividade e cumprimento de tarefas' },
  { campo: 'nota_comportamento', titulo: 'Comportamento e atitude',       ajuda: 'Postura profissional, respeito e responsabilidade' },
  { campo: 'nota_colaboracao',   titulo: 'Colaboração e trabalho em equipe', ajuda: 'Cooperação, comunicação e apoio à equipe' },
];

// A legenda da escala. Sem ela, "3" não quer dizer nada para quem recebe a via.
export const ESCALA = [
  [1, 'Muito abaixo'], [2, 'Abaixo'], [3, 'Adequado'], [4, 'Bom'], [5, 'Excelente'],
];

export const RODAPE_FICHA = 'Registro de feedback • Uma via para o colaborador e uma para o RH.';

// A marca vai embutida porque a folha é impressa numa janela em branco, aberta
// pelo navegador: um caminho relativo não resolveria, e um endereço externo
// sairia em branco se a impressão começasse antes do download.
export const LOGO_BEPI = 'data:image/png;base64,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';

export const ESTILO_FICHA = `
  .ff { color: #353729; max-width: 185mm; margin: 0 auto; }
  .ff-topo {
    display: flex; align-items: center; gap: 18px;
    border: 1px solid #DDE7D6; border-radius: 12px; padding: 10px 16px; margin-bottom: 9px;
  }
  .ff-logo { width: 112px; height: auto; flex-shrink: 0; }
  .ff-topo-texto { flex: 1; }
  .ff-topo h1 { font-size: 21px; margin: 0; letter-spacing: .01em; color: #353729; }
  .ff-topo p { margin: 3px 0 0; font-size: 11.5px; color: #677068; }
  .ff-tag {
    background: #E5EEE0; color: #4C6B3D; border-radius: 20px; padding: 5px 14px;
    font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .ff-secao {
    font-size: 12.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase;
    color: #729D62; margin: 9px 0 2px;
  }
  .ff-ajuda { font-size: 10.5px; color: #677068; margin: 0 0 4px; }
  .ff-cartao {
    border: 1px solid #DDE7D6; border-radius: 10px; padding: 9px 14px;
    background: #FDFEFC; page-break-inside: avoid;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .ff-ident { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 40px; }
  .ff-rotulo { display: block; font-size: 9.5px; letter-spacing: .09em; text-transform: uppercase; color: #677068; }
  .ff-valor { display: block; font-size: 14px; font-weight: 700; margin-top: 2px; min-height: 18px; }
  /* A mesma grade da linha de cima: "Data" cai sob "Setor", e não no canto. */
  .ff-ident-pe { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 40px; margin-top: 2px; }
  .ff-preencher { font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: #677068; }
  .ff-preencher b { font-weight: 600; color: #353729; text-transform: none; letter-spacing: 0; }
  .ff-preencher .ff-vazio { display: inline-block; width: 150px; border-bottom: 1px solid #9EA79C; }

  .ff-comp { display: flex; align-items: center; gap: 16px; padding: 5px 0; border-bottom: 1px solid #EDF2E9; }
  .ff-comp:last-child { border-bottom: 0; }
  .ff-comp-nome { flex: 1; }
  .ff-comp-nome strong { display: block; font-size: 12px; }
  .ff-comp-nome small { display: block; font-size: 9.5px; color: #677068; margin-top: 1px; }
  .ff-escala { display: flex; gap: 8px; flex-shrink: 0; }
  .ff-escala i {
    width: 21px; height: 21px; border: 1.3px solid #729D62; border-radius: 50%;
    display: inline-grid; place-items: center; font-style: normal; font-size: 10.5px; color: #4C6B3D;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .ff-escala i.on { background: #729D62; border-color: #729D62; color: #fff; font-weight: 700; }
  .ff-legenda { font-size: 9.5px; color: #677068; margin: 6px 0 0; letter-spacing: .04em; }

  .ff-linha { border-bottom: 1px solid #DDE7D6; height: 15px; }
  .ff-texto { font-size: 11.5px; line-height: 1.55; white-space: pre-wrap; }

  .ff-plano { width: 100%; border-collapse: collapse; }
  .ff-plano th {
    font-size: 9.5px; letter-spacing: .09em; text-transform: uppercase; color: #677068;
    text-align: left; font-weight: 700; padding: 0 8px 7px 0; border: 0; border-bottom: 1px solid #DDE7D6;
  }
  .ff-plano td { font-size: 11px; padding: 0 8px 0 0; border: 0; border-bottom: 1px solid #DDE7D6; height: 18px; vertical-align: bottom; }
  .ff-plano .col-resp { width: 26%; }
  .ff-plano .col-prazo { width: 18%; }

  .ff-revisao { font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #353729; margin: 9px 0 0; }
  .ff-aviso {
    background: #EEF5EA; border-radius: 8px; padding: 7px 14px; font-size: 10.5px; color: #4C6B3D;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .ff-assinaturas { display: flex; gap: 56px; margin-top: 16px; page-break-inside: avoid; }
  .ff-assinaturas div { flex: 1; border-top: 1px solid #353729; padding-top: 6px; text-align: center; font-size: 10.5px; color: #677068; }

  /* A ficha é de UMA página, e para isso manda na própria margem.
     Sem a regra, a margem do papel dos relatórios (12mm no body) soma com a
     que o navegador aplica por conta e sobra menos folha do que a ficha ocupa
     — era assim que só as assinaturas vazavam para a segunda página. */
  @page { size: A4; margin: 12mm; }
  @media print {
    body { margin: 0; }
    .ff { max-width: none; }
  }
`;

/** Linhas pautadas para escrever à mão. */
function pauta(quantas) {
  return Array.from({ length: quantas }, () => '<div class="ff-linha"></div>').join('');
}

/**
 * Monta a ficha.
 *
 * @param {{colaborador?: string, setor?: string, avaliador?: string, data?: string,
 *          nota_entrega?: number|string, nota_comportamento?: number|string,
 *          nota_colaboracao?: number|string, pontos_fortes?: string,
 *          pontos_desenvolver?: string, plano_acao?: string}} d
 * @param {{h: (s: any) => string, fmtDate: (iso: string) => string}} ferramentas
 * @returns {string} HTML da folha inteira, cabeçalho próprio incluído
 */
export function montarFichaFeedback(d = {}, { h, fmtDate }) {
  const texto = (v) => (v == null ? '' : String(v)).trim();

  const escala = (nota) => `<div class="ff-escala">${ESCALA
    .map(([n]) => `<i class="${Number(nota) === n ? 'on' : ''}">${n}</i>`).join('')}</div>`;

  const competencias = COMPETENCIAS.map(c => `
      <div class="ff-comp">
        <div class="ff-comp-nome"><strong>${h(c.titulo)}</strong><small>${h(c.ajuda)}</small></div>
        ${escala(d[c.campo])}
      </div>`).join('');

  const bloco = (titulo, ajuda, conteudo, linhasVazias) => `
    <h2 class="ff-secao">${h(titulo)}</h2>
    <p class="ff-ajuda">${h(ajuda)}</p>
    <div class="ff-cartao">${conteudo
      ? `<div class="ff-texto">${h(conteudo)}</div>${pauta(1)}`
      : pauta(linhasVazias)}</div>`;

  // O plano de ação é um campo de texto livre no sistema e três colunas no
  // papel. O que foi digitado abre a tabela; as linhas seguintes ficam em
  // branco, porque quem assina costuma combinar mais um passo ali mesmo.
  const planoSalvo = texto(d.plano_acao);
  const linhasPlano = [
    `<tr><td>${planoSalvo ? h(planoSalvo) : ''}</td><td></td><td></td></tr>`,
    '<tr><td></td><td></td><td></td></tr>',
    '<tr><td></td><td></td><td></td></tr>',
  ].join('');

  const setor = texto(d.setor);
  const avaliador = texto(d.avaliador);
  const data = texto(d.data);

  return `
    <div class="ff">
      <header class="ff-topo">
        <img class="ff-logo" src="${LOGO_BEPI}" alt="Bepi Mataruco">
        <div class="ff-topo-texto">
          <h1>FICHA DE FEEDBACK</h1>
          <p>Avaliação de desempenho e desenvolvimento</p>
        </div>
        <div class="ff-tag">RH${setor ? ` | ${h(setor)}` : ''}</div>
      </header>

      <h2 class="ff-secao">Identificação</h2>
      <div class="ff-cartao ff-ident">
        <div>
          <span class="ff-rotulo">Colaborador</span>
          <span class="ff-valor">${h(texto(d.colaborador))}</span>
        </div>
        <div>
          <span class="ff-rotulo">Setor</span>
          <span class="ff-valor">${h(setor)}</span>
        </div>
        <div class="ff-ident-pe">
          <div class="ff-preencher">Avaliador:
            ${avaliador ? `<b>${h(avaliador)}</b>` : '<span class="ff-vazio"></span>'}</div>
          <div class="ff-preencher">Data:
            ${data ? `<b>${h(fmtDate(data))}</b>` : '<span class="ff-vazio"></span>'}</div>
        </div>
      </div>

      <h2 class="ff-secao">Avaliação de competências</h2>
      <p class="ff-ajuda">Marque uma nota por competência.</p>
      <div class="ff-cartao">${competencias}</div>
      <p class="ff-legenda">ESCALA: ${ESCALA.map(([n, r]) => `${n} = ${r}`).join('  |  ')}</p>

      ${bloco('Pontos fortes', 'O que o colaborador faz bem e deve manter', texto(d.pontos_fortes), 4)}
      ${bloco('Pontos a desenvolver', 'Oportunidades de melhoria identificadas', texto(d.pontos_desenvolver), 4)}

      <h2 class="ff-secao">Plano de ação e acompanhamento</h2>
      <p class="ff-ajuda">Registre os compromissos definidos durante a conversa.</p>
      <div class="ff-cartao">
        <table class="ff-plano">
          <thead><tr>
            <th>Ação / próximo passo</th>
            <th class="col-resp">Responsável</th>
            <th class="col-prazo">Prazo</th>
          </tr></thead>
          <tbody>${linhasPlano}</tbody>
        </table>
      </div>

      <p class="ff-revisao">Data de revisão: ___ / ___ / _____</p>

      <h2 class="ff-secao">Ciência e assinaturas</h2>
      <div class="ff-aviso">${RODAPE_FICHA}</div>
      <div class="ff-assinaturas">
        <div>Assinatura do colaborador</div>
        <div>Assinatura do avaliador</div>
      </div>
    </div>`;
}

export default { montarFichaFeedback, COMPETENCIAS, ESCALA, ESTILO_FICHA, RODAPE_FICHA };
