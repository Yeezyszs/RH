// Procura chaves privilegiadas do Supabase commitadas no código.
//
// A verificação anterior era `grep service_role`. Ela errava nos dois sentidos:
//
//   Falso positivo — batia em qualquer texto contendo a palavra, inclusive no
//   comentário que documentava a própria regra (foi o que reprovou o CI).
//
//   Falso negativo, mais grave — a chave é um JWT, e o `role` fica dentro do
//   payload em base64. A palavra "service_role" NÃO aparece no texto do token.
//   Ou seja: a verificação criada para pegar a chave vazada não conseguiria
//   pegá-la.
//
// Aqui decodificamos o payload de cada JWT encontrado e olhamos o claim `role`.
// Isso pega a chave independentemente do nome da variável, e não se importa
// com o que está escrito em comentário.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

// header.payload — a assinatura não interessa para identificar o papel.
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})/g;

// A única chave que pode ficar no cliente. Qualquer outra é vazamento.
const PAPEL_PERMITIDO = 'anon';

/** Decodifica o payload de um JWT. Devolve null se não for JSON válido. */
export function lerPayload(payloadBase64) {
  try {
    return JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Analisa um conteúdo e devolve os tokens com papel não permitido.
 * @returns {Array<{role: string, inicio: string}>}
 */
export function analisarConteudo(texto) {
  const achados = [];
  for (const m of texto.matchAll(JWT)) {
    const payload = lerPayload(m[1]);
    if (!payload) continue;                      // não é JWT de verdade
    if (!payload.role) continue;                 // token sem papel: não é do Supabase
    if (payload.role === PAPEL_PERMITIDO) continue;
    achados.push({ role: payload.role, inicio: m[0].slice(0, 24) + '…' });
  }
  return achados;
}

const IGNORAR = new Set(['node_modules', 'coverage', '_site', '.git', 'dist']);
const EXTENSOES = new Set(['.js', '.mjs', '.html', '.json', '.ts', '.yml', '.yaml', '.env']);

function* arquivos(dir) {
  for (const item of readdirSync(dir)) {
    if (IGNORAR.has(item)) continue;
    const caminho = join(dir, item);
    if (statSync(caminho).isDirectory()) yield* arquivos(caminho);
    else if (EXTENSOES.has(extname(item))) yield caminho;
  }
}

function main() {
  const raiz = process.argv[2] || '.';
  const problemas = [];

  for (const caminho of arquivos(raiz)) {
    // Não analisa a si mesmo nem os testes: ambos contêm exemplos de propósito.
    if (caminho.includes('checar-segredos')) continue;
    for (const achado of analisarConteudo(readFileSync(caminho, 'utf8'))) {
      problemas.push({ caminho, ...achado });
    }
  }

  if (problemas.length) {
    console.error('ERRO: chave privilegiada encontrada no código.\n');
    for (const p of problemas) {
      console.error(`  ${p.caminho}: token com role="${p.role}" (${p.inicio})`);
    }
    console.error('\nSó a chave `anon` pode ficar no cliente — a proteção real é o RLS.');
    process.exit(1);
  }

  console.log('OK: nenhuma chave privilegiada no código (só `anon`).');
}

if (process.argv[1]?.endsWith('checar-segredos.mjs')) main();
