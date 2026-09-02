-- Migration 052 (dados): vale combustível — julho/2026 e complemento de fevereiro
--
-- Dois relatórios novos enviados pelo RH:
--
--   RelatorioCreditoServicos_9.pdf — nota 824, emitida em 03/07/2026
--     Valor total da nota .... R$ 6.395,00
--     Total de crédito ....... R$ 6.390,00   (46 pessoas)
--     Total de serviço ....... R$     5,00   (reimpressão de cartão)
--
--     A taxa de R$ 5,00 é cobrança de serviço da operadora, não é crédito de
--     benefício de ninguém — por isso não entra na tabela. Nos cinco
--     relatórios anteriores esse campo era R$ 0,00, o que confirma que as
--     conferências passadas continuam corretas.
--
--     SINVAL COSTA CHAVES segue excluído a pedido do RH (R$ 150,00 no
--     relatório), então julho fecha em 6.390,00 − 150,00 = R$ 6.240,00 em
--     45 linhas.
--
--     Julho tinha 6 linhas antigas de R$ 150,00 (total R$ 900,00) que não
--     vieram de relatório nenhum — eram resquício do cadastro manual. Elas
--     são apagadas: as 6 pessoas estão todas no relatório novo.
--
--   RelatorioCreditoServicos_6_adicional_vitor_hugo.pdf — nota 172313,
--     emitida em 04/02/2026, R$ 50,00 para VICTOR HUGO PEREIRA NOVAIS
--     (CPF 114.099.649-57, colaborador 35).
--
--     Apesar do "_6" no nome do arquivo, os dados do PDF são de FEVEREIRO —
--     a nota 172313 é vizinha da 172312, que é o relatório principal do mês.
--     Victor Hugo não consta na 172312, logo esses R$ 50,00 são o crédito de
--     fevereiro dele, e não uma adição sobre um crédito existente. Fevereiro
--     passa de R$ 5.570,00 (40 linhas) para R$ 5.620,00 (41 linhas).

BEGIN;

-- Julho: descarta o resquício manual e grava o relatório.
DELETE FROM vale_combustivel WHERE ano = 2026 AND mes = 7;

INSERT INTO vale_combustivel (colaborador_id, mes, ano, valor_mensal, utilizado, saldo_inicial) VALUES
  (17, 7, 2026, 150.00, 0, 0),
  (18, 7, 2026, 150.00, 0, 0),
  (19, 7, 2026, 150.00, 0, 0),
  (20, 7, 2026, 150.00, 0, 0),
  (21, 7, 2026, 150.00, 0, 0),
  (32, 7, 2026, 150.00, 0, 0),
  (26, 7, 2026, 150.00, 0, 0),
  (27, 7, 2026, 60.00, 0, 0),
  (28, 7, 2026, 150.00, 0, 0),
  (29, 7, 2026, 105.00, 0, 0),
  (66, 7, 2026, 150.00, 0, 0),
  (65, 7, 2026, 150.00, 0, 0),
  (30, 7, 2026, 150.00, 0, 0),
  (31, 7, 2026, 150.00, 0, 0),
  (37, 7, 2026, 150.00, 0, 0),
  (98, 7, 2026, 150.00, 0, 0),
  (39, 7, 2026, 150.00, 0, 0),
  (40, 7, 2026, 150.00, 0, 0),
  (102, 7, 2026, 150.00, 0, 0),
  (101, 7, 2026, 45.00, 0, 0),
  (41, 7, 2026, 60.00, 0, 0),
  (67, 7, 2026, 45.00, 0, 0),
  (53, 7, 2026, 150.00, 0, 0),
  (43, 7, 2026, 150.00, 0, 0),
  (44, 7, 2026, 150.00, 0, 0),
  (88, 7, 2026, 150.00, 0, 0),
  (36, 7, 2026, 150.00, 0, 0),
  (45, 7, 2026, 150.00, 0, 0),
  (46, 7, 2026, 150.00, 0, 0),
  (47, 7, 2026, 150.00, 0, 0),
  (48, 7, 2026, 150.00, 0, 0),
  (49, 7, 2026, 150.00, 0, 0),
  (50, 7, 2026, 150.00, 0, 0),
  (51, 7, 2026, 150.00, 0, 0),
  (92, 7, 2026, 150.00, 0, 0),
  (42, 7, 2026, 150.00, 0, 0),
  (55, 7, 2026, 150.00, 0, 0),
  (57, 7, 2026, 75.00, 0, 0),
  (58, 7, 2026, 150.00, 0, 0),
  (63, 7, 2026, 150.00, 0, 0),
  (61, 7, 2026, 150.00, 0, 0),
  (59, 7, 2026, 150.00, 0, 0),
  (97, 7, 2026, 150.00, 0, 0),
  (56, 7, 2026, 150.00, 0, 0),
  (54, 7, 2026, 150.00, 0, 0);

-- Fevereiro: crédito avulso do Victor Hugo (nota 172313).
INSERT INTO vale_combustivel (colaborador_id, mes, ano, valor_mensal, utilizado, saldo_inicial) VALUES
  (35, 2, 2026, 50.00, 0, 0);

COMMIT;
