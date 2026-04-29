-- ============================================================================
-- Correções de Segurança — RLS e SECURITY DEFINER Functions
-- Execute ESTE arquivo para corrigir os warnings do Supabase Security Advisor
-- ============================================================================

-- ============================================================================
-- 1. Corrigir SECURITY DEFINER Functions com search_path seguro
-- ============================================================================

-- Dropar e recriar funções com search_path protegido
DROP FUNCTION IF EXISTS get_user_role();
DROP FUNCTION IF EXISTS get_user_id();
DROP FUNCTION IF EXISTS get_colaborador_id();
DROP FUNCTION IF EXISTS get_departamento_id();

CREATE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT perfil FROM usuarios WHERE auth_id = auth.uid()
$$;

CREATE FUNCTION get_user_id()
RETURNS INT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM usuarios WHERE auth_id = auth.uid()
$$;

CREATE FUNCTION get_colaborador_id()
RETURNS INT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM colaboradores WHERE usuario_id = get_user_id()
$$;

CREATE FUNCTION get_departamento_id()
RETURNS INT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT departamento_id FROM colaboradores WHERE usuario_id = get_user_id()
$$;

-- ============================================================================
-- 2. Revogar permissões PUBLIC nas funções (apenas usuários autenticados)
-- ============================================================================

REVOKE EXECUTE ON FUNCTION get_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_user_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_colaborador_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_departamento_id() FROM PUBLIC;

-- Permitir acesso apenas para usuários autenticados (role authenticated)
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_colaborador_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_departamento_id() TO authenticated;

-- ============================================================================
-- 3. Desabilitar RLS em tabelas que não precisam (views e tabelas de configuração)
-- ============================================================================

-- Views não podem ter RLS, mas vamos verificar as tabelas
-- Se necessário, use esta abordagem para tabelas de leitura:
-- ALTER TABLE <tabela> DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Garantir que TODAS as tabelas com RLS têm políticas
-- ============================================================================

-- Verificar se faltam políticas em alguma tabela
SELECT
  t.tablename,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as num_policies
FROM pg_tables t
WHERE schemaname = 'public'
  AND t.tablename IN (
    'usuarios', 'departamentos', 'cargos', 'colaboradores',
    'historico_colaboradores', 'rotatividade', 'desligamentos',
    'documentos', 'asos', 'treinamentos', 'participantes_treinamento',
    'epis', 'vale_combustivel', 'vale_alimentacao', 'ferias', 'salarios',
    'advertencias', 'pesquisas_clima', 'respostas_pesquisa', 'feedbacks',
    'cronograma', 'participantes_cronograma', 'trilhas_carreira',
    'plano_carreiras_colaborador'
  )
ORDER BY num_policies;

-- ============================================================================
-- 5. Adicionar política "permissão negada por padrão" em tabelas críticas
-- ============================================================================

-- Para tabelas que não têm nenhuma política, adicionar deny por padrão
-- Isso garante segurança mesmo que falte uma política específica

-- Exemplo para salários (apenas admin/rh devem acessar):
CREATE POLICY "deny_public_salarios" ON salarios
  FOR ALL USING (false);

-- ============================================================================
-- 6. Recomendações de Segurança Adicionais
-- ============================================================================

-- A. Usar Row Level Security em auth.users também (padrão do Supabase)
-- ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY; -- Já habilitado por padrão

-- B. Criar trigger para atualizar 'atualizado_em' automaticamente
CREATE OR REPLACE FUNCTION update_updated_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em tabelas com 'atualizado_em'
DROP TRIGGER IF EXISTS usuarios_updated_em ON usuarios;
CREATE TRIGGER usuarios_updated_em BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_em();

DROP TRIGGER IF EXISTS colaboradores_updated_em ON colaboradores;
CREATE TRIGGER colaboradores_updated_em BEFORE UPDATE ON colaboradores
  FOR EACH ROW EXECUTE FUNCTION update_updated_em();

DROP TRIGGER IF EXISTS documentos_updated_em ON documentos;
CREATE TRIGGER documentos_updated_em BEFORE UPDATE ON documentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_em();

DROP TRIGGER IF EXISTS salarios_updated_em ON salarios;
CREATE TRIGGER salarios_updated_em BEFORE UPDATE ON salarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_em();

DROP TRIGGER IF EXISTS plano_carreiras_colaborador_updated_em ON plano_carreiras_colaborador;
CREATE TRIGGER plano_carreiras_colaborador_updated_em BEFORE UPDATE ON plano_carreiras_colaborador
  FOR EACH ROW EXECUTE FUNCTION update_updated_em();

-- C. Criar índice em auth_id para performance
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_id ON usuarios(auth_id);

-- D. Adicionar constraint de validação em campos críticos
ALTER TABLE usuarios
  ADD CONSTRAINT check_perfil_valido
  CHECK (perfil IN ('admin', 'rh', 'gerente', 'colaborador'));

ALTER TABLE colaboradores
  ADD CONSTRAINT check_status_valido
  CHECK (status IN ('ativo', 'inativo', 'afastado', 'desligado'));

-- ============================================================================
-- 7. Verificação final de segurança
-- ============================================================================

-- Listar todas as políticas criadas
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verificar funções com SECURITY DEFINER
SELECT
  n.nspname,
  p.proname,
  p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;
