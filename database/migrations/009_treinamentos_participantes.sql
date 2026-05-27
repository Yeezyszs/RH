-- Migration 009: participantes_treinamento — add data_vencimento + observacoes for vencimentos module
ALTER TABLE participantes_treinamento
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS observacoes     text;

-- RLS
ALTER TABLE participantes_treinamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "participantes_treinamento_rh_all" ON participantes_treinamento;
CREATE POLICY "participantes_treinamento_rh_all" ON participantes_treinamento
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE treinamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "treinamentos_rh_all" ON treinamentos;
CREATE POLICY "treinamentos_rh_all" ON treinamentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
