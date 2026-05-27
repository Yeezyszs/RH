-- ============================================================================
-- Migration 003: Corrigir colunas PII e constraint de status
-- ============================================================================
-- O trigger de criptografia PII limpa cpf/email em texto plano após encriptar.
-- Removemos NOT NULL dessas colunas para compatibilidade com o trigger.
-- Também adicionamos 'ferias' ao check constraint de status (colaborador
-- ativo mas em período de férias é um estado válido no sistema).
-- ============================================================================

-- 1. Permitir NULL em colunas que o trigger PII vai limpar
ALTER TABLE public.colaboradores
  ALTER COLUMN cpf   DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;

-- 2. Adicionar 'ferias' como status válido
ALTER TABLE public.colaboradores DROP CONSTRAINT IF EXISTS check_status_valido;
ALTER TABLE public.colaboradores ADD CONSTRAINT check_status_valido
  CHECK (status IN ('ativo', 'inativo', 'afastado', 'desligado', 'ferias'));
