-- ============================================================================
-- RLS (Row Level Security) — RH System
-- Execute este arquivo APÓS o database-schema.sql
-- ============================================================================

-- ============================================================================
-- PASSO 1: Vincular auth.users do Supabase com a tabela usuarios
-- ============================================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- PASSO 2: Funções helper de segurança
-- ============================================================================

-- Retorna o perfil do usuário autenticado
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT perfil FROM usuarios WHERE auth_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Retorna o id interno do usuário autenticado
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS INT AS $$
  SELECT id FROM usuarios WHERE auth_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Retorna o colaborador_id do usuário autenticado
CREATE OR REPLACE FUNCTION get_colaborador_id()
RETURNS INT AS $$
  SELECT id FROM colaboradores WHERE usuario_id = get_user_id()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Retorna o departamento_id do colaborador autenticado
CREATE OR REPLACE FUNCTION get_departamento_id()
RETURNS INT AS $$
  SELECT departamento_id FROM colaboradores WHERE usuario_id = get_user_id()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================================
-- PASSO 3: Habilitar RLS em todas as tabelas
-- ============================================================================

ALTER TABLE usuarios                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE departamentos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargos                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores               ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_colaboradores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotatividade                ENABLE ROW LEVEL SECURITY;
ALTER TABLE desligamentos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE asos                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE treinamentos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes_treinamento   ENABLE ROW LEVEL SECURITY;
ALTER TABLE epis                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vale_combustivel            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vale_alimentacao            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ferias                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE salarios                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertencias                ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesquisas_clima             ENABLE ROW LEVEL SECURITY;
ALTER TABLE respostas_pesquisa          ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cronograma                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes_cronograma    ENABLE ROW LEVEL SECURITY;
ALTER TABLE trilhas_carreira            ENABLE ROW LEVEL SECURITY;
ALTER TABLE plano_carreiras_colaborador ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASSO 4: Políticas — USUARIOS
-- admin: tudo | rh/gerente/colaborador: apenas o próprio registro
-- ============================================================================

CREATE POLICY "admin_usuarios_all" ON usuarios
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "usuarios_select_proprio" ON usuarios
  FOR SELECT USING (auth_id = auth.uid());

CREATE POLICY "usuarios_update_proprio" ON usuarios
  FOR UPDATE USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- ============================================================================
-- PASSO 5: Políticas — DEPARTAMENTOS
-- admin/rh: tudo | gerente/colaborador: somente leitura
-- ============================================================================

CREATE POLICY "admin_rh_departamentos_all" ON departamentos
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaborador_departamentos_select" ON departamentos
  FOR SELECT USING (get_user_role() IN ('gerente', 'colaborador'));

-- ============================================================================
-- PASSO 6: Políticas — CARGOS
-- admin/rh: tudo | gerente/colaborador: somente leitura
-- ============================================================================

CREATE POLICY "admin_rh_cargos_all" ON cargos
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaborador_cargos_select" ON cargos
  FOR SELECT USING (get_user_role() IN ('gerente', 'colaborador'));

-- ============================================================================
-- PASSO 7: Políticas — COLABORADORES
-- admin/rh: tudo
-- gerente: SELECT apenas do seu departamento
-- colaborador: SELECT/UPDATE apenas do próprio registro
-- ============================================================================

CREATE POLICY "admin_rh_colaboradores_all" ON colaboradores
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaboradores_select_dept" ON colaboradores
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND departamento_id = get_departamento_id()
  );

CREATE POLICY "colaborador_select_proprio" ON colaboradores
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND usuario_id = get_user_id()
  );

CREATE POLICY "colaborador_update_proprio" ON colaboradores
  FOR UPDATE USING (
    get_user_role() = 'colaborador'
    AND usuario_id = get_user_id()
  )
  WITH CHECK (usuario_id = get_user_id());

-- ============================================================================
-- PASSO 8: Políticas — HISTORICO_COLABORADORES
-- admin/rh: tudo | gerente: SELECT do seu dept | colaborador: SELECT próprio
-- ============================================================================

CREATE POLICY "admin_rh_historico_all" ON historico_colaboradores
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_historico_select_dept" ON historico_colaboradores
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "colaborador_historico_select_proprio" ON historico_colaboradores
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

-- ============================================================================
-- PASSO 9: Políticas — ROTATIVIDADE
-- admin/rh: tudo | gerente: SELECT do seu dept | colaborador: sem acesso
-- ============================================================================

CREATE POLICY "admin_rh_rotatividade_all" ON rotatividade
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_rotatividade_select_dept" ON rotatividade
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

