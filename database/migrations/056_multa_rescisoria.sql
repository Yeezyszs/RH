-- Migration 056: multa rescisória vinculada ao desligamento
--
-- `encargos_rescisao` guarda o valor do acerto. A multa é outra coisa: um
-- valor que se soma ao acerto e que só existe em parte dos desligamentos.
-- Somar as duas numa coluna só tornaria impossível responder "quanto foi
-- multa?" depois — e é justamente essa a pergunta que o RH faz ao fechar o
-- ano.
--
-- A regra de QUANDO a multa cabe é da empresa, não do banco: aqui ela fica
-- como CHECK apenas na forma (não-negativa). Quem decide o motivo elegível é
-- a tela de Rescisões, num único lugar (MOTIVOS_COM_MULTA), porque é regra de
-- negócio que muda sem migração.

ALTER TABLE desligamentos
  ADD COLUMN IF NOT EXISTS multa_rescisoria numeric(10,2)
    CHECK (multa_rescisoria IS NULL OR multa_rescisoria >= 0);

COMMENT ON COLUMN desligamentos.multa_rescisoria IS
  'Multa rescisória vinculada ao desligamento. Soma-se a encargos_rescisao; nula quando o motivo não admite multa.';
