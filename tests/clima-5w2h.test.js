import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { classificarDimensao, pedePlanoDeAcao, CAMPOS_5W2H } from '../src/utils/clima.js';

// O gráfico de dimensões da pesquisa de clima sempre diagnosticou: verde o que
// está na meta, amarelo o que está abaixo, vermelho o que está ruim. Só isso.
// Dimensão amarela ano após ano é o retrato de um diagnóstico que nunca virou
// ação — e, quando o RH apresenta o resultado, a primeira pergunta da
// diretoria é o que vai ser feito.
//
// Agora clicar na barra fora da meta abre a folha 5W2H daquela dimensão,
// presa à pesquisa que a originou: é a comparação com a pesquisa seguinte que
// diz se a ação funcionou.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const trecho = (abre, fecha, de = 0) => {
  const ini = html.indexOf(abre, de);
  return html.slice(ini, html.indexOf(fecha, ini));
};
const VIEW  = trecho('<div id="view-clima"', '<!-- ════════════');
const MODAL = trecho('<div id="modal-5w2h"', '<!-- ════════════');
const MODAL_CLIMA = trecho('<div id="modal-clima"', '<!-- ════════════');

// Distribuições escolhidas para dar nota redonda: nota = ((média − 1) / 4) × 10.
const resp = { oito5: [0, 0, 0, 6, 4], sete: [0, 0, 2, 8, 0], cinco: [0, 0, 10, 0, 0] };
const pergunta = (chave, dimensao, respostas) => ({ chave, dimensao, texto: chave, respostas });

const PESQUISA = {
  id: 3, titulo: 'Pesquisa de Clima 2026', inicio: '2026-03-01', fim: '2026-03-20',
  convidados: 40, responderam: 30,
  perguntas: [
    pergunta('ambiente_respeitoso', 'ambiente', resp.oito5),
    pergunta('trabalho_reconhecido', 'reconhecimento', resp.sete),
    pergunta('aprender_crescer', 'carreira', resp.cinco),
  ],
};

// Só três dimensões foram respondidas, então o gráfico tem três barras:
// ambiente (8,5 · verde), reconhecimento (7,0 · amarelo), carreira (5,0 ·
// vermelho) — nessa ordem, a de DIMENSOES.
const AMBIENTE = 0, RECONHECIMENTO = 1, CARREIRA = 2;

let graficos;

async function montar({ planos = [], pesquisas = [PESQUISA] } = {}) {
  const dom = new JSDOM(`<body><div id="page-feedback-clima">${VIEW}</div>${MODAL}${MODAL_CLIMA}</body>`);
  global.window = dom.window;
  global.document = dom.window.document;
  global.FormData = dom.window.FormData;
  const doc = dom.window.document;

  // Chart.js não roda no jsdom; o dublê guarda a configuração para que o teste
  // possa disparar o onClick como o navegador faria.
  graficos = [];
  global.Chart = class {
    constructor(ctx, cfg) { graficos.push(cfg); }
    destroy() {}
  };

  const toasts = [];
  const { FeedbackClimaModule } = await import('../src/modules/feedback.js');
  const mod = new FeedbackClimaModule({
    $: (s) => doc.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (d) => (d ? d.split('-').reverse().join('/') : '—'),
    COLABORADORES: [], FEEDBACK: [],
    CLIMA: pesquisas, PLANO_CLIMA: planos,
    POLITICAS: [], PROCEDIMENTOS: [],
    CHART_COLORS: { grid: '#eee', phthalo: '#123E6B', phthaloBright: '#2E7AB8' },
    Auth: { sessaoAtual: async () => null },
    FeedbackClima: null, PoliticasEmpresa: null, ProcedimentosEmpresa: null,
    StorageDocs: null, RespostasPesquisa: null,
    showToast: (m, t) => toasts.push([m, t]),
  });
  return { mod, doc, toasts, planos };
}

// O gráfico de dimensões é o segundo criado pelo renderClima (o primeiro é a
// evolução do score).
const grafDims = () => graficos[graficos.length - 1];
const clicarNaBarra = (indice) =>
  grafDims().options.onClick({ native: { target: { style: {} } } }, [{ index: indice }]);
const aberto = (doc) => doc.querySelector('#modal-5w2h').classList.contains('active');
const campo  = (doc, nome) => doc.querySelector(`#form-5w2h [name="${nome}"]`);

