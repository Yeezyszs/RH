-- ============================================================================
-- Correção Final de Segurança
-- Move funções helper para schema privado (não exposto via API REST)
-- ============================================================================

-- ============================================================================
-- 1. Criar schema privado (não acessível via API REST do Supabase)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;

-- ============================================================================
-- 2. Dropar funções antigas do schema público
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_user_role();
DROP FUNCTION IF EXISTS public.get_user_id();
DROP FUNCTION IF EXISTS public.get_colaborador_id();
DROP FUNCTION IF EXISTS public.get_departamento_id();
DROP FUNCTION IF EXISTS public.update_updated_em() CASCADE;

-- ============================================================================
-- 3. Recriar funções no schema privado com search_path seguro
-- ============================================================================

CREATE OR REPLACE FUNCTION private.get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, private
STABLE
AS $$
  SELECT perfil FROM public.usuarios WHERE auth_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION private.get_user_id()
RETURNS INT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, private
STABLE
AS $$
  SELECT id FROM public.usuarios WHERE auth_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION private.get_colaborador_id()
RETURNS INT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, private
STABLE
AS $$
  SELECT id FROM public.colaboradores WHERE usuario_id = private.get_user_id()
$$;

CREATE OR REPLACE FUNCTION private.get_departamento_id()
RETURNS INT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, private
STABLE
AS $$
  SELECT departamento_id FROM public.colaboradores WHERE usuario_id = private.get_user_id()
$$;

-- Trigger function com search_path seguro
CREATE OR REPLACE FUNCTION private.update_updated_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. Recriar triggers usando a função do schema privado
-- ============================================================================

DROP TRIGGER IF EXISTS usuarios_updated_em ON public.usuarios;
CREATE TRIGGER usuarios_updated_em BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION private.update_updated_em();

DROP TRIGGER IF EXISTS colaboradores_updated_em ON public.colaboradores;
CREATE TRIGGER colaboradores_updated_em BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION private.update_updated_em();

DROP TRIGGER IF EXISTS documentos_updated_em ON public.documentos;
CREATE TRIGGER documentos_updated_em BEFORE UPDATE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION private.update_updated_em();

DROP TRIGGER IF EXISTS salarios_updated_em ON public.salarios;
CREATE TRIGGER salarios_updated_em BEFORE UPDATE ON public.salarios
  FOR EACH ROW EXECUTE FUNCTION private.update_updated_em();

DROP TRIGGER IF EXISTS plano_carreiras_updated_em ON public.plano_carreiras_colaborador;
CREATE TRIGGER plano_carreiras_updated_em BEFORE UPDATE ON public.plano_carreiras_colaborador
  FOR EACH ROW EXECUTE FUNCTION private.update_updated_em();

-- ============================================================================
-- 5. Recriar TODAS as políticas RLS apontando para schema privado
-- ============================================================================

-- Dropar políticas antigas
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END
$$;

-- USUARIOS
CREATE POLICY "admin_usuarios_all" ON public.usuarios
  FOR ALL USING (private.get_user_role() = 'admin');

CREATE POLICY "usuarios_select_proprio" ON public.usuarios
  FOR SELECT USING (auth_id = auth.uid());

CREATE POLICY "usuarios_update_proprio" ON public.usuarios
  FOR UPDATE USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- DEPARTAMENTOS
CREATE POLICY "admin_rh_departamentos_all" ON public.departamentos
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaborador_departamentos_select" ON public.departamentos
  FOR SELECT USING (private.get_user_role() IN ('gerente', 'colaborador'));

-- CARGOS
CREATE POLICY "admin_rh_cargos_all" ON public.cargos
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaborador_cargos_select" ON public.cargos
  FOR SELECT USING (private.get_user_role() IN ('gerente', 'colaborador'));

-- COLABORADORES
CREATE POLICY "admin_rh_colaboradores_all" ON public.colaboradores
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaboradores_select_dept" ON public.colaboradores
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND departamento_id = private.get_departamento_id()
  );

CREATE POLICY "colaborador_select_proprio" ON public.colaboradores
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND usuario_id = private.get_user_id()
  );

CREATE POLICY "colaborador_update_proprio" ON public.colaboradores
  FOR UPDATE USING (
    private.get_user_role() = 'colaborador'
    AND usuario_id = private.get_user_id()
  )
  WITH CHECK (usuario_id = private.get_user_id());

-- HISTORICO_COLABORADORES
CREATE POLICY "admin_rh_historico_all" ON public.historico_colaboradores
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_historico_select_dept" ON public.historico_colaboradores
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "colaborador_historico_select_proprio" ON public.historico_colaboradores
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

-- ROTATIVIDADE
CREATE POLICY "admin_rh_rotatividade_all" ON public.rotatividade
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_rotatividade_select_dept" ON public.rotatividade
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

-- DESLIGAMENTOS
CREATE POLICY "admin_rh_desligamentos_all" ON public.desligamentos
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_desligamentos_select_dept" ON public.desligamentos
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

-- DOCUMENTOS
CREATE POLICY "admin_rh_documentos_all" ON public.documentos
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_documentos_select_dept" ON public.documentos
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "colaborador_documentos_select_proprio" ON public.documentos
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

