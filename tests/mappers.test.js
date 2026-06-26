import { describe, it, expect } from 'vitest';
import {
  mapColaborador,
  mapAdvertencia,
  mapFerias,
  mapDesligamento,
  mapEvento,
} from './helpers.js';

// ── mapColaborador ─────────────────────────────────────────────────────────

describe('mapColaborador', () => {
  const rowCompleto = {
    id: 1,
    nome: 'Ana Paula Costa',
    email: 'ana@empresa.com',
    status: 'ativo',
    data_admissao: '2021-03-15',
    data_nascimento: '1988-07-12',
    genero: 'Feminino',
    cpf: '123.456.789-00',
    celular: '(11) 98765-4321',
    telefone: '(11) 3333-4444',
    endereco: 'Rua das Flores, 120',
    cidade: 'São Paulo',
    estado: 'SP',
    departamento_id: 2,
    cargo_id: 3,
    salario: 5000,
    tipo_contrato: 'CLT',
    escolaridade: 'Superior',
    area: 'RH',
    cargos: { nome: 'Analista RH' },
    departamentos: { nome: 'Administrativo' },
  };

  it('mapeia todos os campos corretamente', () => {
    const r = mapColaborador(rowCompleto);
    expect(r.id).toBe(1);
    expect(r.nome).toBe('Ana Paula Costa');
    expect(r.email).toBe('ana@empresa.com');
    expect(r.status).toBe('ativo');
    expect(r.admissao).toBe('2021-03-15');
    expect(r.nascimento).toBe('1988-07-12');
    expect(r.cargo).toBe('Analista RH');
    expect(r.setor).toBe('Administrativo');
    expect(r.area).toBe('RH');
    expect(r.escolaridade).toBe('Superior');
    expect(r.salario).toBe(5000);
    expect(r.tipo_contrato).toBe('CLT');
    expect(r.departamento_id).toBe(2);
    expect(r.cargo_id).toBe(3);
  });

  it('extrai matrícula dos últimos 6 dígitos do CPF', () => {
    // '123.456.789-00' → remove não-dígitos → '12345678900' → slice(-6) → '678900'
    const r = mapColaborador(rowCompleto);
    expect(r.matricula).toBe('678900');
  });

  it('usa id formatado como matrícula quando CPF ausente', () => {
    expect(mapColaborador({ id: 7, nome: 'X' }).matricula).toBe('000007');
    expect(mapColaborador({ id: 1234, nome: 'X' }).matricula).toBe('001234');
  });

  it('mapeia sexo Feminino → F', () => {
    expect(mapColaborador({ id: 1, nome: 'T', genero: 'Feminino' }).sexo).toBe('F');
  });

  it('mapeia sexo Masculino → M', () => {
    expect(mapColaborador({ id: 1, nome: 'T', genero: 'Masculino' }).sexo).toBe('M');
  });

  it('mapeia qualquer outro genero → O', () => {
    expect(mapColaborador({ id: 1, nome: 'T', genero: 'Outro' }).sexo).toBe('O');
    expect(mapColaborador({ id: 1, nome: 'T' }).sexo).toBe('O');
  });

  it('usa celular com prioridade sobre telefone', () => {
    const r = mapColaborador(rowCompleto);
    expect(r.telefone).toBe('(11) 98765-4321');
  });

  it('usa telefone quando celular ausente', () => {
    const r = mapColaborador({ ...rowCompleto, celular: undefined });
    expect(r.telefone).toBe('(11) 3333-4444');
  });

  it('concatena endereço com " — " como separador', () => {
    const r = mapColaborador(rowCompleto);
    expect(r.endereco).toBe('Rua das Flores, 120 — São Paulo — SP');
  });

  it('omite partes do endereço que são null/undefined', () => {
    const r = mapColaborador({ id: 1, nome: 'X', cidade: 'Campinas', estado: 'SP' });
    expect(r.endereco).toBe('Campinas — SP');
  });

  it('endereço vazio quando todos os campos ausentes', () => {
    expect(mapColaborador({ id: 1, nome: 'X' }).endereco).toBe('');
  });

  it('usa — quando cargo e cargos ausentes', () => {
    expect(mapColaborador({ id: 1, nome: 'X' }).cargo).toBe('—');
  });

  it('usa cargo direto quando cargos (join) ausente', () => {
    expect(mapColaborador({ id: 1, nome: 'X', cargo: 'Motorista' }).cargo).toBe('Motorista');
  });

  it('status padrão é ativo quando ausente', () => {
    expect(mapColaborador({ id: 1, nome: 'X' }).status).toBe('ativo');
  });
});

// ── mapAdvertencia ─────────────────────────────────────────────────────────

