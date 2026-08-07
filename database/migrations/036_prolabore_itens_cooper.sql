-- Migration 036: itens livres do Cooper (ex.: pá carregadeira) como lista JSON
-- Cada item: { "descricao": "Pá carregadeira", "valor": 1234.56 }
ALTER TABLE prolabore_socios
  ADD COLUMN IF NOT EXISTS itens jsonb NOT NULL DEFAULT '[]'::jsonb;
