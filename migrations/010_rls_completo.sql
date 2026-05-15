-- Migração 010: RLS completo para todas as tabelas
-- Data: 2026-05-15
-- Objetivo: Corrigir políticas RLS faltantes em 13 tabelas
--           Resolver issues de segurança (SECURITY DEFINER, search_path)

-- FÉRIAS
CREATE POLICY admin_rh_ferias_all ON public.ferias FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY gerente_ferias_select_dept ON public.ferias FOR SELECT USING (private.get_user_role() = 'gerente' AND colaborador_id IN (SELECT id FROM colaboradores WHERE departamento_id = private.get_departamento_id()));
CREATE POLICY colaborador_ferias_select_proprio ON public.ferias FOR SELECT USING (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());

-- SALÁRIOS
CREATE POLICY admin_rh_salarios_all ON public.salarios FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY colaborador_salarios_select_proprio ON public.salarios FOR SELECT USING (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());

-- SALÁRIO ATUAL
CREATE POLICY admin_rh_salario_atual_all ON public.salario_atual FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY colaborador_salario_atual_select_proprio ON public.salario_atual FOR SELECT USING (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());

-- VALE COMBUSTÍVEL
CREATE POLICY admin_rh_vale_combustivel_all ON public.vale_combustivel FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY gerente_vale_combustivel_select_dept ON public.vale_combustivel FOR SELECT USING (private.get_user_role() = 'gerente' AND colaborador_id IN (SELECT id FROM colaboradores WHERE departamento_id = private.get_departamento_id()));
CREATE POLICY colaborador_vale_combustivel_select_proprio ON public.vale_combustivel FOR SELECT USING (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());

-- VALE ALIMENTAÇÃO
CREATE POLICY admin_rh_vale_alimentacao_all ON public.vale_alimentacao FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY gerente_vale_alimentacao_select_dept ON public.vale_alimentacao FOR SELECT USING (private.get_user_role() = 'gerente' AND colaborador_id IN (SELECT id FROM colaboradores WHERE departamento_id = private.get_departamento_id()));
CREATE POLICY colaborador_vale_alimentacao_select_proprio ON public.vale_alimentacao FOR SELECT USING (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());

-- ADVERTÊNCIAS
CREATE POLICY admin_rh_advertencias_all ON public.advertencias FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY gerente_advertencias_select_dept ON public.advertencias FOR SELECT USING (private.get_user_role() = 'gerente' AND colaborador_id IN (SELECT id FROM colaboradores WHERE departamento_id = private.get_departamento_id()));
CREATE POLICY colaborador_advertencias_select_proprio ON public.advertencias FOR SELECT USING (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());

-- FEEDBACKS
CREATE POLICY admin_rh_feedbacks_all ON public.feedbacks FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY gerente_feedbacks_select_dept ON public.feedbacks FOR SELECT USING (private.get_user_role() = 'gerente' AND confidencial = false AND colaborador_id IN (SELECT id FROM colaboradores WHERE departamento_id = private.get_departamento_id()));
CREATE POLICY colaborador_feedbacks_select_proprio ON public.feedbacks FOR SELECT USING (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());
CREATE POLICY colaborador_feedbacks_insert_proprio ON public.feedbacks FOR INSERT WITH CHECK (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());

-- PESQUISAS CLIMA
CREATE POLICY admin_rh_pesquisas_clima_all ON public.pesquisas_clima FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY gerente_colaborador_pesquisas_clima_select ON public.pesquisas_clima FOR SELECT USING (private.get_user_role() = ANY (ARRAY['gerente','colaborador']));

-- RESPOSTAS PESQUISA
CREATE POLICY admin_rh_respostas_pesquisa_all ON public.respostas_pesquisa FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY colaborador_respostas_pesquisa_select_proprio ON public.respostas_pesquisa FOR SELECT USING (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());
CREATE POLICY colaborador_respostas_pesquisa_insert_proprio ON public.respostas_pesquisa FOR INSERT WITH CHECK (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());

-- CRONOGRAMA
CREATE POLICY admin_rh_cronograma_all ON public.cronograma FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY gerente_cronograma_select ON public.cronograma FOR SELECT USING (private.get_user_role() = 'gerente');
CREATE POLICY gerente_cronograma_insert ON public.cronograma FOR INSERT WITH CHECK (private.get_user_role() = 'gerente' AND responsavel_id = private.get_colaborador_id());
CREATE POLICY gerente_cronograma_update_proprio ON public.cronograma FOR UPDATE USING (private.get_user_role() = 'gerente' AND responsavel_id = private.get_colaborador_id());
CREATE POLICY colaborador_cronograma_select ON public.cronograma FOR SELECT USING (private.get_user_role() = 'colaborador');

-- PARTICIPANTES CRONOGRAMA
CREATE POLICY admin_rh_part_cronograma_all ON public.participantes_cronograma FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY gerente_part_cronograma_select_dept ON public.participantes_cronograma FOR SELECT USING (private.get_user_role() = 'gerente' AND colaborador_id IN (SELECT id FROM colaboradores WHERE departamento_id = private.get_departamento_id()));
CREATE POLICY colaborador_part_cronograma_select_proprio ON public.participantes_cronograma FOR SELECT USING (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());
CREATE POLICY colaborador_part_cronograma_insert_proprio ON public.participantes_cronograma FOR INSERT WITH CHECK (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());

-- TRILHAS CARREIRA
CREATE POLICY admin_rh_trilhas_carreira_all ON public.trilhas_carreira FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY gerente_colaborador_trilhas_select ON public.trilhas_carreira FOR SELECT USING (private.get_user_role() = ANY (ARRAY['gerente','colaborador']));

-- PLANO CARREIRAS COLABORADOR
CREATE POLICY admin_rh_plano_carreiras_all ON public.plano_carreiras_colaborador FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
CREATE POLICY gerente_plano_carreiras_select_dept ON public.plano_carreiras_colaborador FOR SELECT USING (private.get_user_role() = 'gerente' AND colaborador_id IN (SELECT id FROM colaboradores WHERE departamento_id = private.get_departamento_id()));
CREATE POLICY colaborador_plano_carreiras_select_proprio ON public.plano_carreiras_colaborador FOR SELECT USING (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id());
CREATE POLICY colaborador_plano_carreiras_update_proprio ON public.plano_carreiras_colaborador FOR UPDATE USING (private.get_user_role() = 'colaborador' AND colaborador_id = private.get_colaborador_id()) WITH CHECK (colaborador_id = private.get_colaborador_id());

-- SEGURANÇA: mover rls_auto_enable para schema private
-- (retira da API REST, corrige search_path)
-- Ver: migrations/011_security_fixes.sql
