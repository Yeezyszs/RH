import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Lançar um vencimento de categoria "Treinamento" grava em
// `participantes_treinamento`, cuja coluna `treinamento_id` é obrigatória — e
// o código não a preenchia. Mesma família do erro que derrubou o feedback:
// o banco recusa, o RH vê uma mensagem crua e o registro não entra.
//
// A correção não foi afrouxar a chave estrangeira (participação sem
// treinamento não quer dizer nada), e sim encontrar-ou-criar o treinamento
// pelo nome que a tela já pede.

const api = readFileSync(new URL('../src/api/compliance.js', import.meta.url), 'utf8');

describe('vencimento de treinamento', () => {
  it('a participação é gravada com o treinamento ligado', () => {
    const bloco = api.slice(api.indexOf('async criar(payload)'),
      api.indexOf('participantes_treinamento', api.indexOf('async criar(payload)')));
    expect(bloco).toContain('treinamento_id');
    expect(bloco).toContain('_idDoTreinamento');
  });

  it('o id vem do nome do item lançado na tela', () => {
    expect(api).toContain('_idDoTreinamento(payload.tipo)');
  });

  it('encontra o treinamento existente antes de criar outro', () => {
    // Sem isto, cada vencimento de "NR 35" criaria um treinamento novo e o
    // catálogo viraria uma lista de duplicatas.
    const fn = api.slice(api.indexOf('async _idDoTreinamento'), api.indexOf('async criar(payload)'));
    expect(fn).toContain(".select('id')");
    expect(fn).toContain(".eq('nome'");
    expect(fn.indexOf('.select(')).toBeLessThan(fn.indexOf('.insert('));
  });

  it('nome vazio não vira treinamento sem nome — a coluna é obrigatória', () => {
    const fn = api.slice(api.indexOf('async _idDoTreinamento'), api.indexOf('async criar(payload)'));
    expect(fn).toContain("|| 'Treinamento'");
  });
});

describe('a varredura das colunas obrigatórias', () => {
  // Três vezes o mesmo defeito: coluna antiga que sobreviveu a um renomeio,
  // ficou NOT NULL e ninguém preenche. Estas duas migrações registram os
  // casos encontrados, para que a próxima pessoa saiba que a varredura foi
  // feita e o que ela achou.
  it('a migração do feedback está no repositório', () => {
    const m = readFileSync(new URL('../database/migrations/064_feedbacks_data_legada.sql', import.meta.url), 'utf8');
    expect(m).toContain('data_feedback DROP NOT NULL');
  });

  it('a da pesquisa de clima continua lá', () => {
    const m = readFileSync(new URL('../database/migrations/060_clima_perguntas.sql', import.meta.url), 'utf8');
    expect(m).toContain('data_inicio  DROP NOT NULL');
  });
});
