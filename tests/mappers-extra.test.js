import { describe, it, expect } from 'vitest';
import { mapColaborador, mapAdvertencia, mapFerias, mapDesligamento, mapEvento } from './helpers.js';

// Mappers adicionais que espelham a lógica dos módulos
function mapFeedback(row) {
  return {
    id:           row.id,
    colab_id:     row.colaborador_id,
    avaliador:    row.avaliador || row.avaliador_id || '—',
    data:         row.data_feedback || row.data || '',
    tipo:         row.tipo,
    conteudo:     row.conteudo || '',
    avaliacao:    row.avaliacao ?? null,
    confidencial: Boolean(row.confidencial),
    notas: {
      entrega:       row.nota_entrega       ?? null,
      comportamento: row.nota_comportamento ?? null,
      colaboracao:   row.nota_colaboracao   ?? null,
    },
    pontos_fortes:    row.pontos_fortes    || '',
    pontos_desenvolver: row.pontos_desenvolver || '',
    plano_acao:       row.plano_acao       || '',
  };
}

function mapSalario(row) {
  return {
    id:           row.id,
    colab_id:     row.colaborador_id,
    valor:        row.salario || row.valor || 0,
    data_inicio:  row.data_inicio || '',
    data_fim:     row.data_fim    || null,
    tipo:         row.tipo_salario || 'mensalista',
    observacoes:  row.observacoes  || '',
  };
}

function mapValeLancamento(row) {
  return {
    id:          row.id,
    colab_id:    row.colaborador_id,
    competencia: row.competencia || '',
    valor:       row.valor || 0,
    tipo:        row.tipo || 'combustivel',
    status:      row.status || 'pendente',
    observacoes: row.observacoes || '',
  };
}

function mapPlanoCarreira(row) {
  return {
    id:              row.id,
    colab_id:        row.colaborador_id,
    trilha_id:       row.trilha_id,
    data_inicio:     row.data_inicio || '',
    data_conclusao:  row.data_previsao_conclusao || null,
    etapa_atual:     row.etapa_atual || '',
    progresso:       row.progresso_percentual ?? 0,
    cargo_atual_id:  row.cargo_atual_id || null,
    cargo_alvo_id:   row.cargo_alvo_id  || null,
    plano_acao:      row.plano_acao     || '',
    observacoes:     row.observacoes    || '',
  };
}

// ─── mapColaborador ───────────────────────────────────────────────────────────
describe('mapColaborador()', () => {
  const row = {
    id: 1, nome: 'Ana Lima', email: 'ana@empresa.com',
    cpf: '123.456.789-00', genero: 'Feminino',
    data_admissao: '2022-03-01', status: 'ativo',
    cargos: { nome: 'Analista' }, departamentos: { nome: 'TI' },
    departamento_id: 5, cargo_id: 3, salario: 5000,
    tipo_contrato: 'CLT', celular: '(11)99999-0001',
  };

  it('mapeia campos básicos', () => {
    const m = mapColaborador(row);
    expect(m.id).toBe(1);
    expect(m.nome).toBe('Ana Lima');
    expect(m.email).toBe('ana@empresa.com');
  });

  it('usa nome do cargo aninhado', () => expect(mapColaborador(row).cargo).toBe('Analista'));
  it('usa nome do departamento aninhado', () => expect(mapColaborador(row).setor).toBe('TI'));
  it('mapeia sexo feminino para F', () => expect(mapColaborador(row).sexo).toBe('F'));
  it('mapeia sexo masculino para M', () => {
    expect(mapColaborador({ ...row, genero: 'Masculino' }).sexo).toBe('M');
  });
  it('usa celular como telefone preferencial', () => {
    expect(mapColaborador(row).telefone).toBe('(11)99999-0001');
  });
  it('fallback para cargo direto quando sem join', () => {
    const r = { ...row, cargos: null, cargo: 'Dev' };
    expect(mapColaborador(r).cargo).toBe('Dev');
  });
  it('fallback para — quando sem cargo', () => {
    const r = { ...row, cargos: null, cargo: null };
    expect(mapColaborador(r).cargo).toBe('—');
  });
});

