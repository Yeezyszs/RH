-- Migration 039: tratativa das mensagens do SAC
-- O RH registra como cada mensagem está sendo tratada (status, providências,
-- responsável) na aba "Tratativa".
ALTER TABLE sac_mensagens
  ADD COLUMN IF NOT EXISTS status_tratativa varchar(20) NOT NULL DEFAULT 'aberta', -- aberta | em_andamento | resolvida
  ADD COLUMN IF NOT EXISTS tratativa text,
  ADD COLUMN IF NOT EXISTS responsavel varchar(120),
  ADD COLUMN IF NOT EXISTS tratado_em timestamp;