beforeEach(() => { graficos = []; });

describe('a classificação da dimensão', () => {
  it('7,5 ou mais está na meta; abaixo disso pede plano', () => {
    expect(classificarDimensao(8.5).chave).toBe('meta');
    expect(classificarDimensao(7.5).chave).toBe('meta');
    expect(classificarDimensao(7.49).chave).toBe('atencao');
    expect(classificarDimensao(6).chave).toBe('atencao');
    expect(classificarDimensao(5.99).chave).toBe('critico');
  });

  it('amarelo E vermelho pedem plano — vermelho é o amarelo que piorou', () => {
    expect(pedePlanoDeAcao(8.5)).toBe(false);
    expect(pedePlanoDeAcao(7.0)).toBe(true);
    expect(pedePlanoDeAcao(5.0)).toBe(true);
  });

  it('sem nota não há classificação', () => {
    expect(classificarDimensao(null)).toBe(null);
    expect(pedePlanoDeAcao(undefined)).toBe(false);
  });

  it('a cor da barra sai da mesma regra que decide o plano', async () => {
    const { mod } = await montar();
    mod.renderClima();
    const cores = grafDims().data.datasets[0].backgroundColor;
    expect(cores[AMBIENTE]).toBe('#10B981');
    expect(cores[RECONHECIMENTO]).toBe('#F59E0B');
    expect(cores[CARREIRA]).toBe('#EF4444');
  });
});

describe('clicar na barra', () => {
  it('a barra amarela abre o 5W2H daquela dimensão', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);

    expect(aberto(doc)).toBe(true);
    expect(campo(doc, 'dimensao').value).toBe('reconhecimento');
    expect(campo(doc, 'pesquisa_id').value).toBe('3');
    expect(doc.querySelector('#w2h-modal-title').textContent).toContain('Reconhecimento');
  });

  it('a barra vermelha também abre', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    clicarNaBarra(CARREIRA);
    expect(campo(doc, 'dimensao').value).toBe('carreira');
  });

  it('o índice do clique aponta para a dimensão desenhada, não para a lista inteira', async () => {
    // Só três dimensões foram respondidas. Se o clique olhasse DIMENSOES
    // inteira, o índice 1 seria "Liderança" — que nem está no gráfico. O RH
    // abriria o plano da dimensão errada, e nada avisaria.
    const { mod, doc } = await montar();
    mod.renderClima();
    expect(grafDims().data.labels).toEqual(['Ambiente e respeito', 'Reconhecimento', 'Carreira']);
    clicarNaBarra(RECONHECIMENTO);
    expect(campo(doc, 'dimensao').value).toBe('reconhecimento');
  });

  it('a barra verde não abre plano novo — explica por quê', async () => {
    const { mod, doc, toasts } = await montar();
    mod.renderClima();
    clicarNaBarra(AMBIENTE);

    expect(aberto(doc)).toBe(false);
    expect(toasts[0][0]).toContain('na meta');
    expect(toasts[0][0]).toContain('8,5');
  });

  it('mas a barra verde COM plano salvo abre o que existe', async () => {
    // Senão o plano some da tela justamente quando a ação deu certo.
    const { mod, doc } = await montar({
      planos: [{ id: 1, pesquisa_id: 3, dimensao: 'ambiente', o_que: 'Rodada de conversas', status: 'concluido' }],
    });
    mod.renderClima();
    clicarNaBarra(AMBIENTE);
    expect(aberto(doc)).toBe(true);
    expect(campo(doc, 'o_que').value).toBe('Rodada de conversas');
  });

  it('clique fora de qualquer barra não faz nada', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    grafDims().options.onClick({ native: { target: { style: {} } } }, []);
    expect(aberto(doc)).toBe(false);
  });
});

