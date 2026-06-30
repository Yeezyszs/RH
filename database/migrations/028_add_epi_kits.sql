-- Migration 028: Create epi_kits table (kits de EPI por área)
-- Os kits de EPI eram mantidos apenas em memória, agrupados por setor.
-- Agora passam a ser persistidos por ÁREA (granularidade pedida), guardando
-- a lista de ids do catálogo (epi_catalogo) esperada para cada área.

CREATE TABLE IF NOT EXISTS epi_kits (
  id serial PRIMARY KEY,
  area varchar(120) NOT NULL UNIQUE,
  epi_ids integer[] NOT NULL DEFAULT '{}',
  atualizado_em timestamp DEFAULT now()
);

ALTER TABLE epi_kits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "epi_kits_rh_all" ON epi_kits;
CREATE POLICY "epi_kits_rh_all" ON epi_kits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
