import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// A conversa de feedback termina em papel assinado pelos dois lados. A mesma
// folha precisa servir nos dois momentos: preenchida, saindo de um registro
// salvo, e EM BRANCO, para o gestor levar à conversa e escrever à mão. É por
// isso que campo vazio vira linha pautada em vez de sumir — uma ficha que some
// com o que não foi digitado não serve para ser preenchida no papel.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const MODAL = (() => {
  const ini = html.indexOf('<div id="modal-feedback"');
  return html.slice(ini, html.indexOf('<!-- ════════════', ini));
})();

const PESSOAS = [
  { id: 1, nome: 'Adão Ribeiro', setor: 'Produção', status: 'ativo' },
  { id: 2, nome: 'Beatriz Nunes', setor: 'Administrativo', status: 'ativo' },
];

const FEEDBACK = [{
  id: 7, colaborador_id: 1, avaliador: 'Maycon', data: '2026-11-13',
  nota_entrega: 4, nota_comportamento: 5, nota_colaboracao: 3,
  pontos_fortes: 'Pontual e atento à segurança.',
  pontos_desenvolver: 'Precisa documentar as paradas de forno.',
  plano_acao: 'Treinamento de registro em dezembro.',
}];

function montar({ feedback = FEEDBACK } = {}) {
  const dom = new JSDOM(`<body>${MODAL}</body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  global.FormData = dom.window.FormData;
  const doc = dom.window.document;

  // Captura o documento em vez de abrir janela.
  const impressos = [];
  dom.window.imprimirDocumento = (titulo, corpo, opcoes) => impressos.push({ titulo, corpo, opcoes });

  const { FeedbackClimaModule } = require('../src/modules/feedback.js');
  const mod = new FeedbackClimaModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (d) => (d ? d.split('-').reverse().join('/') : ''),
    COLABORADORES: PESSOAS,
    FEEDBACK: feedback,
    CLIMA: [], POLITICAS: [], PROCEDIMENTOS: [],
    CHART_COLORS: { grid: '#eee', phthalo: '#123E6B' },
    Auth: { sessaoAtual: async () => null },
    FeedbackClima: null, PoliticasEmpresa: null, ProcedimentosEmpresa: null,
    StorageDocs: null, RespostasPesquisa: null,
    showToast: () => {},
  });
  return { mod, doc, impressos };
}

const marcadas = (corpo) => (corpo.match(/<i class="on">/g) || []).length;
const linhasPautadas = (corpo) => (corpo.match(/fb-doc-linha/g) || []).length;

describe('ficha de feedback preenchida', () => {
  it('sai com identificação, notas e textos', () => {
    const { mod, impressos } = montar();
    mod.imprimirFeedback(7);

    expect(impressos).toHaveLength(1);
    const { titulo, corpo } = impressos[0];
    expect(titulo).toContain('Adão Ribeiro');
    expect(corpo).toContain('Produção');
    expect(corpo).toContain('Maycon');
    expect(corpo).toContain('13/11/2026');
    expect(corpo).toContain('Pontual e atento à segurança.');
    expect(corpo).toContain('Precisa documentar as paradas de forno.');
    expect(corpo).toContain('Treinamento de registro em dezembro.');
  });

  it('marca exatamente a nota dada em cada escala', () => {
    const { mod, impressos } = montar();
    mod.imprimirFeedback(7);
    // Três escalas, uma bolinha marcada em cada.
    expect(marcadas(impressos[0].corpo)).toBe(3);

    // E é a bolinha certa: a primeira escala é 4 de 5.
    const primeira = impressos[0].corpo.slice(impressos[0].corpo.indexOf('Entrega'));
    const escala = primeira.slice(0, primeira.indexOf('</div>', primeira.indexOf('fb-doc-escala')));
    expect(escala).toContain('<i class="on">4</i>');
    expect(escala).not.toContain('<i class="on">5</i>');
  });

  it('tem as duas linhas de assinatura', () => {
    const { mod, impressos } = montar();
    mod.imprimirFeedback(7);
    expect(impressos[0].corpo).toContain('Assinatura do colaborador');
    expect(impressos[0].corpo).toContain('Assinatura do avaliador');
  });

  it('o rodapé lembra que são duas vias', () => {
    const { mod, impressos } = montar();
    mod.imprimirFeedback(7);
    expect(impressos[0].opcoes.rodape).toContain('uma via para o colaborador');
  });

  it('campo não preenchido vira linha para escrever, não some', () => {
    const { mod, impressos } = montar({
      feedback: [{ ...FEEDBACK[0], plano_acao: '' }],
    });
    mod.imprimirFeedback(7);
    const corpo = impressos[0].corpo;
    expect(corpo).toContain('Plano de ação');
    expect(linhasPautadas(corpo)).toBeGreaterThan(0);
  });

  it('feedback inexistente não imprime nada', () => {
    const { mod, impressos } = montar();
    mod.imprimirFeedback(999);
    expect(impressos).toHaveLength(0);
  });
});

describe('ficha em branco, para preencher à mão', () => {
  const abrirFormulario = (preencher = () => {}) => {
    const r = montar();
    r.mod.abrirModalFeedback();
    const form = r.doc.querySelector('#form-feedback');
    // O select de colaboradores é montado pelo módulo; escolhe o primeiro.
    form.elements['colaborador_id'].value = '1';
    preencher(form);
    r.mod.imprimirFormularioFeedback();
    return r;
  };

  it('imprime sem precisar salvar — a conversa ainda nem aconteceu', () => {
    const { impressos } = abrirFormulario();
    expect(impressos).toHaveLength(1);
    expect(impressos[0].titulo).toContain('Adão Ribeiro');
  });

  it('em branco, as três escalas saem sem marca e os textos viram pauta', () => {
    const { impressos } = abrirFormulario();
    const corpo = impressos[0].corpo;
    expect(marcadas(corpo)).toBe(0);
    // Três blocos de texto: 4 + 4 + 5 linhas.
    expect(linhasPautadas(corpo)).toBe(13);
    expect(corpo).toContain('Assinatura do colaborador');
  });

  it('o que já foi digitado na tela sai impresso', () => {
    const { impressos } = abrirFormulario((form) => {
      form.elements['avaliador'].value = 'Maycon';
      form.elements['nota_entrega'].value = '5';
      form.elements['pontos_fortes'].value = 'Assíduo.';
    });
    const corpo = impressos[0].corpo;
    expect(corpo).toContain('Maycon');
    expect(corpo).toContain('Assíduo.');
    expect(marcadas(corpo)).toBe(1);
  });

  it('sem colaborador escolhido ainda imprime a folha, só sem o nome', () => {
    const { mod, doc, impressos } = montar();
    mod.abrirModalFeedback();
    doc.querySelector('#form-feedback').elements['colaborador_id'].value = '';
    mod.imprimirFormularioFeedback();

    expect(impressos).toHaveLength(1);
    expect(impressos[0].titulo).toBe('Ficha de Feedback');
    expect(linhasPautadas(impressos[0].corpo)).toBe(13);
  });
});

describe('ligação com a tela', () => {
  it('cada linha da lista tem o botão de imprimir', () => {
    const modulo = readFileSync(new URL('../src/modules/feedback.js', import.meta.url), 'utf8');
    expect(modulo).toContain('onclick="imprimirFeedback(${f.id})"');
  });

  it('o botão do modal chama a impressão do formulário', () => {
    expect(html).toContain('data-action="imprimirFormularioFeedback"');
  });

  it('o gerador de documento é o mesmo do resto do sistema', () => {
    // Dois geradores seriam duas papeladas diferentes saindo da mesma empresa.
    const relatorio = readFileSync(new URL('../src/utils/relatorio.js', import.meta.url), 'utf8');
    expect(relatorio).toContain('window.imprimirDocumento');
    expect(relatorio).toContain('function imprimirDocumento');
  });

  it('não quebra quando a janela de impressão não está disponível', () => {
    const { mod } = montar();
    delete global.window.imprimirDocumento;
    expect(() => mod.imprimirFeedback(7)).not.toThrow();
  });
});

vi.useRealTimers();
