-- Migração 017: permite limpar campos PII criptografados
-- Antes, o trigger só (re)criptografava quando o valor textual era NOT NULL e
-- nunca zerava o *_enc, então não dava para apagar um RG/CPF/telefone já salvo.
-- Agora distinguimos três casos para cada campo PII textual:
--   NULL  -> campo ausente na operação (ex.: update parcial de status) => mantém _enc
--   ''    -> intenção explícita de limpar                              => zera _enc
--   valor -> criptografa normalmente
-- data_nascimento (date) continua como antes: criptografa quando presente.
--
-- O front-end (salvarColaborador) passou a enviar '' (em vez de null) nos
-- campos PII textuais vazios, para que o "limpar" chegue até aqui.

CREATE OR REPLACE FUNCTION private.trigger_criptografar_pii()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
BEGIN
  IF NEW.cpf IS NOT NULL THEN
    NEW.cpf_enc = CASE WHEN NEW.cpf = '' THEN NULL ELSE private.encrypt_pii(NEW.cpf) END;
  END IF;
  IF NEW.rg IS NOT NULL THEN
    NEW.rg_enc = CASE WHEN NEW.rg = '' THEN NULL ELSE private.encrypt_pii(NEW.rg) END;
  END IF;
  IF NEW.telefone IS NOT NULL THEN
    NEW.telefone_enc = CASE WHEN NEW.telefone = '' THEN NULL ELSE private.encrypt_pii(NEW.telefone) END;
  END IF;
  IF NEW.celular IS NOT NULL THEN
    NEW.celular_enc = CASE WHEN NEW.celular = '' THEN NULL ELSE private.encrypt_pii(NEW.celular) END;
  END IF;
  IF NEW.endereco IS NOT NULL THEN
    NEW.endereco_enc = CASE WHEN NEW.endereco = '' THEN NULL ELSE private.encrypt_pii(NEW.endereco) END;
  END IF;
  IF NEW.documentacao IS NOT NULL THEN
    NEW.documentacao_enc = CASE WHEN NEW.documentacao = '' THEN NULL ELSE private.encrypt_pii(NEW.documentacao) END;
  END IF;
  IF NEW.data_nascimento IS NOT NULL THEN
    NEW.nascimento_enc = private.encrypt_pii(NEW.data_nascimento::TEXT);
  END IF;

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
