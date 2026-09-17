# Informativo — Como lançar férias no sistema

> Para quem opera o RH. Não precisa saber programar para ler isto.
>
> **Regra de ouro:** o sistema registra **férias tiradas**, não o período em que
> a pessoa *ganhou* o direito. Confundir os dois é o erro mais comum, e é o que
> aconteceu com os 8 lançamentos que existem hoje na base — veja a
> [seção 6](#6-o-que-está-errado-hoje-e-precisa-ser-refeito).

---

## 1. Os dois períodos que a lei separa (e o sistema também)

| | O que é | Dura | O sistema… |
|---|---|---|---|
| **Período aquisitivo** | o tempo trabalhado que **dá direito** a 30 dias de férias | 12 meses | **calcula sozinho**, a partir da data de admissão |
| **Período de gozo** | os dias em que a pessoa **realmente sai** de férias | 1 a 30 dias | é isto que **você lança** |
| **Período concessivo** | o prazo que a empresa tem para conceder as férias | 12 meses após o fim do aquisitivo | **calcula sozinho** e avisa quando aperta |

Exemplo, para fixar:

```
Admitido em 12/12/2023
  ├── 12/12/2023 a 11/12/2024  → período AQUISITIVO (ganhou 30 dias)
  ├── prazo para sair: até 11/12/2025  → período CONCESSIVO
  └── saiu de 05/01/2025 a 03/02/2025  → período de GOZO   ← É ISTO QUE SE LANÇA
```

Você **nunca** digita as datas do aquisitivo. Ele vem da admissão.

---

## 2. Lançando um período — passo a passo

1. Abra **Férias** no menu.
2. Clique na linha do colaborador (ou em **+ Agendar férias** e escolha o nome).
3. Leia o **banner colorido** no topo do modal — ele responde, antes de tudo,
   se a pessoa pode sair e até quando. Veja a [seção 3](#3-o-que-o-banner-quer-dizer).
4. Preencha só três coisas:

| Campo | O que colocar |
|---|---|
| **Primeiro dia de férias** | o primeiro dia em que a pessoa **não** trabalha |
| **Quantos dias** | 1 a 30. Há atalhos de 30, 20, 15 e 10 |
| **Vender dias em dinheiro** | o abono pecuniário, se houver (máx. 10 dias) |

5. Confira a **prévia**, logo abaixo: ela mostra o último dia de férias e o dia
   em que a pessoa **volta ao trabalho**. É a linha que evita o erro de contar
   um dia a mais ou a menos.
6. Os campos **Valor pago** e **Observações** são opcionais.
7. Se aparecer aviso **vermelho**, o botão de agendar fica bloqueado — o
   lançamento fere a lei ou o saldo. Aviso **amarelo** deixa salvar, mas
   registra que algo merece atenção.
8. **Agendar**.

> **O que NÃO fazer:** não lance o período aquisitivo. Se você digitar
> "01/01/2025 a 31/12/2025", está dizendo que a pessoa passou **365 dias** de
> férias. O sistema hoje bloqueia isso (o saldo máximo é 30), mas os
> lançamentos antigos entraram antes dessa trava e estão errados.

---

## 3. O que o banner quer dizer

| Banner | Significa | O que fazer |
|---|---|---|
| 🔵 **Ainda não tem direito a férias** | menos de 12 meses de casa | nada; ele diz a data em que completa 1 ano |
| 🟢 **N dias disponíveis** | tem saldo e prazo folgado | agendar quando for conveniente |
| 🟡 **Precisa sair em até N dias** | faltam 60 dias ou menos para o prazo | **agende agora** |
| 🔴 **Prazo vencido há N dias** | passou do período concessivo | agende imediatamente — a lei manda **pagar em dobro** |
| 🟢 **Férias em dia** | todos os dias do direito já foram usados | nada |

Ao lado do banner aparece o **saldo** no formato `18/30 dias`: quantos dias
ainda restam do período aberto.

> ⚠️ **Atenção:** "Férias em dia" também aparece quando os lançamentos estão
> errados para mais — foi o que aconteceu com os 8 registros de 365 dias. O
> sistema acredita no que está gravado.

---

## 4. As regras que o sistema cobra

Todas vêm do art. 134 da CLT:

| Regra | Como aparece |
|---|---|
| No máximo **3 períodos** por ano aquisitivo | erro ao tentar o 4º |
| Um dos períodos precisa ter **14 dias ou mais** | aviso amarelo |
| Nenhum período pode ter **menos de 5 dias** (quando dividido) | erro |
| Não se pode lançar **mais dias do que o saldo** | erro, dizendo quanto resta |
| Férias após o prazo = **pagamento em dobro** | aviso amarelo, com a data |
| Abono pecuniário: até **10 dias** vendidos | o campo limita |

O abono conta como uso do saldo: vender 10 e tirar 20 fecha os 30.

---

## 5. Depois de lançar

- **O status do colaborador acompanha o período automaticamente.** Enquanto o
  período estiver em curso, ele aparece como **Férias**; quando termina, volta
  sozinho para **Ativo**. Você não precisa mexer no cadastro.
- **Férias não tiram ninguém do efetivo.** Quem está de férias continua contando
  como funcionário no Quadro e no relatório de Colaboradores.
- Para corrigir um lançamento, exclua o período e lance de novo. O status se
  ajusta junto.
- O **valor pago** pode ser preenchido depois, pelo ✎ na linha do período.

---

## 6. O que está errado hoje e precisa ser refeito

Existem **8 lançamentos** na base, todos criados em 23/06/2026, e **todos os 8
estão errados da mesma forma**: registram 365 dias de férias, ou seja, foi
lançado o período aquisitivo no lugar do período de gozo.

| Colaborador | Admissão | Lançado como férias | Dias |
|---|---|---|---|
| ANA CLAUDIA BATISTA BENVINDA | 02/07/2020 | 22/12/2024 a 21/12/2025 | 365 |
| EDUARDO TOKUNAGA JUNIOR *(desligado)* | 09/05/2024 | 19/12/2024 a 18/12/2025 | 365 |
| FABIO RODRIGUES DE OLIVEIRA | 03/01/2018 | 03/01/2025 a 02/01/2026 | 365 |
| GABRIEL MARTINS RIBEIRO BEDETI | 12/12/2023 | 12/12/2024 a 11/12/2025 | 365 |
| JOSE LUIS RODRIGUES | 13/06/2022 | 22/12/2024 a 21/12/2025 | 365 |
| VALDECIR GONÇALVEZ BUENO | 26/10/2023 | 26/12/2024 a 25/12/2025 | 365 |
| WALDECIR PAULINO ROSA *(desligado)* | 01/10/2024 | 19/12/2024 a 18/12/2025 | 365 |
| YASMIN DE SOUZA FAVARIN MATARUCO | 07/06/2022 | 22/12/2024 a 21/12/2025 | 365 |

### Por que isso é grave

O sistema soma os dias lançados para saber quanto resta. Com 365 dias, ele
entende que **12 períodos inteiros já foram tirados** — mais do que qualquer
uma dessas pessoas chegou a acumular. Resultado: as 8 aparecem como
**"Férias em dia"**, com saldo zero.

O caso mais claro é o do **GABRIEL MARTINS RIBEIRO BEDETI**: admitido em
12/12/2023, o prazo do primeiro período dele venceu em **11/12/2025**. Ele
deveria estar em vermelho, como **prazo vencido**. A tela diz "Férias em dia"
porque acredita nos 365 dias lançados.

### Como corrigir

Para cada um dos 8, no modal de Férias:

1. Exclua o período de 365 dias (🗑 na linha).
2. Lance o período **real** de gozo, se a pessoa efetivamente saiu — primeiro
   dia e quantidade de dias.
3. Se a pessoa **não** saiu de férias, basta excluir e não lançar nada. O banner
   vai passar a mostrar a situação verdadeira, que em alguns casos será prazo
   vencido.

Os dois desligados (Eduardo e Waldecir) podem ficar por último; não afetam a
operação do dia a dia, mas convém acertar para o histórico.

> Estes 8 registros **não foram corrigidos automaticamente** de propósito: o
> sistema não tem como saber quais foram as datas reais de saída. Só o RH tem
> essa informação.

---

## 7. Perguntas rápidas

**A pessoa saiu 15 dias em março e 15 em setembro. Lanço um ou dois?**
Dois períodos, um para cada saída. O sistema junta e mostra o saldo somado.

**E se ela vendeu 10 dias?**
Lance o período de gozo normalmente e informe 10 em "Vender dias em dinheiro".
O saldo desconta os 30 (20 gozados + 10 vendidos).

**Esqueci de lançar férias do ano passado. Posso lançar com data retroativa?**
Pode. O sistema aceita datas passadas e marca o período como "Já saiu".

**A pessoa está de férias e apareceu como Ativo (ou o contrário).**
Abra a tela de Férias uma vez: ao carregar, ela confere todos os status contra
os períodos e corrige o que estiver divergente.

**Quem está de férias some do Quadro de Funcionários?**
Não. Férias e afastamento continuam contando no efetivo — só o desligado sai.

---

## Onde isto está no código

Para quem for mexer:

| Assunto | Arquivo |
|---|---|
| Tela e regras de férias | [`src/modules/ferias.js`](../src/modules/ferias.js) |
| Cálculo do ciclo em aberto e do prazo | `_cicloEmAberto()`, `_situacaoFerias()` |
| Avisos que bloqueiam o agendamento | `_avisosDoPeriodo()` |
| Sincronia do status do colaborador | `_reconciliarStatus()` |
| Gravação no banco | [`src/api/beneficios.js`](../src/api/beneficios.js) → `Ferias` |
| Tabela | `ferias` (ver [`database/schema.sql`](../database/schema.sql)) |
| Testes | [`tests/ferias-calculo.test.js`](../tests/ferias-calculo.test.js), [`tests/ferias-modal.test.js`](../tests/ferias-modal.test.js), [`tests/ferias-status.test.js`](../tests/ferias-status.test.js) |
