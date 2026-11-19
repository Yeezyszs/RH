-- 065 — Plano de ação 5W2H para as dimensões fracas do clima
--
-- A pesquisa de clima termina num gráfico de barras por dimensão: verde o que
-- está na meta, amarelo o que está abaixo, vermelho o que está ruim. Até aqui
-- o gráfico só diagnosticava. Uma dimensão amarela ano após ano é o retrato de
-- um diagnóstico que nunca virou ação — e, quando o RH apresenta o resultado,
-- a primeira pergunta da diretoria é o que vai ser feito.
--
-- 5W2H é o formulário que a empresa já usa para isso: o quê, por quê, onde,
-- quando, quem, como e quanto custa. Cada dimensão abaixo da meta ganha uma
-- folha dessas, presa à PESQUISA que a originou — plano solto não diz de qual
-- resultado nasceu, e é a comparação com a pesquisa seguinte que diz se
-- funcionou.
--
-- UMA folha por (pesquisa, dimensão), de propósito: o "como" é texto livre e
-- comporta os passos. Várias folhas para a mesma dimensão na mesma pesquisa
-- dividiriam a responsabilidade sem dizer qual é a principal.

CREATE TABLE IF NOT EXISTS plano_acao_clima (
  id            serial PRIMARY KEY,
  pesquisa_id   integer NOT NULL REFERENCES pesquisas_clima(id) ON DELETE CASCADE,
  -- Chave da dimensão como está em src/utils/clima.js ('reconhecimento',
  -- 'lideranca', …). Fica como texto: as dimensões do questionário são do
  -- código, não uma tabela que o RH cadastra.
  dimensao      varchar(40) NOT NULL,
  -- Nota da dimensão quando o plano nasceu. Guardada porque a pesquisa pode
  -- ser reaberta e recalculada, e o plano precisa dizer de que número partiu.
  nota_origem   numeric(4,2),

  o_que         text NOT NULL,          -- What
  por_que       text,                   -- Why
  onde          varchar(200),           -- Where
  quando        date,                   -- When
  quem          varchar(200),           -- Who
  como          text,                   -- How
  quanto        numeric(12,2),          -- How much

  status        varchar(20) NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente', 'andamento', 'concluido')),
  conclusao     date,
  criado_em     timestamp DEFAULT now(),
  atualizado_em timestamp DEFAULT now(),

  UNIQUE (pesquisa_id, dimensao)
);

COMMENT ON TABLE plano_acao_clima IS
  'Plano de ação 5W2H de uma dimensão da pesquisa de clima. Uma folha por (pesquisa, dimensão).';
COMMENT ON COLUMN plano_acao_clima.nota_origem IS
  'A nota da dimensão quando o plano foi aberto — de que número se partiu.';

CREATE INDEX IF NOT EXISTS idx_plano_clima_pesquisa ON plano_acao_clima (pesquisa_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Mesmo regime das pesquisas de clima: admin e RH operam; gerente lê. O
-- resultado do clima é da empresa inteira, não de um departamento, e o plano
-- que nasce dele também.

ALTER TABLE plano_acao_clima ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_rh_plano_clima_all ON plano_acao_clima;
CREATE POLICY admin_rh_plano_clima_all ON plano_acao_clima FOR ALL TO authenticated
  USING (private.get_user_role() = ANY (ARRAY['admin', 'rh']))
  WITH CHECK (private.get_user_role() = ANY (ARRAY['admin', 'rh']));

DROP POLICY IF EXISTS gerente_plano_clima_select ON plano_acao_clima;
CREATE POLICY gerente_plano_clima_select ON plano_acao_clima FOR SELECT TO authenticated
  USING (private.get_user_role() = 'gerente');
