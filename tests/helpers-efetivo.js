// base.js é script clássico: anexa statusCasa ao window. Os testes de módulo
// precisam da MESMA função de produção — uma cópia aqui já causou teste verde
// com produção quebrada antes (o status das advertências), então carrega o
// arquivo real e reexporta o que ele publicou.
globalThis.window = globalThis.window || {};
await import('../src/utils/base.js');

export const statusCasa = globalThis.window.statusCasa;
export const noEfetivo  = globalThis.window.noEfetivo;
