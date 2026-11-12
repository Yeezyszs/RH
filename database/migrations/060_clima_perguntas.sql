-- Migration 060: pesquisa de clima por pergunta
--
-- A tela guardava seis notas de 0 a 10 digitadas à mão (liderança, ambiente,
-- reconhecimento, carreira, comunicação, remuneração). O questionário real da
-- Bepi é outro: 17 afirmações respondidas numa escala de 5 pontos, de
-- "Discordo totalmente" a "Concordo totalmente", e nenhuma delas é sobre
-- remuneração. A nota por dimensão não era um dado de entrada — era um
-- resumo que alguém calculava de cabeça antes de digitar.
--
-- Agora a pesquisa guarda a distribuição de respostas de cada pergunta, que é
-- o que o formulário devolve, e a nota da dimensão passa a ser derivada daí
-- (src/modules/feedback.js). Entra o dado bruto, sai o resumo — não o
-- contrário.
--
-- As colunas score_* ficam onde estão, sem uso: a tabela está vazia, ninguém
-- depende delas, e derrubá-las num banco em produção para ganhar arrumação
-- não paga o risco.

ALTER TABLE pesquisas_clima
  ADD COLUMN IF NOT EXISTS perguntas jsonb NOT NULL DEFAULT '[]';

COMMENT ON COLUMN pesquisas_clima.perguntas IS
  'Perguntas do questionário com a distribuição de respostas: [{chave, texto, dimensao, respostas:[n1..n5]}]. As notas por dimensão são derivadas daqui.';

COMMENT ON COLUMN pesquisas_clima.score_lideranca IS
  'Legado: a nota por dimensão passou a ser derivada da coluna perguntas (migration 060).';

-- Defeito que vinha de antes e só aparecia na hora de salvar: `data_inicio` e
-- `data_termino` são NOT NULL e sem default, mas a aplicação grava `inicio` e
-- `fim` — as colunas legadas com o mesmo significado. Nenhuma consulta lê as
-- legadas (o SELECT da listagem nem as pede). Resultado: toda tentativa de
-- cadastrar uma pesquisa de clima era recusada pelo banco, e a tabela estava
-- vazia não por falta de uso, mas porque salvar nunca funcionou.
ALTER TABLE pesquisas_clima ALTER COLUMN data_inicio  DROP NOT NULL;
ALTER TABLE pesquisas_clima ALTER COLUMN data_termino DROP NOT NULL;
