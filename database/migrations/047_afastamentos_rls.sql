-- Migration 047: políticas RLS de `afastamentos`
-- A tabela tinha RLS habilitado e NENHUMA política — em Postgres isso nega
-- todo acesso, então a funcionalidade estava inoperante em produção (a carga
-- falhava em silêncio e a tela ficava sempre vazia).
--
-- Mesmo modelo de acesso das demais tabelas de pessoal, com uma diferença:
-- aqui as políticas são restritas a `TO authenticated`. Sem isso elas também
-- são avaliadas para a role `anon` a cada requisição, que é a origem dos
-- alertas de "multiple permissive policies" nas outras tabelas.

DROP POLICY IF EXISTS "admin_rh_afastamentos_all" ON afastamentos;
CREATE POLICY "admin_rh_afastamentos_all" ON afastamentos
  FOR ALL TO authenticated
  USING (private.get_user_role() = ANY (ARRAY['admin', 'rh']))
  WITH CHECK (private.get_user_role() = ANY (ARRAY['admin', 'rh']));

-- O colaborador enxerga apenas os próprios afastamentos.
DROP POLICY IF EXISTS "colaborador_afastamentos_select_proprio" ON afastamentos;
CREATE POLICY "colaborador_afastamentos_select_proprio" ON afastamentos
  FOR SELECT TO authenticated
  USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id()
  );

-- O gerente enxerga apenas os do próprio departamento.
DROP POLICY IF EXISTS "gerente_afastamentos_select_dept" ON afastamentos;
CREATE POLICY "gerente_afastamentos_select_dept" ON afastamentos
  FOR SELECT TO authenticated
  USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

-- FK sem índice de cobertura (apontado pelo advisor de performance).
CREATE INDEX IF NOT EXISTS idx_afastamentos_colaborador ON afastamentos (colaborador_id);
