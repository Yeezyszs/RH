-- Migration 041: número de protocolo do SAC
-- Cada mensagem recebe um protocolo único no momento do envio (gerado no
-- cliente, em sac.html) que identifica tanto a mensagem quanto a sua tratativa
-- — ambas vivem na MESMA linha, então o protocolo é naturalmente compartilhado.
-- Formato: SAC-AAAAMMDD-XXXXX  (ex.: SAC-20260826-7A3F2)

ALTER TABLE sac_mensagens ADD COLUMN IF NOT EXISTS protocolo varchar(24);

-- Backfill dos registros já existentes (que foram criados antes do protocolo).
UPDATE sac_mensagens
SET protocolo = 'SAC-' || to_char(coalesce(criado_em, now()), 'YYYYMMDD')
             || '-' || upper(substr(md5(id::text || random()::text), 1, 5))
WHERE protocolo IS NULL;

-- Fallback: se um insert chegar sem protocolo, o banco gera um.
-- (O fluxo normal é o cliente enviar o protocolo já pronto para exibi-lo ao autor.)
ALTER TABLE sac_mensagens
  ALTER COLUMN protocolo SET DEFAULT
    ('SAC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 5)));

-- Garante unicidade do protocolo.
CREATE UNIQUE INDEX IF NOT EXISTS sac_mensagens_protocolo_key ON sac_mensagens (protocolo);
