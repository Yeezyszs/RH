-- Migração 016: documentação pessoal criptografada
-- Guarda os campos extras de documentação (PIS, CTPS, CNH, título de eleitor,
-- reservista, dados bancários, órgão emissor, datas) como um JSON único,
-- criptografado no banco pelo mesmo trigger de PII e descriptografado na
-- leitura pela RPC segura (visível só para admin/rh/gerente).

ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS documentacao     text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS documentacao_enc bytea;

-- Estende o trigger de criptografia para incluir o campo documentacao
CREATE OR REPLACE FUNCTION private.trigger_criptografar_pii()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
BEGIN
  IF NEW.cpf             IS NOT NULL THEN NEW.cpf_enc          = private.encrypt_pii(NEW.cpf); END IF;
  IF NEW.rg              IS NOT NULL THEN NEW.rg_enc           = private.encrypt_pii(NEW.rg); END IF;
  IF NEW.telefone        IS NOT NULL THEN NEW.telefone_enc     = private.encrypt_pii(NEW.telefone); END IF;
  IF NEW.celular         IS NOT NULL THEN NEW.celular_enc      = private.encrypt_pii(NEW.celular); END IF;
  IF NEW.endereco        IS NOT NULL THEN NEW.endereco_enc     = private.encrypt_pii(NEW.endereco); END IF;
  IF NEW.data_nascimento IS NOT NULL THEN NEW.nascimento_enc   = private.encrypt_pii(NEW.data_nascimento::TEXT); END IF;
  IF NEW.documentacao    IS NOT NULL THEN NEW.documentacao_enc = private.encrypt_pii(NEW.documentacao); END IF;

  NEW.cpf             = NULL;
  NEW.rg              = NULL;
  NEW.telefone        = NULL;
  NEW.celular         = NULL;
  NEW.endereco        = NULL;
  NEW.data_nascimento = NULL;
  NEW.documentacao    = NULL;

  RETURN NEW;
END;
$function$;

-- Atualiza a RPC para retornar a documentação descriptografada (objeto JSON)
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
      CASE WHEN c.documentacao_enc IS NOT NULL THEN private.decrypt_pii(c.documentacao_enc)::jsonb ELSE '{}'::jsonb END AS documentacao,
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
