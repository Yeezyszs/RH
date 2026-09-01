import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync } from 'node:fs';
import { limparFormulario } from '../src/utils/ui.js';

// Regressão do bug "um lançamento substitui o outro" no pró-labore.
//
// Sequência que quebrava: abrir um registro para EDITAR (o id vai para o campo
// oculto), fechar, e clicar em "+ Novo lançamento". O `form.reset()` não limpa
// input hidden, então o id do registro anterior sobrevivia e o "novo" era
// gravado como UPDATE daquele — o pró-labore virava cooper, sem erro nenhum.

function dom(html) {
  const d = new JSDOM(`<body>${html}</body>`);
  return d.window.document;
}

describe('por que form.reset() não bastava', () => {
  let doc, form;

  beforeEach(() => {
    doc = dom('<form id="f"><input type="hidden" name="id"><input type="text" name="nome"></form>');
    form = doc.querySelector('#f');
  });

  it('reset() limpa campo de texto', () => {
    form.elements['nome'].value = 'algo';
    form.reset();
    expect(form.elements['nome'].value).toBe('');
  });

  it('reset() NÃO limpa campo oculto — a origem do bug', () => {
    // Não é bug de navegador: input hidden usa "value mode default", então
    // atribuir .value escreve o ATRIBUTO, que é o valor para o qual o reset
    // restaura. Este teste documenta o comportamento que nos pegou.
    form.elements['id'].value = '5';
    form.reset();
    expect(form.elements['id'].value).toBe('5');
  });

  it('atribuir .value num hidden também muda o defaultValue', () => {
    form.elements['id'].value = '5';
    expect(form.elements['id'].defaultValue).toBe('5');
  });

  it('num campo de texto o defaultValue não muda', () => {
    form.elements['nome'].value = 'algo';
    expect(form.elements['nome'].defaultValue).toBe('');
  });
});

describe('limparFormulario', () => {
  let doc, form;

  beforeEach(() => {
    doc = dom(`<form id="f">
      <input type="hidden" name="id">
      <input type="hidden" name="competencia">
      <input type="text" name="socio">
      <select name="tipo"><option value="prolabore">a</option><option value="cooper">b</option></select>
      <textarea name="observacoes"></textarea>
    </form>`);
    form = doc.querySelector('#f');
  });

  it('limpa o campo oculto que o reset deixava passar', () => {
    form.elements['id'].value = '5';
    limparFormulario(form);
    expect(form.elements['id'].value).toBe('');
  });

  it('limpa TODOS os campos ocultos, não só o id', () => {
    form.elements['id'].value = '5';
    form.elements['competencia'].value = '2026-08';
    limparFormulario(form);
    expect(form.elements['competencia'].value).toBe('');
  });

  it('continua limpando os campos visíveis', () => {
    form.elements['socio'].value = 'Antonio';
    form.elements['observacoes'].value = 'nota';
    limparFormulario(form);
    expect(form.elements['socio'].value).toBe('');
    expect(form.elements['observacoes'].value).toBe('');
  });

  it('devolve o select ao primeiro item', () => {
    form.elements['tipo'].value = 'cooper';
    limparFormulario(form);
    expect(form.elements['tipo'].value).toBe('prolabore');
  });

  it('não quebra sem formulário', () => {
    expect(() => limparFormulario(null)).not.toThrow();
  });
});

describe('nenhum módulo voltou a usar form.reset() direto', () => {
  it('todos passaram a usar limparFormulario', () => {
    // Trava de regressão: reintroduzir reset() num formulário com id oculto
    // traz o bug de volta, e ele não dá erro — só troca um registro pelo outro.
    const dir = new URL('../src/modules/', import.meta.url);
    const comReset = readdirSync(dir)
      .filter(f => f.endsWith('.js'))
      .filter(f => /\.reset\(\)/.test(readFileSync(new URL(f, dir), 'utf8')));
    expect(comReset).toEqual([]);
  });
});
