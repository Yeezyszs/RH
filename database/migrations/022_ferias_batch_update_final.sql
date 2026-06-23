-- Migration 022: Add final two vacation records with corrected spellings

-- Insert vacation records for the remaining collaborators
INSERT INTO ferias (
  colaborador_id,
  data_inicio,
  data_termino,
  dias_usados,
  dias_saldo,
  abono_pecuniario,
  ano_referencia,
  aprovado,
  observacoes,
  criado_em
)
SELECT
  c.id,
  '2024-09-10'::DATE,
  '2025-09-09'::DATE,
  calc_dias('2024-09-10'::DATE, '2025-09-09'::DATE),
  0,
  0,
  2024,
  true,
  'Período de férias atualizado de acordo com documentação',
  NOW()
FROM colaboradores c WHERE c.nome = 'ADAO RIBEIRO'

UNION ALL

SELECT
  c.id,
  '2024-12-19'::DATE,
  '2025-12-18'::DATE,
  calc_dias('2024-12-19'::DATE, '2025-12-18'::DATE),
  0,
  0,
  2024,
  true,
  'Período de férias atualizado de acordo com documentação',
  NOW()
FROM colaboradores c WHERE c.nome = 'WALDECIR PAULINO ROSA';
