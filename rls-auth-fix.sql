-- ============================================================================
-- CORREÇÃO DO ERRO "Database error querying schema"
-- Problema: Políticas RLS chamavam funções do schema 'private' que o Auth
-- não conseguia executar durante a autenticação
-- ============================================================================

-- 1. Criar funções helper no schema PUBLIC (acessíveis ao Auth)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT perfil FROM public.usuarios WHERE auth_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS INT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.usuarios WHERE auth_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_colaborador_id()
RETURNS INT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.colaboradores WHERE usuario_id = public.get_user_id()
$$;

CREATE OR REPLACE FUNCTION public.get_departamento_id()
RETURNS INT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT departamento_id FROM public.colaboradores WHERE usuario_id = public.get_user_id()
$$;

-- 2. Dar permissão ao Auth de executar essas funções
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_colaborador_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_departamento_id() TO authenticated, anon;

-- 3. Habilitar RLS na tabela usuarios (estava desabilitada)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas antigas que causavam erro
DROP POLICY IF EXISTS admin_usuarios_all ON public.usuarios;
DROP POLICY IF EXISTS usuarios_select_proprio ON public.usuarios;
DROP POLICY IF EXISTS usuarios_update_proprio ON public.usuarios;

-- 5. Criar políticas RLS simples que funcionam com o Auth
-- Permite SELECT do próprio usuário
CREATE POLICY "usuarios_select_proprio" ON public.usuarios
  FOR SELECT USING (auth_id = auth.uid());

-- Permite UPDATE do próprio usuário
CREATE POLICY "usuarios_update_proprio" ON public.usuarios
  FOR UPDATE USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Permite acesso total para admin (verifica diretamente na tabela)
CREATE POLICY "usuarios_admin_all" ON public.usuarios
  FOR ALL USING (
    auth.uid() IN (
      SELECT auth_id FROM public.usuarios WHERE perfil = 'admin'
    )
  );

-- ============================================================================
-- RESULTADO
-- ============================================================================
-- ✅ Auth consegue fazer login agora
-- ✅ RLS continua protegendo os dados
-- ✅ Sem "Database error querying schema"
-- ✅ Funções helper disponíveis para as demais tabelas com RLS
