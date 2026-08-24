-- Migration 037: valor pago das férias (lançamento manual do pagamento)
-- Permite registrar o valor efetivamente pago em cada período de férias,
-- independente do salário cadastrado.
ALTER TABLE ferias ADD COLUMN IF NOT EXISTS valor_pago numeric(12,2);
