import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// A tela de importação da folha: PDF entra, conferência aparece, e só os
// salários que o operador confirmou são gravados. Usa o modal real do
// index.html — se um id mudar lá e não aqui, quebra.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const MODAL = (() => {
  const ini = html.indexOf('<div id="modal-folha-import"');
  return html.slice(ini, html.indexOf('<!-- ════════════', ini));
})();

function pdfjsFake(linhas) {
  // `linhas` pode ser uma lista simples (tudo numa página) ou uma lista de
  // páginas — o recorte do holerite depende de saber em qual folha cada linha
  // saiu, então o dublê precisa saber paginar.
  const paginas = Array.isArray(linhas[0]) ? linhas : [linhas];
  const itensDe = (ls) => ls.map((s, i) => ({ str: s, transform: [1, 0, 0, 1, 10, 9000 - i * 20] }));
  return {
    getDocument: () => ({ promise: Promise.resolve({
      numPages: paginas.length,
      getPage: (n) => Promise.resolve({
        getTextContent: async () => ({ items: itensDe(paginas[n - 1] || []) }),
      }),
    }) }),
  };
}

const pdfFalso = (nome = 'folha_09.26.pdf') => ({
  name: nome, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(8),
});

const via = ({ codigo = '5', nome = 'ADAO RIBEIRO', base = '3.674,64' } = {}) => [
  'MATARUCO COMÉRCIO ATACADISTA DE FARINHAS LTDA',
  'CNPJ: 24.939.311/0001-89 CC: Produção Folha Mensal',
  'Mensalista Setembro de 2026',
  'Código Nome do Funcionário CBO Departamento Filial',
  `${codigo} ${nome} 821205 11 1`,
  'OPERADOR DE FORNO Admissão: 10/09/2018',
  'Código Descrição Referência Vencimentos Descontos',
  '1 HORAS NORMAIS 220:00 3.674,64',
  'Total de Vencimentos Total de Descontos',
  '3.998,84 1.878,21 Data',
  `conta: 46576-7 Agência: 718 - Valor Líquido  2.120,63`,
  'Salário Base Sal. Contr. INSS Base Cálc. FGTS F.G.T.S do Mês Base Cálc. IRRF Faixa IRRF',
  `${base} 3.988,48 3.988,48 319,07 2.181,63 0,00`,
];

const PESSOAS = [
  { id: 1, nome: 'Adão Ribeiro',       status: 'ativo' },
  { id: 2, nome: 'Alessandro Ribeiro', status: 'ativo' },
  { id: 9, nome: 'Zenaide Alves',      status: 'ativo' },
];

const LINHAS = [
  ...via({}),
  ...via({ codigo: '49', nome: 'ALESSANDRO RIBEIRO', base: '2.800,00' }),
];

