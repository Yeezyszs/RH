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
  const itens = linhas.map((s, i) => ({ str: s, transform: [1, 0, 0, 1, 10, 9000 - i * 20] }));
  return {
    getDocument: () => ({ promise: Promise.resolve({
      numPages: 1,
      getPage: () => Promise.resolve({ getTextContent: () => Promise.resolve({ items: itens }) }),
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

async function montar({ linhas = LINHAS, salarios = {}, config = {}, comSessao = true } = {}) {
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
    showToast: (m, t) => { gravado.toast = [m, t]; },
    carregarPdfJs: async () => pdfjsFake(linhas),
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

  it('avisa quando tudo já confere e não libera gravação', async () => {
    const { mod, doc } = await montar({
      salarios: { 1: { id: 7, valor: 3674.64 }, 2: { id: 8, valor: 2800 } },
    });
    await mod.lerArquivo(pdfFalso());
    expect(doc.querySelector('#folha-resultado').textContent).toMatch(/já conferem com o sistema/);
    expect(doc.querySelector('#btn-folha-confirmar').disabled).toBe(true);
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
