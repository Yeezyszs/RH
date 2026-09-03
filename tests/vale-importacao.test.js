import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// A tela de importação: PDF entra, conferência aparece, e só o que o operador
// confirmou é gravado. Os testes usam o modal real do index.html — se um id
// mudar lá e não aqui, quebra, que é exatamente o que se quer.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const MODAL = (() => {
  const ini = html.indexOf('<div id="modal-vale-import"');
  return html.slice(ini, html.indexOf('<!-- ════════════', ini));
})();

// pdf.js falso: devolve as linhas pedidas como itens posicionados, uma por Y.
function pdfjsFake(linhas) {
  const itens = linhas.map((s, i) => ({ str: s, transform: [1, 0, 0, 1, 10, 1000 - i * 20] }));
  return {
    getDocument: () => ({ promise: Promise.resolve({
      numPages: 1,
      getPage: () => Promise.resolve({ getTextContent: () => Promise.resolve({ items: itens }) }),
    }) }),
  };
}

const pdfFalso = (nome = 'relatorio.pdf') => ({
  name: nome, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(8),
});

const CABECALHO = [
  'Usuário: FULANA Emitido em: 03/07/2026',
  'Empresa: Empresa Exemplo Ltda',
  'Número da nota: 824',
  'Valor total da nota: R$ 300,00',
  'Total de crédito: R$ 300,00',
  'Total de serviço: R$ 0,00',
];
const CORPO = [
  '1 ADAO RIBEIRO 111.111.111-11 R$ 150,00 R$ R$ R$',
  '2 BEATRIZ NUNES 222.222.222-22 R$ 100,00 R$ R$ R$',
  '3 CARLOS ANDRADE 333.333.333-33 R$ 50,00 R$ R$ R$',
];

const PESSOAS = [
  { id: 1, nome: 'Adão Ribeiro',  cpf: '111.111.111-11', setor: 'Produção', status: 'ativo' },
  { id: 2, nome: 'Beatriz Nunes', cpf: '222.222.222-22', setor: 'Produção', status: 'ativo' },
  { id: 9, nome: 'Zenaide Alves', cpf: '999.999.999-99', setor: 'Produção', status: 'ativo' },
];

