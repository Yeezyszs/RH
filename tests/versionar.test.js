import { describe, it, expect } from 'vitest';
import { aplicarVersao, normalizarVersao } from '../scripts/versionar.mjs';

// O cache-busting era mantido à mão em 39 lugares. Um erro aqui entrega
// arquivo velho ao usuário sem nenhum sintoma visível em desenvolvimento —
// por isso a substituição é testada.

describe('aplicarVersao — referências locais', () => {
  it('troca a versão em <script src>', () => {
    const { saida, trocas } = aplicarVersao('<script src="src/app.js?v=dev"></script>', 'abc1234');
    expect(saida).toBe('<script src="src/app.js?v=abc1234"></script>');
    expect(trocas).toBe(1);
  });

  it('troca em <link href> de CSS', () => {
    const { saida } = aplicarVersao('<link rel="stylesheet" href="css/style.css?v=dev">', 'abc1234');
    expect(saida).toContain('css/style.css?v=abc1234');
  });

  it('troca em import de módulo ES com caminho relativo', () => {
    const { saida } = aplicarVersao("import x from './modules/sac.js?v=dev';", 'abc1234');
    expect(saida).toBe("import x from './modules/sac.js?v=abc1234';");
  });

  it('troca todas as ocorrências, não só a primeira', () => {
    const entrada = `<script src="a.js?v=dev"></script><script src="b.js?v=dev"></script>`;
    const { saida, trocas } = aplicarVersao(entrada, 'xyz');
    expect(trocas).toBe(2);
    expect(saida).not.toContain('?v=dev');
  });

  it('funciona com aspas simples', () => {
    const { saida } = aplicarVersao("<script src='src/app.js?v=dev'></script>", 'abc');
    expect(saida).toContain("src/app.js?v=abc");
  });

  it('substitui versão antiga qualquer, não só o marcador dev', () => {
    const { saida } = aplicarVersao('<script src="src/app.js?v=20260624t"></script>', 'novo');
    expect(saida).toContain('?v=novo');
  });
});

describe('aplicarVersao — o que NÃO deve tocar', () => {
  it('não mexe em URL de CDN', () => {
    const cdn = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';
    const { saida, trocas } = aplicarVersao(cdn, 'abc');
    expect(saida).toBe(cdn);
    expect(trocas).toBe(0);
  });

  it('não mexe em arquivo sem query de versão', () => {
    const html = '<script src="src/app.js"></script>';
    expect(aplicarVersao(html, 'abc').trocas).toBe(0);
  });

  it('não mexe em ?v= solto em comentário', () => {
    const txt = '<!-- ?v= é cache-busting -->';
    const { saida, trocas } = aplicarVersao(txt, 'abc');
    expect(saida).toBe(txt);
    expect(trocas).toBe(0);
  });

  it('não mexe em extensão que não seja js/css', () => {
    const html = '<img src="logo.png?v=dev">';
    expect(aplicarVersao(html, 'abc').trocas).toBe(0);
  });
});

describe('normalizarVersao — hash seguro para URL', () => {
  it('encurta o SHA para 12 caracteres', () => {
    expect(normalizarVersao('c31698d4f2a1b9e8d7c6b5a4f3e2d1c0b9a8f7e6')).toBe('c31698d4f2a1');
  });

  it('remove caracteres que quebrariam a query', () => {
    expect(normalizarVersao('abc/def?ghi&jkl')).toBe('abcdefghijkl');
  });

  it('preserva ponto, hífen e sublinhado', () => {
    expect(normalizarVersao('v1.2-rc_3')).toBe('v1.2-rc_3');
  });

  it('cai para "dev" quando não recebe nada', () => {
    expect(normalizarVersao('')).toBe('dev');
    expect(normalizarVersao(null)).toBe('dev');
    expect(normalizarVersao(undefined)).toBe('dev');
  });

  it('cai para "dev" se sobrar string vazia após a limpeza', () => {
    expect(normalizarVersao('///???')).toBe('dev');
  });
});