describe('a folha 5W2H', () => {
  it('tem os sete campos do método, com a palavra em inglês', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);

    CAMPOS_5W2H.forEach(c => {
      expect(campo(doc, c.campo), `campo ${c.campo}`).toBeTruthy();
    });
    const texto = doc.querySelector('#w2h-campos').textContent;
    ['What', 'Why', 'Where', 'When', 'Who', 'How', 'How much'].forEach(w => {
      expect(texto).toContain(w);
    });
  });

  it('guarda a nota de onde o plano partiu', async () => {
    // A pesquisa pode ser reaberta e recalculada; o plano precisa dizer de que
    // número partiu, senão a comparação com a pesquisa seguinte não fecha.
    const { mod, doc } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    expect(Number(campo(doc, 'nota_origem').value)).toBeCloseTo(7, 2);
  });

  it('o subtítulo diz a pesquisa, a nota e a classificação', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    clicarNaBarra(CARREIRA);
    const sub = doc.querySelector('#w2h-modal-sub').textContent;
    expect(sub).toContain('Pesquisa de Clima 2026');
    expect(sub).toContain('5,0');
    expect(sub).toContain('Crítico');
  });

  it('plano novo não oferece excluir; plano salvo oferece', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    expect(doc.querySelector('#btn-5w2h-excluir').style.display).toBe('none');

    const comPlano = await montar({
      planos: [{ id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', o_que: 'x', status: 'pendente' }],
    });
    comPlano.mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    expect(comPlano.doc.querySelector('#btn-5w2h-excluir').style.display).not.toBe('none');
  });

  it('abrir de novo traz o que estava salvo, campo a campo', async () => {
    const { mod, doc } = await montar({
      planos: [{
        id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', nota_origem: 7,
        o_que: 'Programa de reconhecimento mensal',
        por_que: 'Dimensão em 7,0 na pesquisa',
        onde: 'Produção', quando: '2026-06-30', quem: 'Maycon',
        como: 'Indicação entre pares', quanto: 1200, status: 'andamento',
      }],
    });
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);

    expect(campo(doc, 'o_que').value).toBe('Programa de reconhecimento mensal');
    expect(campo(doc, 'onde').value).toBe('Produção');
    expect(campo(doc, 'quando').value).toBe('2026-06-30');
    expect(campo(doc, 'quem').value).toBe('Maycon');
    expect(campo(doc, 'quanto').value).toBe('1200');
    expect(campo(doc, 'status').value).toBe('andamento');
    expect(campo(doc, 'id').value).toBe('4');
  });
});

