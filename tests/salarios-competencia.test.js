import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// `salario_atual` guarda um valor só por pessoa — o de hoje. Importar outubro
// por cima de setembro apagava setembro. O histórico por competência guarda o
// que cada folha disse, e é dele que sai o seletor de mês da tela de Salários.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const PAGINA = (() => {
  const ini = html.indexOf('<div class="toolbar">', html.indexOf('page-salarios'));
  return html.slice(ini, html.indexOf('</section>', ini));
})();

// O painel do holerite mora fora da seção, junto dos outros modais.
const MODAL_HOLERITE = (() => {
  const ini = html.indexOf('<div id="modal-holerite"');
  return html.slice(ini, html.indexOf('<!-- ════════════', ini));
})();

const PESSOAS = [
  { id: 1, nome: 'Adão Ribeiro',   matricula: '23', setor: 'Produção', status: 'ativo' },
  { id: 2, nome: 'Beatriz Nunes',  matricula: '24', setor: 'Produção', status: 'ativo' },
  { id: 3, nome: 'Carlos Saiu',    matricula: '25', setor: 'Admin',    status: 'inativo' },
];

const FAIXAS = [
  { short: 'até 2k' }, { short: '2–3,5k' }, { short: '3,5–5k' }, { short: '5–7,5k' }, { short: '7,5k+' },
];