CREATE POLICY "colaborador_documentos_insert_proprio" ON public.documentos
  FOR INSERT WITH CHECK (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

-- ASOS
CREATE POLICY "admin_rh_asos_all" ON public.asos
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_asos_select_dept" ON public.asos
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "colaborador_asos_select_proprio" ON public.asos
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

-- TREINAMENTOS
CREATE POLICY "admin_rh_treinamentos_all" ON public.treinamentos
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaborador_treinamentos_select" ON public.treinamentos
  FOR SELECT USING (private.get_user_role() IN ('gerente', 'colaborador'));

-- PARTICIPANTES_TREINAMENTO
CREATE POLICY "admin_rh_part_treinamento_all" ON public.participantes_treinamento
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_part_treinamento_select_dept" ON public.participantes_treinamento
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "colaborador_part_treinamento_select_proprio" ON public.participantes_treinamento
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

CREATE POLICY "colaborador_part_treinamento_insert_proprio" ON public.participantes_treinamento
  FOR INSERT WITH CHECK (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

-- EPIS
CREATE POLICY "admin_rh_epis_all" ON public.epis
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_epis_select_dept" ON public.epis
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "colaborador_epis_select_proprio" ON public.epis
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

-- VALE_COMBUSTIVEL
CREATE POLICY "admin_rh_vale_comb_all" ON public.vale_combustivel
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_vale_comb_select_dept" ON public.vale_combustivel
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "colaborador_vale_comb_select_proprio" ON public.vale_combustivel
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

-- VALE_ALIMENTACAO
CREATE POLICY "admin_rh_vale_alim_all" ON public.vale_alimentacao
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_vale_alim_select_dept" ON public.vale_alimentacao
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "colaborador_vale_alim_select_proprio" ON public.vale_alimentacao
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

-- FERIAS
CREATE POLICY "admin_rh_ferias_all" ON public.ferias
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_ferias_select_dept" ON public.ferias
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "gerente_ferias_update_dept" ON public.ferias
  FOR UPDATE USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "colaborador_ferias_select_proprio" ON public.ferias
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

CREATE POLICY "colaborador_ferias_insert_proprio" ON public.ferias
  FOR INSERT WITH CHECK (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

-- SALARIOS (RESTRITO)
CREATE POLICY "admin_rh_salarios_all" ON public.salarios
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "colaborador_salarios_select_proprio" ON public.salarios
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

-- ADVERTENCIAS
CREATE POLICY "admin_rh_advertencias_all" ON public.advertencias
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_advertencias_select_dept" ON public.advertencias
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "gerente_advertencias_insert_dept" ON public.advertencias
  FOR INSERT WITH CHECK (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "colaborador_advertencias_select_proprio" ON public.advertencias
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

-- PESQUISAS_CLIMA
CREATE POLICY "admin_rh_pesquisas_all" ON public.pesquisas_clima
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaborador_pesquisas_select" ON public.pesquisas_clima
  FOR SELECT USING (
    private.get_user_role() IN ('gerente', 'colaborador')
    AND ativa = true
  );

-- RESPOSTAS_PESQUISA
CREATE POLICY "admin_rh_respostas_all" ON public.respostas_pesquisa
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaborador_respostas_select_proprio" ON public.respostas_pesquisa
  FOR SELECT USING (
    private.get_user_role() IN ('gerente', 'colaborador')
    AND colaborador_id = private.get_colaborador_id()
  );

CREATE POLICY "gerente_colaborador_respostas_insert_proprio" ON public.respostas_pesquisa
  FOR INSERT WITH CHECK (
    private.get_user_role() IN ('gerente', 'colaborador')
    AND colaborador_id = private.get_colaborador_id()
  );

-- FEEDBACKS
CREATE POLICY "admin_rh_feedbacks_all" ON public.feedbacks
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_feedbacks_select_dept" ON public.feedbacks
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
    AND (confidencial = false OR avaliador_id = private.get_user_id())
  );

CREATE POLICY "gerente_feedbacks_insert_dept" ON public.feedbacks
  FOR INSERT WITH CHECK (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "colaborador_feedbacks_select_proprio" ON public.feedbacks
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
    AND confidencial = false
  );

-- CRONOGRAMA
CREATE POLICY "admin_rh_gerente_cronograma_all" ON public.cronograma
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh', 'gerente'));

CREATE POLICY "colaborador_cronograma_select" ON public.cronograma
  FOR SELECT USING (private.get_user_role() = 'colaborador');

-- PARTICIPANTES_CRONOGRAMA
CREATE POLICY "admin_rh_gerente_part_cronograma_all" ON public.participantes_cronograma
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh', 'gerente'));

CREATE POLICY "colaborador_part_cronograma_select_proprio" ON public.participantes_cronograma
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

-- TRILHAS_CARREIRA
CREATE POLICY "admin_rh_trilhas_all" ON public.trilhas_carreira
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaborador_trilhas_select" ON public.trilhas_carreira
  FOR SELECT USING (private.get_user_role() IN ('gerente', 'colaborador'));

-- PLANO_CARREIRAS_COLABORADOR
CREATE POLICY "admin_rh_plano_all" ON public.plano_carreiras_colaborador
  FOR ALL USING (private.get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_plano_select_dept" ON public.plano_carreiras_colaborador
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM public.colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY "colaborador_plano_select_proprio" ON public.plano_carreiras_colaborador
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

CREATE POLICY "colaborador_plano_update_proprio" ON public.plano_carreiras_colaborador
  FOR UPDATE USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  )
  WITH CHECK (colaborador_id = private.get_colaborador_id());
