-- Migração 011: Corrigir problemas de SECURITY DEFINER
-- Data: 2026-05-15

-- 1. Mover rls_auto_enable para schema private (retira da API REST)
CREATE OR REPLACE FUNCTION private.rls_auto_enable()
RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = private, public, pg_catalog
AS $$...$$;

DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end EXECUTE FUNCTION private.rls_auto_enable();
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.rls_auto_enable();

-- 2. Mover colaboradores_pii para schema private
--    (view usa decrypt_pii — SECURITY DEFINER necessário, mas não deve ser pública)
DROP VIEW IF EXISTS public.colaboradores_pii;
CREATE VIEW private.colaboradores_pii AS
  SELECT ... FROM colaboradores c
  WHERE private.get_user_role() = ANY (ARRAY['admin','rh'])
     OR (private.get_user_role() = 'colaborador' AND c.usuario_id = private.get_user_id())
     OR (private.get_user_role() = 'gerente' AND c.departamento_id = private.get_departamento_id());

-- 3. AÇÃO MANUAL NECESSÁRIA:
--    Habilitar Leaked Password Protection em:
--    Supabase Dashboard → Authentication → Sign In / Up → Password Protection
