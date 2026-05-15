import { describe, it, expect } from 'vitest';

// ─── Simulação da lógica de RLS ───────────────────────────────────────────────
// Estas funções espelham as USING/WITH CHECK conditions das policies do banco.
// Testamos a lógica de controle de acesso pura, sem conexão com banco de dados.

function makeCtx({ role, colaboradorId = null, departamentoId = null, userId = null }) {
  return { role, colaboradorId, departamentoId, userId };
}

// Políticas simuladas — refletem exatamente as USING conditions aplicadas no banco
const policy = {
  // Acesso total para admin e rh
  adminRh: (ctx) => ['admin', 'rh'].includes(ctx.role),

  // SELECT do próprio colaborador (por usuario_id)
  colaboradorSelectProprio: (ctx, row) =>
    ctx.role === 'colaborador' && row.usuario_id === ctx.userId,

  // SELECT por departamento (gerente)
  gerenteSelectDept: (ctx, row) =>
    ctx.role === 'gerente' && row.departamento_id === ctx.departamentoId,

  // Recursos vinculados a colaborador_id (férias, salários, vales, etc.)
  adminRhTudo: (ctx) => ['admin', 'rh'].includes(ctx.role),
  gerenteDept: (ctx, row, colaboradores) => {
    if (ctx.role !== 'gerente') return false;
    const colab = colaboradores.find(c => c.id === row.colaborador_id);
    return colab?.departamento_id === ctx.departamentoId;
  },
  colaboradorProprio: (ctx, row) =>
    ctx.role === 'colaborador' && row.colaborador_id === ctx.colaboradorId,

  // Feedbacks: gerente não vê confidenciais
  gerenteFeedbackDept: (ctx, row, colaboradores) => {
    if (ctx.role !== 'gerente') return false;
    if (row.confidencial) return false;
    const colab = colaboradores.find(c => c.id === row.colaborador_id);
    return colab?.departamento_id === ctx.departamentoId;
  },

  // Salários: colaborador vê apenas o próprio, gerente não tem acesso
  salarioColaborador: (ctx, row) =>
    ctx.role === 'colaborador' && row.colaborador_id === ctx.colaboradorId,

  // Cronograma: todos podem ver, gerente/admin gerencia
  cronogramaSelect: (ctx) => ['admin', 'rh', 'gerente', 'colaborador'].includes(ctx.role),
  cronogramaInsert: (ctx, row) =>
    ['admin', 'rh'].includes(ctx.role) ||
    (ctx.role === 'gerente' && row.responsavel_id === ctx.colaboradorId),

  // Pesquisas de clima: todos autenticados veem
  pesquisaSelect: (ctx) => ['admin', 'rh', 'gerente', 'colaborador'].includes(ctx.role),

  // Trilhas de carreira: todos veem
  trilhasSelect: (ctx) => ['admin', 'rh', 'gerente', 'colaborador'].includes(ctx.role),

  // Plano de carreiras: colaborador vê/atualiza o próprio
  planoColaboradorProprio: (ctx, row) =>
    ctx.role === 'colaborador' && row.colaborador_id === ctx.colaboradorId,
  planoColaboradorUpdate: (ctx, row, newRow) =>
    ctx.role === 'colaborador' &&
    row.colaborador_id === ctx.colaboradorId &&
    newRow.colaborador_id === ctx.colaboradorId,
};

// Dados fictícios para os testes
const COLABORADORES = [
  { id: 1, usuario_id: 'u1', departamento_id: 10 },
  { id: 2, usuario_id: 'u2', departamento_id: 10 },
  { id: 3, usuario_id: 'u3', departamento_id: 20 },
];

