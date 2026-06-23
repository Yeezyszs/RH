-- Migration 019: Alinha tabelas de vales ao modelo usado pelo frontend
--
-- vale_alimentacao: o frontend trabalha com tipo (fixo/dia_util), valor por
-- dia ou mensal, dias úteis e observações. Adicionamos as colunas faltantes
-- para que o cadastro seja realmente persistido.
ALTER TABLE public.vale_alimentacao
  ADD COLUMN IF NOT EXISTS tipo        varchar(20) NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS dias_uteis  integer,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- vale_combustivel: lançamentos individuais (abastecimentos) não possuem
-- mês/ano de referência — apenas as cotas mensais usam. Tornamos mes/ano
-- opcionais para que os lançamentos possam ser persistidos sem violar
-- a restrição NOT NULL.
ALTER TABLE public.vale_combustivel
  ALTER COLUMN mes DROP NOT NULL,
  ALTER COLUMN ano DROP NOT NULL;
