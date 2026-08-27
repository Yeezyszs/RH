-- Migration 042: protocolo do SAC simplificado e sequencial
-- Formato: SAC-NN-DD/MM/AAAA  (ex.: SAC-01-27/08/2029)
-- O número vem de uma sequence do banco (ordem real de chegada) — não dá para
-- gerar no cliente, pois a role anônima não pode ler as mensagens já existentes.

CREATE SEQUENCE IF NOT EXISTS sac_protocolo_seq;
GRANT USAGE ON SEQUENCE sac_protocolo_seq TO anon, authenticated;

-- Renumera as mensagens já existentes na ordem em que foram criadas.
WITH ord AS (
  SELECT id, criado_em, row_number() OVER (ORDER BY criado_em, id) AS n
  FROM sac_mensagens
)
UPDATE sac_mensagens m
SET protocolo = 'SAC-' || lpad(ord.n::text, 2, '0')
             || '-' || to_char(coalesce(ord.criado_em, now()), 'DD/MM/YYYY')
FROM ord
WHERE m.id = ord.id;

-- A sequence continua de onde os registros existentes pararam.
SELECT setval(
  'sac_protocolo_seq',
  GREATEST((SELECT count(*) FROM sac_mensagens), 1),
  (SELECT count(*) FROM sac_mensagens) > 0
);

-- Todo insert ganha o protocolo automaticamente.
ALTER TABLE sac_mensagens
  ALTER COLUMN protocolo SET DEFAULT
    ('SAC-' || lpad(nextval('sac_protocolo_seq')::text, 2, '0')
           || '-' || to_char(now(), 'DD/MM/YYYY'));

-- Envio anônimo: insere e devolve o protocolo para exibir ao autor.
-- SECURITY DEFINER porque a role anônima tem permissão de INSERT mas não de
-- SELECT — sem isso ela não conseguiria ver o próprio número de protocolo.
CREATE OR REPLACE FUNCTION sac_enviar(p_categoria text, p_mensagem text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO sac_mensagens (categoria, mensagem)
  VALUES (p_categoria, p_mensagem)
  RETURNING protocolo;
$$;

GRANT EXECUTE ON FUNCTION sac_enviar(text, text) TO anon, authenticated;
