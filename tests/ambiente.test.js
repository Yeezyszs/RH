import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

// O CI reprovou com "webidl.util.markAsUncloneable is not a function" enquanto
// tudo passava aqui. O código estava certo: a máquina local rodava Node 22 e o
// CI, Node 20 — e o jsdom (via undici) exige >= 22.19.0.
//
// Esta suíte trava essa divergência: a versão declarada nos workflows precisa
// atender ao que o package.json exige, e o que o package.json exige precisa
// atender às dependências instaladas. Sem isso, "passa aqui e quebra lá" volta.

const raiz = new URL('..', import.meta.url);
const ler = (p) => readFileSync(new URL(p, raiz), 'utf8');
const pkg = JSON.parse(ler('package.json'));

/** Primeiro número de uma faixa como ">=22.19.0" ou "^22.22.2 || >=26.0.0". */
function maiorVersaoMinima(faixa) {
  const versoes = [...String(faixa).matchAll(/(\d+)\.(\d+)\.(\d+)/g)]
    .map(m => [+m[1], +m[2], +m[3]]);
  if (!versoes.length) {
    const soMajor = String(faixa).match(/(\d+)/);
    return soMajor ? [+soMajor[1], 0, 0] : [0, 0, 0];
  }
  // A menor entre as alternativas é o piso real que precisamos atender.
  return versoes.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])[0];
}

const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function versoesNosWorkflows() {
  const dir = new URL('.github/workflows/', raiz);
  const achados = [];
  for (const arquivo of readdirSync(dir).filter(f => f.endsWith('.yml'))) {
    const conteudo = readFileSync(new URL(arquivo, dir), 'utf8');
    for (const m of conteudo.matchAll(/node-version:\s*'?"?(\d+[\d.]*)'?"?/g)) {
      achados.push({ arquivo, versao: m[1] });
    }
  }
  return achados;
}

describe('o projeto declara qual Node precisa', () => {
  it('package.json tem engines.node', () => {
    expect(pkg.engines?.node).toBeTruthy();
  });

  it('existe .nvmrc para o ambiente local seguir o mesmo', () => {
    expect(existsSync(new URL('.nvmrc', raiz))).toBe(true);
  });

  it('o .nvmrc atende ao engines', () => {
    const nvmrc = maiorVersaoMinima(ler('.nvmrc'));
    const exigido = maiorVersaoMinima(pkg.engines.node);
    expect(nvmrc[0]).toBeGreaterThanOrEqual(exigido[0]);
  });
});

describe('o CI roda a mesma versão que o projeto exige', () => {
  const versoes = versoesNosWorkflows();

  it('encontra as declarações nos workflows', () => {
    expect(versoes.length).toBeGreaterThan(0);
  });

  it('nenhum workflow usa versão abaixo do engines', () => {
    const exigido = maiorVersaoMinima(pkg.engines.node);
    const abaixo = versoes
      .filter(v => maiorVersaoMinima(v.versao)[0] < exigido[0])
      .map(v => `${v.arquivo}: node ${v.versao}`);
    expect(abaixo).toEqual([]);
  });

  it('todos os workflows usam a MESMA versão', () => {
    // Divergência entre ci.yml e deploy.yml faria o deploy quebrar sozinho,
    // depois de o CI ter aprovado.
    expect([...new Set(versoes.map(v => v.versao))]).toHaveLength(1);
  });
});

describe('as dependências cabem no Node declarado', () => {
  it('nenhuma devDependency exige Node acima do nosso engines', () => {
    const exigidoPeloProjeto = maiorVersaoMinima(pkg.engines.node);
    const problemas = [];

    for (const nome of Object.keys(pkg.devDependencies || {})) {
      const caminho = new URL(`node_modules/${nome}/package.json`, raiz);
      if (!existsSync(caminho)) continue;           // sem node_modules: pula
      const dep = JSON.parse(readFileSync(caminho, 'utf8'));
      const exigidoPelaDep = dep.engines?.node;
      if (!exigidoPelaDep) continue;
      if (cmp(maiorVersaoMinima(exigidoPelaDep), exigidoPeloProjeto) > 0) {
        problemas.push(`${nome} exige ${exigidoPelaDep}, projeto declara ${pkg.engines.node}`);
      }
    }
    expect(problemas).toEqual([]);
  });
});