// ─── mapAdvertencia ───────────────────────────────────────────────────────────
describe('mapAdvertencia()', () => {
  const row = {
    id: 10, colaborador_id: 1, data_advertencia: '2024-06-10',
    tipo: 'escrita', motivo: 'Atraso', descricao: 'Terceiro atraso no mês',
    resposta_colaborador: null,
  };

  it('mapeia campos corretamente', () => {
    const m = mapAdvertencia(row);
    expect(m.id).toBe(10);
    expect(m.colab_id).toBe(1);
    expect(m.tipo).toBe('escrita');
    expect(m.motivo).toBe('Atraso');
  });

  it('status pendente quando sem resposta', () => {
    expect(mapAdvertencia(row).status).toBe('pendente');
  });

  it('status respondida quando há resposta', () => {
    const m = mapAdvertencia({ ...row, resposta_colaborador: 'Reconheço o atraso.' });
    expect(m.status).toBe('respondida');
  });

  it('descricao padrão como string vazia', () => {
    expect(mapAdvertencia({ ...row, descricao: undefined }).descricao).toBe('');
  });
});

// ─── mapFerias ────────────────────────────────────────────────────────────────
describe('mapFerias()', () => {
  const row = {
    id: 5, colaborador_id: 2,
    data_inicio: '2024-07-01', data_termino: '2024-07-30',
    dias_usados: 30, dias_saldo: 0, ano_referencia: 2024,
    aprovado: true, observacoes: 'Férias anuais',
  };

  it('mapeia todos os campos', () => {
    const m = mapFerias(row);
    expect(m.id).toBe(5);
    expect(m.inicio).toBe('2024-07-01');
    expect(m.fim).toBe('2024-07-30');
    expect(m.dias).toBe(30);
    expect(m.saldo).toBe(0);
    expect(m.ano).toBe(2024);
    expect(m.aprovado).toBe(true);
  });

  it('observacoes padrão como string vazia', () => {
    expect(mapFerias({ ...row, observacoes: undefined }).observacoes).toBe('');
  });
});

// ─── mapDesligamento ──────────────────────────────────────────────────────────
describe('mapDesligamento()', () => {
  const row = {
    id: 7, colaborador_id: 3,
    data_desligamento: '2024-05-31', motivo: 'Pedido de demissão',
    tipo: 'voluntario', encargos_rescisao: 12000,
  };

  it('mapeia campos corretamente', () => {
    const m = mapDesligamento(row);
    expect(m.id).toBe(7);
    expect(m.colab_id).toBe(3);
    expect(m.data).toBe('2024-05-31');
    expect(m.motivo).toBe('Pedido de demissão');
    expect(m.tipo).toBe('voluntario');
    expect(m.valor).toBe(12000);
  });
});

// ─── mapEvento ────────────────────────────────────────────────────────────────
describe('mapEvento()', () => {
  const row = {
    id: 20, titulo: 'Treinamento NR-35',
    data_inicio: '2024-08-15T09:00:00',
    data_termino: '2024-08-15T17:00:00',
    local: 'Sala A', tipo: 'treinamento',
    descricao: 'Trabalho em altura',
  };

  it('mapeia campos corretamente', () => {
    const m = mapEvento(row);
    expect(m.id).toBe(20);
    expect(m.titulo).toBe('Treinamento NR-35');
    expect(m.data).toBe('2024-08-15');
    expect(m.hora_inicio).toBe('09:00');
    expect(m.hora_fim).toBe('17:00');
    expect(m.local).toBe('Sala A');
    expect(m.tipo).toBe('treinamento');
  });

  it('hora vazia quando sem horário', () => {
    const m = mapEvento({ ...row, data_inicio: '2024-08-15', data_termino: '2024-08-15' });
    expect(m.hora_inicio).toBe('');
  });

  it('local padrão como string vazia', () => {
    expect(mapEvento({ ...row, local: undefined }).local).toBe('');
  });
});

