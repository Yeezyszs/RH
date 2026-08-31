import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// A interface chama JavaScript por atributos inline: onclick="salvarX(event)".
// O nome vive numa STRING — nenhum linter o resolve. Renomear um método e
// esquecer a string deixa o botão mudo, sem erro no console e sem falha em
// teste. Foi assim com `setRating`, que não existia em lugar nenhum.
//
// Este teste fecha essa lacuna: extrai todo handler referenciado no HTML e nos
// templates dos módulos e exige que exista um `window.<nome>` correspondente.
// É a rede que precisa existir ANTES de migrar os handlers para delegação.

const RAIZ = new URL('..', import.meta.url).pathname;
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');

// Scripts CLÁSSICOS: além do que atribuem a window, toda `function` no topo do
// arquivo já vira global automaticamente — é assim que handleLogin() e
// fazerLogout() funcionam sem nenhum window.x = .
const CLASSICOS = [
  'src/dashboard.js', 'src/auth.js', 'src/api/init.js', 'src/api/realtime.js',
  'src/utils/base.js', 'src/utils/carregamento.js', 'src/utils/arrays.js',
  'src/utils/rede.js', 'src/utils/mappers.js', 'src/utils/relatorio.js',
];

// MÓDULOS ES: têm escopo próprio, então só o que é atribuído a window conta.
const MODULOS = ['src/app.js'];

function globaisRegistradas() {
  const nomes = new Set();
  for (const arquivo of [...CLASSICOS, ...MODULOS]) {
    for (const m of ler(arquivo).matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) {
      nomes.add(m[1]);
    }
  }
  for (const arquivo of CLASSICOS) {
    for (const m of ler(arquivo).matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) {
      nomes.add(m[1]);
    }
  }
  return nomes;
}

// Nomes chamados dentro de atributos on*="..." — só o identificador inicial de
// cada chamada, ignorando o que é built-in do próprio navegador.
const BUILTINS = new Set([
  'event', 'this', 'window', 'document', 'location', 'alert', 'confirm', 'return',
  'true', 'false', 'null', 'undefined', 'if', 'else', 'const', 'let', 'var', 'new',
]);

function handlersEm(conteudo, origem) {
  const achados = [];
  for (const attr of conteudo.matchAll(/\son(?:click|change|submit|input|keyup)="([^"]*)"/g)) {
    // (?<![.\w$]) evita casar método de objeto — event.stopPropagation() é do
    // navegador, não uma global do projeto.
    for (const chamada of attr[1].matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const nome = chamada[1];
      if (!BUILTINS.has(nome)) achados.push({ nome, origem });
    }
  }
  return achados;
}

// Ações declaradas via data-action (despachadas por src/dashboard.js).
// Precisam da mesma validação: migrar de onclick para data-action sem cobrir
// os novos nomes teria REDUZIDO a proteção, não aumentado.
function acoesDelegadas(conteudo, origem) {
  return [...conteudo.matchAll(/\sdata-action="([A-Za-z_$][\w$]*)"/g)]
    .map(m => ({ nome: m[1], origem }));
}

function todosOsHandlers() {
  const html = ler('index.html');
  const achados = [
    ...handlersEm(html, 'index.html'),
    ...acoesDelegadas(html, 'index.html'),
  ];
  const dirMods = join(RAIZ, 'src/modules');
  for (const f of readdirSync(dirMods).filter(f => f.endsWith('.js'))) {
    const src = ler(join('src/modules', f));
    achados.push(...handlersEm(src, `src/modules/${f}`));
    achados.push(...acoesDelegadas(src, `src/modules/${f}`));
  }
  return achados;
}

describe('handlers inline apontam para funções que existem', () => {
  const registradas = globaisRegistradas();
  const handlers = todosOsHandlers();

  it('a migração para data-action cobriu a maior parte do index.html', () => {
    const html = ler('index.html');
    const inline = (html.match(/\sonclick="/g) || []).length;
    const delegados = (html.match(/\sdata-action="/g) || []).length;
    expect(delegados).toBeGreaterThan(100);
    // Os que sobram carregam argumento; se voltarem a crescer, é regressão.
    expect(inline).toBeLessThanOrEqual(15);
  });

  it('encontra os handlers do projeto (o extrator está funcionando)', () => {
    // Se este número desabar, o extrator quebrou e os testes abaixo passariam
    // vazios — dando falsa segurança.
    expect(handlers.length).toBeGreaterThan(150);
  });

  it('registra um conjunto grande de globais', () => {
    expect(registradas.size).toBeGreaterThan(100);
  });

  it('nenhum handler do index.html está órfão', () => {
    const orfaos = [...new Set(
      handlers.filter(x => x.origem === 'index.html' && !registradas.has(x.nome))
              .map(x => x.nome)
    )].sort();
    expect(orfaos).toEqual([]);
  });

  it('nenhum handler gerado pelos módulos está órfão', () => {
    const orfaos = [...new Set(
      handlers.filter(x => x.origem !== 'index.html' && !registradas.has(x.nome))
              .map(x => `${x.nome} (${x.origem})`)
    )].sort();
    expect(orfaos).toEqual([]);
  });
});

describe('não sobrou global registrada sem uso', () => {
  // O inverso: função exposta no window que ninguém chama é dívida — foi o
  // caso do VALE_LANCAMENTOS. Aqui é só um aviso informativo, não uma trava:
  // várias globais são consumidas entre scripts clássicos, não pelo HTML.
  it('lista as globais de UI não referenciadas por nenhum handler', () => {
    const usados = new Set(todosOsHandlers().map(x => x.nome));
    const app = ler('src/app.js');
    const soDoApp = [...app.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=\s*\(/g)].map(m => m[1]);
    const naoUsadas = soDoApp.filter(n => !usados.has(n));
    // Registrado como expectativa explícita: se crescer muito, virou dívida.
    expect(naoUsadas.length).toBeLessThan(60);
  });
});
