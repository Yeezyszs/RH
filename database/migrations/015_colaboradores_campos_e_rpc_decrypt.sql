-- Migração 015: campos adicionais + leitura segura de PII
-- Data: 2026-06-19
--
-- Contexto: a tabela colaboradores tem um trigger (trigger_criptografar_pii)
-- que move cpf/rg/telefone/celular/endereco/data_nascimento para colunas *_enc
-- (cifradas) e zera as colunas de texto plano. A leitura precisava, portanto,
-- de uma rota que descriptografe esses dados — sem isso os campos apareciam
-- sempre vazios na aplicação.
--
-- 1) Colunas não-sensíveis que o formulário coleta mas não existiam.
-- 2) Função RPC SECURITY DEFINER que retorna os colaboradores com a PII já
--    descriptografada, restrita aos perfis admin/rh/gerente.

ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS matricula     VARCHAR(40);
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS escolaridade  VARCHAR(60);
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS estado_civil  VARCHAR(40);

CREATE OR REPLACE FUNCTION public.listar_colaboradores_seguro()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := private.get_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin','rh','gerente') THEN
    RAISE EXCEPTION 'Acesso nao autorizado a dados de colaboradores';
  END IF;

  RETURN QUERY
  SELECT to_jsonb(t) FROM (
    SELECT
      c.id, c.nome, c.email, c.genero, c.status, c.area,
      c.departamento_id, c.cargo_id, c.data_admissao, c.data_desligamento,
      c.matricula, c.escolaridade, c.estado_civil,
      c.cidade, c.estado, c.cep, c.numero_dependentes,
      c.tipo_contrato, c.salario,
      CASE WHEN c.cpf_enc        IS NOT NULL THEN private.decrypt_pii(c.cpf_enc)        ELSE c.cpf END             AS cpf,
      CASE WHEN c.rg_enc         IS NOT NULL THEN private.decrypt_pii(c.rg_enc)         ELSE c.rg END              AS rg,
      CASE WHEN c.telefone_enc   IS NOT NULL THEN private.decrypt_pii(c.telefone_enc)   ELSE c.telefone END        AS telefone,
      CASE WHEN c.celular_enc    IS NOT NULL THEN private.decrypt_pii(c.celular_enc)    ELSE c.celular END         AS celular,
      CASE WHEN c.endereco_enc   IS NOT NULL THEN private.decrypt_pii(c.endereco_enc)   ELSE c.endereco END        AS endereco,
      CASE WHEN c.nascimento_enc IS NOT NULL THEN private.decrypt_pii(c.nascimento_enc) ELSE c.data_nascimento::text END AS data_nascimento,
      d.nome  AS setor,
      cg.nome AS cargo
    FROM public.colaboradores c
    LEFT JOIN public.departamentos d ON d.id = c.departamento_id
    LEFT JOIN public.cargos       cg ON cg.id = c.cargo_id
    ORDER BY c.nome
  ) t;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_colaboradores_seguro() TO authenticated;
