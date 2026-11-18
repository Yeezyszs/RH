import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { lerRelatorioTicket } from '../src/utils/relatorio-ticket.js';

// A mesma tela de importação do vale combustível, agora servindo o vale
// alimentação. O que muda é o leitor — a operadora é outra e o PDF tem outro
// layout — e para onde o valor vai. A conferência contra o total do relatório
// e o cruzamento com o cadastro são os mesmos, e é isso que estes testes
// verificam: que a generalização não deixou o segundo benefício com menos
// trava que o primeiro.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const MODAL = (() => {
  const ini = html.indexOf('<div id="modal-va-import"');
  return html.slice(ini, html.indexOf('<!-- ════════════', ini));
})();

function pdfjsFake(linhas) {
  const itens = linhas.map((s, i) => ({ str: s, transform: [1, 0, 0, 1, 10, 9000 - i * 20] }));
  return {
    getDocument: () => ({ promise: Promise.resolve({
      numPages: 1,
      getPage: () => Promise.resolve({ getTextContent: () => Promise.resolve({ items: itens }) }),
    }) }),
  };
}
const pdfFalso = () => ({ name: 'ticket.pdf', type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(8) });

const CABECALHO = [
  'Relatório de Pedidos e Dados Fiscais',
  'Emissão: 30/10/2026 11:50',
  'Pedido: 99667080 Empresa: MATARUCO COMERCIO ATACADISTA',
  'Total de beneficiários: 3 DE FARINHAS LTDA',
  'Total de benefícios: R$ 900,00 CNPJ: 24.939.311/0001-89',
  'Total de taxas: R$ 0,00 Contrato: 4277850006091',
  'Ajuste de crédito: R$ 0,00 Benefício: Ticket Alimentação',
  'Total do pedido: R$ 900,00 NF-e: 131994258',
  'Data do crédito: 01/10/2026',
  'Beneficiário CPF / Matrícula Crédito (R$)',
];
const CORPO = [
  'ADAO RIBEIRO 57203237915 R$ 360,00',
  'BEATRIZ NUNES 07140994900 R$ 360,00',
  'GIOVANNA GIACOBBO ALVES 08850662947 R$ 180,00',
  'Total R$ 0,00',
];

const PESSOAS = [
  { id: 1, nome: 'Adão Ribeiro',  cpf: '572.032.379-15', setor: 'Produção', status: 'ativo' },
  { id: 2, nome: 'Beatriz Nunes', cpf: '071.409.949-00', setor: 'Produção', status: 'ativo' },
];

