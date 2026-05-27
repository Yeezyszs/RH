-- Migration 007: Fix ferias and desligamentos schema to match frontend expectations

-- ferias: abono_pecuniario as integer (number of days that can be monetized)
ALTER TABLE ferias ADD COLUMN IF NOT EXISTS abono_pecuniario integer NOT NULL DEFAULT 0;

-- desligamentos: store aviso type string, ultimo_dia date, entrevista as JSON
ALTER TABLE desligamentos
  ADD COLUMN IF NOT EXISTS aviso      varchar(20),
  ADD COLUMN IF NOT EXISTS ultimo_dia date,
  ADD COLUMN IF NOT EXISTS entrevista jsonb;
