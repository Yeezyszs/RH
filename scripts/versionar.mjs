// Aplica a versão de cache-busting no artefato de deploy.
//
// Antes disto a versão era um literal (`?v=20260624t`) repetido em 39 lugares,
// incrementado à mão a cada alteração. Esquecer de incrementar entregava
// arquivo velho ao usuário — e isso é indetectável em teste local, porque o
// servidor de desenvolvimento roda sem cache.
//
// Agora o código-fonte carrega o marcador `?v=dev` e o deploy o troca pelo
// hash do commit. Uso:
//     node scripts/versionar.mjs _site <versao>

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

// Só caminhos locais .js/.css seguidos de ?v=. Assim URLs de CDN (que não têm
// query de versão) e qualquer outro `?v=` de texto ficam intocados.
const PADRAO = /(["'\s])([^"'\s>]+\.(?:js|css))\?v=[^"'\s>]*/g;

/** Troca a versão em todas as referências locais. Função pura. */
export function aplicarVersao(texto, versao) {
  let trocas = 0;
  const saida = texto.replace(PADRAO, (_m, antes, caminho) => {
    trocas++;
    return `${antes}${caminho}?v=${versao}`;
  });
  return { saida, trocas };
}

/** Normaliza a versão recebida: hash curto, sem caracteres problemáticos. */
export function normalizarVersao(bruta) {
  const limpa = String(bruta || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 12);
  return limpa || 'dev';
}

async function* arquivos(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const caminho = join(dir, item.name);
    if (item.isDirectory()) yield* arquivos(caminho);
    else if (['.html', '.js'].includes(extname(item.name))) yield caminho;
  }
}

async function main() {
  const [dir, versaoBruta] = process.argv.slice(2);
  if (!dir) {
    console.error('uso: node scripts/versionar.mjs <diretório> <versão>');
    process.exit(2);
  }

  const versao = normalizarVersao(versaoBruta);
  let total = 0;

  for await (const caminho of arquivos(dir)) {
    const original = await readFile(caminho, 'utf8');
    const { saida, trocas } = aplicarVersao(original, versao);
    if (trocas > 0) {
      await writeFile(caminho, saida);
      console.log(`  ${caminho}: ${trocas} referência(s)`);
      total += trocas;
    }
  }

  // Falhar alto é melhor que publicar sem versão: se o marcador mudar de nome
  // e nada for substituído, o deploy passaria entregando cache velho.
  if (total === 0) {
    console.error('ERRO: nenhuma referência versionada encontrada em ' + dir);
    process.exit(1);
  }
  console.log(`Versão "${versao}" aplicada em ${total} referência(s).`);
}

// Só executa como CLI; ao ser importado pelos testes, não roda nada.
if (process.argv[1]?.endsWith('versionar.mjs')) {
  main().catch(err => { console.error(err); process.exit(1); });
}
