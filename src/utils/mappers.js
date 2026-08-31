// Mappers banco → UI.
//
// Extraídos de supabase.js para poderem ser testados: o supabase.js instancia
// o client no carregamento, o que impede importá-lo fora do navegador. Enquanto
// estavam lá, os testes exercitavam uma cópia em tests/helpers.js — e passavam
// verdes mesmo com a versão de produção quebrada (aconteceu com o status das
// advertências).
//
// Script clássico (supabase.js não é módulo ES): expõe no window ao final.

function mapColaborador(row) {
  return {
    id:            row.id,
    nome:          row.nome,
    matricula:     row.cpf?.replace(/\D/g, '').slice(-6) || String(row.id).padStart(6, '0'),
    cargo:         row.cargos?.nome        || row.cargo  || '—',
    setor:         row.departamentos?.nome || row.setor  || '—',
    area:          row.area                || '',
    sexo:          row.genero === 'Masculino' ? 'M' : row.genero === 'Feminino' ? 'F' : 'O',
    escolaridade:  row.escolaridade        || '',
    admissao:      row.data_admissao       || '',
    status:        row.status              || 'ativo',
    nascimento:    row.data_nascimento     || '',
    cpf:           row.cpf                 || '',
    telefone:      row.celular || row.telefone || '',
    email:         row.email               || '',
    endereco:      [row.endereco, row.cidade, row.estado].filter(Boolean).join(' — '),
    departamento_id: row.departamento_id,
    cargo_id:      row.cargo_id,
    salario:       row.salario,
    tipo_contrato: row.tipo_contrato,
  };
}

function mapAdvertencia(row) {
  return {
    id:             row.id,
    colab_id:       row.colaborador_id,
    colaborador_id: row.colaborador_id,
    data:           row.data_advertencia,
    tipo:           row.tipo,
    categoria:      row.categoria || '',
    motivo:         row.motivo,
    descricao:      row.descricao || '',
    gestor:         row.gestor || '',
    testemunhas:    row.testemunhas || '',
    dias_suspensao: row.dias_suspensao ?? null,
    assinada_em:    row.assinada_em || null,
    status:         row.status || (row.resposta_colaborador ? 'respondida' : 'pendente'),
  };
}

function mapFerias(row) {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicio = row.data_inicio;
  const fim    = row.data_termino;
  const status = fim < hoje ? 'concluida' : inicio <= hoje ? 'em_curso' : 'planejada';
  return {
    id:             row.id,
    colaborador_id: row.colaborador_id,
    inicio,
    fim,
    dias:           row.dias_usados,
    abono:          row.abono_pecuniario ?? 0,
    saldo:          row.dias_saldo,
    ano:            row.ano_referencia,
    aprovado:       row.aprovado,
    valor:          row.valor_pago != null ? parseFloat(row.valor_pago) : null,
    observacoes:    row.observacoes || '',
    status,
  };
}

function mapDesligamento(row) {
  const c = row.colaboradores || {};
  return {
    id:             row.id,
    colaborador_id: row.colaborador_id,
    nome:           c.nome           || row.nome           || '—',
    cargo:          c.cargo          || row.cargo          || '—',
    setor:          c.setor          || row.setor          || '—',
    admissao:       c.data_admissao  || row.admissao       || null,
    data:           row.data_desligamento,
    ultimo_dia:     row.ultimo_dia   || row.data_desligamento,
    motivo:      row.motivo,
    tipo:        row.tipo,
    aviso:       row.aviso        || null,
    observacoes: row.observacoes  || '',
    entrevista:  row.entrevista   || { realizada: false },
    valor:       row.encargos_rescisao,
  };
}

function mapEvento(row) {
  if (!row) return { id: undefined, titulo: '', data: undefined, hora_inicio: '', hora_fim: '', local: '', tipo: 'evento', status: 'agendado', descricao: '' };
  // Timestamps podem vir com 'T' (API REST) ou espaço (Realtime). Normaliza.
  const ini = row.data_inicio ? String(row.data_inicio).replace(' ', 'T') : '';
  const fim = row.data_termino ? String(row.data_termino).replace(' ', 'T') : '';
  return {
    id:          row.id,
    titulo:      row.titulo,
    data:        ini ? ini.slice(0, 10) : undefined,
    hora_inicio: ini.split('T')[1]?.slice(0, 5) || '',
    hora_fim:    fim.split('T')[1]?.slice(0, 5) || '',
    local:       row.local || '',
    tipo:        row.tipo || 'evento',
    status:      row.status || 'agendado',
    descricao:   row.descricao || '',
  };
}

window.mapColaborador  = mapColaborador;
window.mapAdvertencia  = mapAdvertencia;
window.mapFerias       = mapFerias;
window.mapDesligamento = mapDesligamento;
window.mapEvento       = mapEvento;