// ─── Colaboradores ────────────────────────────────────────────────────────────
describe('RLS — Colaboradores', () => {
  it('admin vê todos os colaboradores', () => {
    const ctx = makeCtx({ role: 'admin' });
    expect(COLABORADORES.every(() => policy.adminRh(ctx))).toBe(true);
  });

  it('rh vê todos os colaboradores', () => {
    const ctx = makeCtx({ role: 'rh' });
    expect(policy.adminRh(ctx)).toBe(true);
  });

  it('colaborador vê apenas o próprio registro', () => {
    const ctx = makeCtx({ role: 'colaborador', userId: 'u1' });
    expect(policy.colaboradorSelectProprio(ctx, COLABORADORES[0])).toBe(true);
    expect(policy.colaboradorSelectProprio(ctx, COLABORADORES[1])).toBe(false);
    expect(policy.colaboradorSelectProprio(ctx, COLABORADORES[2])).toBe(false);
  });

  it('gerente vê apenas colaboradores do próprio departamento', () => {
    const ctx = makeCtx({ role: 'gerente', departamentoId: 10 });
    expect(policy.gerenteSelectDept(ctx, COLABORADORES[0])).toBe(true);
    expect(policy.gerenteSelectDept(ctx, COLABORADORES[1])).toBe(true);
    expect(policy.gerenteSelectDept(ctx, COLABORADORES[2])).toBe(false);
  });

  it('gerente de outro departamento não vê colaboradores', () => {
    const ctx = makeCtx({ role: 'gerente', departamentoId: 99 });
    expect(COLABORADORES.every(c => !policy.gerenteSelectDept(ctx, c))).toBe(true);
  });
});

// ─── Salários (módulo restrito) ───────────────────────────────────────────────
const SALARIOS = [
  { colaborador_id: 1, valor: 5000 },
  { colaborador_id: 2, valor: 6000 },
];

describe('RLS — Salários (restrito)', () => {
  it('admin acessa todos os salários', () => {
    const ctx = makeCtx({ role: 'admin' });
    expect(policy.adminRhTudo(ctx)).toBe(true);
  });

  it('gerente NÃO tem acesso a salários', () => {
    const ctx = makeCtx({ role: 'gerente', departamentoId: 10 });
    expect(policy.adminRhTudo(ctx)).toBe(false);
    expect(SALARIOS.every(s => !policy.salarioColaborador(ctx, s))).toBe(true);
  });

  it('colaborador vê apenas o próprio salário', () => {
    const ctx = makeCtx({ role: 'colaborador', colaboradorId: 1 });
    expect(policy.salarioColaborador(ctx, SALARIOS[0])).toBe(true);
    expect(policy.salarioColaborador(ctx, SALARIOS[1])).toBe(false);
  });
});

// ─── Férias ───────────────────────────────────────────────────────────────────
const FERIAS = [
  { colaborador_id: 1, data_inicio: '2024-01-10' },
  { colaborador_id: 2, data_inicio: '2024-02-15' },
  { colaborador_id: 3, data_inicio: '2024-03-01' },
];

describe('RLS — Férias', () => {
  it('rh acessa todas as férias', () => {
    const ctx = makeCtx({ role: 'rh' });
    expect(policy.adminRhTudo(ctx)).toBe(true);
  });

  it('gerente vê férias apenas do seu departamento', () => {
    const ctx = makeCtx({ role: 'gerente', departamentoId: 10 });
    expect(policy.gerenteDept(ctx, FERIAS[0], COLABORADORES)).toBe(true);
    expect(policy.gerenteDept(ctx, FERIAS[1], COLABORADORES)).toBe(true);
    expect(policy.gerenteDept(ctx, FERIAS[2], COLABORADORES)).toBe(false);
  });

  it('colaborador vê apenas as próprias férias', () => {
    const ctx = makeCtx({ role: 'colaborador', colaboradorId: 2 });
    expect(policy.colaboradorProprio(ctx, FERIAS[0])).toBe(false);
    expect(policy.colaboradorProprio(ctx, FERIAS[1])).toBe(true);
  });
});

// ─── Vales ────────────────────────────────────────────────────────────────────
const LANCAMENTOS = [
  { colaborador_id: 1, valor: 200 },
  { colaborador_id: 3, valor: 300 },
];