-- ============================================================================
-- PASSO 10: Políticas — DESLIGAMENTOS
-- admin/rh: tudo | gerente: SELECT do seu dept | colaborador: sem acesso
-- ============================================================================

CREATE POLICY "admin_rh_desligamentos_all" ON desligamentos
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_desligamentos_select_dept" ON desligamentos
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

-- ============================================================================
-- PASSO 11: Políticas — DOCUMENTOS
-- admin/rh: tudo | gerente: SELECT dept | colaborador: SELECT/INSERT próprio
-- ============================================================================

CREATE POLICY "admin_rh_documentos_all" ON documentos
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_documentos_select_dept" ON documentos
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "colaborador_documentos_select_proprio" ON documentos
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

CREATE POLICY "colaborador_documentos_insert_proprio" ON documentos
  FOR INSERT WITH CHECK (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

-- ============================================================================
-- PASSO 12: Políticas — ASOS
-- admin/rh: tudo | gerente: SELECT dept | colaborador: SELECT próprio
-- ============================================================================

CREATE POLICY "admin_rh_asos_all" ON asos
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_asos_select_dept" ON asos
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "colaborador_asos_select_proprio" ON asos
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

-- ============================================================================
-- PASSO 13: Políticas — TREINAMENTOS
-- admin/rh: tudo | gerente/colaborador: somente leitura
-- ============================================================================

CREATE POLICY "admin_rh_treinamentos_all" ON treinamentos
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaborador_treinamentos_select" ON treinamentos
  FOR SELECT USING (get_user_role() IN ('gerente', 'colaborador'));

-- ============================================================================
-- PASSO 14: Políticas — PARTICIPANTES_TREINAMENTO
-- admin/rh: tudo | gerente: SELECT dept | colaborador: SELECT/INSERT próprio
-- ============================================================================

CREATE POLICY "admin_rh_part_treinamento_all" ON participantes_treinamento
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_part_treinamento_select_dept" ON participantes_treinamento
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "colaborador_part_treinamento_select_proprio" ON participantes_treinamento
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

CREATE POLICY "colaborador_part_treinamento_insert_proprio" ON participantes_treinamento
  FOR INSERT WITH CHECK (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

-- ============================================================================
-- PASSO 15: Políticas — EPIS
-- admin/rh: tudo | gerente: SELECT dept | colaborador: SELECT próprio
-- ============================================================================

CREATE POLICY "admin_rh_epis_all" ON epis
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_epis_select_dept" ON epis
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "colaborador_epis_select_proprio" ON epis
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

-- ============================================================================
-- PASSO 16: Políticas — VALE_COMBUSTIVEL
-- admin/rh: tudo | gerente: SELECT dept | colaborador: SELECT próprio
-- ============================================================================

CREATE POLICY "admin_rh_vale_comb_all" ON vale_combustivel
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_vale_comb_select_dept" ON vale_combustivel
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "colaborador_vale_comb_select_proprio" ON vale_combustivel
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

-- ============================================================================
-- PASSO 17: Políticas — VALE_ALIMENTACAO
-- admin/rh: tudo | gerente: SELECT dept | colaborador: SELECT próprio
-- ============================================================================

CREATE POLICY "admin_rh_vale_alim_all" ON vale_alimentacao
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_vale_alim_select_dept" ON vale_alimentacao
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "colaborador_vale_alim_select_proprio" ON vale_alimentacao
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

-- ============================================================================
-- PASSO 18: Políticas — FERIAS
-- admin/rh: tudo | gerente: SELECT/UPDATE dept | colaborador: SELECT/INSERT próprio
-- ============================================================================

CREATE POLICY "admin_rh_ferias_all" ON ferias
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_ferias_select_dept" ON ferias
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "gerente_ferias_update_dept" ON ferias
  FOR UPDATE USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "colaborador_ferias_select_proprio" ON ferias
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

CREATE POLICY "colaborador_ferias_insert_proprio" ON ferias
  FOR INSERT WITH CHECK (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

-- ============================================================================
-- PASSO 19: Políticas — SALARIOS (RESTRITO)
-- admin/rh: tudo | gerente: sem acesso | colaborador: SELECT apenas do próprio
-- ============================================================================

CREATE POLICY "admin_rh_salarios_all" ON salarios
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "colaborador_salarios_select_proprio" ON salarios
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

-- ============================================================================
-- PASSO 20: Políticas — ADVERTENCIAS
-- admin/rh: tudo | gerente: SELECT/INSERT dept | colaborador: SELECT próprio
-- ============================================================================

CREATE POLICY "admin_rh_advertencias_all" ON advertencias
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_advertencias_select_dept" ON advertencias
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "gerente_advertencias_insert_dept" ON advertencias
  FOR INSERT WITH CHECK (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "colaborador_advertencias_select_proprio" ON advertencias
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

-- ============================================================================
-- PASSO 21: Políticas — PESQUISAS_CLIMA
-- admin/rh: tudo | gerente/colaborador: SELECT apenas pesquisas ativas
-- ============================================================================

CREATE POLICY "admin_rh_pesquisas_all" ON pesquisas_clima
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaborador_pesquisas_select" ON pesquisas_clima
  FOR SELECT USING (
    get_user_role() IN ('gerente', 'colaborador')
    AND ativa = true
  );

-- ============================================================================
-- PASSO 22: Políticas — RESPOSTAS_PESQUISA
-- admin/rh: tudo | gerente/colaborador: SELECT/INSERT próprio
-- ============================================================================

CREATE POLICY "admin_rh_respostas_all" ON respostas_pesquisa
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaborador_respostas_select_proprio" ON respostas_pesquisa
  FOR SELECT USING (
    get_user_role() IN ('gerente', 'colaborador')
    AND colaborador_id = get_colaborador_id()
  );

CREATE POLICY "gerente_colaborador_respostas_insert_proprio" ON respostas_pesquisa
  FOR INSERT WITH CHECK (
    get_user_role() IN ('gerente', 'colaborador')
    AND colaborador_id = get_colaborador_id()
  );

-- ============================================================================
-- PASSO 23: Políticas — FEEDBACKS
-- admin/rh: tudo
-- gerente: SELECT/INSERT do seu dept (exceto confidenciais de outros)
-- colaborador: SELECT apenas dos próprios (exceto confidenciais)
-- ============================================================================

CREATE POLICY "admin_rh_feedbacks_all" ON feedbacks
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_feedbacks_select_dept" ON feedbacks
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
    AND (confidencial = false OR avaliador_id = get_user_id())
  );

CREATE POLICY "gerente_feedbacks_insert_dept" ON feedbacks
  FOR INSERT WITH CHECK (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "colaborador_feedbacks_select_proprio" ON feedbacks
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
    AND confidencial = false
  );

-- ============================================================================
-- PASSO 24: Políticas — CRONOGRAMA
-- admin/rh/gerente: tudo | colaborador: somente leitura
-- ============================================================================

CREATE POLICY "admin_rh_gerente_cronograma_all" ON cronograma
  FOR ALL USING (get_user_role() IN ('admin', 'rh', 'gerente'));

CREATE POLICY "colaborador_cronograma_select" ON cronograma
  FOR SELECT USING (get_user_role() = 'colaborador');

-- ============================================================================
-- PASSO 25: Políticas — PARTICIPANTES_CRONOGRAMA
-- admin/rh/gerente: tudo | colaborador: SELECT próprio
-- ============================================================================

CREATE POLICY "admin_rh_gerente_part_cronograma_all" ON participantes_cronograma
  FOR ALL USING (get_user_role() IN ('admin', 'rh', 'gerente'));

CREATE POLICY "colaborador_part_cronograma_select_proprio" ON participantes_cronograma
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

-- ============================================================================
-- PASSO 26: Políticas — TRILHAS_CARREIRA
-- admin/rh: tudo | gerente/colaborador: somente leitura
-- ============================================================================

CREATE POLICY "admin_rh_trilhas_all" ON trilhas_carreira
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_colaborador_trilhas_select" ON trilhas_carreira
  FOR SELECT USING (get_user_role() IN ('gerente', 'colaborador'));

-- ============================================================================
-- PASSO 27: Políticas — PLANO_CARREIRAS_COLABORADOR
-- admin/rh: tudo | gerente: SELECT dept | colaborador: SELECT/UPDATE próprio
-- ============================================================================

CREATE POLICY "admin_rh_plano_all" ON plano_carreiras_colaborador
  FOR ALL USING (get_user_role() IN ('admin', 'rh'));

CREATE POLICY "gerente_plano_select_dept" ON plano_carreiras_colaborador
  FOR SELECT USING (
    get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = get_departamento_id()
    )
  );

CREATE POLICY "colaborador_plano_select_proprio" ON plano_carreiras_colaborador
  FOR SELECT USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  );

CREATE POLICY "colaborador_plano_update_proprio" ON plano_carreiras_colaborador
  FOR UPDATE USING (
    get_user_role() = 'colaborador'
    AND colaborador_id = get_colaborador_id()
  )
  WITH CHECK (colaborador_id = get_colaborador_id());
