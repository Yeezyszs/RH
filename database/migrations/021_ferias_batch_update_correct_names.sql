-- Migration 021: Add remaining vacation records with correct collaborator names from database

-- Delete any existing records that don't match to clean up
DELETE FROM ferias
WHERE colaborador_id IN (
  SELECT id FROM colaboradores
  WHERE nome IN (
    'GABRIEL MARTINS RIBEIRO BEDETI',
    'ANA CLAUDIA BATISTA BENVINDA',
    'YASMIN DE SOUZA FAVARIN MATARUCO',
    'VALDECIR GONÇALVEZ BUENO'
  )
);

-- Insert vacation records with correct names
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
  '2024-12-12'::DATE,
  '2025-12-11'::DATE,
  calc_dias('2024-12-12'::DATE, '2025-12-11'::DATE),
  0,
  0,
  2024,
  true,
  'Período de férias atualizado de acordo com documentação',
  NOW()
FROM colaboradores c WHERE c.nome = 'GABRIEL MARTINS RIBEIRO BEDETI'

UNION ALL

SELECT
  c.id,
  '2024-12-22'::DATE,
  '2025-12-21'::DATE,
  calc_dias('2024-12-22'::DATE, '2025-12-21'::DATE),
  0,
  0,
  2024,
  true,
  'Período de férias atualizado de acordo com documentação',
  NOW()
FROM colaboradores c WHERE c.nome = 'ANA CLAUDIA BATISTA BENVINDA'

UNION ALL

SELECT
  c.id,
  '2024-12-22'::DATE,
  '2025-12-21'::DATE,
  calc_dias('2024-12-22'::DATE, '2025-12-21'::DATE),
  0,
  0,
  2024,
  true,
  'Período de férias atualizado de acordo com documentação',
  NOW()
FROM colaboradores c WHERE c.nome = 'YASMIN DE SOUZA FAVARIN MATARUCO'

UNION ALL

SELECT
  c.id,
  '2024-12-26'::DATE,
  '2025-12-25'::DATE,
  calc_dias('2024-12-26'::DATE, '2025-12-25'::DATE),
  0,
  0,
  2024,
  true,
  'Período de férias atualizado de acordo com documentação',
  NOW()
FROM colaboradores c WHERE c.nome = 'VALDECIR GONÇALVEZ BUENO';
