import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

// O sistema marcava o colaborador como 'ferias' quando o período começava e
// nunca desmarcava. Excluir o período também não devolvia o status. Resultado
// real: o ADAO RIBEIRO aparecia de férias sem ter um único período cadastrado.
//
// `_reconciliarStatus()` fecha a porta de saída: o status passa a seguir os
// períodos, nos dois sentidos.

const HOJE = new Date().toISOString().slice(0, 10);
const desloca = (dias) => {
  const d = new Date(HOJE + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

async function criar({ colaboradores, ferias = [], comSessao = true, falhas = [] } = {}) {
  const dom = new JSDOM('<body></body>');
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.FALHAS_CARREGAMENTO = falhas;

  const gravado = [];
  const { FeriasModule } = await import('../src/modules/ferias.js');
  const mod = new FeriasModule({
    $: (s) => dom.window.document.querySelector(s),
    h: (s) => String(s ?? ''),
    iniciais: (s) => String(s).slice(0, 2),
    fmtDate: (s) => s,
    fmtBRL: (v) => Number(v).toFixed(2),
    FERIAS: ferias,
    COLABORADORES: colaboradores,
    SALARIOS: {},
    Auth: { sessaoAtual: async () => (comSessao ? { user: 'x' } : null) },
    Ferias: {},
    Colaboradores: {
      atualizar: async (id, payload) => { gravado.push([id, payload.status]); },
    },
  });
  return { mod, gravado, colaboradores };
}

const pessoa = (over) => ({ id: 1, nome: 'Fulano', status: 'ativo', admissao: '2018-09-10', ...over });
const periodo = (over) => ({
  id: 1, colaborador_id: 1, inicio: desloca(-5), fim: desloca(5), dias: 11, abono: 0, ...over,
});

describe('quem não está de férias volta a ativo', () => {
  it('corrige quem está marcado sem nenhum período cadastrado', async () => {
    // O caso do Adão: status 'ferias' e a tabela de férias sem nada dele.
    const { mod, gravado, colaboradores } = await criar({
      colaboradores: [pessoa({ status: 'ferias' })],
    });
    expect(await mod._reconciliarStatus()).toBe(1);
    expect(colaboradores[0].status).toBe('ativo');
    expect(gravado).toEqual([[1, 'ativo']]);
  });

  it('corrige quem tem período, mas já terminou', async () => {
    const { mod, colaboradores } = await criar({
      colaboradores: [pessoa({ status: 'ferias' })],
      ferias: [periodo({ inicio: '2024-12-01', fim: '2024-12-30' })],
    });
    await mod._reconciliarStatus();
    expect(colaboradores[0].status).toBe('ativo');
  });

  it('corrige quem tem período que ainda nem começou', async () => {
    const { mod, colaboradores } = await criar({
      colaboradores: [pessoa({ status: 'ferias' })],
      ferias: [periodo({ inicio: desloca(10), fim: desloca(40) })],
    });
    await mod._reconciliarStatus();
    expect(colaboradores[0].status).toBe('ativo');
  });
});

describe('quem está de férias fica marcado', () => {
  it('marca quem tem período em curso hoje', async () => {
    const { mod, gravado, colaboradores } = await criar({
      colaboradores: [pessoa({ status: 'ativo' })],
      ferias: [periodo()],
    });
    await mod._reconciliarStatus();
    expect(colaboradores[0].status).toBe('ferias');
    expect(gravado).toEqual([[1, 'ferias']]);
  });

  it('o primeiro e o último dia contam como férias', async () => {
    const primeiro = await criar({
      colaboradores: [pessoa({ status: 'ativo' })],
      ferias: [periodo({ inicio: HOJE, fim: desloca(29) })],
    });
    await primeiro.mod._reconciliarStatus();
    expect(primeiro.colaboradores[0].status).toBe('ferias');

    const ultimo = await criar({
      colaboradores: [pessoa({ status: 'ativo' })],
      ferias: [periodo({ inicio: desloca(-29), fim: HOJE })],
    });
    await ultimo.mod._reconciliarStatus();
    expect(ultimo.colaboradores[0].status).toBe('ferias');
  });

  it('não escreve nada quando já está certo', async () => {
    const { mod, gravado } = await criar({
      colaboradores: [pessoa({ status: 'ferias' })],
      ferias: [periodo()],
    });
    expect(await mod._reconciliarStatus()).toBe(0);
    expect(gravado).toEqual([]);
  });
});

describe('o que a reconciliação não pode tocar', () => {
  it('afastado continua afastado, mesmo sem período', async () => {
    // Afastamento é decisão de contrato, não estado de calendário.
    const { mod, gravado, colaboradores } = await criar({
      colaboradores: [pessoa({ status: 'afastado' })],
    });
    await mod._reconciliarStatus();
    expect(colaboradores[0].status).toBe('afastado');
    expect(gravado).toEqual([]);
  });

  it('desligado continua desligado, mesmo com período antigo', async () => {
    const { mod, colaboradores } = await criar({
      colaboradores: [pessoa({ status: 'inativo' })],
      ferias: [periodo()],
    });
    await mod._reconciliarStatus();
    expect(colaboradores[0].status).toBe('inativo');
  });
});

describe('segurança da reconciliação', () => {
  it('não corrige nada quando a carga de férias falhou', async () => {
    // Lista vazia por erro de rede não é lista vazia por não haver períodos:
    // corrigir aqui tiraria de férias quem está de férias de verdade.
    const { mod, gravado, colaboradores } = await criar({
      colaboradores: [pessoa({ status: 'ferias' })],
      falhas: [{ nome: 'férias', erro: 'timeout' }],
    });
    expect(await mod._reconciliarStatus()).toBe(0);
    expect(colaboradores[0].status).toBe('ferias');
    expect(gravado).toEqual([]);
  });

  it('falha em outra tabela não impede a correção', async () => {
    const { mod, colaboradores } = await criar({
      colaboradores: [pessoa({ status: 'ferias' })],
      falhas: [{ nome: 'EPIs', erro: 'timeout' }],
    });
    await mod._reconciliarStatus();
    expect(colaboradores[0].status).toBe('ativo');
  });

  it('sem sessão, corrige só a tela e não tenta gravar', async () => {
    const { mod, gravado, colaboradores } = await criar({
      colaboradores: [pessoa({ status: 'ferias' })],
      comSessao: false,
    });
    await mod._reconciliarStatus();
    expect(colaboradores[0].status).toBe('ativo');
    expect(gravado).toEqual([]);
  });

  it('erro ao gravar um não impede corrigir os outros', async () => {
    const { mod } = await criar({ colaboradores: [pessoa({ status: 'ferias' })] });
    const pessoas = [pessoa({ id: 1, status: 'ferias' }), pessoa({ id: 2, nome: 'Outro', status: 'ferias' })];
    mod.COLABORADORES = pessoas;
    mod.Colaboradores = {
      atualizar: async (id) => { if (id === 1) throw new Error('sem permissão'); },
    };
    expect(await mod._reconciliarStatus()).toBe(1);
    expect(pessoas[0].status).toBe('ferias');   // não gravou, não mente na tela
    expect(pessoas[1].status).toBe('ativo');
  });

  it('corrige vários de uma vez, nos dois sentidos', async () => {
    const pessoas = [
      pessoa({ id: 1, nome: 'Voltando',  status: 'ferias' }),
      pessoa({ id: 2, nome: 'Saindo',    status: 'ativo' }),
      pessoa({ id: 3, nome: 'Parado',    status: 'ativo' }),
    ];
    const { mod, gravado } = await criar({
      colaboradores: pessoas,
      ferias: [periodo({ id: 9, colaborador_id: 2 })],
    });
    expect(await mod._reconciliarStatus()).toBe(2);
    expect(pessoas.map(p => p.status)).toEqual(['ativo', 'ferias', 'ativo']);
    expect(gravado.sort()).toEqual([[1, 'ativo'], [2, 'ferias']]);
  });
});
