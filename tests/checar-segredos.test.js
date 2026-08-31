import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { analisarConteudo, lerPayload } from '../scripts/checar-segredos.mjs';

// Verificação de chave privilegiada commitada. A versão anterior (grep pela
// palavra "service_role") não conseguia detectar o vazamento que existia para
// evitar — a palavra fica dentro do payload em base64 e não aparece no texto
// do token. Estes testes provam que a nova detecta.

const jwt = (payload) =>
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
  + Buffer.from(JSON.stringify(payload)).toString('base64url')
  + '.assinaturaFalsaParaTeste';

const ANON    = jwt({ iss: 'supabase', ref: 'abc', role: 'anon',         iat: 1, exp: 2 });
const SERVICE = jwt({ iss: 'supabase', ref: 'abc', role: 'service_role', iat: 1, exp: 2 });

describe('o formato do token confirma o problema da verificação antiga', () => {
  it('a palavra "service_role" NÃO aparece no texto do token', () => {
    // É por isso que um grep pela palavra nunca pegaria a chave vazada.
    expect(SERVICE.includes('service_role')).toBe(false);
  });

  it('mas o papel está lá, no payload codificado', () => {
    expect(lerPayload(SERVICE.split('.')[1]).role).toBe('service_role');
  });
});

describe('analisarConteudo — detecta o que importa', () => {
  it('acusa uma service_role key', () => {
    const achados = analisarConteudo(`const KEY = '${SERVICE}';`);
    expect(achados).toHaveLength(1);
    expect(achados[0].role).toBe('service_role');
  });

  it('acusa mesmo com nome de variável inocente', () => {
    // O ponto de decodificar: o nome da variável não esconde a chave.
    expect(analisarConteudo(`const config = { k: '${SERVICE}' };`)).toHaveLength(1);
  });

  it('acusa qualquer papel que não seja anon', () => {
    const outro = jwt({ role: 'supabase_admin', iat: 1 });
    expect(analisarConteudo(outro)[0].role).toBe('supabase_admin');
  });

  it('aceita a chave anon — ela é para ficar no cliente', () => {
    expect(analisarConteudo(`const SUPABASE_ANON = '${ANON}';`)).toEqual([]);
  });
});

describe('analisarConteudo — não acusa o que é inofensivo', () => {
  it('não acusa a palavra em comentário', () => {
    // Exatamente o caso que reprovou o CI: um comentário explicando a regra.
    const comentario = '// Nunca colocar aqui a `service_role`, que ignora RLS.';
    expect(analisarConteudo(comentario)).toEqual([]);
  });

  it('não acusa texto comum', () => {
    expect(analisarConteudo('a chave service_role jamais deve ser commitada')).toEqual([]);
  });

  it('não acusa string parecida com JWT mas sem payload válido', () => {
    expect(analisarConteudo('eyJnaoEhJsonDeVerdade.eyJtambemNao.xxx')).toEqual([]);
  });

  it('não acusa JWT de outro sistema, sem claim role', () => {
    expect(analisarConteudo(jwt({ sub: '123', name: 'fulano' }))).toEqual([]);
  });
});

describe('o repositório está limpo', () => {
  it('supabase.js contém apenas a chave anon', () => {
    const achados = analisarConteudo(readFileSync(
      new URL('../supabase.js', import.meta.url), 'utf8'));
    expect(achados).toEqual([]);
  });

  it('o comentário sobre service_role em supabase.js não dispara alarme', () => {
    const conteudo = readFileSync(new URL('../supabase.js', import.meta.url), 'utf8');
    expect(conteudo).toContain('service_role');        // o comentário está lá
    expect(analisarConteudo(conteudo)).toEqual([]);    // e não é acusado
  });
});
