-- Migration 023: Add turno column to colaboradores and create afastamentos table

-- 1. Add turno column to colaboradores (turno: diurno, noturno)
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS turno VARCHAR(20) DEFAULT 'diurno';

-- 2. Create afastamentos table for tracking atestados, afastamentos, and banco de horas
CREATE TABLE IF NOT EXISTS afastamentos (
  id SERIAL PRIMARY KEY,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL, -- 'atestado', 'afastamento', 'banco_hora'
  data_inicio DATE NOT NULL,
  data_termino DATE NOT NULL,
  dias_totais INTEGER NOT NULL,
  motivo TEXT,
  comprovante_url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente', -- 'pendente', 'aprovado', 'rejeitado'
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_afastamentos_colab_id ON afastamentos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_afastamentos_tipo ON afastamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_afastamentos_data_inicio ON afastamentos(data_inicio);

-- 4. Add RLS policies to afastamentos table
ALTER TABLE afastamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view afastamentos"
  ON afastamentos FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert afastamentos"
  ON afastamentos FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update afastamentos"
  ON afastamentos FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete afastamentos"
  ON afastamentos FOR DELETE
  USING (auth.role() = 'authenticated');
