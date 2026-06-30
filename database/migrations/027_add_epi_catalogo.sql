-- Migration 027: Create epi_catalogo table (catálogo de EPIs)
-- O catálogo de EPIs era mantido apenas em memória (ver 006_schema_fix.sql).
-- Esta tabela passa a persistir os itens do catálogo no banco.

CREATE TABLE IF NOT EXISTS epi_catalogo (
  id serial PRIMARY KEY,
  nome varchar(200) NOT NULL,
  ca varchar(50),
  validade_ca date,
  vida_util_meses integer,
  fabricante varchar(200),
  criado_em timestamp DEFAULT now(),
  atualizado_em timestamp DEFAULT now()
);

ALTER TABLE epi_catalogo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "epi_catalogo_rh_all" ON epi_catalogo;
CREATE POLICY "epi_catalogo_rh_all" ON epi_catalogo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
