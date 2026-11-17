-- Migration 063: compliance de segurança do trabalho
--
-- Três assuntos que hoje vivem numa planilha e num punhado de PDFs soltos:
--
--   treinamentos_nr   — a matriz de normas regulamentadoras por colaborador.
--                       Uma linha por pessoa e por norma, e não uma coluna por
--                       NR: a empresa acrescenta norma (NR 33, NR 35, brigada,
--                       CIPA) sem pedir licença, e coluna nova exigiria
--                       migração a cada vez.
--
--   cat_acidentes     — comunicação de acidente de trabalho, com o documento
--                       anexado e o afastamento que ele gerou.
--
--   programas_esocial — LTCAT, PGR, PCMSO e afins, com o PDF e a validade.
--
--   plano_acao_programa — o plano de ação que vem dentro do PGR. Fica preso
--                       ao programa que o originou, porque é dele que a
--                       auditoria cobra: plano solto não diz de onde veio.
--
-- Os arquivos seguem para o bucket `organizacional`, o mesmo das políticas e
-- procedimentos: path e nome ficam aqui, o conteúdo lá.

CREATE TABLE IF NOT EXISTS treinamentos_nr (
  id              serial PRIMARY KEY,
  colaborador_id  integer NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  -- Código da norma como a empresa escreve: 'NR 01', 'NR 11/EN', 'BRIGADA'.
  nr              varchar(20) NOT NULL,
  data_realizacao date,
  -- "REALIZAR" na planilha: a empresa já sabe que a pessoa precisa fazer,
  -- mas ainda não fez. É diferente de nunca ter sido exigido.
  pendente        boolean NOT NULL DEFAULT false,
  validade_meses  integer CHECK (validade_meses IS NULL OR validade_meses > 0),
  observacoes     text,
  criado_em       timestamp DEFAULT now(),
  atualizado_em   timestamp DEFAULT now(),
  UNIQUE (colaborador_id, nr)
);

COMMENT ON TABLE treinamentos_nr IS
  'Matriz de treinamentos de NR por colaborador. Uma linha por (colaborador, norma).';
COMMENT ON COLUMN treinamentos_nr.pendente IS
  'O "REALIZAR" da planilha: exigido e ainda não feito.';

CREATE INDEX IF NOT EXISTS idx_trein_nr_colab ON treinamentos_nr (colaborador_id);

CREATE TABLE IF NOT EXISTS cat_acidentes (
  id                 serial PRIMARY KEY,
  colaborador_id     integer NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  data_acidente      date NOT NULL,
  hora               varchar(5),
  tipo               varchar(30) NOT NULL DEFAULT 'tipico'
                     CHECK (tipo IN ('tipico', 'trajeto', 'doenca')),
  descricao          text,
  parte_corpo        varchar(120),
  houve_afastamento  boolean NOT NULL DEFAULT false,
  afastamento_inicio date,
  afastamento_fim    date,
  numero_cat         varchar(40),
  arquivo_path       text,
  arquivo_nome       text,
  criado_em          timestamp DEFAULT now(),
  CHECK (afastamento_fim IS NULL OR afastamento_inicio IS NULL
         OR afastamento_fim >= afastamento_inicio)
);

COMMENT ON TABLE cat_acidentes IS
  'Comunicações de Acidente de Trabalho, com o documento anexado e o afastamento gerado.';

CREATE INDEX IF NOT EXISTS idx_cat_data ON cat_acidentes (data_acidente DESC);

CREATE TABLE IF NOT EXISTS programas_esocial (
  id            serial PRIMARY KEY,
  tipo          varchar(30) NOT NULL,     -- LTCAT, PGR, PCMSO, PPR, LTIP…
  titulo        varchar(200),
  data_documento date,
  validade      date,
  responsavel   varchar(200),
  arquivo_path  text,
  arquivo_nome  text,
  observacoes   text,
  criado_em     timestamp DEFAULT now()
);

