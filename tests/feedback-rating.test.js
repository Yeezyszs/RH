import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FeedbackClimaModule } from '../src/modules/feedback.js';

// Regressão: ao editar um feedback, o código chamava `setRating(...)` — uma
// função que não existia em lugar nenhum. Como a chamada estava protegida por
// `typeof setRating === 'function'`, nada quebrava: as estrelas simplesmente
// não reacendiam, e o formulário passava a mentir sobre o próprio estado.
// O ESLint (no-undef) foi quem apontou. Estes testes seguram a correção.

// DOM mínimo: só o suficiente para observar o que o método altera.
function montarDom(campo, valores = [1, 2, 3, 4, 5]) {
  const botoes = valores.map(v => ({
    dataset: { ratingVal: String(v) },
    classes: new Set(),
    classList: {
      toggle(nome, ligar) { ligar ? this._o.classes.add(nome) : this._o.classes.delete(nome); },
      remove(nome) { this._o.classes.delete(nome); },
    },
  }));
  botoes.forEach(b => { b.classList._o = b; });

  const input = { value: '' };
  const grupo = { querySelectorAll: () => botoes };

  globalThis.document = {
    addEventListener() {},
    querySelectorAll: () => [],
    querySelector(sel) {
      if (sel.includes('rating-input')) return sel.includes(campo) ? grupo : null;
      if (sel.includes(`[name="${campo}"]`)) return input;
      return null;
    },
  };
  return { botoes, input, ativos: () => botoes.filter(b => b.classes.has('active')) };
}

function novoModulo() {
  return new FeedbackClimaModule({
    $: () => null,
    h: (s) => s,
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (s) => s,
    COLABORADORES: [], FEEDBACK: [], CLIMA: [], POLITICAS: [], PROCEDIMENTOS: [],
    CHART_COLORS: { grid: '#eee' },
    showToast: () => {},
  });
}

describe('feedback — _setRating reacende as estrelas na edição', () => {
  let dom, mod;

  beforeEach(() => {
    dom = montarDom('nota_entrega');
    mod = novoModulo();
  });

  afterEach(() => { delete globalThis.document; });

  it('marca como ativo apenas o botão da nota', () => {
    mod._setRating('nota_entrega', 4);
    const ativos = dom.ativos();
    expect(ativos).toHaveLength(1);
    expect(ativos[0].dataset.ratingVal).toBe('4');
  });

  it('grava o valor no campo do formulário', () => {
    mod._setRating('nota_entrega', 3);
    expect(dom.input.value).toBe(3);
  });

  it('nota máxima e mínima também acendem', () => {
    mod._setRating('nota_entrega', 5);
    expect(dom.ativos()[0].dataset.ratingVal).toBe('5');
    mod._setRating('nota_entrega', 1);
    expect(dom.ativos()[0].dataset.ratingVal).toBe('1');
  });

  it('trocar a nota apaga a anterior', () => {
    mod._setRating('nota_entrega', 2);
    mod._setRating('nota_entrega', 5);
    const ativos = dom.ativos();
    expect(ativos).toHaveLength(1);
    expect(ativos[0].dataset.ratingVal).toBe('5');
  });

  it('sem nota não mexe em nada (feedback novo)', () => {
    mod._setRating('nota_entrega', 0);
    expect(dom.ativos()).toHaveLength(0);
    expect(dom.input.value).toBe('');
  });

  it('não quebra quando o campo não existe na tela', () => {
    expect(() => mod._setRating('campo_inexistente', 3)).not.toThrow();
  });
});
