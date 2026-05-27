-- Migration 006: Align DB schema with frontend data model
-- Fixes field mismatches that would cause CRUD operations to fail when authenticated.

-- ── asos: add observacoes (frontend VENCIMENTOS uses this field) ──────────────
ALTER TABLE asos ADD COLUMN IF NOT EXISTS observacoes text;

-- ── documentos: add observacoes ───────────────────────────────────────────────
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS observacoes text;

-- ── epis: add frontend-expected columns ───────────────────────────────────────
-- epi_tipo_id  → integer FK to EPI_CATALOGO (stored locally, no DB table)
-- proxima_troca → replaces data_vencimento semantics for the frontend
-- devolvido    → boolean for return status
-- recebido_por → name of recipient
ALTER TABLE epis
  ADD COLUMN IF NOT EXISTS epi_tipo_id   integer,
  ADD COLUMN IF NOT EXISTS proxima_troca date,
  ADD COLUMN IF NOT EXISTS devolvido     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recebido_por  varchar(200);

-- ── salario_atual: one current-salary row per collaborator ────────────────────
-- The existing `salarios` table is a payroll ledger (mes/ano).
-- The frontend SALARIOS dict needs a single "current salary" record per person.
CREATE TABLE IF NOT EXISTS salario_atual (
  id             serial PRIMARY KEY,
  colaborador_id integer     NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  valor          numeric(12,2) NOT NULL DEFAULT 0,
  data_alteracao date        NOT NULL DEFAULT CURRENT_DATE,
  observacoes    text,
  criado_em      timestamp   DEFAULT now(),
  atualizado_em  timestamp   DEFAULT now(),
  UNIQUE (colaborador_id)
);

-- RLS
ALTER TABLE salario_atual ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "salario_atual_rh_all" ON salario_atual;
CREATE POLICY "salario_atual_rh_all" ON salario_atual
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- epis RLS (ensure consistent with other tables)
ALTER TABLE epis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "epis_rh_all" ON epis;
CREATE POLICY "epis_rh_all" ON epis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- documentos / asos RLS
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documentos_rh_all" ON documentos;
CREATE POLICY "documentos_rh_all" ON documentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE asos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asos_rh_all" ON asos;
CREATE POLICY "asos_rh_all" ON asos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
