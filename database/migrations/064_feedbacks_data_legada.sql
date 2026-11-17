-- Migration 064: a coluna legada que impedia registrar feedback
--
-- `feedbacks.data_feedback` é NOT NULL e sem default, mas a aplicação grava
-- `data` — a coluna legada com o mesmo significado, que nenhuma consulta lê
-- (o SELECT da listagem nem a pede). Resultado: toda tentativa de registrar
-- um feedback era recusada pelo banco, com "null value in column
-- data_feedback violates not-null constraint" na cara do RH.
--
-- A tabela estava com zero linhas. Não por falta de uso: salvar nunca
-- funcionou.
--
-- É o terceiro caso do mesmo tipo neste banco — antes foram
-- `pesquisas_clima.data_inicio` e `data_termino` (migration 060). O padrão é
-- sempre o mesmo: uma coluna antiga sobreviveu a um renomeio, ficou
-- obrigatória e ninguém a preenche. Depois desta, uma varredura comparou
-- TODAS as colunas obrigatórias sem default com o que o código escreve; o que
-- ela encontrou está no commit que acompanha esta migração.

ALTER TABLE feedbacks ALTER COLUMN data_feedback DROP NOT NULL;
