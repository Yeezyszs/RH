-- Migration 024: Include turno column in listar_colaboradores_seguro RPC

CREATE OR REPLACE FUNCTION public.listar_colaboradores_seguro()
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
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
      c.id, c.nome, c.email, c.genero, c.status, c.area, c.turno,
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
      CASE WHEN c.documentacao_enc IS NOT NULL THEN private.decrypt_pii(c.documentacao_enc)::jsonb ELSE '{}'::jsonb END AS documentacao,
      d.nome  AS setor,
      cg.nome AS cargo
    FROM public.colaboradores c
    LEFT JOIN public.departamentos d ON d.id = c.departamento_id
    LEFT JOIN public.cargos       cg ON cg.id = c.cargo_id
    ORDER BY c.nome
  ) t;
END;
$function$;
