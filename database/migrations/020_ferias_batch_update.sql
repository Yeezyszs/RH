-- Migration 020: Batch vacation (férias) period updates from user spreadsheet

-- Helper function to calculate days between two dates (inclusive)
CREATE OR REPLACE FUNCTION calc_dias(data_inicio DATE, data_termino DATE)
RETURNS INTEGER AS $$
  SELECT (data_termino - data_inicio) + 1;
$$ LANGUAGE SQL IMMUTABLE;

-- Delete existing vacation records for these collaborators to avoid duplicates
DELETE FROM ferias
WHERE colaborador_id IN (
  SELECT id FROM colaboradores
  WHERE nome IN (
    'ADÃO RIBEIRO',
    'GABRIEL MARTINS RIBEIRO',
    'EDUARDO TOKUNAGA JUNIOR',
    'VALDECER PAULINHO ROSA',
    'ANA CLAUDIA BATISTA',
    'YASMIN DE SOUZA FAVARIM',
    'JOSE LUIS RODRIGUES',
    'VALDECIR GONCALVES BUENO',
    'FABIO RODRIGUES DE OLIVEIRA'
  )
);

-- Insert vacation records
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
FROM colaboradores c WHERE c.nome = 'ADÃO RIBEIRO'

UNION ALL

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
FROM colaboradores c WHERE c.nome = 'GABRIEL MARTINS RIBEIRO'

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
FROM colaboradores c WHERE c.nome = 'EDUARDO TOKUNAGA JUNIOR'

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
FROM colaboradores c WHERE c.nome = 'VALDECER PAULINHO ROSA'

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
FROM colaboradores c WHERE c.nome = 'ANA CLAUDIA BATISTA'

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
FROM colaboradores c WHERE c.nome = 'YASMIN DE SOUZA FAVARIM'

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
FROM colaboradores c WHERE c.nome = 'JOSE LUIS RODRIGUES'

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
FROM colaboradores c WHERE c.nome = 'VALDECIR GONCALVES BUENO'

UNION ALL

SELECT
  c.id,
  '2025-01-03'::DATE,
  '2026-01-02'::DATE,
  calc_dias('2025-01-03'::DATE, '2026-01-02'::DATE),
  0,
  0,
  2025,
  true,
  'Período de férias atualizado de acordo com documentação',
  NOW()
FROM colaboradores c WHERE c.nome = 'FABIO RODRIGUES DE OLIVEIRA';
