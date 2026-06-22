-- Migração 018: habilita Realtime para sincronização automática da UI
--
-- O cliente (src/api/init.js → setupRealTimeListeners) assina mudanças via
-- Supabase Realtime para atualizar as telas sem refresh manual. Porém:
--   1) a publication `supabase_realtime` estava VAZIA (nenhuma tabela),
--      então o Postgres não transmitia nenhum evento; e
--   2) o cliente usava a sintaxe antiga `sb.on(...)` (v1), corrigida em paralelo
--      para a API de canais da v2 `sb.channel(...).on(...).subscribe()`.
--
-- Aqui resolvemos o lado do banco:
--   • REPLICA IDENTITY FULL — faz o WAL incluir a linha ANTIGA completa em
--     UPDATE/DELETE. Necessário porque o handler lê colunas que não são PK do
--     registro `old` (ex.: salario_atual.colaborador_id num DELETE).
--   • ADD TABLE na publication — passa a transmitir INSERT/UPDATE/DELETE.

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'colaboradores', 'advertencias', 'ferias', 'desligamentos', 'cronograma',
    'epis', 'salario_atual', 'documentos', 'asos', 'feedbacks', 'pesquisas_clima',
    'vale_combustivel', 'vale_alimentacao', 'rotatividade', 'participantes_treinamento'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- Garante que o registro antigo completo viaje nos eventos UPDATE/DELETE.
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);

    -- Adiciona à publication apenas se ainda não estiver presente (idempotente).
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    END IF;
  END LOOP;
END $$;