describe('mapAdvertencia', () => {
  const row = {
    id: 10,
    colaborador_id: 3,
    data_advertencia: '2024-05-01',
    tipo: 'verbal',
    motivo: 'Atraso recorrente',
    descricao: 'Terceiro atraso no mês',
    resposta_colaborador: null,
  };

  it('mapeia todos os campos', () => {
    const r = mapAdvertencia(row);
    expect(r.id).toBe(10);
    expect(r.colab_id).toBe(3);
    expect(r.data).toBe('2024-05-01');
    expect(r.tipo).toBe('verbal');
    expect(r.motivo).toBe('Atraso recorrente');
    expect(r.descricao).toBe('Terceiro atraso no mês');
  });

  it('status é "pendente" quando sem resposta', () => {
    expect(mapAdvertencia(row).status).toBe('pendente');
  });

  it('status é "respondida" quando há resposta', () => {
    const r = mapAdvertencia({ ...row, resposta_colaborador: 'Reconheço o erro.' });
    expect(r.status).toBe('respondida');
  });

  it('descricao padrão é string vazia', () => {
    expect(mapAdvertencia({ ...row, descricao: undefined }).descricao).toBe('');
  });
});

// ── mapFerias ──────────────────────────────────────────────────────────────

describe('mapFerias', () => {
  const row = {
    id: 5,
    colaborador_id: 2,
    data_inicio: '2024-07-01',
    data_termino: '2024-07-30',
    dias_usados: 30,
    dias_saldo: 0,
    ano_referencia: 2023,
    aprovado: true,
    observacoes: 'Aprovado pela gerência',
  };

  it('mapeia todos os campos', () => {
    const r = mapFerias(row);
    expect(r.id).toBe(5);
    expect(r.colab_id).toBe(2);
    expect(r.inicio).toBe('2024-07-01');
    expect(r.fim).toBe('2024-07-30');
    expect(r.dias).toBe(30);
    expect(r.saldo).toBe(0);
    expect(r.ano).toBe(2023);
    expect(r.aprovado).toBe(true);
    expect(r.observacoes).toBe('Aprovado pela gerência');
  });

  it('observacoes padrão é string vazia', () => {
    expect(mapFerias({ ...row, observacoes: undefined }).observacoes).toBe('');
  });
});

// ── mapDesligamento ────────────────────────────────────────────────────────

describe('mapDesligamento', () => {
  const row = {
    id: 8,
    colaborador_id: 4,
    data_desligamento: '2024-03-15',
    motivo: 'Pedido de demissão',
    tipo: 'voluntario',
    encargos_rescisao: 12500.00,
  };

  it('mapeia todos os campos', () => {
    const r = mapDesligamento(row);
    expect(r.id).toBe(8);
    expect(r.colab_id).toBe(4);
    expect(r.data).toBe('2024-03-15');
    expect(r.motivo).toBe('Pedido de demissão');
    expect(r.tipo).toBe('voluntario');
    expect(r.valor).toBe(12500.00);
  });
});

// ── mapEvento ──────────────────────────────────────────────────────────────

describe('mapEvento', () => {
  const row = {
    id: 3,
    titulo: 'Treinamento NR10',
    data_inicio:  '2024-06-10T08:00:00',
    data_termino: '2024-06-10T17:00:00',
    local: 'Sala de Reuniões A',
    tipo: 'treinamento',
    descricao: 'Treinamento obrigatório de segurança elétrica',
  };

  it('mapeia todos os campos', () => {
    const r = mapEvento(row);
    expect(r.id).toBe(3);
    expect(r.titulo).toBe('Treinamento NR10');
    expect(r.data).toBe('2024-06-10');
    expect(r.hora_inicio).toBe('08:00');
    expect(r.hora_fim).toBe('17:00');
    expect(r.local).toBe('Sala de Reuniões A');
    expect(r.tipo).toBe('treinamento');
    expect(r.descricao).toBe('Treinamento obrigatório de segurança elétrica');
  });

  it('extrai só a data de data_inicio', () => {
    expect(mapEvento({ ...row, data_inicio: '2024-12-31T23:59:59' }).data).toBe('2024-12-31');
  });

  it('aceita timestamp do realtime (separado por espaço)', () => {
    const r = mapEvento({
      ...row,
      data_inicio:  '2024-06-10 08:00:00',
      data_termino: '2024-06-10 17:00:00',
    });
    expect(r.data).toBe('2024-06-10');
    expect(r.hora_inicio).toBe('08:00');
    expect(r.hora_fim).toBe('17:00');
  });

  it('hora_inicio e hora_fim vazios quando datas sem horário', () => {
    const r = mapEvento({ ...row, data_inicio: '2024-06-10', data_termino: '2024-06-10' });
    expect(r.hora_inicio).toBe('');
    expect(r.hora_fim).toBe('');
  });

  it('tipo padrão é "evento" quando ausente', () => {
    expect(mapEvento({ ...row, tipo: undefined }).tipo).toBe('evento');
  });

  it('descricao padrão é string vazia', () => {
    expect(mapEvento({ ...row, descricao: undefined }).descricao).toBe('');
  });

  it('local padrão é string vazia', () => {
    expect(mapEvento({ ...row, local: undefined }).local).toBe('');
  });
});