async function montar({ linhas = LINHAS, salarios = {}, config = {}, comSessao = true,
  folhaCompetencia = null, storage = null, pdfLib = null } = {}) {
  const dom = new JSDOM(`<body>${MODAL}</body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  const doc = dom.window.document;

  const gravado = { criados: [], atualizados: [], config: {} };
  const { FolhaImportacaoModule } = await import('../src/modules/folha-importacao.js');
  const mod = new FolhaImportacaoModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    fmtBRL: (v) => Number(v).toFixed(2),
    mesLabel: (c) => c,
    COLABORADORES: PESSOAS,
    SALARIOS: salarios,
    CONFIG: config,
    Auth: { sessaoAtual: async () => (comSessao ? { user: 'x' } : null) },
    Salarios: {
      criar:     async (p) => { gravado.criados.push(p); return { id: 100 + gravado.criados.length, ...p }; },
      atualizar: async (id, p) => { gravado.atualizados.push([id, p]); return { id, ...p }; },
    },
    Configuracoes: { definir: async (k, v) => { gravado.config[k] = v; } },
    showToast: (m, t) => { gravado.toast = [m, t]; (gravado.toasts ||= []).push([m, t]); },
    carregarPdfJs: async () => pdfjsFake(linhas),
    FolhaCompetencia: folhaCompetencia,
    StorageHolerites: storage,
    ...(pdfLib ? { carregarPdfLib: async () => pdfLib } : {}),
  });
  return { mod, doc, gravado, salarios, config };
}

describe('leitura do arquivo', () => {
  it('mostra competência, quantidade e soma dos salários base', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    const txt = doc.querySelector('#folha-resultado').textContent;
    expect(txt).toContain('2026-09');
    expect(txt).toContain('6474.64');
  });

  it('libera o botão quando há o que atualizar', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('#btn-folha-confirmar').disabled).toBe(false);
  });

  it('explica quando o PDF não é a folha, sem liberar a gravação', async () => {
    const { mod, doc } = await montar({ linhas: ['Contrato', 'Cláusula primeira'] });
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('#folha-resultado').textContent).toMatch(/Não foi possível ler/);
    expect(doc.querySelector('#btn-folha-confirmar').disabled).toBe(true);
  });

  it('recusa arquivo que não é PDF', async () => {
    const { mod, gravado } = await montar();
    await mod.lerArquivo({ name: 'folha.xlsx', type: 'application/vnd.ms-excel' });
    expect(gravado.toast[1]).toBe('err');
  });

  it('trava a gravação quando a leitura saiu inconsistente', async () => {
    // Líquido que não bate com vencimentos menos descontos.
    const quebrada = via({}).map(l => l.includes('Valor Líquido')
      ? 'conta: 46576-7 Agência: 718 - Valor Líquido  9.999,99' : l);
    const { mod, doc } = await montar({ linhas: quebrada });
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('#btn-folha-confirmar').disabled).toBe(true);
    expect(doc.querySelector('#folha-resultado').textContent).toMatch(/líquido impresso/);
  });
});

describe('a conferência mostra o que muda', () => {
  it('lista o salário atual ao lado do da folha', async () => {
    const { mod, doc } = await montar({ salarios: { 1: { id: 7, valor: 3000 } } });
    await mod.lerArquivo(pdfFalso());
    const txt = doc.querySelector('#folha-resultado').textContent;
    expect(txt).toContain('3000.00');
    expect(txt).toContain('3674.64');
  });

  it('quem ainda não tem salário aparece como não cadastrado', async () => {
    const { mod, doc } = await montar();
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('#folha-resultado').textContent).toContain('não cadastrado');
  });

  it('quando tudo já confere, diz isso — mas deixa importar pelo histórico', async () => {
    // Nenhum salário muda, e ainda assim vale gravar: a competência é
    // registro próprio, e é dela que sai o seletor de mês.
    const { mod, doc } = await montar({
      salarios: { 1: { id: 7, valor: 3674.64 }, 2: { id: 8, valor: 2800 } },
    });
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('#folha-resultado').textContent).toMatch(/já conferem com o sistema/);
    expect(doc.querySelector('#btn-folha-confirmar').disabled).toBe(false);
  });

  it('oferece ligar à mão quem não casou pelo nome', async () => {
    const { mod, doc } = await montar({ linhas: via({ codigo: '14', nome: 'NOME QUE NAO EXISTE' }) });
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('[data-folha-vinculo="14"]')).not.toBeNull();
  });
});

describe('gravação', () => {
  it('cria o salário de quem ainda não tinha', async () => {
    const { mod, gravado } = await montar();
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(gravado.criados.map(p => [p.colaborador_id, p.valor]).sort())
      .toEqual([[1, 3674.64], [2, 2800]]);
  });

  it('atualiza quem já tinha, usando o id do registro', async () => {
    const { mod, gravado } = await montar({ salarios: { 1: { id: 77, valor: 3000 } } });
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(gravado.atualizados[0][0]).toBe(77);
    expect(gravado.atualizados[0][1].valor).toBe(3674.64);
  });

  it('registra de qual folha veio o valor', async () => {
    const { mod, gravado } = await montar();
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(gravado.criados[0].observacoes).toBe('Folha de 2026-09');
  });

  it('atualiza o estado local para a tela não mentir', async () => {
    const { mod, salarios } = await montar({ salarios: {} });
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(salarios[1].valor).toBe(3674.64);
    expect(salarios[2].valor).toBe(2800);
  });

  it('não grava quem ficou sem ligação', async () => {
    const { mod, gravado } = await montar({
      linhas: [...via({}), ...via({ codigo: '99', nome: 'NAO EXISTE NO CADASTRO' })],
    });
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(gravado.criados.map(p => p.colaborador_id)).toEqual([1]);
  });

  it('a ligação à mão passa a ser gravada', async () => {
    const { mod, gravado } = await montar({ linhas: via({ codigo: '14', nome: 'GRAFIA DIFERENTE' }) });
    await mod.lerArquivo(pdfFalso());
    mod._vinculos['14'] = 9;
    mod._renderPreview();
    await mod.confirmar();
    expect(gravado.criados[0].colaborador_id).toBe(9);
  });

  it('erro no meio não finge que gravou tudo', async () => {
    const { mod, doc, gravado } = await montar();
    mod.Salarios.criar = async () => { throw new Error('sem conexão'); };
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(doc.querySelector('#modal-folha-import').classList.contains('active')).toBe(false);
    expect(gravado.toast[1]).toBe('err');
    expect(doc.querySelector('#btn-folha-confirmar').disabled).toBe(false);
  });
});

describe('as ligações podem ser lembradas', () => {
  it('guarda só o que foi marcado para lembrar', async () => {
    const { mod, gravado } = await montar({ linhas: via({ codigo: '14', nome: 'GRAFIA DIFERENTE' }) });
    await mod.lerArquivo(pdfFalso());
    mod._vinculos['14'] = 9;
    mod._lembrar['14'] = true;
    mod._renderPreview();
    await mod.confirmar();
    expect(JSON.parse(gravado.config.folha_vinculos)).toEqual({ 14: 9 });
  });

  it('ligação não marcada não é guardada', async () => {
    const { mod, gravado } = await montar({ linhas: via({ codigo: '14', nome: 'GRAFIA DIFERENTE' }) });
    await mod.lerArquivo(pdfFalso());
    mod._vinculos['14'] = 9;
    await mod.confirmar();
    expect(gravado.config.folha_vinculos).toBeUndefined();
  });

  it('a ligação guardada vale na folha seguinte, sem nenhum clique', async () => {
    const { mod, gravado } = await montar({
      linhas: via({ codigo: '14', nome: 'GRAFIA DIFERENTE' }),
      config: { folha_vinculos: '{"14":9}' },
    });
    mod.abrirModal();
    await mod.lerArquivo(pdfFalso());
    expect(mod._conciliacao().semCadastro).toHaveLength(0);
    await mod.confirmar();
    expect(gravado.criados[0].colaborador_id).toBe(9);
  });

  it('configuração corrompida não derruba a importação', async () => {
    const { mod } = await montar({ config: { folha_vinculos: 'isto não é json' } });
    mod.abrirModal();
    await mod.lerArquivo(pdfFalso());
    expect(mod._conciliacao().mudancas).toHaveLength(2);
  });
});

describe('o histórico da competência', () => {
  it('grava uma linha por pessoa que casou, não só quem mudou', async () => {
    // Quem já estava com o salário certo também ganhava algo em setembro.
    const hist = [];
    const { mod } = await montar({ salarios: { 1: { id: 7, valor: 3674.64 } } });
    mod.FOLHA_HIST = hist;
    const gravadas = [];
    mod.FolhaCompetencia = { upsertEmLote: async (l) => { gravadas.push(...l); return l; } };
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(gravadas.map(l => l.colaborador_id).sort()).toEqual([1, 2]);
  });

  it('guarda salário base, totais do mês e a competência', async () => {
    const { mod } = await montar();
    const gravadas = [];
    mod.FOLHA_HIST = [];
    mod.FolhaCompetencia = { upsertEmLote: async (l) => { gravadas.push(...l); return l; } };
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(gravadas[0]).toMatchObject({
      competencia: '2026-09', salario_base: 3674.64,
      vencimentos: 3998.84, descontos: 1878.21, liquido: 2120.63,
      cargo: 'OPERADOR DE FORNO', codigo_folha: '5',
    });
  });

  it('reimportar a mesma competência substitui, não duplica', async () => {
    const hist = [{ colaborador_id: 1, competencia: '2026-09', salario_base: 1 }];
    const { mod } = await montar();
    mod.FOLHA_HIST = hist;
    mod.FolhaCompetencia = { upsertEmLote: async (l) => l };
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(hist.filter(h => h.competencia === '2026-09' && h.colaborador_id === 1)).toHaveLength(1);
    expect(hist.find(h => h.colaborador_id === 1).salario_base).toBe(3674.64);
  });

  it('competência anterior continua no histórico', async () => {
    const hist = [{ colaborador_id: 1, competencia: '2026-08', salario_base: 3500 }];
    const { mod } = await montar();
    mod.FOLHA_HIST = hist;
    mod.FolhaCompetencia = { upsertEmLote: async (l) => l };
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(hist.some(h => h.competencia === '2026-08')).toBe(true);
    expect(hist.some(h => h.competencia === '2026-09')).toBe(true);
  });

  it('quem não casou com o cadastro não entra no histórico', async () => {
    const { mod } = await montar({
      linhas: [...via({}), ...via({ codigo: '99', nome: 'NAO EXISTE NO CADASTRO' })],
    });
    const gravadas = [];
    mod.FOLHA_HIST = [];
    mod.FolhaCompetencia = { upsertEmLote: async (l) => { gravadas.push(...l); return l; } };
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(gravadas.map(l => l.colaborador_id)).toEqual([1]);
  });
});

// ── Quando o banco está atrás do sistema ──────────────────────────────────
// O sistema é publicado na hora; a migração do banco é aplicada à mão. Nessa
// janela o código grava um campo que a tabela ainda não tem, e o PostgREST
// responde com um texto correto e inútil para quem só queria importar a
// folha: "Could not find the 'bases' column of 'folha_competencia' in the
// schema cache". Aconteceu de verdade, na cara do RH.
describe('mensagem de erro de gravação', () => {
  it('explica a coluna que falta e o que fazer', async () => {
    const { explicarErro } = await import('../src/modules/folha-importacao.js');
    const texto = explicarErro(new Error(
      "Could not find the 'bases' column of 'folha_competencia' in the schema cache"));

    expect(texto).toContain('"bases"');
    expect(texto).toContain('atualização do banco');
    expect(texto).toContain('Nada foi alterado');
    // O jargão do PostgREST não chega ao usuário.
    expect(texto).not.toContain('schema cache');
  });

  it('erro comum passa como está — não inventa explicação', async () => {
    const { explicarErro } = await import('../src/modules/folha-importacao.js');
    expect(explicarErro(new Error('Tempo esgotado'))).toBe('Tempo esgotado');
    expect(explicarErro(null)).toBe('');
  });
});

// ─── O holerite em PDF, recortado por pessoa ────────────────────────────────
//
// A folha vem num arquivo só, com uma página por colaborador e o salário de
// todo mundo dentro. Guardar esse arquivo inteiro em cada pessoa faria do
// anexo algo que não se pode entregar a ninguém. A importação recorta a
// página de cada um e anexa só a dela.

// Dublê do pdf-lib: não produz PDF, registra o que foi pedido.
function pdfLibFake({ paginas = 48, falharEm = null } = {}) {
  const pedidos = [];
  const lib = {
    pedidos,
    PDFDocument: {
      load: async () => ({ getPageCount: () => paginas, _original: true }),
      create: async () => {
        const doc = { paginas: [], addPage(p) { this.paginas.push(p); },
          async copyPages(_orig, indices) {
            if (falharEm != null && indices.includes(falharEm)) throw new Error('página ruim');
            pedidos.push(indices);
            return indices.map(i => ({ indice: i }));
          },
          async save() { return new Uint8Array([37, 80, 68, 70]); } };
        doc.copyPages = doc.copyPages.bind(doc);
        return doc;
      },
    },
  };
  return lib;
}

function storageFake({ falhar = false } = {}) {
  const enviados = [];
  return {
    enviados,
    caminho: (comp, id) => `${comp}/${id}.pdf`,
    upload: async (path, blob) => {
      if (falhar) throw new Error('sem permissão');
      enviados.push({ path, tamanho: blob.size ?? 0 });
      return path;
    },
  };
}

// Duas pessoas, uma por página — como sai o PDF de verdade.
const DUAS_PAGINAS = [
  [...via({}), ...via({})],
  [...via({ codigo: '49', nome: 'ALESSANDRO RIBEIRO', base: '2.800,00' }),
    ...via({ codigo: '49', nome: 'ALESSANDRO RIBEIRO', base: '2.800,00' })],
];

const comAnexo = (extra = {}) => montar({
  linhas: DUAS_PAGINAS,
  folhaCompetencia: { upsertEmLote: async (l) => { (extra._linhas ||= []).push(l); return l; } },
  storage: extra.storage || storageFake(),
  pdfLib: extra.pdfLib || pdfLibFake(),
  ...extra.resto,
});

describe('anexo do holerite', () => {
  it('recorta a página de cada pessoa e manda uma por colaborador', async () => {
    const storage = storageFake();
    const pdfLib = pdfLibFake();
    const { mod } = await comAnexo({ storage, pdfLib });
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();

    // pdf.js numera de 1; o pdf-lib, de 0.
    expect(pdfLib.pedidos).toEqual([[0], [1]]);
    expect(storage.enviados.map(e => e.path)).toEqual(['2026-09/1.pdf', '2026-09/2.pdf']);
  });

  it('o caminho do arquivo entra na mesma gravação do histórico', async () => {
    const guardado = {};
    const { mod } = await comAnexo({ _linhas: guardado.linhas = [] });
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();

    const linhas = guardado.linhas[0];
    expect(linhas.map(l => l.holerite_path)).toEqual(['2026-09/1.pdf', '2026-09/2.pdf']);
    expect(linhas[0].holerite_nome).toContain('Adão Ribeiro');
  });

  it('quem continua na folha seguinte leva as duas páginas', async () => {
    const pdfLib = pdfLibFake();
    const continuada = [
      [...via({}).map(l => l.includes('Valor Líquido')
        ? 'A TRANSPORTAR ********* *********' : l)],
      [...via({}), ...via({})],
    ];
    const { mod } = await comAnexo({ pdfLib, resto: { linhas: continuada } });
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(pdfLib.pedidos[0]).toEqual([0, 1]);
  });

  it('falha ao anexar não derruba a importação — o número é o que não pode sumir', async () => {
    const { mod, gravado } = await comAnexo({ storage: storageFake({ falhar: true }) });
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();

    // Os salários foram gravados mesmo sem anexo nenhum.
    expect(gravado.criados.length + gravado.atualizados.length).toBeGreaterThan(0);
    expect(gravado.toasts.some(([m, t]) => t === 'err' && /não puderam ser anexados/.test(m))).toBe(true);
  });

  it('sem o recortador disponível, importa sem anexo e avisa', async () => {
    const { mod, gravado } = await montar({
      linhas: DUAS_PAGINAS,
      folhaCompetencia: { upsertEmLote: async (l) => l },
      storage: storageFake(),
      pdfLib: null,
      // carregarPdfLib não injetado: o módulo tentaria o CDN, que não existe aqui.
    });
    mod.carregarPdfLib = async () => { throw new Error('offline'); };
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();

    expect(gravado.criados.length + gravado.atualizados.length).toBeGreaterThan(0);
    expect(gravado.toasts.some(([m]) => /sem os holerites anexados/.test(m))).toBe(true);
  });

  it('sem sessão não tenta anexar nada', async () => {
    const storage = storageFake();
    const { mod } = await montar({
      linhas: DUAS_PAGINAS, comSessao: false,
      folhaCompetencia: { upsertEmLote: async (l) => l },
      storage, pdfLib: pdfLibFake(),
    });
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    expect(storage.enviados).toHaveLength(0);
  });

  it('página fora do arquivo é descartada em vez de recortar errado', async () => {
    const storage = storageFake();
    const { mod } = await comAnexo({ storage, pdfLib: pdfLibFake({ paginas: 1 }) });
    await mod.lerArquivo(pdfFalso());
    await mod.confirmar();
    // Só a primeira pessoa está dentro do arquivo de 1 página.
    expect(storage.enviados.map(e => e.path)).toEqual(['2026-09/1.pdf']);
  });
});
