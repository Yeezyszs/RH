-- Migration 054: justificativa do desconto que já vem no crédito
--
-- O relatório da operadora não credita R$ 150,00 para todo mundo: quem teve
-- falta, advertência ou afastamento aparece com valor menor, e quem entrou ou
-- saiu no meio do mês aparece com o proporcional. O sistema importava esse
-- valor reduzido sem registrar em lugar nenhum POR QUE ele veio reduzido — o
-- gráfico de perdas ficava vazio e o RH não tinha onde anotar o motivo.
--
-- Entra um terceiro tipo de lançamento: `no_credito`. Ele NÃO mexe no saldo,
-- porque o desconto já foi aplicado pela operadora antes do crédito chegar —
-- somar de novo cobraria a mesma falta duas vezes. Serve para dar motivo e
-- observação à diferença, e para alimentar o gráfico.
--
--   desconto   → tira do saldo agora
--   adicao     → soma ao saldo agora
--   no_credito → só explica um crédito que já veio menor
--
-- O tipo cabia em varchar(10) enquanto eram duas palavras curtas; passa a
-- varchar(20) para não ficar apertado de novo.

ALTER TABLE vale_descontos ALTER COLUMN tipo TYPE varchar(20);

ALTER TABLE vale_descontos DROP CONSTRAINT IF EXISTS vale_descontos_tipo_check;
ALTER TABLE vale_descontos
  ADD CONSTRAINT vale_descontos_tipo_check
  CHECK (tipo IN ('desconto', 'adicao', 'no_credito'));

-- Cada colaborador tem no máximo uma justificativa por competência: ela
-- explica a diferença do mês inteiro, não uma ocorrência isolada.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vale_desc_no_credito_unico
  ON vale_descontos (colaborador_id, mes, ano)
  WHERE tipo = 'no_credito';

COMMENT ON COLUMN vale_descontos.tipo IS
  'desconto (subtrai do saldo) | adicao (soma ao saldo) | no_credito (justifica crédito que já veio menor, não mexe no saldo)';