async function montar({ linhas = [...CABECALHO, ...CORPO], cotas = {}, config = {} } = {}) {
  const dom = new JSDOM(`<body>${MODAL}<select id="vale-mes"></select></body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  const doc = dom.window.document;

  const gravado = { limpou: [], upsert: [], config: {} };
  const { ValeImportacaoModule } = await import('../src/modules/vale-importacao.js');
  const mod = new ValeImportacaoModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    fmtBRL: (v) => Number(v).toFixed(2),
    mesLabel: (c) => c,
    COLABORADORES: PESSOAS,
    VALE_COTAS: {},
    VALE_COTAS_MES: cotas,
    VALE_USO_MES: {},
    VALE_SALDO_INI: {},
    CONFIG: config,
    Auth: { sessaoAtual: async () => ({ user: 'x' }) },
    ValeCombustivel: {
      limparCompetencia: async (m, a) => { gravado.limpou.push([m, a]); },
      upsertCotasEmLote: async (l) => { gravado.upsert.push(...l); return l; },
    },
    Configuracoes: { definir: async (k, v) => { gravado.config[k] = v; } },
    showToast: (m, t) => { gravado.toast = [m, t]; },
    carregarPdfJs: async () => pdfjsFake(linhas),
  });
  return { mod, doc, gravado, dom };
}

describe('leitura do arquivo', () => {
  it('preenche a competência com o mês de emissão do relatório', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('#vale-imp-competencia').value).toBe('2026-07');
  });

  it('mostra nota, total de crédito e quantidade de beneficiários', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    const txt = doc.querySelector('#vale-imp-resultado').textContent;
    expect(txt).toContain('824');
    expect(txt).toContain('300.00');
  });

  it('libera o botão quando a conferência fecha', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('#btn-vale-imp-confirmar').disabled).toBe(false);
  });

  it('explica quando o PDF não é o relatório, sem liberar a gravação', async () => {
    const { mod, doc } = await montar({ linhas: ['Contrato de trabalho', 'Cláusula primeira'] });
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('#vale-imp-resultado').textContent).toMatch(/Não foi possível ler/);
    expect(doc.querySelector('#btn-vale-imp-confirmar').disabled).toBe(true);
  });

  it('recusa arquivo que não é PDF', async () => {
    const { mod, gravado } = await montar();
    await mod.lerArquivo({ name: 'planilha.xlsx', type: 'application/vnd.ms-excel' });
    expect(gravado.toast[1]).toBe('err');
  });

  it('avisa quando a soma dos beneficiários não bate com a nota', async () => {
    const { mod, doc } = await montar({
      linhas: [...CABECALHO, ...CORPO, '4 DINA PIRES 444.444.444-44 R$ 10,00 R$ R$ R$'],
    });
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('#vale-imp-resultado').textContent).toMatch(/não bate com o total de crédito/);
  });
});

describe('conferência antes de gravar', () => {
  it('lista quem não tem cadastro e oferece ligar a um colaborador', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    const linha = doc.querySelector('[data-vinculo="33333333333"]');
    expect(linha).not.toBeNull();
    expect(doc.querySelector('#vale-imp-resultado').textContent).toContain('CARLOS ANDRADE');
  });

  it('conta quem está ativo e ficou fora do relatório', async () => {
    const { mod } = await montar();
    await mod.lerArquivo(pdfFalso());
    // Zenaide não aparece no PDF.
    expect(mod._conciliacao().ausentes.map(c => c.id)).toEqual([9]);
  });

  it('grava só quem casou — o sem cadastro fica de fora', async () => {
    const { mod, gravado } = await montar();
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(gravado.upsert.map(l => [l.colaborador_id, l.valor_mensal]))
      .toEqual([[1, 150], [2, 100]]);
  });

  it('a ligação manual passa a ser gravada', async () => {
    const { mod, gravado } = await montar();
    await mod.lerArquivo(pdfFalso());
    mod._vinculos['33333333333'] = 9;
    mod._renderPreview();
    await mod.confirmar();
    expect(gravado.upsert.find(l => l.colaborador_id === 9).valor_mensal).toBe(50);
  });

  it('não deixa importar quando a conferência interna não fecha', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    mod._relatorio.soma = 999;          // simula leitura inconsistente
    mod._renderPreview();
    expect(doc.querySelector('#btn-vale-imp-confirmar').disabled).toBe(true);
  });
});

describe('gravação', () => {
  it('substituir apaga a competência antes de gravar', async () => {
    const { mod, gravado } = await montar();
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(gravado.limpou).toEqual([[7, 2026]]);
  });

  it('complementar soma ao que já existe e não apaga nada', async () => {
    // É o caso da nota avulsa emitida depois do crédito principal do mês.
    const { mod, doc, gravado } = await montar({ cotas: { '1|2026-07': 150 } });
    await mod.lerArquivo(pdfFalso());
    doc.querySelector('#vale-imp-modo').value = 'complementar';
    mod._renderPreview();
    await mod.confirmar();
    expect(gravado.limpou).toEqual([]);
    expect(gravado.upsert.find(l => l.colaborador_id === 1).valor_mensal).toBe(300);
  });

  it('respeita a competência que o operador corrigiu à mão', async () => {
    const { mod, doc, gravado } = await montar();
    await mod.lerArquivo(pdfFalso());
    doc.querySelector('#vale-imp-competencia').value = '2026-08';
    await mod.confirmar();
    expect(gravado.limpou).toEqual([[8, 2026]]);
    expect(gravado.upsert.every(l => l.mes === 8)).toBe(true);
  });

  it('substituir limpa também o estado local da competência', async () => {
    // Sem isto, quem saiu do relatório continuaria na tela com o valor antigo.
    const cotas = { '1|2026-07': 999, '9|2026-07': 150 };
    const { mod } = await montar({ cotas });
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(cotas['9|2026-07']).toBeUndefined();
    expect(cotas['1|2026-07']).toBe(150);
  });

  it('guarda os CPFs marcados como "ignorar sempre"', async () => {
    const { mod, gravado } = await montar();
    await mod.lerArquivo(pdfFalso());
    mod._marcados['33333333333'] = true;
    await mod.confirmar();
    expect(JSON.parse(gravado.config.vale_importacao_ignorados)).toEqual(['33333333333']);
  });

  it('quem já está na lista de ignorados nem entra na conferência', async () => {
    const { mod, gravado } = await montar({
      config: { vale_importacao_ignorados: '["33333333333"]' },
    });
    await mod.lerArquivo(pdfFalso());
    expect(mod._conciliacao().semCadastro).toHaveLength(0);
    expect(mod._conciliacao().ignorados).toHaveLength(1);
    await mod.confirmar();
    expect(gravado.upsert).toHaveLength(2);
  });

  it('lista de ignorados corrompida não derruba a importação', async () => {
    const { mod } = await montar({ config: { vale_importacao_ignorados: 'isto não é json' } });
    await mod.lerArquivo(pdfFalso());
    expect(mod._conciliacao().casados).toHaveLength(2);
  });

  it('erro do banco não fecha o modal nem finge que gravou', async () => {
    const { mod, doc } = await montar();
    mod.ValeCombustivel.upsertCotasEmLote = async () => { throw new Error('sem conexão'); };
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(doc.querySelector('#modal-vale-import').classList.contains('active')).toBe(false);
    expect(doc.querySelector('#btn-vale-imp-confirmar').disabled).toBe(false);
  });

  it('abrir o modal de novo esquece o relatório anterior', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    mod.abrirModal();
    expect(mod._relatorio).toBeNull();
    expect(doc.querySelector('#vale-imp-resultado').innerHTML).toBe('');
    expect(doc.querySelector('#btn-vale-imp-confirmar').disabled).toBe(true);
  });
});

describe('desfazer uma ligação feita à mão', () => {
  it('a linha ligada continua na tabela, com o colaborador selecionado', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    mod._vinculos['33333333333'] = 9;
    mod._renderPreview();
    const sel = doc.querySelector('[data-vinculo="33333333333"]');
    expect(sel).not.toBeNull();
    expect(sel.value).toBe('9');
  });

  it('voltar a opção para "não importar" desfaz a ligação', async () => {
    const { mod, gravado } = await montar();
    await mod.lerArquivo(pdfFalso());
    mod._vinculos['33333333333'] = 9;
    delete mod._vinculos['33333333333'];
    await mod.confirmar();
    expect(gravado.upsert.some(l => l.colaborador_id === 9)).toBe(false);
  });
});

describe('a conta do relatório fica aberta na tela', () => {
  it('mostra total = importado + o que fica de fora', async () => {
    // Sem isto o modal mostra o total da nota e o valor a gravar sem dizer
    // que a diferença é justamente quem não entra.
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    const txt = doc.querySelector('.conta-aberta').textContent.replace(/\s+/g, ' ');
    expect(txt).toContain('300.00 no relatório');
    expect(txt).toContain('250.00');
    expect(txt).toContain('2 importado(s)');
    expect(txt).toContain('50.00');
    expect(txt).toContain('1 sem cadastro');
  });

  it('some quando o relatório inteiro entra — não há conta a explicar', async () => {
    const { mod, doc } = await montar({
      linhas: [
        'Emitido em: 03/07/2026', 'Número da nota: 1',
        'Total de crédito: R$ 250,00', 'Total de serviço: R$ 0,00',
        ...CORPO.slice(0, 2),
      ],
    });
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('.conta-aberta')).toBeNull();
  });
});