describe('salvar o plano', () => {
  const preencher = (doc, valores) => {
    Object.entries(valores).forEach(([k, v]) => { campo(doc, k).value = v; });
  };

  it('grava os sete campos, presos à pesquisa e à dimensão', async () => {
    const { mod, doc, planos } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    preencher(doc, {
      o_que: 'Programa de reconhecimento mensal', por_que: 'Nota 7,0',
      onde: 'Produção', quando: '2026-06-30', quem: 'Maycon',
      como: 'Indicação entre pares', quanto: '1200', status: 'andamento',
    });
    await mod.salvarPlanoClima({ preventDefault() {} });

    expect(planos).toHaveLength(1);
    expect(planos[0]).toMatchObject({
      pesquisa_id: 3, dimensao: 'reconhecimento',
      o_que: 'Programa de reconhecimento mensal', onde: 'Produção',
      quando: '2026-06-30', quem: 'Maycon', quanto: 1200, status: 'andamento',
    });
  });

  it('sem "o quê" não salva — é o campo que define a ação', async () => {
    const { mod, doc, toasts, planos } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    preencher(doc, { o_que: '   ', quem: 'Maycon' });
    await mod.salvarPlanoClima({ preventDefault() {} });

    expect(planos).toHaveLength(0);
    expect(toasts.at(-1)[1]).toBe('err');
  });

  it('campo vazio vira null, não string vazia', async () => {
    const { mod, doc, planos } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    preencher(doc, { o_que: 'Conversar com a liderança' });
    await mod.salvarPlanoClima({ preventDefault() {} });

    expect(planos[0].quem).toBe(null);
    expect(planos[0].quanto).toBe(null);
    expect(planos[0].quando).toBe(null);
  });

  it('concluído sem data recebe a data de hoje', async () => {
    // Concluído sem data é o que faz a diretoria perguntar "quando?".
    const { mod, doc, planos } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    preencher(doc, { o_que: 'Feito', status: 'concluido' });
    await mod.salvarPlanoClima({ preventDefault() {} });

    expect(planos[0].conclusao).toBe(new Date().toISOString().slice(0, 10));
  });

  it('salvar de novo atualiza o mesmo plano, não cria outro', async () => {
    const { mod, doc, planos } = await montar({
      planos: [{ id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', o_que: 'Antigo', status: 'pendente' }],
    });
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    preencher(doc, { o_que: 'Novo texto' });
    await mod.salvarPlanoClima({ preventDefault() {} });

    expect(planos).toHaveLength(1);
    expect(planos[0].o_que).toBe('Novo texto');
    expect(planos[0].id).toBe(4);
  });
});

describe('a lista de planos da pesquisa', () => {
  const linhas = (doc) => [...doc.querySelectorAll('#tb-cl-planos tr')];

  it('mostra os planos da última pesquisa', async () => {
    const { mod, doc } = await montar({
      planos: [{
        id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', nota_origem: 7,
        o_que: 'Programa de reconhecimento', quem: 'Maycon',
        quando: '2026-06-30', quanto: 1200, status: 'andamento',
      }],
    });
    mod.renderClima();

    const linha = linhas(doc)[0].textContent;
    expect(linha).toContain('Reconhecimento');
    expect(linha).toContain('nota 7,0');
    expect(linha).toContain('Programa de reconhecimento');
    expect(linha).toContain('Maycon');
    expect(linha).toContain('30/06/2026');
    expect(linha).toContain('1200,00');
    expect(linha).toContain('Em andamento');
  });

  it('plano de outra pesquisa não aparece', async () => {
    const { mod, doc } = await montar({
      planos: [{ id: 9, pesquisa_id: 99, dimensao: 'carreira', o_que: 'De outra pesquisa', status: 'pendente' }],
    });
    mod.renderClima();
    expect(doc.querySelector('#tb-cl-planos').textContent).not.toContain('De outra pesquisa');
    expect(doc.querySelector('#tb-cl-planos').textContent).toContain('Nenhum plano');
  });

  it('a dica embaixo do gráfico conta quantas dimensões pedem plano', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    const dica = doc.querySelector('#cl-dica-plano').textContent;
    expect(dica).toContain('2');
    expect(dica).toContain('abaixo de 7,5');
  });

  it('sem pesquisa nenhuma, a lista explica em vez de ficar vazia', async () => {
    const { mod, doc } = await montar({ pesquisas: [] });
    mod.renderClima();
    expect(doc.querySelector('#tb-cl-planos').textContent).toContain('Nenhuma pesquisa');
  });

  it('excluir tira o plano da lista', async () => {
    const { mod, doc, planos } = await montar({
      planos: [{ id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', o_que: 'Sai', status: 'pendente' }],
    });
    global.confirm = () => true;
    mod.renderClima();
    await mod.excluirPlanoClima(4);

    expect(planos).toHaveLength(0);
    expect(doc.querySelector('#tb-cl-planos').textContent).toContain('Nenhum plano');
  });

  it('desistir da exclusão mantém o plano', async () => {
    const { mod, planos } = await montar({
      planos: [{ id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', o_que: 'Fica', status: 'pendente' }],
    });
    global.confirm = () => false;
    mod.renderClima();
    await mod.excluirPlanoClima(4);
    expect(planos).toHaveLength(1);
  });
});

// ─── A automação ────────────────────────────────────────────────────────────
//
// Três coisas o sistema faz sozinho, e uma que ele não faz de propósito:
//
//  1. Escreve o "por quê" — é transcrição dos números, não julgamento.
//  2. Abre um rascunho por dimensão fora da meta quando a pesquisa é salva.
//  3. Mostra como a dimensão saiu na pesquisa seguinte.
//
// O "o quê" e o "como" continuam em branco: o valor do 5W2H está em alguém
// digitar "eu, até março", e plano que se escreve sozinho vira ritual sem
// dono — que é justamente o que faz a nota cair.

const ANTERIOR = {
  id: 1, titulo: 'Pesquisa 2025', inicio: '2025-10-01', fim: '2025-10-20',
  convidados: 30, responderam: 25,
  perguntas: [pergunta('trabalho_reconhecido', 'reconhecimento', [0, 0, 10, 0, 0])], // 5,0
};
const SEGUINTE = {
  id: 7, titulo: 'Pesquisa 2027', inicio: '2027-10-01', fim: '2027-10-20',
  convidados: 30, responderam: 25,
  perguntas: [pergunta('trabalho_reconhecido', 'reconhecimento', [0, 0, 0, 6, 4])], // 8,5
};

describe('o "por quê" se escreve sozinho', () => {
  it('traz nota, meta, posição entre as dimensões e a distribuição', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);

    const txt = campo(doc, 'por_que').value;
    expect(txt).toContain('Reconhecimento ficou em 7,0');
    expect(txt).toContain('abaixo da meta de 7,5');
    expect(txt).toContain('score geral');
    expect(txt).toContain('10 resposta');
  });

  it('diz quando a dimensão é a única fora da meta', async () => {
    const sozinha = {
      ...PESQUISA, id: 11,
      perguntas: [
        pergunta('ambiente_respeitoso', 'ambiente', resp.oito5),
        pergunta('trabalho_reconhecido', 'reconhecimento', resp.sete),
      ],
    };
    const { mod, doc } = await montar({ pesquisas: [sozinha] });
    mod.renderClima();
    clicarNaBarra(1);
    expect(campo(doc, 'por_que').value).toContain('única dimensão fora da meta');
  });

  it('compara com a pesquisa anterior quando existe', async () => {
    const { mod, doc } = await montar({ pesquisas: [PESQUISA, ANTERIOR] });
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    const txt = campo(doc, 'por_que').value;
    expect(txt).toContain('Estava em 5,0 na pesquisa anterior');
    expect(txt).toContain('+2,0');
  });

  it('não sobrescreve o que a pessoa escreveu', async () => {
    const { mod, doc } = await montar({
      planos: [{
        id: 4, pesquisa_id: 3, dimensao: 'reconhecimento',
        o_que: 'x', por_que: 'Escrevi à mão', status: 'pendente',
      }],
    });
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    expect(campo(doc, 'por_que').value).toBe('Escrevi à mão');
  });
});

describe('o rascunho nasce com a pesquisa', () => {
  const salvarPesquisa = async (mod, doc) => {
    mod.abrirModalClima(PESQUISA.id);
    // O formulário monta as perguntas a partir da pesquisa aberta; salvar sem
    // tocar em nada é o caso real de "revisei e gravei".
    await mod.salvarClima({ preventDefault() {} });
    return doc;
  };

  it('abre um rascunho por dimensão fora da meta', async () => {
    const { mod, doc, planos } = await montar();
    await salvarPesquisa(mod, doc);

    expect(planos).toHaveLength(2);
    expect(planos.map(p => p.dimensao).sort()).toEqual(['carreira', 'reconhecimento']);
    expect(planos.every(p => p.status === 'rascunho')).toBe(true);
  });

  it('o rascunho já vem com o "por quê" e a nota de origem', async () => {
    const { mod, doc, planos } = await montar();
    await salvarPesquisa(mod, doc);

    const rec = planos.find(p => p.dimensao === 'reconhecimento');
    expect(rec.por_que).toContain('Reconhecimento ficou em 7,0');
    expect(rec.nota_origem).toBeCloseTo(7, 2);
  });

  it('o "o quê" fica vazio — a ação é de quem assume', async () => {
    const { mod, doc, planos } = await montar();
    await salvarPesquisa(mod, doc);
    expect(planos.every(p => !p.o_que)).toBe(true);
  });

  it('dimensão na meta não ganha rascunho', async () => {
    const { mod, doc, planos } = await montar();
    await salvarPesquisa(mod, doc);
    expect(planos.find(p => p.dimensao === 'ambiente')).toBeUndefined();
  });

  it('salvar de novo não duplica nem apaga o que já foi escrito', async () => {
    const { mod, doc, planos } = await montar({
      planos: [{
        id: 4, pesquisa_id: 3, dimensao: 'reconhecimento',
        o_que: 'Ritual mensal', quem: 'Maycon', status: 'andamento',
      }],
    });
    await salvarPesquisa(mod, doc);

    expect(planos).toHaveLength(2);                    // só a carreira entrou
    expect(planos[0].o_que).toBe('Ritual mensal');
    expect(planos[0].status).toBe('andamento');
  });

  it('o rascunho aparece na lista marcado, sem ação definida', async () => {
    const { mod, doc } = await montar();
    await salvarPesquisa(mod, doc);
    mod.renderClima();

    const corpo = doc.querySelector('#tb-cl-planos').textContent;
    expect(corpo).toContain('Rascunho');
    expect(corpo).toContain('a definir');
  });
});

describe('rascunho e dono', () => {
  it('rascunho salva sem "o quê" — é o que o sistema abriu', async () => {
    const { mod, doc, planos } = await montar({
      planos: [{ id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', o_que: null, status: 'rascunho' }],
    });
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    campo(doc, 'status').value = 'rascunho';
    await mod.salvarPlanoClima({ preventDefault() {} });
    expect(planos).toHaveLength(1);
  });

  it('tirar do rascunho exige a ação escrita', async () => {
    const { mod, doc, toasts } = await montar({
      planos: [{ id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', o_que: null, status: 'rascunho' }],
    });
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    campo(doc, 'status').value = 'pendente';
    await mod.salvarPlanoClima({ preventDefault() {} });
    expect(toasts.at(-1)[1]).toBe('err');
  });

  it('abrir a folha à mão já começa em pendente, não em rascunho', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    expect(campo(doc, 'status').value).toBe('pendente');
  });
});

describe('sugestões de ação', () => {
  it('aparecem ao lado do "o quê" e do "como", nunca dentro', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);

    expect(campo(doc, 'o_que').value).toBe('');
    const chips = [...doc.querySelectorAll('.w2h-sugestao')];
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.map(c => c.dataset.w2hCampo)).toContain('o_que');
    expect(chips.map(c => c.dataset.w2hCampo)).toContain('como');
  });

  it('são as da dimensão aberta', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    const texto = doc.querySelector('#w2h-campos').textContent;
    expect(texto).toContain('Ritual mensal de reconhecimento');
    expect(texto).not.toContain('Treinamento de liderança');
  });

  it('clicar numa sugestão escreve no campo', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    const chip = doc.querySelector('.w2h-sugestao[data-w2h-campo="o_que"]');
    chip.dispatchEvent(new doc.defaultView.MouseEvent('click', { bubbles: true }));
    expect(campo(doc, 'o_que').value).toBe(chip.dataset.w2hTexto);
  });

  it('uma segunda sugestão soma, não substitui', async () => {
    const { mod, doc } = await montar();
    mod.renderClima();
    clicarNaBarra(RECONHECIMENTO);
    const chips = [...doc.querySelectorAll('.w2h-sugestao[data-w2h-campo="como"]')];
    chips[0].dispatchEvent(new doc.defaultView.MouseEvent('click', { bubbles: true }));
    chips[1].dispatchEvent(new doc.defaultView.MouseEvent('click', { bubbles: true }));
    expect(campo(doc, 'como').value.split('\n')).toHaveLength(2);
  });
});

describe('o resultado na pesquisa seguinte', () => {
  it('mostra de quanto para quanto foi', async () => {
    const { mod, doc } = await montar({
      pesquisas: [SEGUINTE, PESQUISA],
      planos: [{
        id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', nota_origem: 7,
        o_que: 'Ritual mensal', status: 'concluido',
      }],
    });
    // A lista é da ÚLTIMA pesquisa; o plano é da anterior, então renderizo a
    // lista da pesquisa que o originou.
    mod._renderPlanosClima(PESQUISA);
    expect(doc.querySelector('#tb-cl-planos').textContent).toContain('7,0 → 8,5');
  });

  it('sem pesquisa seguinte, diz que está aguardando', async () => {
    const { mod, doc } = await montar({
      planos: [{ id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', o_que: 'x', status: 'pendente' }],
    });
    mod.renderClima();
    expect(doc.querySelector('#tb-cl-planos').textContent).toContain('aguarda a próxima pesquisa');
  });
});

describe('cobrança de prazo', () => {
  const ontem = (dias) => {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d.toISOString().slice(0, 10);
  };

  it('plano com prazo vencido e não concluído está atrasado', async () => {
    const { mod, doc } = await montar({
      planos: [{
        id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', o_que: 'Atrasou',
        quando: ontem(5), status: 'pendente',
      }],
    });
    mod.renderClima();
    expect(doc.querySelector('#tb-cl-planos').textContent).toContain('atrasado');
  });

  it('concluído no prazo ou não, não é cobrado', async () => {
    const { mod, doc } = await montar({
      planos: [{
        id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', o_que: 'Feito',
        quando: ontem(5), status: 'concluido', conclusao: ontem(6),
      }],
    });
    mod.renderClima();
    expect(doc.querySelector('#tb-cl-planos').textContent).not.toContain('atrasado');
  });

  it('rascunho não é cobrado — o que falta ali é dono, não prazo', async () => {
    const { mod, doc } = await montar({
      planos: [{
        id: 4, pesquisa_id: 3, dimensao: 'reconhecimento', o_que: null,
        quando: ontem(5), status: 'rascunho',
      }],
    });
    mod.renderClima();
    expect(doc.querySelector('#tb-cl-planos').textContent).not.toContain('atrasado');
  });
});
