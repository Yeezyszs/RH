-- Migration 008: Extend feedbacks, pesquisas_clima, vale_combustivel
-- to match frontend field model (keeps existing columns for backward compat)

-- feedbacks: frontend uses individual scores + structured fields
ALTER TABLE feedbacks
  ADD COLUMN IF NOT EXISTS avaliador          varchar(200),
  ADD COLUMN IF NOT EXISTS data               date,
  ADD COLUMN IF NOT EXISTS nota_entrega       smallint,
  ADD COLUMN IF NOT EXISTS nota_comportamento smallint,
  ADD COLUMN IF NOT EXISTS nota_colaboracao   smallint,
  ADD COLUMN IF NOT EXISTS pontos_fortes      text,
  ADD COLUMN IF NOT EXISTS pontos_desenvolver text,
  ADD COLUMN IF NOT EXISTS plano_acao         text;

-- pesquisas_clima: frontend stores aggregated scores and participation
ALTER TABLE pesquisas_clima
  ADD COLUMN IF NOT EXISTS inicio               date,
  ADD COLUMN IF NOT EXISTS fim                  date,
  ADD COLUMN IF NOT EXISTS convidados           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responderam          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_lideranca      numeric(4,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_ambiente       numeric(4,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_reconhecimento numeric(4,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_carreira       numeric(4,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_comunicacao    numeric(4,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_remuneracao    numeric(4,1) NOT NULL DEFAULT 0;

-- vale_combustivel: frontend tracks individual transactions (not just monthly cotas)
ALTER TABLE vale_combustivel
  ADD COLUMN IF NOT EXISTS data        date,
  ADD COLUMN IF NOT EXISTS valor       numeric(10,2),
  ADD COLUMN IF NOT EXISTS litros      numeric(8,2),
  ADD COLUMN IF NOT EXISTS km_atual    integer,
  ADD COLUMN IF NOT EXISTS posto       varchar(200),
  ADD COLUMN IF NOT EXISTS observacoes text;

-- RLS for all three
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feedbacks_rh_all" ON feedbacks;
CREATE POLICY "feedbacks_rh_all" ON feedbacks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE pesquisas_clima ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pesquisas_clima_rh_all" ON pesquisas_clima;
CREATE POLICY "pesquisas_clima_rh_all" ON pesquisas_clima
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE vale_combustivel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vale_combustivel_rh_all" ON vale_combustivel;
CREATE POLICY "vale_combustivel_rh_all" ON vale_combustivel
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
