-- Migration 025: Create politicas_empresa table for company policies

-- 1. Create politicas_empresa table
CREATE TABLE IF NOT EXISTS politicas_empresa (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create index for ordering by update date
CREATE INDEX IF NOT EXISTS idx_politicas_atualizado_em ON politicas_empresa(atualizado_em DESC);

-- 3. Enable Row Level Security
ALTER TABLE politicas_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view politicas"
  ON politicas_empresa FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert politicas"
  ON politicas_empresa FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update politicas"
  ON politicas_empresa FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete politicas"
  ON politicas_empresa FOR DELETE
  USING (auth.role() = 'authenticated');
