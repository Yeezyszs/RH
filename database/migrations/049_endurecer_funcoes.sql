-- Migration 049: endurecimento das funções expostas

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) search_path fixo em calc_dias
-- ─────────────────────────────────────────────────────────────────────────────
-- Sem search_path definido, a função resolve nomes conforme o search_path de
-- quem chama. Fixar remove essa variação.
CREATE OR REPLACE FUNCTION public.calc_dias(data_inicio date, data_termino date)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT (data_termino - data_inicio) + 1;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Validação no canal anônimo do SAC
-- ─────────────────────────────────────────────────────────────────────────────
-- `sac_enviar` é chamável sem login — é o propósito do canal. Mas até agora
-- aceitava qualquer `categoria` e mensagem de qualquer tamanho, vindas de quem
-- quisesse chamar o endpoint direto, sem passar pela página. A validação
-- estava só no navegador, que é exatamente onde ela não vale nada.
--
-- Passa a rejeitar categoria fora da lista e mensagem vazia ou absurdamente
-- longa. Segue SECURITY DEFINER porque precisa devolver o protocolo ao autor,
-- e o anônimo não tem permissão de leitura na tabela.
CREATE OR REPLACE FUNCTION public.sac_enviar(p_categoria text, p_mensagem text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_protocolo text;
  v_mensagem  text := btrim(coalesce(p_mensagem, ''));
BEGIN
  IF p_categoria IS NULL OR p_categoria NOT IN
     ('sugestao', 'reclamacao', 'elogio', 'duvida', 'outro') THEN
    RAISE EXCEPTION 'Categoria invalida';
  END IF;

  IF length(v_mensagem) < 3 THEN
    RAISE EXCEPTION 'Mensagem muito curta';
  END IF;

  IF length(v_mensagem) > 5000 THEN
    RAISE EXCEPTION 'Mensagem muito longa';
  END IF;

  INSERT INTO sac_mensagens (categoria, mensagem)
  VALUES (p_categoria, v_mensagem)
  RETURNING protocolo INTO v_protocolo;

  RETURN v_protocolo;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sac_enviar(text, text) TO anon, authenticated;
