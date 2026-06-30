-- Migration 030: Grupos de EPI
-- No catálogo, variações (ex.: tamanhos de bota/botina) ficam como itens
-- separados para controle de estoque. Nos kits por área, porém, basta exigir
-- o GRUPO (ex.: "Botina") — qualquer tamanho satisfaz a cobertura.

-- Catálogo: campo grupo (NULL = item é seu próprio grupo)
ALTER TABLE epi_catalogo ADD COLUMN IF NOT EXISTS grupo varchar(120);

-- Kits passam a referenciar GRUPOS de EPI em vez de ids de itens
ALTER TABLE epi_kits DROP COLUMN IF EXISTS epi_ids;
ALTER TABLE epi_kits ADD COLUMN IF NOT EXISTS grupos text[] NOT NULL DEFAULT '{}';

-- Agrupa as variações por número de bota/botina
UPDATE epi_catalogo SET grupo = 'Botina Bico PVC'  WHERE nome ILIKE 'BOTINA BICO PVC%';
UPDATE epi_catalogo SET grupo = 'Bota PVC Galocha' WHERE nome ILIKE 'BOTA PVC GALOCHA%';
