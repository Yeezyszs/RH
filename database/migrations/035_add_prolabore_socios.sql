-- Migration 035: Pró-labore dos sócios (pró-labore e cartão Cooper)
CREATE TABLE IF NOT EXISTS prolabore_socios (
  id serial PRIMARY KEY,
  socio varchar(200) NOT NULL,
  competencia varchar(7) NOT NULL,               -- 'YYYY-MM'
  tipo varchar(20) NOT NULL DEFAULT 'prolabore', -- prolabore | cooper
  valor_base numeric(12,2) NOT NULL DEFAULT 0,   -- Salário Base (prolabore) / Benefício (cooper)
  inss numeric(12,2) NOT NULL DEFAULT 0,
  unimed numeric(12,2) NOT NULL DEFAULT 0,
  adiantamento numeric(12,2) NOT NULL DEFAULT 0, -- prolabore
  telefone numeric(12,2) NOT NULL DEFAULT 0,     -- cooper
  observacoes text,
  criado_em timestamp DEFAULT now(),
  atualizado_em timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prolabore_competencia ON prolabore_socios(competencia);

ALTER TABLE prolabore_socios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prolabore_rh_all" ON prolabore_socios;
CREATE POLICY "prolabore_rh_all" ON prolabore_socios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
