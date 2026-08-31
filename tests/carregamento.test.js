import { describe, it, expect, beforeAll } from 'vitest';

// carregamento.js é script clássico (init.js não é módulo ES) e expõe as
// funções no window — mesmo padrão de base.js.
beforeAll(async () => {
  globalThis.window = globalThis.window || {};
  await import('../src/utils/carregamento.js');
});

const ok   = (value) => ({ status: 'fulfilled', value });
const fail = (reason) => ({ status: 'rejected', reason });

describe('descreverErro — traduz a causa', () => {
  it('devolve a string quando o motivo já é texto', () => {
    expect(window.descreverErro('Deu ruim')).toBe('Deu ruim');
  });

  it('reconhece falta de permissão pelo código do Postgres', () => {
    expect(window.descreverErro({ code: '42501' })).toBe('Sem permissão de acesso');
  });

  it('reconhece falta de permissão pelo status HTTP', () => {
    expect(window.descreverErro({ status: 403 })).toBe('Sem permissão de acesso');
  });

  it('reconhece sessão expirada', () => {
    expect(window.descreverErro({ code: 'PGRST301' })).toBe('Sessão expirada');
  });

  it('reconhece tabela inexistente', () => {
    expect(window.descreverErro({ code: '42P01' })).toBe('Tabela não encontrada no banco');
  });

  it('reconhece timeout pela mensagem', () => {
    expect(window.descreverErro(new Error('Requisição expirou. Verifique sua conexão.')))
      .toBe('Tempo de resposta esgotado');
  });

  it('reconhece falha de rede', () => {
    expect(window.descreverErro(new Error('Failed to fetch'))).toBe('Falha de conexão');
  });

  it('cai na mensagem original quando não há código conhecido', () => {
    expect(window.descreverErro(new Error('coluna x não existe'))).toBe('coluna x não existe');
  });

  it('não quebra com motivo nulo', () => {
    expect(window.descreverErro(null)).toBe('Erro desconhecido');
  });
});

describe('coletarFalhas — separa o que falhou', () => {
  it('devolve vazio quando tudo carregou', () => {
    expect(window.coletarFalhas({ a: ok([]), b: ok([1]) })).toEqual([]);
  });

  it('sucesso com lista vazia não é falha', () => {
    // Distinção central: "carregou e não tem nada" ≠ "não carregou".
    expect(window.coletarFalhas({ afastamentos: ok([]) })).toEqual([]);
  });

  it('captura o nome e a causa de cada rejeição', () => {
    const falhas = window.coletarFalhas({
      colaboradores: ok([1, 2]),
      afastamentos:  fail({ code: '42501' }),
    });
    expect(falhas).toEqual([{ nome: 'afastamentos', erro: 'Sem permissão de acesso' }]);
  });

  it('captura várias falhas de uma vez', () => {
    const falhas = window.coletarFalhas({
      a: fail(new Error('Failed to fetch')),
      b: ok([]),
      c: fail({ status: 403 }),
    });
    expect(falhas.map(f => f.nome)).toEqual(['a', 'c']);
  });

  it('não quebra sem argumento', () => {
    expect(window.coletarFalhas()).toEqual([]);
  });
});

describe('resumirFalhas — frase para o usuário', () => {
  it('devolve vazio quando não há falha', () => {
    expect(window.resumirFalhas([])).toBe('');
  });

  it('usa o singular com uma falha só', () => {
    const t = window.resumirFalhas([{ nome: 'afastamentos', erro: 'x' }]);
    expect(t).toContain('Não foi possível carregar afastamentos');
    expect(t).toContain('Esta tela pode aparecer vazia');
  });

  it('liga os nomes com "e" quando são poucos', () => {
    const t = window.resumirFalhas([
      { nome: 'férias', erro: 'x' },
      { nome: 'salários', erro: 'y' },
    ]);
    expect(t).toContain('férias e salários');
    expect(t).toContain('Estas telas podem aparecer vazias');
  });

  it('resume o excedente em vez de listar tudo', () => {
    const muitas = ['a', 'b', 'c', 'd', 'e'].map(n => ({ nome: n, erro: 'x' }));
    expect(window.resumirFalhas(muitas)).toContain('a, b, c e mais 2');
  });

  it('deixa explícito que o dado existe, mas não chegou', () => {
    const t = window.resumirFalhas([{ nome: 'SAC', erro: 'x' }]);
    expect(t).toContain('o dado existe, mas não chegou até aqui');
  });
});
