# Informativo — Como importar a folha de pagamento

> Para quem opera o RH. Rotina mensal, leva um minuto.
>
> **O que o sistema grava:** o **salário base** de cada holerite — o salário
> contratual. Vencimentos, descontos e líquido do mês aparecem na conferência
> como contexto, mas **não** viram cadastro: mudam todo mês com horas extras,
> faltas e adiantamentos, e não são o salário da pessoa.

---

## 1. Passo a passo

1. Abra **Salários** no menu.
2. Clique em **⭳ Importar folha**.
3. Arraste o PDF de recibos que a contabilidade exporta (ou clique em escolher
   arquivo).
4. Confira o que aparece — veja a [seção 2](#2-o-que-a-conferência-mostra).
5. Resolva as pendências, se houver — [seção 3](#3-quando-alguém-não-casa-pelo-nome).
6. **Atualizar salários**.

O sistema não grava nada até você clicar no botão.

---

## 2. O que a conferência mostra

No topo, o que foi lido do arquivo:

| | |
|---|---|
| **Competência** | o mês da folha, lido do próprio PDF |
| **Holerites no PDF** | quantas pessoas vieram |
| **Soma dos salários base** | o total contratual da folha |

Logo abaixo, quatro números que resumem o que vai acontecer:

| Card | Significa |
|---|---|
| **Salários que mudam** | é o que será gravado |
| **Já conferem** | o sistema já tem esse valor; nada a fazer |
| **Sem cadastro** | a folha trouxe alguém que o sistema não achou |
| **Ativos fora da folha** | gente do efetivo que não veio nesta folha |

E a tabela **O que vai mudar**, linha a linha: o salário no sistema, o da
folha, e a diferença com seta ▲ ou ▼. Quem ainda não tinha salário cadastrado
aparece como "não cadastrado" — é aumento nenhum, é primeiro registro.

A última coluna traz o que a folha revela sobre o cadastro: admissão
diferente, cargo diferente, ou alguém que recebeu na folha mas está marcado
como desligado no sistema. **Esses avisos não bloqueiam a importação** e não
mudam o cadastro — servem para você decidir se vale corrigir a ficha.

> ⚠️ **"Ativos fora da folha" merece um olhar.** Pode ser normal (admitido
> depois do fechamento, sócio, estagiário) ou pode ser alguém que saiu e
> continua ativo no sistema.

---

## 3. Quando alguém não casa pelo nome

O holerite **não traz CPF**, então o cruzamento é pelo nome. Quando o nome está
grafado de um jeito na folha e de outro no cadastro, não casa — e o sistema não
chuta, porque gravar salário na ficha da pessoa errada é pior do que pedir a
ligação.

Essas pessoas aparecem na tabela **Sem correspondência automática**. Para cada
uma:

1. Escolha o colaborador certo no campo **Ligar a**.
2. Marque **Lembrar** — assim, da próxima folha em diante ela casa sozinha.

A ligação é guardada pelo **código da folha** (o número que aparece à esquerda
do nome no holerite), que não muda de mês para mês.

> **Os três casos que existiam foram corrigidos no cadastro** (eram erros de
> digitação no sistema: OLIVERIA por OLIVEIRA, VICNICIUS por VINICIUS,
> GONÇALVEZ por GONÇALVES). Hoje os 39 holerites da folha de setembro casam
> sozinhos. Se aparecer um caso novo, é porque alguém foi cadastrado com o nome
> diferente do que a contabilidade usa — vale corrigir a ficha, que é mais
> limpo do que carregar a ligação para sempre.

Se deixar alguém como "— não importar —", o salário dela simplesmente não é
gravado. Nada quebra.

---

## 4. As travas

O botão **Atualizar salários** fica bloqueado quando:

- a leitura do PDF saiu inconsistente — o sistema confere, em cada holerite, se
  *vencimentos − descontos = líquido*. Se não fecha, a leitura está torta e
  gravar seria pior que não gravar;
- a folha não diz a que mês se refere;
- não há nenhum salário a mudar (tudo já confere).

---

## 5. Ver um mês passado

Cada folha importada fica guardada por competência. Na tela de **Salários**,
assim que existir pelo menos uma folha importada, aparece um seletor no começo
da barra:

| Opção | Mostra |
|---|---|
| **Salário atual (cadastro)** | o salário vigente — é o normal, e é o que dá para editar |
| **Folha de setembro de 2026** | a folha daquele mês, como foi importada |

Escolhendo um mês, a tela muda de assunto:

- os valores são os **daquela folha**, não os de hoje;
- entra quem estava naquela folha, **inclusive quem foi desligado depois**;
- a última coluna deixa de ser "última alteração" e passa a ser o
  **líquido do mês**;
- uma faixa azul no topo avisa que você está no passado e mostra o **total
  líquido pago** naquele mês;
- **não dá para editar** — passado não se edita; para mexer no salário de hoje,
  volte para "Salário atual".

> **Reimportar o mesmo mês substitui**, não duplica. Subiu a folha errada? Suba
> a certa por cima.

---

## 6. Perguntas rápidas

**Importei a folha errada. E agora?**
Importe a certa por cima — o valor é substituído. O campo de observação de cada
salário registra de qual folha ele veio ("Folha de setembro de 2026").

**A folha de 13º ou de férias serve?**
Não use. Essas folhas não trazem o salário contratual no mesmo lugar, e o
sistema pode ler um valor que não é salário. Use a **folha mensal**.

**O sistema altera cargo ou data de admissão?**
Não. Ele só avisa quando estão diferentes. Mudar cadastro é em Colaboradores.

**Dá para importar meses anteriores?**
Dá, e vale a pena: cada competência fica guardada e passa a aparecer no seletor
de mês. Mas atenção à ordem — o **salário atual** do cadastro é sempre o da
última folha importada. Se você importar setembro depois de outubro, o cadastro
volta para o valor de setembro. O histórico fica certo nos dois casos; o que
depende da ordem é o valor vigente.

**Importar um mês onde nada mudou adianta?**
Adianta: mesmo sem nenhum salário mudar, a competência é registrada no
histórico e passa a aparecer no seletor de mês.

---

## Onde isto está no código

| Assunto | Arquivo |
|---|---|
| Leitura do PDF e cruzamento | [`src/utils/folha-pagamento.js`](../src/utils/folha-pagamento.js) |
| Reconstrução das linhas do PDF | [`src/utils/texto-pdf.js`](../src/utils/texto-pdf.js) |
| Tela de importação | [`src/modules/folha-importacao.js`](../src/modules/folha-importacao.js) |
| Gravação | [`src/api/beneficios.js`](../src/api/beneficios.js) → `Salarios` |
| Tabelas | `salario_atual` (vigente) e `folha_competencia` (histórico) |
| Seletor de mês | [`src/modules/salarios.js`](../src/modules/salarios.js) → `_preencherCompetencias()` |
| Testes | [`tests/folha-pagamento.test.js`](../tests/folha-pagamento.test.js), [`tests/folha-importacao.test.js`](../tests/folha-importacao.test.js), [`tests/salarios-competencia.test.js`](../tests/salarios-competencia.test.js) |