COMMENT ON TABLE programas_esocial IS
  'Programas e laudos de SST enviados ao eSocial (LTCAT, PGR, PCMSO…), com o PDF e a validade.';

CREATE TABLE IF NOT EXISTS plano_acao_programa (
  id           serial PRIMARY KEY,
  programa_id  integer NOT NULL REFERENCES programas_esocial(id) ON DELETE CASCADE,
  item         text NOT NULL,
  risco        varchar(200),
  responsavel  varchar(200),
  prazo        date,
  status       varchar(20) NOT NULL DEFAULT 'pendente'
               CHECK (status IN ('pendente', 'andamento', 'concluido')),
  conclusao    date,
  observacoes  text,
  criado_em    timestamp DEFAULT now()
);

COMMENT ON TABLE plano_acao_programa IS
  'Plano de ação que acompanha o programa (tipicamente o PGR). Preso ao programa que o originou.';

CREATE INDEX IF NOT EXISTS idx_plano_programa ON plano_acao_programa (programa_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Mesmo regime do resto do compliance: admin e RH operam; gerente lê o que é
-- do departamento dele. Programas e plano de ação são da empresa, não de uma
-- pessoa, então o gerente lê tudo.

ALTER TABLE treinamentos_nr      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_acidentes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE programas_esocial    ENABLE ROW LEVEL SECURITY;
ALTER TABLE plano_acao_programa  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_rh_trein_nr_all ON treinamentos_nr;
CREATE POLICY admin_rh_trein_nr_all ON treinamentos_nr FOR ALL TO authenticated
  USING (private.get_user_role() = ANY (ARRAY['admin', 'rh']))
  WITH CHECK (private.get_user_role() = ANY (ARRAY['admin', 'rh']));

DROP POLICY IF EXISTS gerente_trein_nr_select ON treinamentos_nr;
CREATE POLICY gerente_trein_nr_select ON treinamentos_nr FOR SELECT TO authenticated
  USING (private.get_user_role() = 'gerente' AND colaborador_id IN (
    SELECT id FROM colaboradores WHERE departamento_id = private.get_departamento_id()));

DROP POLICY IF EXISTS admin_rh_cat_all ON cat_acidentes;
CREATE POLICY admin_rh_cat_all ON cat_acidentes FOR ALL TO authenticated
  USING (private.get_user_role() = ANY (ARRAY['admin', 'rh']))
  WITH CHECK (private.get_user_role() = ANY (ARRAY['admin', 'rh']));

DROP POLICY IF EXISTS gerente_cat_select ON cat_acidentes;
CREATE POLICY gerente_cat_select ON cat_acidentes FOR SELECT TO authenticated
  USING (private.get_user_role() = 'gerente' AND colaborador_id IN (
    SELECT id FROM colaboradores WHERE departamento_id = private.get_departamento_id()));

DROP POLICY IF EXISTS admin_rh_programas_all ON programas_esocial;
CREATE POLICY admin_rh_programas_all ON programas_esocial FOR ALL TO authenticated
  USING (private.get_user_role() = ANY (ARRAY['admin', 'rh']))
  WITH CHECK (private.get_user_role() = ANY (ARRAY['admin', 'rh']));

DROP POLICY IF EXISTS gerente_programas_select ON programas_esocial;
CREATE POLICY gerente_programas_select ON programas_esocial FOR SELECT TO authenticated
  USING (private.get_user_role() = 'gerente');

DROP POLICY IF EXISTS admin_rh_plano_all ON plano_acao_programa;
CREATE POLICY admin_rh_plano_all ON plano_acao_programa FOR ALL TO authenticated
  USING (private.get_user_role() = ANY (ARRAY['admin', 'rh']))
  WITH CHECK (private.get_user_role() = ANY (ARRAY['admin', 'rh']));

DROP POLICY IF EXISTS gerente_plano_select ON plano_acao_programa;
CREATE POLICY gerente_plano_select ON plano_acao_programa FOR SELECT TO authenticated
  USING (private.get_user_role() = 'gerente');
