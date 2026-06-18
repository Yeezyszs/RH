-- Migração 013: RLS para tabela colaboradores
-- Data: 2026-06-18
-- Objetivo: Adicionar políticas RLS faltando na tabela colaboradores
--           Corrigir erro "new row violates row-level security policy"

-- Ativar RLS se não estiver ativado
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

-- POLÍTICA 1: Admin/RH têm acesso total (READ, CREATE, UPDATE, DELETE)
CREATE POLICY admin_rh_colaboradores_all ON public.colaboradores
  FOR ALL
  USING (private.get_user_role() = ANY (ARRAY['admin','rh']));

-- POLÍTICA 2: Gerente vê colaboradores do seu departamento (SELECT)
CREATE POLICY gerente_colaboradores_select_dept ON public.colaboradores
  FOR SELECT
  USING (
    private.get_user_role() = 'gerente'
    AND departamento_id = private.get_departamento_id()
  );

-- POLÍTICA 3: Colaborador vê apenas seus próprios dados (SELECT)
CREATE POLICY colaborador_colaboradores_select_proprio ON public.colaboradores
  FOR SELECT
  USING (
    private.get_user_role() = 'colaborador'
    AND usuario_id = private.get_user_id()
  );

-- POLÍTICA 4: Colaborador pode atualizar seus próprios dados (UPDATE)
CREATE POLICY colaborador_colaboradores_update_proprio ON public.colaboradores
  FOR UPDATE
  USING (
    private.get_user_role() = 'colaborador'
    AND usuario_id = private.get_user_id()
  )
  WITH CHECK (
    private.get_user_role() = 'colaborador'
    AND usuario_id = private.get_user_id()
  );

-- Tabela relacionada: histórico_colaboradores
ALTER TABLE public.historico_colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_rh_historico_all ON public.historico_colaboradores
  FOR ALL
  USING (private.get_user_role() = ANY (ARRAY['admin','rh']));

CREATE POLICY gerente_historico_select_dept ON public.historico_colaboradores
  FOR SELECT
  USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores
      WHERE departamento_id = private.get_departamento_id()
    )
  );

CREATE POLICY colaborador_historico_select_proprio ON public.historico_colaboradores
  FOR SELECT
  USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );
