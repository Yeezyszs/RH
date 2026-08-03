-- Migration 034: Procedimentos da empresa + anexos (PDF) em politicas/procedimentos

-- Colunas de anexo em politicas_empresa
ALTER TABLE politicas_empresa
  ADD COLUMN IF NOT EXISTS arquivo_path text,
  ADD COLUMN IF NOT EXISTS arquivo_nome varchar(300);

-- Nova tabela de procedimentos (mesmo modelo de politicas)
CREATE TABLE IF NOT EXISTS procedimentos_empresa (
  id serial PRIMARY KEY,
  titulo varchar(255) NOT NULL,
  descricao text,
  arquivo_path text,
  arquivo_nome varchar(300),
  criado_em timestamp DEFAULT CURRENT_TIMESTAMP,
  atualizado_em timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_procedimentos_atualizado_em ON procedimentos_empresa(atualizado_em DESC);

ALTER TABLE procedimentos_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view procedimentos" ON procedimentos_empresa FOR SELECT USING (true);
CREATE POLICY "Auth insert procedimentos" ON procedimentos_empresa FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update procedimentos" ON procedimentos_empresa FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete procedimentos" ON procedimentos_empresa FOR DELETE USING (auth.role() = 'authenticated');

-- Bucket de storage para documentos organizacionais (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('organizacional', 'organizacional', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage: usuários autenticados podem gerenciar objetos do bucket
CREATE POLICY "org_docs_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'organizacional');
CREATE POLICY "org_docs_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'organizacional');
CREATE POLICY "org_docs_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'organizacional');
CREATE POLICY "org_docs_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'organizacional');
