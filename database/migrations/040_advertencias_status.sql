-- Migration 040: status real da advertência (assinatura)
-- Antes o status era derivado de resposta_colaborador (sempre "pendente").
-- Agora é uma coluna própria: pendente | assinada | recusada.
ALTER TABLE advertencias
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS assinada_em date;
