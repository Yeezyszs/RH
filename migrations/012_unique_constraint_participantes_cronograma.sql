-- Migração 012: UNIQUE constraint em participantes_cronograma
-- Data: 2026-05-17
-- Objetivo: Impedir inscrição duplicada de colaborador no mesmo evento de cronograma

ALTER TABLE public.participantes_cronograma
  ADD CONSTRAINT participantes_cronograma_cronograma_id_colaborador_id_key
  UNIQUE (cronograma_id, colaborador_id);
