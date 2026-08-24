-- Migration 038: SAC anônimo (canal de opiniões/sugestões dos funcionários)
-- A página pública (sac.html) permite envio ANÔNIMO por qualquer pessoa (role anon).
-- A leitura/gestão fica restrita aos usuários autenticados (RH).

CREATE TABLE IF NOT EXISTS sac_mensagens (
  id serial PRIMARY KEY,
  categoria varchar(30) NOT NULL,        -- sugestao | reclamacao | elogio | duvida | outro
  mensagem text NOT NULL,
  lido boolean NOT NULL DEFAULT false,
  criado_em timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sac_criado_em ON sac_mensagens(criado_em DESC);

ALTER TABLE sac_mensagens ENABLE ROW LEVEL SECURITY;

-- Qualquer um (inclusive anônimo) pode ENVIAR uma mensagem.
DROP POLICY IF EXISTS "sac_insert_publico" ON sac_mensagens;
CREATE POLICY "sac_insert_publico" ON sac_mensagens
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Somente usuários autenticados (RH) podem LER e gerenciar.
DROP POLICY IF EXISTS "sac_select_auth" ON sac_mensagens;
CREATE POLICY "sac_select_auth" ON sac_mensagens FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sac_update_auth" ON sac_mensagens;
CREATE POLICY "sac_update_auth" ON sac_mensagens FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "sac_delete_auth" ON sac_mensagens;
CREATE POLICY "sac_delete_auth" ON sac_mensagens FOR DELETE TO authenticated USING (true);
