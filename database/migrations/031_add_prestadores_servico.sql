-- Migration 031: Create prestadores_servico table (documentação de terceiros)
-- Controle de documentação dos prestadores de serviço: ASO, treinamentos,
-- ficha de EPI, certidões (FGTS / INSS) e requisitos de segurança de alimentos.

CREATE TABLE IF NOT EXISTS prestadores_servico (
  id serial PRIMARY KEY,
  empresa varchar(200) NOT NULL,
  nome varchar(200) NOT NULL,
  cpf varchar(20),
  funcao varchar(120),
  aso_valido_ate date,
  treinamentos varchar(20) NOT NULL DEFAULT 'pendente',      -- conforme | nao_conforme | pendente
  ficha_epi varchar(20) NOT NULL DEFAULT 'pendente',          -- conforme | nao_conforme | pendente
  fgts varchar(20) NOT NULL DEFAULT 'pendente',               -- negativa | positiva | pendente
  inss varchar(20) NOT NULL DEFAULT 'pendente',               -- negativa | positiva | pendente
  seguranca_alimentos varchar(20) NOT NULL DEFAULT 'pendente',-- conforme | nao_conforme | pendente | na
  observacoes text,
  criado_em timestamp DEFAULT now(),
  atualizado_em timestamp DEFAULT now()
);

ALTER TABLE prestadores_servico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prestadores_rh_all" ON prestadores_servico;
CREATE POLICY "prestadores_rh_all" ON prestadores_servico
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