describe('RLS — Vale Combustível / Vale Alimentação', () => {
  it('admin acessa todos os lançamentos', () => {
    const ctx = makeCtx({ role: 'admin' });
    expect(policy.adminRhTudo(ctx)).toBe(true);
  });

  it('gerente vê lançamentos do seu departamento', () => {
    const ctx = makeCtx({ role: 'gerente', departamentoId: 10 });
    expect(policy.gerenteDept(ctx, LANCAMENTOS[0], COLABORADORES)).toBe(true);
    expect(policy.gerenteDept(ctx, LANCAMENTOS[1], COLABORADORES)).toBe(false);
  });

  it('colaborador vê apenas os próprios lançamentos', () => {
    const ctx = makeCtx({ role: 'colaborador', colaboradorId: 1 });
    expect(policy.colaboradorProprio(ctx, LANCAMENTOS[0])).toBe(true);
    expect(policy.colaboradorProprio(ctx, LANCAMENTOS[1])).toBe(false);
  });
});

// ─── Feedbacks ────────────────────────────────────────────────────────────────
const FEEDBACKS = [
  { colaborador_id: 1, confidencial: false, conteudo: 'Bom desempenho' },
  { colaborador_id: 1, confidencial: true,  conteudo: 'Advertência verbal' },
  { colaborador_id: 3, confidencial: false, conteudo: 'Outro depto' },
];

describe('RLS — Feedbacks', () => {
  it('admin vê todos os feedbacks, inclusive confidenciais', () => {
    const ctx = makeCtx({ role: 'admin' });
    expect(policy.adminRhTudo(ctx)).toBe(true);
  });

  it('gerente vê feedbacks não confidenciais do seu departamento', () => {
    const ctx = makeCtx({ role: 'gerente', departamentoId: 10 });
    expect(policy.gerenteFeedbackDept(ctx, FEEDBACKS[0], COLABORADORES)).toBe(true);
    expect(policy.gerenteFeedbackDept(ctx, FEEDBACKS[1], COLABORADORES)).toBe(false); // confidencial bloqueado
    expect(policy.gerenteFeedbackDept(ctx, FEEDBACKS[2], COLABORADORES)).toBe(false); // outro depto
  });

  it('colaborador vê apenas os próprios feedbacks', () => {
    const ctx = makeCtx({ role: 'colaborador', colaboradorId: 1 });
    expect(policy.colaboradorProprio(ctx, FEEDBACKS[0])).toBe(true);
    expect(policy.colaboradorProprio(ctx, FEEDBACKS[2])).toBe(false);
  });

  it('colaborador pode ver próprio feedback confidencial', () => {
    const ctx = makeCtx({ role: 'colaborador', colaboradorId: 1 });
    expect(policy.colaboradorProprio(ctx, FEEDBACKS[1])).toBe(true);
  });
});

// ─── Advertências ────────────────────────────────────────────────────────────
const ADVERTENCIAS = [
  { colaborador_id: 1, tipo: 'verbal' },
  { colaborador_id: 3, tipo: 'escrita' },
];

describe('RLS — Advertências', () => {
  it('rh acessa todas as advertências', () => {
    const ctx = makeCtx({ role: 'rh' });
    expect(policy.adminRhTudo(ctx)).toBe(true);
  });

  it('gerente vê advertências do seu departamento', () => {
    const ctx = makeCtx({ role: 'gerente', departamentoId: 10 });
    expect(policy.gerenteDept(ctx, ADVERTENCIAS[0], COLABORADORES)).toBe(true);
    expect(policy.gerenteDept(ctx, ADVERTENCIAS[1], COLABORADORES)).toBe(false);
  });

  it('colaborador vê apenas as próprias advertências', () => {
    const ctx = makeCtx({ role: 'colaborador', colaboradorId: 1 });
    expect(policy.colaboradorProprio(ctx, ADVERTENCIAS[0])).toBe(true);
    expect(policy.colaboradorProprio(ctx, ADVERTENCIAS[1])).toBe(false);
  });
});

// ─── Cronograma ───────────────────────────────────────────────────────────────
const EVENTOS = [
  { id: 1, titulo: 'Treinamento NR', responsavel_id: 1 },
  { id: 2, titulo: 'Reunião geral',  responsavel_id: 2 },
];

