-- Migration 061: verbas do holerite, uma a uma
--
-- O histórico guardava quatro números por pessoa e por mês: salário base,
-- vencimentos, descontos e líquido. Os totais respondem "quanto custou", mas
-- não respondem "do que foi feito" — quanto foi adiantamento, insalubridade,
-- adicional noturno, pensão judicial, empréstimo consignado.
--
-- Essas linhas já estavam impressas no holerite e o leitor já passava por
-- elas; só eram descartadas. Agora ficam guardadas como vieram.
--
-- Cada verba é {codigo, descricao, referencia, provento, desconto, tipo}. O
-- lado (provento ou desconto) sai da COLUNA em que o valor foi impresso — é a
-- única fonte confiável, porque o texto de "89 P.A.T 1,00" não diz se o real
-- foi pago ou descontado.

ALTER TABLE folha_competencia
  ADD COLUMN IF NOT EXISTS verbas jsonb NOT NULL DEFAULT '[]';

COMMENT ON COLUMN folha_competencia.verbas IS
  'Linhas do quadro de verbas do holerite: [{codigo, descricao, referencia, provento, desconto, tipo}]. Provento/desconto vêm da coluna impressa.';
