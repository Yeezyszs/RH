-- Migration 005: Plano de Carreiras
-- Seeds trilhas_carreira and extends plano_carreiras_colaborador for frontend PC_PLANOS

-- Seed the 4 career tracks matching the frontend PC_CARGOS mock data
INSERT INTO trilhas_carreira (nome, descricao, tempo_estimado_meses) VALUES
  ('Operacional',  'Trilha de cargos operacionais de produção e campo',        36),
  ('Técnica',      'Trilha técnica para mecânicos e especialistas industriais', 48),
  ('Gestão',       'Trilha de coordenação e gerência administrativa',           60),
  ('Especialista', 'Trilha especialista para profissionais de área específica', 48)
ON CONFLICT DO NOTHING;

-- Add columns to plano_carreiras_colaborador to match the frontend PC_PLANOS structure
ALTER TABLE plano_carreiras_colaborador
  ADD COLUMN IF NOT EXISTS cargo_atual_id integer,
  ADD COLUMN IF NOT EXISTS cargo_alvo_id  integer,
  ADD COLUMN IF NOT EXISTS plano_acao     text;

-- Unique constraint: one plan per collaborator
ALTER TABLE plano_carreiras_colaborador
  DROP CONSTRAINT IF EXISTS plano_carreiras_colaborador_colaborador_id_key;

ALTER TABLE plano_carreiras_colaborador
  ADD CONSTRAINT plano_carreiras_colaborador_colaborador_id_key UNIQUE (colaborador_id);

-- RLS: allow authenticated users to manage career plans
ALTER TABLE plano_carreiras_colaborador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plano_carreiras_rh_all" ON plano_carreiras_colaborador;
CREATE POLICY "plano_carreiras_rh_all" ON plano_carreiras_colaborador
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE trilhas_carreira ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trilhas_carreira_read" ON trilhas_carreira;
CREATE POLICY "trilhas_carreira_read" ON trilhas_carreira
  FOR SELECT TO authenticated USING (true);
