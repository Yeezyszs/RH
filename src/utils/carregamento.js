// Diagnóstico da carga inicial de dados.
//
// A carga usa Promise.allSettled, que nunca rejeita: uma tabela que falha
// (permissão, rede, timeout) simplesmente não preenche seu array, e a tela
// renderiza vazia. Sem isto, "não carregou" e "não existe nada" ficam
// indistinguíveis — foi assim que a tabela `afastamentos` passou meses
// inacessível sem ninguém perceber.
//
// Funções puras, sem DOM: a apresentação fica em quem chama.
// Script clássico (init.js não é módulo ES) — expõe no window ao final, como
// base.js. Os testes importam o arquivo e leem as mesmas funções do window.

/** Traduz o motivo de uma promessa rejeitada em uma frase legível. */
function descreverErro(reason) {
  if (!reason) return 'Erro desconhecido';
  if (typeof reason === 'string') return reason;

  const msg = reason.message || reason.error_description || reason.details || '';

  // Códigos do PostgREST/Supabase que têm causa conhecida.
  if (reason.code === 'PGRST301' || reason.status === 401) return 'Sessão expirada';
  if (reason.code === '42501' || reason.status === 403) return 'Sem permissão de acesso';
  if (reason.code === '42P01') return 'Tabela não encontrada no banco';
  if (/expirou|timeout/i.test(msg)) return 'Tempo de resposta esgotado';
  if (/fetch|network|failed to fetch/i.test(msg)) return 'Falha de conexão';

  return msg || 'Erro desconhecido';
}

/**
 * Recebe { rótulo: resultadoDoAllSettled } e devolve só o que falhou.
 * @returns {Array<{nome: string, erro: string}>}
 */
function coletarFalhas(resultados) {
  if (!resultados) return [];
  return Object.entries(resultados)
    .filter(([, r]) => r && r.status === 'rejected')
    .map(([nome, r]) => ({ nome, erro: descreverErro(r.reason) }));
}

/**
 * Frase única para o usuário. Lista até `limite` nomes e resume o restante,
 * para o aviso não virar um parágrafo quando muita coisa falha de uma vez.
 */
function resumirFalhas(falhas, limite = 3) {
  if (!falhas || falhas.length === 0) return '';

  const nomes = falhas.map(f => f.nome);
  const mostrados = nomes.slice(0, limite);
  const restantes = nomes.length - mostrados.length;

  let lista = mostrados.join(', ');
  if (restantes > 0) {
    lista += ` e mais ${restantes}`;
  } else if (mostrados.length > 1) {
    // Troca a última vírgula por "e".
    const i = lista.lastIndexOf(', ');
    lista = lista.slice(0, i) + ' e ' + lista.slice(i + 2);
  }

  const plural = falhas.length > 1;
  return `Não foi possível carregar ${lista}. ` +
         `${plural ? 'Estas telas podem aparecer vazias' : 'Esta tela pode aparecer vazia'} — ` +
         `o dado existe, mas não chegou até aqui.`;
}

window.descreverErro = descreverErro;
window.coletarFalhas = coletarFalhas;
window.resumirFalhas = resumirFalhas;
