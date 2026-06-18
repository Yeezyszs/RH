-- Migração 014: tornar cargo_id opcional e adicionar coluna area
-- Data: 2026-06-18
-- Objetivo: remover a obrigatoriedade de cargo no cadastro de colaboradores;
--           a classificação passa a ser por Setor (departamento) + Área.

ALTER TABLE public.colaboradores ALTER COLUMN cargo_id DROP NOT NULL;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS area VARCHAR(120);
