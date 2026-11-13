-- Migration 062: o resto do holerite
--
-- O histórico já guardava as verbas (migration 061). Falta o que o papel traz
-- no rodapé e no cabeçalho, e que a tela do holerite precisa para mostrar a
-- folha como ela é: o salário de contribuição do INSS, a base de cálculo do
-- FGTS, o FGTS do mês, a base de IRRF, a faixa e o número de dependentes;
-- mais o CBO e o centro de custo.
--
-- `bases` guarda rótulo e valor como foram impressos ([{rotulo, texto,
-- valor}]), e não colunas fixas: os rótulos mudam entre as versões do
-- relatório da contabilidade ("Sal Cont INSS" virou isso vindo de "Sal.
-- Contr. INSS"), e uma coluna por rótulo exigiria migração a cada troca.
--
-- O que NÃO entra aqui, de propósito: CPF e dados bancários. Os dois estão no
-- holerite, mas o sistema trata esses campos como dado pessoal e os guarda
-- criptografados no cadastro (cpf_enc, documentacao_enc). Copiá-los para cá
-- em texto puro desfaria essa proteção pela porta dos fundos.

ALTER TABLE folha_competencia
  ADD COLUMN IF NOT EXISTS bases        jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cbo          varchar(12),
  ADD COLUMN IF NOT EXISTS departamento varchar(20),
  ADD COLUMN IF NOT EXISTS filial       varchar(10);

COMMENT ON COLUMN folha_competencia.bases IS
  'Rodapé do holerite: [{rotulo, texto, valor}] — salário base, sal. contr. INSS, base FGTS, FGTS do mês, base IRRF, faixa, dependentes.';
COMMENT ON COLUMN folha_competencia.departamento IS
  'Centro de custo impresso no holerite (ex.: 01.007).';
