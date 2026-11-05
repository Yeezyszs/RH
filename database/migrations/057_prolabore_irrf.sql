-- Migration 057: IRRF no pró-labore dos sócios
--
-- O pró-labore é remuneração tributável: retém INSS e também imposto de renda
-- na fonte. A tela tinha INSS, Unimed e adiantamento, e o IRRF acabava
-- embutido num deles ou fora da conta — nos dois casos o líquido saía errado
-- e não havia como responder quanto foi retido de imposto no ano.
--
-- Coluna própria, como os outros descontos, e pelo mesmo motivo: desconto
-- somado a outro não se separa depois.
--
-- Só vale para o tipo `prolabore`. No Cooper os descontos são a lista de itens
-- em `itens` (jsonb), e a tela zera esta coluna nesse regime.

ALTER TABLE prolabore_socios
  ADD COLUMN IF NOT EXISTS irrf numeric(12,2) DEFAULT 0
    CHECK (irrf IS NULL OR irrf >= 0);

COMMENT ON COLUMN prolabore_socios.irrf IS
  'Imposto de renda retido na fonte sobre o pró-labore. Zero no regime Cooper.';