async function montar({ linhas = [...CABECALHO, ...CORPO], porMes = {}, config = {}, pessoas = PESSOAS } = {}) {
  const dom = new JSDOM(`<body>${MODAL}<select id="va-mes"></select></body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  const doc = dom.window.document;

  const gravado = { chamadas: [], config: {}, renderizou: 0 };
  const { ValeImportacaoModule } = await import('../src/modules/vale-importacao.js');
  const mod = new ValeImportacaoModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    fmtBRL: (v) => Number(v).toFixed(2),
    mesLabel: (c) => c,
    COLABORADORES: pessoas,
    CONFIG: config,
    Auth: { sessaoAtual: async () => ({ user: 'x' }) },
    Configuracoes: { definir: async (k, v) => { gravado.config[k] = v; } },
    showToast: (m, t) => { gravado.toast = [m, t]; },
    beneficio: {
      chave: 'alimentacao',
      prefixo: 'va-imp',
      modal: 'modal-va-import',
      botao: 'btn-va-imp-confirmar',
      rotulo: 'vale alimentação',
      chaveIgnorados: 'va_importacao_ignorados',
    },
    ler: lerRelatorioTicket,
    gravar: async (dados) => {
      gravado.chamadas.push(dados);
      dados.casados.forEach(({ registro, colab }) => {
        porMes[`${colab.id}|${dados.mes}`] = { tipo: 'fixo', valor: registro.valor };
      });
    },
    aoImportar: () => { gravado.renderizou++; },
    carregarPdfJs: async () => pdfjsFake(linhas),
  });
  return { mod, doc, gravado, porMes };
}

const resultado = (doc) => doc.querySelector('#va-imp-resultado').textContent;
const podeConfirmar = (doc) => !doc.querySelector('#btn-va-imp-confirmar').disabled;

describe('leitura do relatório Ticket na tela', () => {
  it('a competência vem da data do crédito', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('#va-imp-competencia').value).toBe('2026-10');
  });

  it('mostra pedido, total de crédito e quantos beneficiários', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    const txt = resultado(doc);
    expect(txt).toContain('99667080');
    expect(txt).toContain('900.00');
    expect(txt).toContain('3');
  });

  it('separa quem casou de quem não tem cadastro', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    const txt = resultado(doc);
    expect(txt).toContain('GIOVANNA GIACOBBO ALVES');   // na lista a resolver
    expect(podeConfirmar(doc)).toBe(true);              // os dois que casaram vão
  });

  it('PDF que não é este relatório mostra erro, sem derrubar a tela', async () => {
    const { mod, doc } = await montar({ linhas: ['Documento qualquer', 'sem beneficiários'] });
    await mod.lerArquivo(pdfFalso());
    expect(resultado(doc)).toContain('Não foi possível ler');
    expect(podeConfirmar(doc)).toBe(false);
  });
});

describe('a trava do total vale para os dois benefícios', () => {
  it('relatório cuja soma não bate com o total trava a importação', async () => {
    // Uma linha perdida na leitura: a competência entraria faltando gente.
    const { mod, doc } = await montar({ linhas: [...CABECALHO, ...CORPO.slice(0, 2), 'Total R$ 0,00'] });
    await mod.lerArquivo(pdfFalso());
    expect(podeConfirmar(doc)).toBe(false);
    expect(resultado(doc)).toContain('mesmo assim');    // só com liberação manual
  });

  it('a liberação manual destrava, e é o operador quem assume', async () => {
    const { mod, doc } = await montar({ linhas: [...CABECALHO, ...CORPO.slice(0, 2), 'Total R$ 0,00'] });
    await mod.lerArquivo(pdfFalso());
    const caixa = doc.querySelector('#va-imp-forcar');
    caixa.checked = true;
    caixa.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
    expect(podeConfirmar(doc)).toBe(true);
  });
});

describe('gravação', () => {
  it('grava só quem casou, na competência do crédito', async () => {
    const { mod, gravado, porMes } = await montar();
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();

    expect(gravado.chamadas).toHaveLength(1);
    const { casados, mes, mesNum, ano, modo } = gravado.chamadas[0];
    expect(casados).toHaveLength(2);
    expect([mes, mesNum, ano, modo]).toEqual(['2026-10', 10, 2026, 'substituir']);
    expect(porMes['1|2026-10'].valor).toBe(360);
    expect(porMes['2|2026-10'].valor).toBe(360);
    // Quem não tem cadastro não entra.
    expect(Object.keys(porMes)).toHaveLength(2);
  });

  it('a ligação feita à mão passa a ser gravada', async () => {
    const { mod, doc, gravado } = await montar();
    await mod.lerArquivo(pdfFalso());
    const sel = doc.querySelector('select[data-vinculo="08850662947"]');
    sel.value = '1';
    sel.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
    // O CPF da Giovanna agora aponta para o id 1, que já casou com o Adão:
    // a tela recusa a dupla gravação no mesmo colaborador.
    await mod.confirmar();
    expect(gravado.chamadas[0].casados.map(x => x.colab.id).sort()).toEqual([1, 2]);
  });

  it('o modo complementar chega ao adaptador de gravação', async () => {
    const { mod, doc, gravado } = await montar();
    await mod.lerArquivo(pdfFalso());
    const modo = doc.querySelector('#va-imp-modo');
    modo.value = 'complementar';
    modo.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
    await mod.confirmar();
    expect(gravado.chamadas[0].modo).toBe('complementar');
  });

  it('avisa quantos foram e em que mês, e atualiza a tela do benefício', async () => {
    const { mod, gravado } = await montar();
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(gravado.toast[0]).toContain('2 crédito');
    expect(gravado.toast[0]).toContain('2026-10');
    expect(gravado.renderizou).toBe(1);
  });

  it('a lista de ignorados é a do vale alimentação, não a do combustível', async () => {
    // Duas chaves separadas em `configuracoes`: marcar alguém para ignorar
    // num benefício não pode escondê-lo no outro.
    const { mod, doc, gravado } = await montar();
    await mod.lerArquivo(pdfFalso());
    const caixa = doc.querySelector('input[data-ignorar="08850662947"]');
    caixa.checked = true;
    caixa.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
    await mod.confirmar();

    expect(Object.keys(gravado.config)).toEqual(['va_importacao_ignorados']);
    expect(gravado.config.va_importacao_ignorados).toContain('08850662947');
  });

  it('CPF ignorado no vale alimentação não aparece mais na conferência', async () => {
    const { mod, doc } = await montar({
      config: { va_importacao_ignorados: JSON.stringify(['08850662947']) },
    });
    await mod.lerArquivo(pdfFalso());
    expect(resultado(doc)).toContain('Ignorados por configuração');
  });
});

describe('ligar à mão quem o cruzamento não achou', () => {
  // O relatório é do mês que passou. Quem recebeu em janeiro e foi desligado
  // em março está no PDF de janeiro — e o seletor só oferecia quem está na
  // casa hoje, então a linha dele não tinha a quem ser ligada: restava "não
  // importar", e o crédito sumia da competência.
  const COM_EX = [
    ...PESSOAS,
    { id: 9, nome: 'Zuleica Antiga', cpf: '', setor: 'Produção', status: 'inativo' },
  ];
  const grupos = (doc) => [...doc.querySelectorAll('#va-imp-resultado optgroup')]
    .map(g => ({ rotulo: g.label, nomes: [...g.querySelectorAll('option')].map(o => o.textContent) }));

  it('o seletor oferece ex-colaboradores, num grupo à parte', async () => {
    const { mod, doc } = await montar({ pessoas: COM_EX });
    await mod.lerArquivo(pdfFalso());
    const g = grupos(doc);
    expect(g.map(x => x.rotulo)).toEqual(['Colaboradores', 'Ex-colaboradores']);
    expect(g[1].nomes).toContain('Zuleica Antiga');
  });

  it('os que estão na casa vêm primeiro — é o uso do dia a dia', async () => {
    const { mod, doc } = await montar({ pessoas: COM_EX });
    await mod.lerArquivo(pdfFalso());
    const todas = [...doc.querySelectorAll('#va-imp-resultado option')].map(o => o.textContent);
    expect(todas.indexOf('Adão Ribeiro')).toBeLessThan(todas.indexOf('Zuleica Antiga'));
  });

  it('sem ninguém desligado, o grupo de ex não aparece vazio', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    expect(grupos(doc).map(g => g.rotulo)).toEqual(['Colaboradores']);
  });

  it('o crédito do ex-colaborador é gravado para ele', async () => {
    const { mod, doc, gravado } = await montar({ pessoas: COM_EX });
    await mod.lerArquivo(pdfFalso());
    const sel = doc.querySelector('#va-imp-resultado select[data-vinculo="08850662947"]');
    sel.value = '9';
    sel.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
    await mod.confirmar();
    const casados = gravado.chamadas[0].casados;
    expect(casados.find(x => x.colab.id === 9)?.registro.valor).toBe(180);
  });
});
