-- Migration 053 (dados): zera o vale combustível
--
-- A partir daqui a competência não é mais digitada nem carregada por migration:
-- o RH sobe o PDF "Produto de Carga" da operadora na própria tela do vale
-- (Importar relatório) e o sistema grava os valores já conferidos contra o
-- "Total de crédito" da nota.
--
-- Por isso a base fica limpa — todo crédito volta a existir a partir do
-- relatório que o originou, e não de uma carga manual sem rastro:
--
--   vale_combustivel ... 309 linhas apagadas (jan, fev, abr, mai, jun, jul, ago/2026)
--   vale_descontos ..... 0 linhas (nunca chegou a ter lançamento)
--
-- As migrations de dados que traziam essas competências (043, 051 e 052) foram
-- removidas junto: mantê-las faria uma base recriada do zero nascer com os
-- valores que esta aqui acabou de apagar. A estrutura continua nas migrations
-- 044 (lançamentos), 045 (utilizado), 046 (saldo inicial) e 050 (adição).
--
-- O que NÃO é apagado: `configuracoes.vale_combustivel_valor_padrao`, que é
-- ajuste da empresa e não dado importado.

BEGIN;

DELETE FROM vale_descontos;
DELETE FROM vale_combustivel;

COMMIT;
