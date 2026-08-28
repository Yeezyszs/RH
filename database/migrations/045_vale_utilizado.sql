-- Migration 045: consumo mensal do vale combustível (saldo acumulativo)
-- O benefício acumula: o que não é usado no mês soma ao crédito do mês seguinte.
--   saldo do mês = saldo anterior + crédito − descontos − utilizado
-- `utilizado` fica na própria linha da competência (a mesma que guarda o
-- crédito em `valor_mensal`, com `data` nula).

ALTER TABLE vale_combustivel ADD COLUMN IF NOT EXISTS utilizado numeric(12,2);

COMMENT ON COLUMN vale_combustivel.utilizado IS
  'Valor efetivamente gasto pelo colaborador na competência (linhas de cota, data IS NULL)';
