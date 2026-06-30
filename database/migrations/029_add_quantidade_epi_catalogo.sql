-- Migration 029: Add quantidade (estoque) to epi_catalogo
-- Quantidade em estoque de cada item do catálogo de EPIs.

ALTER TABLE epi_catalogo ADD COLUMN IF NOT EXISTS quantidade integer NOT NULL DEFAULT 0;