describe('RLS — Cronograma', () => {
  it('todos os perfis autenticados podem ver o cronograma', () => {
    for (const role of ['admin', 'rh', 'gerente', 'colaborador']) {
      expect(policy.cronogramaSelect(makeCtx({ role }))).toBe(true);
    }
  });

  it('admin e rh podem inserir qualquer evento', () => {
    expect(policy.cronogramaInsert(makeCtx({ role: 'admin' }), EVENTOS[0])).toBe(true);
    expect(policy.cronogramaInsert(makeCtx({ role: 'rh' }), EVENTOS[0])).toBe(true);
  });

  it('gerente só pode inserir eventos dos quais é responsável', () => {
    const ctx = makeCtx({ role: 'gerente', colaboradorId: 1 });
    expect(policy.cronogramaInsert(ctx, EVENTOS[0])).toBe(true);
    expect(policy.cronogramaInsert(ctx, EVENTOS[1])).toBe(false);
  });

  it('colaborador não pode inserir eventos', () => {
    const ctx = makeCtx({ role: 'colaborador', colaboradorId: 1 });
    expect(policy.cronogramaInsert(ctx, EVENTOS[0])).toBe(false);
  });
});

// ─── Trilhas de Carreira ──────────────────────────────────────────────────────
describe('RLS — Trilhas de Carreira', () => {
  it('todos os perfis podem ver trilhas de carreira', () => {
    for (const role of ['admin', 'rh', 'gerente', 'colaborador']) {
      expect(policy.trilhasSelect(makeCtx({ role }))).toBe(true);
    }
  });
});

// ─── Plano de Carreiras Colaborador ──────────────────────────────────────────
const PLANOS = [
  { colaborador_id: 1, trilha_id: 10, progresso_percentual: 40 },
  { colaborador_id: 2, trilha_id: 11, progresso_percentual: 70 },
];

describe('RLS — Plano de Carreiras', () => {
  it('admin acessa todos os planos', () => {
    const ctx = makeCtx({ role: 'admin' });
    expect(policy.adminRhTudo(ctx)).toBe(true);
  });

  it('gerente vê planos do seu departamento', () => {
    const ctx = makeCtx({ role: 'gerente', departamentoId: 10 });
    expect(policy.gerenteDept(ctx, PLANOS[0], COLABORADORES)).toBe(true);
    expect(policy.gerenteDept(ctx, PLANOS[1], COLABORADORES)).toBe(true);
  });

  it('colaborador vê apenas o próprio plano', () => {
    const ctx = makeCtx({ role: 'colaborador', colaboradorId: 1 });
    expect(policy.planoColaboradorProprio(ctx, PLANOS[0])).toBe(true);
    expect(policy.planoColaboradorProprio(ctx, PLANOS[1])).toBe(false);
  });

  it('colaborador só pode atualizar o próprio plano sem mudar colaborador_id', () => {
    const ctx = makeCtx({ role: 'colaborador', colaboradorId: 1 });
    const newRow = { colaborador_id: 1, progresso_percentual: 60 };
    expect(policy.planoColaboradorUpdate(ctx, PLANOS[0], newRow)).toBe(true);
  });

  it('colaborador não pode atualizar mudando o colaborador_id', () => {
    const ctx = makeCtx({ role: 'colaborador', colaboradorId: 1 });
    const newRow = { colaborador_id: 2, progresso_percentual: 60 };
    expect(policy.planoColaboradorUpdate(ctx, PLANOS[0], newRow)).toBe(false);
  });
});

// ─── Pesquisas de Clima ───────────────────────────────────────────────────────
describe('RLS — Pesquisas de Clima', () => {
  it('todos os perfis autenticados podem ver pesquisas', () => {
    for (const role of ['admin', 'rh', 'gerente', 'colaborador']) {
      expect(policy.pesquisaSelect(makeCtx({ role }))).toBe(true);
    }
  });

  it('apenas admin e rh gerenciam pesquisas', () => {
    expect(policy.adminRhTudo(makeCtx({ role: 'admin' }))).toBe(true);
    expect(policy.adminRhTudo(makeCtx({ role: 'gerente' }))).toBe(false);
    expect(policy.adminRhTudo(makeCtx({ role: 'colaborador' }))).toBe(false);
  });
});
