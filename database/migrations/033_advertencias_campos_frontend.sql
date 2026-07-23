-- Migration 033: alinha advertencias com o modelo do frontend
-- O frontend usa categoria, gestor, testemunhas e dias_suspensao, que não
-- existiam na tabela (o salvamento falhava com "column not found").

ALTER TABLE advertencias
  ADD COLUMN IF NOT EXISTS categoria      varchar(100),
  ADD COLUMN IF NOT EXISTS gestor         varchar(200),
  ADD COLUMN IF NOT EXISTS testemunhas    text,
  ADD COLUMN IF NOT EXISTS dias_suspensao integer;
