-- Migration 050: adições no vale combustível
--
-- Até aqui a tabela só registrava o que TIRAVA do benefício. Passa a registrar
-- também o que acrescenta — viagem, plantão, reembolso, ajuste — que antes só
-- podia ser feito alterando o crédito do mês na mão, sem deixar rastro do
-- motivo.
--
-- Mesma tabela, porque é o mesmo tipo de registro: um lançamento com valor,
-- motivo e competência, que ajusta o saldo. Só muda o sinal.

ALTER TABLE vale_descontos
  ADD COLUMN IF NOT EXISTS tipo varchar(10) NOT NULL DEFAULT 'desconto';

-- Registros existentes são todos descontos (o default já cobre), e daqui em
-- diante só estes dois valores são aceitos.
ALTER TABLE vale_descontos DROP CONSTRAINT IF EXISTS vale_descontos_tipo_check;
ALTER TABLE vale_descontos
  ADD CONSTRAINT vale_descontos_tipo_check CHECK (tipo IN ('desconto', 'adicao'));

CREATE INDEX IF NOT EXISTS idx_vale_descontos_tipo ON vale_descontos (tipo);

COMMENT ON TABLE vale_descontos IS
  'Lançamentos que ajustam o vale combustível: descontos (advertência, falta…) e adições (viagem, plantão, reembolso…)';
COMMENT ON COLUMN vale_descontos.tipo IS 'desconto (subtrai do saldo) | adicao (soma ao saldo)';
