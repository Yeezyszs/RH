-- 066 — O plano de ação do clima nasce sozinho, como rascunho
--
-- Salvar a pesquisa passa a abrir um plano para cada dimensão abaixo da meta,
-- já com o "por quê" escrito a partir dos próprios números. O RH não precisa
-- mais lembrar de clicar na barra: o que estava fora da meta já está na lista
-- esperando dono.
--
-- Isso exige duas folgas no 065:
--
--  1. 'rascunho' entra no status. É o estado de um plano que o sistema abriu
--     e ninguém assumiu ainda. Fica DE FORA das contas de plano ativo e do
--     alerta de prazo — senão o número de planos sobe sozinho e vira relatório
--     bonito sem ninguém responsável, que é o oposto do que o 5W2H serve.
--  2. `o_que` passa a aceitar NULL, porque é exatamente o campo que o rascunho
--     NÃO tem: a ação é o julgamento de quem assume, não do sistema. Um plano
--     que deixa de ser rascunho sem "o quê" é barrado na tela.

ALTER TABLE plano_acao_clima ALTER COLUMN o_que DROP NOT NULL;

ALTER TABLE plano_acao_clima DROP CONSTRAINT IF EXISTS plano_acao_clima_status_check;
ALTER TABLE plano_acao_clima ADD CONSTRAINT plano_acao_clima_status_check
  CHECK (status IN ('rascunho', 'pendente', 'andamento', 'concluido'));

ALTER TABLE plano_acao_clima ALTER COLUMN status SET DEFAULT 'rascunho';

COMMENT ON COLUMN plano_acao_clima.status IS
  'rascunho = aberto pelo sistema e ainda sem dono; não conta como plano ativo.';
COMMENT ON COLUMN plano_acao_clima.o_que IS
  'A ação. Vazia enquanto o plano é rascunho — é o julgamento de quem assume.';
