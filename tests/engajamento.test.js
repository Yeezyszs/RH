import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ITENS_ENGAJAMENTO, PONTUACAO_MAXIMA, NOTA_MAXIMA,
  pontuacao, consolidar, classificar, notasDe, pctBR,
} from '../src/utils/engajamento.js';

// O formulário impresso traz um exemplo conferido à mão: 11 itens com nota 2
// somam 22, dão 66,7% e classificam como "Satisfatório". Esse caso é o
// gabarito — se ele quebrar, a conta do sistema deixou de ser a da empresa.

const notas = (arr) => ({ itens: arr.map(n => ({ nota: n })) });
const todos = (n) => notas(Array(11).fill(n));

describe('pontuação — o gabarito do formulário impresso', () => {
  it('11 itens com nota 2 somam 22 de 33 e dão 66,7% satisfatório', () => {
    const p = pontuacao(todos(2));
    expect(p.soma).toBe(22);
    expect(p.maximo).toBe(33);
    expect(pctBR(p.percentual)).toBe('66,7%');
    expect(p.rotulo).toBe('Satisfatório');
  });

  it('o formulário tem 11 itens e máximo 33', () => {
    expect(ITENS_ENGAJAMENTO).toHaveLength(11);
    expect(PONTUACAO_MAXIMA).toBe(33);
    expect(NOTA_MAXIMA).toBe(3);
  });

  it('nota máxima em tudo é 100% excelente', () => {
    const p = pontuacao(todos(3));
    expect(p.soma).toBe(33);
    expect(p.percentual).toBe(100);
    expect(p.rotulo).toBe('Excelente');
  });

  it('nota mínima em tudo é 33,3% insatisfatório', () => {
    const p = pontuacao(todos(1));
    expect(p.soma).toBe(11);
    expect(p.rotulo).toBe('Insatisfatório');
  });
});

describe('faixas de classificação', () => {
  // As bordas são o que o formulário define e o que erra na implementação
  // ingênua: 50% já é satisfatório e 70% já é excelente.
  it('49,9% é insatisfatório e 50% é satisfatório', () => {
    expect(classificar(49.9).rotulo).toBe('Insatisfatório');
    expect(classificar(50).rotulo).toBe('Satisfatório');
  });

  it('69,9% é satisfatório e 70% é excelente', () => {
    expect(classificar(69.9).rotulo).toBe('Satisfatório');
    expect(classificar(70).rotulo).toBe('Excelente');
  });
});

describe('itens sem nota', () => {
  it('não reduzem a pontuação máxima', () => {
    // Três itens nota 3 e o resto em branco: 9 de 33, não 9 de 9. Dividir só
    // pelos respondidos transformaria meio formulário em "Excelente".
    const p = pontuacao(notas([3, 3, 3, null, null, null, null, null, null, null, null]));
    expect(p.soma).toBe(9);
    expect(p.maximo).toBe(33);
    expect(p.rotulo).toBe('Insatisfatório');
    expect(p.completa).toBe(false);
    expect(p.respondidos).toBe(3);
  });

  it('nota fora da faixa é descartada, não somada', () => {
    expect(notasDe(notas([9, 2, 0, -1, 2, 2, 2, 2, 2, 2, 2]))[0]).toBeNull();
    expect(pontuacao(notas([9, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2])).soma).toBe(20);
  });

  it('avaliação vazia não quebra a conta', () => {
    expect(pontuacao({}).soma).toBe(0);
    expect(pontuacao(null).rotulo).toBe('Insatisfatório');
  });
});

describe('média entre gestor e RH', () => {
  // "O gestor e o responsável pelo RH devem avaliar separadamente e depois
  // tirar média das notas" — e a média é item a item, não entre os totais.
  it('tira a média item a item', () => {
    const gestor = todos(3);
    const rh = todos(1);
    const c = consolidar([gestor, rh]);
    expect(c.notas.every(n => n === 2)).toBe(true);
    expect(c.soma).toBe(22);
    expect(c.rotulo).toBe('Satisfatório');
    expect(c.avaliadores).toBe(2);
  });

  it('um item avaliado por um só dos dois mantém a nota dada', () => {
    // Pela média dos totais, um item respondido só pelo gestor valeria metade.
    const gestor = notas([3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
    const rh     = notas([null, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
    const c = consolidar([gestor, rh]);
    expect(c.notas[0]).toBe(3);
    expect(c.notas[1]).toBe(2);
  });

  it('com uma avaliação só, a nota é a dela', () => {
    const c = consolidar([todos(3)]);
    expect(c.soma).toBe(33);
    expect(c.avaliadores).toBe(1);
  });

  it('sem nenhuma avaliação devolve nulo em vez de zero', () => {
    expect(consolidar([])).toBeNull();
    expect(consolidar(null)).toBeNull();
  });
});

describe('o formulário público e o sistema contam igual', () => {
  // engajamento.html é servido solto, sem o bundle, então repete a lista de
  // itens e a regra de classificação. Duas cópias que precisam concordar:
  // este teste é o que impede que se separem com o tempo.
  const publico = readFileSync(new URL('../engajamento.html', import.meta.url), 'utf8');

  it('usa os mesmos 11 itens, na mesma ordem', () => {
    const bloco = publico.slice(publico.indexOf('const ITENS = ['), publico.indexOf('];', publico.indexOf('const ITENS = [')));
    ITENS_ENGAJAMENTO.forEach(item => {
      expect(bloco).toContain(item);
    });
    expect((bloco.match(/\n      '/g) || []).length).toBe(ITENS_ENGAJAMENTO.length);
  });

  it('usa as mesmas faixas de classificação', () => {
    expect(publico).toContain('pct >= 70');
    expect(publico).toContain('pct >= 50');
    expect(publico).toContain('Excelente');
    expect(publico).toContain('Satisfatório');
    expect(publico).toContain('Insatisfatório');
  });

  it('chama a RPC que valida no banco, não a tabela direto', () => {
    expect(publico).toContain("sb.rpc('engajamento_enviar'");
    expect(publico).toContain("sb.rpc('engajamento_colaboradores')");
    expect(publico).not.toContain("from('avaliacoes_engajamento')");
  });

  it('a página está fora dos buscadores', () => {
    expect(publico).toContain('name="robots" content="noindex"');
  });
});

describe('o link público chega ao ar', () => {
  // A página é servida solta, fora do SPA. O workflow de deploy copia os
  // arquivos avulsos um a um — esquecer esta linha publica um link que dá 404,
  // e isso só apareceria quando um gestor tentasse responder.
  it('o deploy copia engajamento.html para o site', () => {
    const deploy = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
    expect(deploy).toContain('cp engajamento.html _site/');
  });
});
