-- 067 — O holerite em PDF, recortado por pessoa
--
-- A folha que a contabilidade exporta é um PDF só, com uma página por
-- colaborador (impressa em duas vias). O sistema já lê esse arquivo e guarda o
-- que ele diz — verbas, bases, totais —, mas o papel em si se perdia: para
-- rever o holerite original de alguém era preciso achar o PDF do mês e
-- procurar a página.
--
-- Agora a importação recorta a página de cada um e guarda o holerite
-- individual preso à competência. O arquivo de cada pessoa tem só os dados
-- dela, então dá para entregar ou mandar sem expor a folha inteira.
--
-- O caminho é estável — `<competência>/<colaborador>.pdf` —, então reimportar
-- o mesmo mês substitui o arquivo em vez de acumular cópias órfãs.

ALTER TABLE folha_competencia
  ADD COLUMN IF NOT EXISTS holerite_path varchar(300),
  ADD COLUMN IF NOT EXISTS holerite_nome varchar(200);

COMMENT ON COLUMN folha_competencia.holerite_path IS
  'Caminho no bucket `holerites`: <competência>/<colaborador_id>.pdf';

-- ───────────────────────────────────────────────────────────────────────────
-- Bucket próprio, e não o `organizacional`.
--
-- O bucket de políticas e procedimentos é legível por qualquer usuário
-- autenticado — inclusive gerente. Holerite é salário com nome em cima: o
-- mesmo dado que faz `folha_competencia` ser restrita a admin e RH. Guardar os
-- dois no mesmo bucket daria ao gerente, pelo storage, o que a RLS da tabela
-- nega.

INSERT INTO storage.buckets (id, name, public)
VALUES ('holerites', 'holerites', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "holerites_select" ON storage.objects;
CREATE POLICY "holerites_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'holerites' AND private.get_user_role() = ANY (ARRAY['admin', 'rh']));

DROP POLICY IF EXISTS "holerites_insert" ON storage.objects;
CREATE POLICY "holerites_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'holerites' AND private.get_user_role() = ANY (ARRAY['admin', 'rh']));

DROP POLICY IF EXISTS "holerites_update" ON storage.objects;
CREATE POLICY "holerites_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'holerites' AND private.get_user_role() = ANY (ARRAY['admin', 'rh']));

DROP POLICY IF EXISTS "holerites_delete" ON storage.objects;
CREATE POLICY "holerites_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'holerites' AND private.get_user_role() = ANY (ARRAY['admin', 'rh']));