async function criar({ salarios = {}, hist = [] } = {}) {
  const dom = new JSDOM(`<body><div id="page-salarios">${PAGINA}</div>${MODAL_HOLERITE}</body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  const doc = dom.window.document;

  const { SalariosModule } = await import('../src/modules/salarios.js');
  const mod = new SalariosModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (s) => s || '—',
    fmtBRL: (v) => Number(v).toFixed(2),
    mesLabel: (c) => c,
    faixaIdx: (v) => (v < 2000 ? 0 : v < 3500 ? 1 : v < 5000 ? 2 : v < 7500 ? 3 : 4),
    COLABORADORES: PESSOAS,
    SALARIOS: salarios,
    FOLHA_HIST: hist,
    FAIXAS,
    CHART_COLORS: { grid: '#eee' },
    Auth: { sessaoAtual: async () => null },
    Salarios: null,
  });
  return { mod, doc };
}

const HIST = [
  { colaborador_id: 1, competencia: '2026-09', salario_base: 3674.64, liquido: 2120.63 },
  { colaborador_id: 2, competencia: '2026-09', salario_base: 2800,    liquido: 1936.23 },
  { colaborador_id: 3, competencia: '2026-09', salario_base: 2000,    liquido: 1500 },
  { colaborador_id: 1, competencia: '2026-08', salario_base: 3500,    liquido: 2000 },
  { colaborador_id: 2, competencia: '2026-08', salario_base: 2800,    liquido: 1900 },
];

// A tela precisa ter renderizado uma vez para o seletor ter as opções — é o
// que acontece de verdade: o usuário abre Salários e só então escolhe o mês.
function escolher(mod, doc, competencia) {
  mod.render();
  doc.querySelector('#sal-competencia').value = competencia;
  mod.render();
}

const nomes  = (doc) => [...doc.querySelectorAll('#tb-salarios .cell-person-name')].map(e => e.textContent);
const opcoes = (doc) => [...doc.querySelectorAll('#sal-competencia option')].map(o => o.value);

describe('o seletor de competências', () => {
  it('fica escondido enquanto não há folha importada', async () => {
    const { mod, doc } = await criar();
    mod.render();
    expect(doc.querySelector('#sal-competencia').style.display).toBe('none');
  });

  it('aparece com as competências importadas, da mais nova para a mais antiga', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    mod.render();
    expect(doc.querySelector('#sal-competencia').style.display).not.toBe('none');
    expect(opcoes(doc)).toEqual(['', '2026-09', '2026-08']);
  });

  it('começa no salário atual do cadastro', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    mod.render();
    expect(doc.querySelector('#sal-competencia').value).toBe('');
  });

  it('mantém a competência escolhida entre renders', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    mod.render();
    escolher(mod, doc, '2026-08');
    expect(doc.querySelector('#sal-competencia').value).toBe('2026-08');
  });
});

describe('vendo o salário atual (cadastro)', () => {
  it('mostra o valor do cadastro e só quem está no efetivo', async () => {
    const { mod, doc } = await criar({ salarios: { 1: { valor: 4000 } }, hist: HIST });
    mod.render();
    expect(nomes(doc).sort()).toEqual(['Adão Ribeiro', 'Beatriz Nunes']);
    expect(doc.querySelector('#tb-salarios').textContent).toContain('4000.00');
  });

  it('a linha abre o modal de edição', async () => {
    const { mod, doc } = await criar({ salarios: { 1: { valor: 4000 } } });
    mod.render();
    const linha = [...doc.querySelectorAll('#tb-salarios tr')][0];
    expect(linha.getAttribute('onclick')).toContain('abrirModalSalario');
  });
});

describe('vendo uma competência passada', () => {
  it('mostra o salário daquela folha, não o de hoje', async () => {
    const { mod, doc } = await criar({ salarios: { 1: { valor: 9999 } }, hist: HIST });
    escolher(mod, doc, '2026-08');
    const txt = doc.querySelector('#tb-salarios').textContent;
    expect(txt).toContain('3500.00');
    expect(txt).not.toContain('9999');
  });

  it('inclui quem saiu depois — a folha daquele mês tinha essa pessoa', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-09');
    expect(nomes(doc)).toContain('Carlos Saiu');
  });

  it('não inclui quem não estava naquela folha', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-08');
    expect(nomes(doc)).not.toContain('Carlos Saiu');
  });

  it('os totais são os daquela competência', async () => {
    const { mod, doc } = await criar({ salarios: { 1: { valor: 9999 } }, hist: HIST });
    escolher(mod, doc, '2026-08');
    expect(doc.querySelector('#sal-stat-total').textContent).toBe('6300.00');
  });

  it('a última coluna passa a ser o líquido do mês', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-09');
    expect(doc.querySelector('#sal-th-ultima').textContent).toBe('Líquido do mês');
    expect(doc.querySelector('#tb-salarios').textContent).toContain('2120.63');
  });

  it('não dá para editar o passado — o clique só abre o holerite', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-09');
    const linhas = [...doc.querySelectorAll('#tb-salarios tr')];
    // A linha é clicável, mas para LER a folha daquele mês. Nenhuma porta
    // leva ao formulário de salário: o que já foi pago não se edita aqui.
    linhas.forEach(l => {
      const acao = l.getAttribute('onclick') || '';
      expect(acao).not.toContain('abrirModalSalario');
      if (acao) expect(acao).toContain('abrirHolerite');
    });
    expect(doc.querySelector('#tb-salarios button[onclick*="abrirModalSalario"]')).toBeNull();
  });

  it('avisa, em texto, que a tela está no passado e soma o líquido pago', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-09');
    const aviso = doc.querySelector('#sal-aviso-historico');
    expect(aviso.style.display).not.toBe('none');
    expect(aviso.textContent).toContain('2026-09');
    expect(aviso.textContent).toContain('5556.86');   // 2120,63 + 1936,23 + 1500
  });

  it('o aviso some ao voltar para o salário atual', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-09');
    doc.querySelector('#sal-competencia').value = '';
    mod.render();
    expect(doc.querySelector('#sal-aviso-historico').style.display).toBe('none');
  });

  it('o card de "sem salário" vira a contagem de quem estava na folha', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    escolher(mod, doc, '2026-09');
    expect(doc.querySelector('#sal-stat-sem-label').textContent).toBe('Pessoas na folha');
    expect(doc.querySelector('#sal-stat-sem').textContent).toBe('3');
  });

  it('a busca continua valendo dentro da competência', async () => {
    const { mod, doc } = await criar({ hist: HIST });
    doc.querySelector('#sal-competencia').value = '2026-09';
    doc.querySelector('#sal-search').value = 'beatriz';
    mod.render();
    expect(nomes(doc)).toEqual(['Beatriz Nunes']);
  });
});

// ── Por que o líquido veio assim ──────────────────────────────────────────
// Olhando uma folha, a pergunta do RH não é a faixa salarial: é por que o
// líquido daquela pessoa veio daquele tamanho. A resposta está nos descontos,
// e ela tem de caber na linha — abrir o holerite de cada um não é resposta.

const desconto = (codigo, descricao, valor) => ({
  codigo, descricao, referencia: null, provento: null, desconto: valor, tipo: 'desconto',
});

const FOLHA_COM_VERBAS = [{
  colaborador_id: 1, competencia: '2026-01',
  salario_base: 3674.64, vencimentos: 3998.84, descontos: 1768.88, liquido: 2229.96,
  verbas: [
    desconto('89', 'P.A.T', 1),
    desconto('318', 'Antecipação Salarial', 300),
    desconto('820', 'Desconto Adiantamento Salarial', 1099.43),
    desconto('1950', 'INSS', 368.45),
  ],
}];

describe('descontos na lista da folha', () => {
  const abrir = async (hist) => {
    const { mod, doc } = await criar({ hist });
    mod.render();
    doc.querySelector('#sal-competencia').value = '2026-01';
    mod.render();
    return { mod, doc };
  };

  it('a coluna da faixa vira a dos descontos quando há um mês à vista', async () => {
    const { mod, doc } = await abrir(FOLHA_COM_VERBAS);
    expect(doc.querySelector('#sal-th-faixa').textContent).toBe('Descontos do mês');

    doc.querySelector('#sal-competencia').value = '';
    mod.render();
    expect(doc.querySelector('#sal-th-faixa').textContent).toBe('Faixa');
  });

  it('mostra o total descontado e os maiores descontos pelo nome', async () => {
    const { doc } = await abrir(FOLHA_COM_VERBAS);
    const celula = doc.querySelectorAll('#tb-salarios tr td')[3].textContent;
    expect(celula).toContain('1768.88');
    expect(celula).toContain('Adiantamento');
    expect(celula).toContain('INSS');
    expect(celula).toContain('Antecipação');
  });

  it('só os três maiores, e diz quantos ficaram de fora', async () => {
    // A linha não comporta seis descontos; o holerite detalha o resto.
    const { doc } = await abrir(FOLHA_COM_VERBAS);
    const celula = doc.querySelectorAll('#tb-salarios tr td')[3].textContent;
    expect(celula).toContain('e mais 1');
    expect(celula).not.toContain('P.A.T');     // o menor de todos
  });

  it('a conta fecha na tela: proventos menos descontos dá o líquido', async () => {
    const { doc } = await abrir(FOLHA_COM_VERBAS);
    const liquido = doc.querySelectorAll('#tb-salarios tr td')[4].textContent;
    expect(liquido).toContain('2229.96');
    // Sem os proventos ao lado, a subtração não fecha: o salário base
    // (3.674,64) não é o que entrou no mês (3.998,84, com insalubridade).
    expect(liquido).toContain('3998.84');
  });

  it('o resumo do mês mostra a conta inteira da folha', async () => {
    const { doc } = await abrir(FOLHA_COM_VERBAS);
    const aviso = doc.querySelector('#sal-aviso-historico').textContent;
    expect(aviso).toContain('3998.84');
    expect(aviso).toContain('1768.88');
    expect(aviso).toContain('2229.96');
  });

  it('folha importada sem verbas mostra o total, sem inventar detalhe', async () => {
    const { doc } = await abrir([{
      colaborador_id: 1, competencia: '2026-01',
      salario_base: 2000, vencimentos: 2000, descontos: 300, liquido: 1700, verbas: [],
    }]);
    const celula = doc.querySelectorAll('#tb-salarios tr td')[3].textContent;
    expect(celula).toContain('300.00');
    expect(celula).not.toContain('·');
  });

  it('sem desconto nenhum, a célula não fica com lista vazia', async () => {
    const { mod } = await abrir(FOLHA_COM_VERBAS);
    expect(mod._resumoDescontos([])).toBe('');
    expect(mod._resumoDescontos(null)).toBe('');
    expect(mod._resumoDescontos([desconto('1', 'Nada', 0)])).toBe('');
  });

  it('encurta nomes compridos sem transformá-los em sigla', async () => {
    const { mod } = await abrir(FOLHA_COM_VERBAS);
    expect(mod._nomeCurto('Desconto Adiantamento Salarial')).toBe('Adiantamento');
    expect(mod._nomeCurto('Pensão Judicial - GAEL CARVALHAES DA SILVA')).toBe('Pensão');
    expect(mod._nomeCurto('INSS')).toBe('INSS');
    expect(mod._nomeCurto('Contribuição Sindical Patronal Anual')).toHaveLength(22);
  });
});

// ── O painel do holerite ──────────────────────────────────────────────────
// Clicar na pessoa abre a folha dela como ela saiu no papel: identificação,
// verbas, líquido e bases de cálculo. É o que o RH confere com o PDF ao lado.

const HOLERITE_COMPLETO = [{
  colaborador_id: 1, competencia: '2026-01',
  salario_base: 3674.64, vencimentos: 3998.84, descontos: 1768.88, liquido: 2229.96,
  cargo: 'OPERADOR DE FORNO', codigo_folha: '23', cbo: '821205', departamento: '01.007',
  verbas: [
    { codigo: '1', descricao: 'Horas Normais Diurnas', referencia: '220:00 hs', provento: 3674.64, desconto: null, tipo: 'provento' },
    { codigo: '62', descricao: 'Insalubridade S/Salário Mínimo', referencia: '20,00 %', provento: 324.20, desconto: null, tipo: 'provento' },
    { codigo: '820', descricao: 'Desconto Adiantamento Salarial', referencia: null, provento: null, desconto: 1099.43, tipo: 'desconto' },
    { codigo: '89', descricao: 'P.A.T', referencia: null, provento: null, desconto: 1, tipo: 'desconto' },
    { codigo: '318', descricao: 'Antecipação Salarial', referencia: null, provento: null, desconto: 300, tipo: 'desconto' },
    { codigo: '1950', descricao: 'INSS', referencia: '12,00 %', provento: null, desconto: 368.45, tipo: 'desconto' },
  ],
  bases: [
    { rotulo: 'Salário Base', texto: '3.674,64', valor: 3674.64 },
    { rotulo: 'Sal Cont INSS', texto: '3.998,84', valor: 3998.84 },
    { rotulo: 'Bas Cálc FGTS', texto: '3.998,84', valor: 3998.84 },
    { rotulo: 'FGTS Mês', texto: '319,90', valor: 319.90 },
    { rotulo: 'Base IRRF C/Ded Simp', texto: '2.292,21', valor: 2292.21 },
    { rotulo: 'Faixa', texto: '0,00', valor: 0 },
    { rotulo: 'Dep', texto: '00', valor: null },
  ],
}];

describe('painel do holerite', () => {
  const abrirPainel = async (hist = HOLERITE_COMPLETO) => {
    const { mod, doc } = await criar({ hist });
    mod.render();
    doc.querySelector('#sal-competencia').value = '2026-01';
    mod.render();
    mod.abrirHolerite(1);
    return { mod, doc, corpo: doc.querySelector('#hol-body').textContent.replace(/\s+/g, ' ') };
  };

  it('clicar na linha abre o painel daquela pessoa', async () => {
    const { mod, doc } = await criar({ hist: HOLERITE_COMPLETO });
    mod.render();
    doc.querySelector('#sal-competencia').value = '2026-01';
    mod.render();
    const linha = doc.querySelector('#tb-salarios tr');
    expect(linha.getAttribute('onclick')).toContain('abrirHolerite(1)');

    mod.abrirHolerite(1);
    expect(doc.querySelector('#modal-holerite').classList.contains('active')).toBe(true);
  });

  it('traz a identificação como no papel', async () => {
    const { corpo } = await abrirPainel();
    expect(corpo).toContain('Adão Ribeiro');
    expect(corpo).toContain('OPERADOR DE FORNO');
    expect(corpo).toContain('821205');       // CBO
    expect(corpo).toContain('01.007');       // centro de custo
    expect(corpo).toContain('23');           // código na folha
  });

  it('lista todas as verbas, com referência e de que lado estão', async () => {
    const { doc } = await abrirPainel();
    const linhas = doc.querySelectorAll('#hol-body tbody tr');
    expect(linhas).toHaveLength(6);

    const insalubridade = [...linhas].find(l => l.textContent.includes('Insalubridade'));
    const celulas = [...insalubridade.querySelectorAll('td')].map(t => t.textContent.trim());
    expect(celulas[2]).toBe('20,00 %');      // referência
    expect(celulas[3]).toBe('324.20');       // provento
    expect(celulas[4]).toBe('');             // nada na coluna de desconto
  });

  it('fecha os totais no rodapé da tabela e destaca o líquido', async () => {
    const { doc, corpo } = await abrirPainel();
    const rodape = doc.querySelector('#hol-body tfoot').textContent.replace(/\s+/g, ' ');
    expect(rodape).toContain('3998.84');
    expect(rodape).toContain('1768.88');
    expect(corpo).toContain('Líquido a receber');
    expect(doc.querySelector('.hol-liquido-faixa strong').textContent).toBe('2229.96');
  });

  it('mostra as bases de cálculo do rodapé do papel', async () => {
    const { doc, corpo } = await abrirPainel();
    expect(doc.querySelectorAll('.hol-bases > div')).toHaveLength(7);
    expect(corpo).toContain('Sal Cont INSS');
    expect(corpo).toContain('FGTS Mês');
    expect(corpo).toContain('Base IRRF C/Ded Simp');
    // "00" de dependentes não é dinheiro — sai como está impresso.
    const dep = [...doc.querySelectorAll('.hol-bases > div')]
      .find(d => d.querySelector('span').textContent === 'Dep');
    expect(dep.querySelector('strong').textContent).toBe('00');
  });

  it('avisa quando as verbas não somam os totais impressos', async () => {
    // Auxílio-doença aparece no holerite mas fica fora do total da empresa.
    const { corpo } = await abrirPainel([{
      ...HOLERITE_COMPLETO[0],
      vencimentos: 2710.24,
      verbas: [
        { codigo: '163', descricao: 'Estouro do Mês', referencia: null, provento: 2710.24, desconto: null, tipo: 'provento' },
        { codigo: '200', descricao: 'Horas Auxílio Doença Diurnas', referencia: '220:00 hs', provento: 3006.52, desconto: null, tipo: 'provento' },
      ],
      descontos: 2710.24, liquido: 0,
    }]);
    expect(corpo).toContain('diferente dos totais impressos');
    expect(corpo).toContain('auxílio-doença');
  });

  it('folha antiga abre mesmo assim, dizendo o que falta', async () => {
    const { corpo } = await abrirPainel([{
      colaborador_id: 1, competencia: '2026-01',
      salario_base: 2000, vencimentos: 2000, descontos: 300, liquido: 1700,
      verbas: [], bases: [],
    }]);
    expect(corpo).toContain('importada antes de o sistema guardar as verbas');
    expect(corpo).toContain('Reimporte o PDF');
    expect(corpo).toContain('2000.00');          // o salário base que existe
  });

  it('não abre painel de quem não está naquela folha', async () => {
    const { mod, doc } = await criar({ hist: HOLERITE_COMPLETO });
    mod.render();
    doc.querySelector('#sal-competencia').value = '2026-01';
    mod.render();
    doc.querySelector('#hol-body').innerHTML = 'intacto';
    mod.abrirHolerite(2);                        // Beatriz não está na folha
    expect(doc.querySelector('#modal-holerite').classList.contains('active')).toBe(false);
    expect(doc.querySelector('#hol-body').textContent).toBe('intacto');
  });
});
