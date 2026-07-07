-- Migration 032: Create contatos_emergencia table
-- Os contatos de emergência eram mantidos apenas em memória no navegador
-- (sumiam ao recarregar). Esta tabela passa a persisti-los no banco.

CREATE TABLE IF NOT EXISTS contatos_emergencia (
  id serial PRIMARY KEY,
  colaborador_id integer NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  nome varchar(200) NOT NULL,
  telefone varchar(30),
  parentesco varchar(50),
  criado_em timestamp DEFAULT now(),
  atualizado_em timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contatos_emerg_colab ON contatos_emergencia(colaborador_id);

ALTER TABLE contatos_emergencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contatos_emerg_rh_all" ON contatos_emergencia;
CREATE POLICY "contatos_emerg_rh_all" ON contatos_emergencia
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