// ─── mapFeedback ──────────────────────────────────────────────────────────────
describe('mapFeedback()', () => {
  const row = {
    id: 30, colaborador_id: 1, avaliador_id: 99,
    data_feedback: '2024-09-10', tipo: 'desempenho',
    conteudo: 'Excelente trimestre', avaliacao: 5,
    confidencial: false,
    nota_entrega: 4, nota_comportamento: 5, nota_colaboracao: 5,
    pontos_fortes: 'Proatividade', pontos_desenvolver: 'Comunicação',
    plano_acao: 'Curso de comunicação',
  };

  it('mapeia campos principais', () => {
    const m = mapFeedback(row);
    expect(m.id).toBe(30);
    expect(m.colab_id).toBe(1);
    expect(m.tipo).toBe('desempenho');
    expect(m.confidencial).toBe(false);
  });

  it('mapeia notas corretamente', () => {
    const m = mapFeedback(row);
    expect(m.notas.entrega).toBe(4);
    expect(m.notas.comportamento).toBe(5);
    expect(m.notas.colaboracao).toBe(5);
  });

  it('confidencial convertido para boolean', () => {
    expect(mapFeedback({ ...row, confidencial: 1 }).confidencial).toBe(true);
    expect(mapFeedback({ ...row, confidencial: 0 }).confidencial).toBe(false);
    expect(mapFeedback({ ...row, confidencial: null }).confidencial).toBe(false);
  });

  it('campos opcionais com fallback vazio', () => {
    const m = mapFeedback({ ...row, pontos_fortes: null, plano_acao: undefined });
    expect(m.pontos_fortes).toBe('');
    expect(m.plano_acao).toBe('');
  });
});

// ─── mapSalario ───────────────────────────────────────────────────────────────
describe('mapSalario()', () => {
  const row = {
    id: 40, colaborador_id: 2,
    salario: 8000, data_inicio: '2023-01-01',
    data_fim: null, tipo_salario: 'mensalista',
    observacoes: 'Reajuste anual',
  };

  it('mapeia campos básicos', () => {
    const m = mapSalario(row);
    expect(m.id).toBe(40);
    expect(m.colab_id).toBe(2);
    expect(m.valor).toBe(8000);
    expect(m.tipo).toBe('mensalista');
  });

  it('data_fim nula mantém null', () => {
    expect(mapSalario(row).data_fim).toBeNull();
  });

  it('valor padrão 0 quando ausente', () => {
    expect(mapSalario({ ...row, salario: null, valor: undefined }).valor).toBe(0);
  });
});

// ─── mapValeLancamento ────────────────────────────────────────────────────────
describe('mapValeLancamento()', () => {
  const row = {
    id: 50, colaborador_id: 1,
    competencia: '2024-05', valor: 300,
    tipo: 'combustivel', status: 'aprovado',
    observacoes: '',
  };

  it('mapeia campos corretamente', () => {
    const m = mapValeLancamento(row);
    expect(m.id).toBe(50);
    expect(m.colab_id).toBe(1);
    expect(m.competencia).toBe('2024-05');
    expect(m.valor).toBe(300);
    expect(m.tipo).toBe('combustivel');
    expect(m.status).toBe('aprovado');
  });

  it('status padrão pendente', () => {
    expect(mapValeLancamento({ ...row, status: undefined }).status).toBe('pendente');
  });
});

// ─── mapPlanoCarreira ─────────────────────────────────────────────────────────
describe('mapPlanoCarreira()', () => {
  const row = {
    id: 60, colaborador_id: 1, trilha_id: 10,
    data_inicio: '2023-06-01', data_previsao_conclusao: '2025-06-01',
    etapa_atual: 'Analista Jr', progresso_percentual: 45,
    cargo_atual_id: 3, cargo_alvo_id: 5,
    plano_acao: 'Certificação AWS', observacoes: '',
  };

  it('mapeia campos corretamente', () => {
    const m = mapPlanoCarreira(row);
    expect(m.id).toBe(60);
    expect(m.colab_id).toBe(1);
    expect(m.trilha_id).toBe(10);
    expect(m.progresso).toBe(45);
    expect(m.etapa_atual).toBe('Analista Jr');
  });

  it('progresso padrão 0 quando nulo', () => {
    expect(mapPlanoCarreira({ ...row, progresso_percentual: null }).progresso).toBe(0);
  });

  it('data_conclusao nula quando ausente', () => {
    expect(mapPlanoCarreira({ ...row, data_previsao_conclusao: null }).data_conclusao).toBeNull();
  });
});
