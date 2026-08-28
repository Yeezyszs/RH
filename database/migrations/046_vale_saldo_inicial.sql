-- Migration 046: saldo de abertura editável
-- Por padrão o saldo anterior é calculado somando as competências anteriores.
-- `saldo_inicial` permite fixar manualmente o saldo com que o colaborador ENTRA
-- na competência — usado para zerar o histórico ou corrigir divergências.
-- NULL = calcular normalmente; 0 (ou qualquer valor) = usar esse número e
-- ignorar tudo que veio antes.

ALTER TABLE vale_combustivel ADD COLUMN IF NOT EXISTS saldo_inicial numeric(12,2);

COMMENT ON COLUMN vale_combustivel.saldo_inicial IS
  'Saldo de abertura da competência; quando preenchido substitui o acumulado dos meses anteriores';
