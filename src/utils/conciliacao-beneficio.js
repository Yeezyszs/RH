// Conciliação de relatório de benefício com o cadastro.
//
// Nasceu dentro de `relatorio-vale.js`, para o vale combustível. Quando o vale
// alimentação virou o segundo benefício importado — de outra operadora, com
// outro layout de PDF —, ficou claro que cruzar beneficiário com colaborador
// não tem nada de específico de um deles: muda o leitor do arquivo, não a
// regra de quem é quem. Veio para cá em vez de virar cópia no segundo
// importador.
//
// `relatorio-vale.js` reexporta daqui, então quem importava de lá continua
// funcionando.

import { normalizarNome, soDigitos, arredondar } from './texto-pdf.js?v=dev';

/**
 * Cruza o relatório com o cadastro. O CPF é a chave forte; o nome só entra
 * quando o cadastro está sem CPF, e um nome que casa com duas pessoas é
 * tratado como não encontrado — adivinhar aqui seria pagar o benefício errado.
 *
 * @param {{registros: object[]}} relatorio
 * @param {{id: number, nome: string, cpf?: string, status?: string}[]} colaboradores
 * @param {{ignorados?: string[], vinculos?: Record<string, number>}} [opcoes]
 *   `ignorados` — CPFs que o RH marcou para nunca importar.
 *   `vinculos`  — CPF → id, ligações feitas à mão na tela de conferência.
 */
export function conciliarRelatorio(relatorio, colaboradores = [], opcoes = {}) {
  const ignorados = new Set((opcoes.ignorados || []).map(soDigitos).filter(Boolean));
  const vinculos  = opcoes.vinculos || {};

  const porCpf = new Map();
  const porNome = new Map();
  for (const c of colaboradores) {
    const cpf = soDigitos(c.cpf);
    if (cpf && !porCpf.has(cpf)) porCpf.set(cpf, c);
    const nome = normalizarNome(c.nome);
    if (!nome) continue;
    if (!porNome.has(nome)) porNome.set(nome, []);
    porNome.get(nome).push(c);
  }

  const casados = [], listaIgnorados = [], semCadastro = [];
  const usados = new Set();

  for (const reg of relatorio.registros) {
    const cpf = soDigitos(reg.cpf);

    if (ignorados.has(cpf)) { listaIgnorados.push({ registro: reg }); continue; }

    const forcado = vinculos[cpf] ?? vinculos[reg.cpf];
    let colab = forcado != null ? colaboradores.find(c => c.id === Number(forcado)) : null;
    let via = colab ? 'manual' : '';

    if (!colab && cpf && porCpf.has(cpf)) { colab = porCpf.get(cpf); via = 'cpf'; }

    if (!colab) {
      const iguais = porNome.get(normalizarNome(reg.nome)) || [];
      if (iguais.length === 1) { colab = iguais[0]; via = 'nome'; }
      else if (iguais.length > 1) {
        semCadastro.push({ registro: reg, motivo: 'Há mais de um cadastro com esse nome' });
        continue;
      }
    }

    if (!colab) { semCadastro.push({ registro: reg, motivo: 'Sem cadastro correspondente' }); continue; }

    if (usados.has(colab.id)) {
      semCadastro.push({ registro: reg, motivo: `Já casado com ${colab.nome} nesta importação` });
      continue;
    }
    usados.add(colab.id);
    casados.push({ registro: reg, colab, via });
  }

  const somar = (lista, get) => arredondar(lista.reduce((s, x) => s + get(x), 0));

  // Quem está ativo no sistema e não aparece no relatório: não recebeu neste
  // crédito. Não é erro, mas o RH precisa ver o número antes de confirmar.
  const noRelatorio = new Set(casados.map(c => c.colab.id));
  const ausentes = colaboradores.filter(c => c.status !== 'inativo' && !noRelatorio.has(c.id));

  return {
    casados,
    ignorados: listaIgnorados,
    semCadastro,
    ausentes,
    somaCasados:     somar(casados,        x => x.registro.valor),
    somaIgnorados:   somar(listaIgnorados, x => x.registro.valor),
    somaSemCadastro: somar(semCadastro,    x => x.registro.valor),
  };
}

export default { conciliarRelatorio };
