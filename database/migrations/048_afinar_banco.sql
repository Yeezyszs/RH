-- Migration 048: afinação do banco (índices e políticas RLS)
-- Nenhuma mudança no MODELO de acesso: quem podia ver o quê continua igual.
-- O que muda é o custo de avaliar isso a cada requisição.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Políticas restritas a `authenticated`
-- ─────────────────────────────────────────────────────────────────────────────
-- 88 políticas em 29 tabelas estavam sem cláusula TO, o que em Postgres
-- significa PUBLIC — elas eram avaliadas também para a role `anon`, a cada
-- requisição. Como todas dependem de private.get_user_role() (que é nula para
-- anônimo), o anônimo já era negado; a avaliação era puro desperdício e a
-- origem dos 191 alertas de "multiple permissive policies".
--
-- ALTER POLICY altera apenas as roles: as expressões USING/WITH CHECK ficam
-- intactas, o que torna esta mudança verificável e reversível.
--
-- A política `sac_insert_publico` (envio anônimo do SAC) já declara
-- {anon,authenticated} explicitamente e por isso não entra no laço.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND roles::text = '{public}'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated',
                   r.policyname, r.tablename);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Funções de auth avaliadas uma vez, não por linha
-- ─────────────────────────────────────────────────────────────────────────────
-- `auth.uid()` solto na condição é reexecutado para CADA linha avaliada.
-- Envolver em (select ...) faz o planejador calcular uma vez só (InitPlan).
ALTER POLICY "usuario_select_proprio"  ON usuarios USING (auth_id = (select auth.uid()));
ALTER POLICY "usuarios_update_proprio" ON usuarios
  USING (auth_id = (select auth.uid())) WITH CHECK (auth_id = (select auth.uid()));

ALTER POLICY "Authenticated users can delete politicas" ON politicas_empresa
  USING ((select auth.role()) = 'authenticated');
ALTER POLICY "Authenticated users can update politicas" ON politicas_empresa
  USING ((select auth.role()) = 'authenticated');
ALTER POLICY "Authenticated users can insert politicas" ON politicas_empresa
  WITH CHECK ((select auth.role()) = 'authenticated');

ALTER POLICY "Auth delete procedimentos" ON procedimentos_empresa
  USING ((select auth.role()) = 'authenticated');
ALTER POLICY "Auth update procedimentos" ON procedimentos_empresa
  USING ((select auth.role()) = 'authenticated');
ALTER POLICY "Auth insert procedimentos" ON procedimentos_empresa
  WITH CHECK ((select auth.role()) = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Políticas redundantes removidas
-- ─────────────────────────────────────────────────────────────────────────────
-- Duas cópias idênticas da mesma regra (auth_id = auth.uid()) — sobra de
-- migrations anteriores. Políticas permissivas são somadas com OR, então a
-- segunda não acrescentava nada e só custava avaliação.
DROP POLICY IF EXISTS "usuarios_select_proprio" ON usuarios;

-- `admin_usuarios_all` (admin) é subconjunto de `admin_rh_usuarios_all`
-- (admin+rh). Sendo permissivas, a mais restrita é inócua.
DROP POLICY IF EXISTS "admin_usuarios_all" ON usuarios;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Índice duplicado
-- ─────────────────────────────────────────────────────────────────────────────
-- Criado por engano na migration 047: já existia idx_afastamentos_colab_id
-- sobre a mesma coluna. Dois índices idênticos custam escrita e não ajudam.
DROP INDEX IF EXISTS idx_afastamentos_colaborador;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Índices nas chaves estrangeiras
-- ─────────────────────────────────────────────────────────────────────────────
-- 20 FKs sem índice de cobertura. Pesa em dois momentos: no JOIN e, sobretudo,
-- ao excluir a linha referenciada — sem índice, o Postgres varre a tabela
-- inteira em busca de referências (desligar um colaborador toca várias).
CREATE INDEX IF NOT EXISTS idx_advertencias_gerente          ON advertencias (gerente_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_usuario         ON colaboradores (usuario_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_responsavel        ON cronograma (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_departamentos_gerente         ON departamentos (gerente_id);
CREATE INDEX IF NOT EXISTS idx_desligamentos_colaborador     ON desligamentos (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_epis_colaborador              ON epis (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_avaliador           ON feedbacks (avaliador_id);
CREATE INDEX IF NOT EXISTS idx_hist_colab_colaborador        ON historico_colaboradores (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_hist_colab_cargo_ant          ON historico_colaboradores (cargo_anterior_id);
CREATE INDEX IF NOT EXISTS idx_hist_colab_cargo_novo         ON historico_colaboradores (cargo_novo_id);
CREATE INDEX IF NOT EXISTS idx_hist_colab_depto_ant          ON historico_colaboradores (departamento_anterior_id);
CREATE INDEX IF NOT EXISTS idx_hist_colab_depto_novo         ON historico_colaboradores (departamento_novo_id);
CREATE INDEX IF NOT EXISTS idx_part_cronograma_colaborador   ON participantes_cronograma (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_part_cronograma_usuario       ON participantes_cronograma (usuario_id);
CREATE INDEX IF NOT EXISTS idx_pc_colaborador_trilha         ON plano_carreiras_colaborador (trilha_id);
CREATE INDEX IF NOT EXISTS idx_respostas_pesquisa_colab      ON respostas_pesquisa (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_respostas_pesquisa_pesquisa   ON respostas_pesquisa (pesquisa_id);
CREATE INDEX IF NOT EXISTS idx_rotatividade_colaborador      ON rotatividade (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_trilhas_cargo_final           ON trilhas_carreira (cargo_final_id);
CREATE INDEX IF NOT EXISTS idx_trilhas_cargo_inicial         ON trilhas_carreira (cargo_inicial_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Nota sobre os "índices não utilizados" apontados pelo advisor
-- ─────────────────────────────────────────────────────────────────────────────
-- Os demais índices com 0 usos NÃO foram removidos de propósito. As tabelas
-- têm de 0 a 93 linhas; nesse tamanho o planejador prefere varredura
-- sequencial e nunca chega a usá-los — o contador reflete o volume atual, não
-- a utilidade do índice. Todos ocupam 8–16 kB. Removê-los economizaria nada e
-- cobraria caro quando a base crescer. Reavaliar quando as tabelas passarem de
-- alguns milhares de linhas.
