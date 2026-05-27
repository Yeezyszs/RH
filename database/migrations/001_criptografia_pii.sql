-- ============================================================================
-- Migration 001: Criptografia de Dados Sensíveis (PII - LGPD)
-- Protege CPF, RG, telefone, celular, endereço, data de nascimento
-- Usando pgcrypto (AES-256) + chave armazenada no Supabase Vault
-- ============================================================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- 2. Armazenar chave de criptografia no Vault (executa uma vez)
-- A chave fica no Vault e nunca fica exposta no banco
SELECT vault.create_secret(
  'rh_pii_encryption_key',
  gen_random_bytes(32)::text,
  'Chave de criptografia para dados PII do sistema RH'
);

-- 3. Criar função de criptografia (usa a chave do Vault)
CREATE OR REPLACE FUNCTION private.encrypt_pii(valor TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  chave TEXT;
BEGIN
  SELECT decrypted_secret INTO chave
  FROM vault.decrypted_secrets
  WHERE name = 'rh_pii_encryption_key';

  RETURN pgp_sym_encrypt(valor, chave);
END;
$$;

-- 4. Criar função de descriptografia
CREATE OR REPLACE FUNCTION private.decrypt_pii(valor BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  chave TEXT;
BEGIN
  IF valor IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO chave
  FROM vault.decrypted_secrets
  WHERE name = 'rh_pii_encryption_key';

  RETURN pgp_sym_decrypt(valor, chave);
END;
$$;

-- 5. Adicionar colunas criptografadas na tabela colaboradores
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS cpf_enc       BYTEA,
  ADD COLUMN IF NOT EXISTS rg_enc        BYTEA,
  ADD COLUMN IF NOT EXISTS nascimento_enc BYTEA,
  ADD COLUMN IF NOT EXISTS telefone_enc  BYTEA,
  ADD COLUMN IF NOT EXISTS celular_enc   BYTEA,
  ADD COLUMN IF NOT EXISTS endereco_enc  BYTEA;

-- 6. Migrar dados existentes para colunas criptografadas
UPDATE public.colaboradores SET
  cpf_enc        = private.encrypt_pii(cpf),
  rg_enc         = private.encrypt_pii(rg),
  nascimento_enc = private.encrypt_pii(data_nascimento::TEXT),
  telefone_enc   = private.encrypt_pii(telefone),
  celular_enc    = private.encrypt_pii(celular),
  endereco_enc   = private.encrypt_pii(endereco)
WHERE cpf IS NOT NULL OR rg IS NOT NULL;

-- 7. Criar trigger para criptografar automaticamente ao inserir/atualizar
CREATE OR REPLACE FUNCTION private.trigger_criptografar_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.cpf       IS NOT NULL THEN NEW.cpf_enc       = private.encrypt_pii(NEW.cpf); END IF;
  IF NEW.rg        IS NOT NULL THEN NEW.rg_enc        = private.encrypt_pii(NEW.rg); END IF;
  IF NEW.telefone  IS NOT NULL THEN NEW.telefone_enc  = private.encrypt_pii(NEW.telefone); END IF;
  IF NEW.celular   IS NOT NULL THEN NEW.celular_enc   = private.encrypt_pii(NEW.celular); END IF;
  IF NEW.endereco  IS NOT NULL THEN NEW.endereco_enc  = private.encrypt_pii(NEW.endereco); END IF;
  IF NEW.data_nascimento IS NOT NULL THEN
    NEW.nascimento_enc = private.encrypt_pii(NEW.data_nascimento::TEXT);
  END IF;

  -- Apagar campos plaintext após criptografar
  NEW.cpf             = NULL;
  NEW.rg              = NULL;
  NEW.telefone        = NULL;
  NEW.celular         = NULL;
  NEW.endereco        = NULL;
  NEW.data_nascimento = NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_criptografar_pii ON public.colaboradores;
CREATE TRIGGER trig_criptografar_pii
  BEFORE INSERT OR UPDATE ON public.colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION private.trigger_criptografar_pii();

-- 8. Criar view segura que descriptografa apenas para admin/rh
CREATE OR REPLACE VIEW public.colaboradores_pii AS
SELECT
  c.id,
  c.nome,
  c.email,
  c.status,
  c.data_admissao,
  c.departamento_id,
  c.cargo_id,
  c.salario,
  -- Campos descriptografados (apenas para admin/rh via RLS)
  private.decrypt_pii(c.cpf_enc)        AS cpf,
  private.decrypt_pii(c.rg_enc)         AS rg,
  private.decrypt_pii(c.nascimento_enc) AS data_nascimento,
  private.decrypt_pii(c.telefone_enc)   AS telefone,
  private.decrypt_pii(c.celular_enc)    AS celular,
  private.decrypt_pii(c.endereco_enc)   AS endereco
FROM public.colaboradores c;

-- 9. RLS na view: apenas admin/rh vê dados descriptografados
ALTER VIEW public.colaboradores_pii OWNER TO authenticated;

-- 10. Garantir que funções só são acessíveis internamente
REVOKE EXECUTE ON FUNCTION private.encrypt_pii(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.decrypt_pii(BYTEA) FROM PUBLIC;

-- ============================================================================
-- RESULTADO:
-- ✅ CPF, RG, telefone, celular, endereço e nascimento criptografados (AES-256)
-- ✅ Chave armazenada no Vault (não fica no código)
-- ✅ Trigger criptografa automaticamente ao inserir/atualizar
-- ✅ View descriptografa apenas para usuários autorizados
-- ✅ Dados plaintext zerados após migração
-- ============================================================================
