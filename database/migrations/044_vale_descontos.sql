-- Migration 044: reformulação do vale combustível
-- O benefício deixa de ser controlado por lançamentos de abastecimento e passa
-- a ser um valor fixo mensal por colaborador (padrão configurável, R$ 150,00),
-- do qual se descontam ocorrências (advertência, falta, atraso, etc.).

-- ─── Configurações gerais (chave/valor) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS configuracoes (
  chave         varchar(60) PRIMARY KEY,
  valor         text NOT NULL,
  descricao     text,
  atualizado_em timestamp DEFAULT now()
);

INSERT INTO configuracoes (chave, valor, descricao)
VALUES ('vale_combustivel_valor_padrao', '150', 'Valor mensal padrão do vale combustível (R$)')
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configuracoes_select_auth" ON configuracoes;
CREATE POLICY "configuracoes_select_auth" ON configuracoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_rh_configuracoes_all" ON configuracoes;
CREATE POLICY "admin_rh_configuracoes_all" ON configuracoes
  FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin', 'rh']));

-- ─── Descontos do vale combustível ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vale_descontos (
  id              serial PRIMARY KEY,
  colaborador_id  integer NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  mes             integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano             integer NOT NULL,
  motivo          varchar(20) NOT NULL,  -- advertencia | falta | atraso | suspensao | afastamento | outro
  valor           numeric(12,2) NOT NULL CHECK (valor >= 0),
  data_ocorrencia date,
  observacoes     text,
  criado_em       timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vale_descontos_competencia ON vale_descontos (ano, mes);
CREATE INDEX IF NOT EXISTS idx_vale_descontos_colaborador ON vale_descontos (colaborador_id);

ALTER TABLE vale_descontos ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de acesso do vale_combustivel.
DROP POLICY IF EXISTS "admin_rh_vale_descontos_all" ON vale_descontos;
CREATE POLICY "admin_rh_vale_descontos_all" ON vale_descontos
  FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin', 'rh']));

DROP POLICY IF EXISTS "colaborador_vale_descontos_select_proprio" ON vale_descontos;
CREATE POLICY "colaborador_vale_descontos_select_proprio" ON vale_descontos
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

DROP POLICY IF EXISTS "gerente_vale_descontos_select_dept" ON vale_descontos;
CREATE POLICY "gerente_vale_descontos_select_dept" ON vale_descontos
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );
