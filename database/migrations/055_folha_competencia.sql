-- Migration 055: histórico da folha por competência
--
-- `salario_atual` guarda um valor por pessoa: o salário de hoje. Importar a
-- folha de outubro por cima da de setembro apagava setembro — não havia como
-- ver o salário de um mês passado, nem o custo da folha mês a mês.
--
-- Esta tabela guarda o que cada folha importada disse, por competência. O
-- `salario_atual` continua sendo a verdade do cadastro (é dele que saem os
-- gráficos e a faixa salarial); aqui fica a série histórica.
--
-- Além do salário base, guarda os totais do mês — vencimentos, descontos e
-- líquido. Eles não são salário (variam com hora extra, falta e adiantamento),
-- mas são o custo real daquele mês, que é a pergunta que o histórico responde.

CREATE TABLE IF NOT EXISTS folha_competencia (
  id              serial PRIMARY KEY,
  colaborador_id  integer NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  competencia     char(7) NOT NULL,          -- 'AAAA-MM'
  salario_base    numeric(12,2) NOT NULL CHECK (salario_base >= 0),
  vencimentos     numeric(12,2),
  descontos       numeric(12,2),
  liquido         numeric(12,2),
  cargo           varchar(120),
  codigo_folha    varchar(20),
  criado_em       timestamp DEFAULT now(),
  UNIQUE (colaborador_id, competencia)
);

COMMENT ON TABLE folha_competencia IS
  'O que cada folha de pagamento importada disse, por competência. Série histórica; o salário vigente fica em salario_atual.';
COMMENT ON COLUMN folha_competencia.salario_base IS 'Salário contratual lido do holerite';
COMMENT ON COLUMN folha_competencia.liquido IS 'Valor líquido daquele mês — não é salário, é o que foi pago';

CREATE INDEX IF NOT EXISTS idx_folha_competencia_comp ON folha_competencia (competencia);

-- Mesmo regime de acesso dos salários: dado sensível, só admin e RH.
ALTER TABLE folha_competencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_rh_folha_competencia_all ON folha_competencia;
CREATE POLICY admin_rh_folha_competencia_all ON folha_competencia
  FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin', 'rh']));

DROP POLICY IF EXISTS colaborador_folha_competencia_proprio ON folha_competencia;
CREATE POLICY colaborador_folha_competencia_proprio ON folha_competencia
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );
