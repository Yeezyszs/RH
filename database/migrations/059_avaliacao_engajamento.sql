-- Migration 059: avaliação de engajamento dos colaboradores
--
-- Transcreve o "Formulário de avaliação dos colaboradores 2026": 11 itens com
-- nota 1 a 3 e um apontamento por item. O formulário manda que o gestor e o
-- responsável pelo RH avaliem SEPARADAMENTE e depois tirem a média — por isso
-- cada avaliação é uma linha com a sua origem, e não um registro só com duas
-- colunas de nota. A média é calculada na leitura (src/utils/engajamento.js).
--
-- As notas ficam em jsonb e não em 22 colunas: o conjunto de itens é do
-- formulário, não do banco, e mudar o formulário não pode exigir migração.
--
-- Soma, percentual e classificação NÃO são gravados. São derivados das notas
-- por uma regra fixa (soma/33); gravá-los criaria uma segunda verdade que
-- pode divergir da primeira.

CREATE TABLE IF NOT EXISTS avaliacoes_engajamento (
  id              serial PRIMARY KEY,
  colaborador_id  integer NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  data_avaliacao  date NOT NULL DEFAULT current_date,
  avaliador       varchar(200) NOT NULL,
  -- Quem avaliou: o formulário prevê exatamente estes dois lados.
  origem          varchar(20) NOT NULL DEFAULT 'gestor'
                  CHECK (origem IN ('gestor', 'rh')),
  -- 'experiencia' (após o período de experiência) ou 'anual'.
  periodo         varchar(20) NOT NULL DEFAULT 'anual'
                  CHECK (periodo IN ('experiencia', 'anual')),
  itens           jsonb NOT NULL DEFAULT '[]',   -- [{nota, apontamento}, ...]
  observacoes     text,
  criado_em       timestamp DEFAULT now()
);

COMMENT ON TABLE avaliacoes_engajamento IS
  'Avaliação de engajamento (formulário de 11 itens, nota 1-3). Uma linha por avaliador.';
COMMENT ON COLUMN avaliacoes_engajamento.itens IS
  'Notas e apontamentos na ordem dos itens do formulário. Pontuação é derivada, não gravada.';

CREATE INDEX IF NOT EXISTS idx_aval_engaj_colab
  ON avaliacoes_engajamento (colaborador_id, data_avaliacao DESC);

-- Mesmo regime do resto da gestão de pessoas: leitura e escrita pelo RH.
-- O formulário público NÃO passa por aqui — entra pela função abaixo, que é
-- SECURITY DEFINER e valida tudo antes de inserir.
ALTER TABLE avaliacoes_engajamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_rh_aval_engaj_all ON avaliacoes_engajamento;
CREATE POLICY admin_rh_aval_engaj_all ON avaliacoes_engajamento
  FOR ALL TO authenticated
  USING (private.get_user_role() = ANY (ARRAY['admin', 'rh']))
  WITH CHECK (private.get_user_role() = ANY (ARRAY['admin', 'rh']));

DROP POLICY IF EXISTS gerente_aval_engaj_select_dept ON avaliacoes_engajamento;
CREATE POLICY gerente_aval_engaj_select_dept ON avaliacoes_engajamento
  FOR SELECT TO authenticated
  USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores WHERE departamento_id = private.get_departamento_id()
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- Formulário público (engajamento.html), no mesmo molde do SAC: o anônimo não
-- fala com a tabela, fala com estas duas funções.

-- Lista para o gestor escolher quem está avaliando. Devolve o MÍNIMO que a
-- tela precisa — id, nome e setor dos ativos. Nada de CPF, salário ou contato:
-- quem tem o link não pode virar dono do cadastro.
CREATE OR REPLACE FUNCTION public.engajamento_colaboradores()
 RETURNS TABLE (id integer, nome varchar, setor varchar)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.nome, d.nome AS setor
  FROM colaboradores c
  LEFT JOIN departamentos d ON d.id = c.departamento_id
  WHERE c.status <> 'inativo'
  ORDER BY c.nome;
$function$;

-- Recebe a avaliação. Valida o formato dos itens aqui dentro, e não só no
-- navegador: o endpoint é público, e validação que só existe no cliente não
-- é validação.
CREATE OR REPLACE FUNCTION public.engajamento_enviar(
  p_colaborador_id integer,
  p_avaliador      text,
  p_origem         text,
  p_periodo        text,
  p_itens          jsonb,
  p_observacoes    text DEFAULT NULL
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id        integer;
  v_avaliador text := btrim(coalesce(p_avaliador, ''));
  v_item      jsonb;
  v_nota      integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM colaboradores
                 WHERE id = p_colaborador_id AND status <> 'inativo') THEN
    RAISE EXCEPTION 'Colaborador invalido';
  END IF;

  IF length(v_avaliador) < 3 OR length(v_avaliador) > 200 THEN
    RAISE EXCEPTION 'Informe o nome do avaliador';
  END IF;

  IF p_origem IS NULL OR p_origem NOT IN ('gestor', 'rh') THEN
    RAISE EXCEPTION 'Origem invalida';
  END IF;

  IF p_periodo IS NULL OR p_periodo NOT IN ('experiencia', 'anual') THEN
    RAISE EXCEPTION 'Periodo invalido';
  END IF;

  IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) <> 11 THEN
    RAISE EXCEPTION 'A avaliacao precisa ter os 11 itens';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_nota := (v_item ->> 'nota')::integer;
    IF v_nota IS NULL OR v_nota < 1 OR v_nota > 3 THEN
      RAISE EXCEPTION 'Cada item precisa de nota 1, 2 ou 3';
    END IF;
    IF length(coalesce(v_item ->> 'apontamento', '')) > 1000 THEN
      RAISE EXCEPTION 'Apontamento muito longo';
    END IF;
  END LOOP;

  INSERT INTO avaliacoes_engajamento
    (colaborador_id, avaliador, origem, periodo, itens, observacoes)
  VALUES
    (p_colaborador_id, v_avaliador, p_origem, p_periodo, p_itens,
     nullif(btrim(coalesce(p_observacoes, '')), ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.engajamento_colaboradores() TO anon;
GRANT EXECUTE ON FUNCTION public.engajamento_enviar(integer, text, text, text, jsonb, text) TO anon;
