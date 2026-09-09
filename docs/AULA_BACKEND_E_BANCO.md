# Aula — Backend e Banco de Dados

> **O que esta aula responde**
> Onde fica o "servidor". Qual rota o cadastro usa para chegar no banco.
> Por que ler um colaborador é diferente de gravar. Quem decide se você tem
> permissão. E como conferir cada afirmação daqui com o navegador aberto.
>
> Todo caminho de arquivo neste documento é real e clicável. Se algum não
> existir mais, o documento está desatualizado — e isso é um bug.

---

## Sumário

1. [A verdade sobre o "backend": não existe servidor](#1-a-verdade-sobre-o-backend-não-existe-servidor)
2. [As quatro camadas e onde cada uma mora](#2-as-quatro-camadas-e-onde-cada-uma-mora)
3. [As rotas HTTP de verdade](#3-as-rotas-http-de-verdade)
4. [Aula prática: o cadastro de colaborador, do clique ao INSERT](#4-aula-prática-o-cadastro-de-colaborador-do-clique-ao-insert)
5. [Por que gravar e ler seguem caminhos diferentes](#5-por-que-gravar-e-ler-seguem-caminhos-diferentes)
6. [Quem autoriza: RLS](#6-quem-autoriza-rls)
7. [Login: a rota do token](#7-login-a-rota-do-token)
8. [Tempo real: o websocket](#8-tempo-real-o-websocket)
9. [Os outros cadastros seguem a mesma receita](#9-os-outros-cadastros-seguem-a-mesma-receita)
10. [Duas exceções que valem estudar](#10-duas-exceções-que-valem-estudar)
11. [Como conferir tudo isto no navegador](#11-como-conferir-tudo-isto-no-navegador)
12. [Dívidas conhecidas](#12-dívidas-conhecidas)

---

## 1. A verdade sobre o "backend": não existe servidor

A primeira coisa a desaprender: **este sistema não tem backend próprio**. Não
existe Node rodando, não existe Express, não existe uma pasta `/server`. Se
você procurar por uma rota tipo `app.post('/colaboradores')`, não vai achar,
porque ela não existe em lugar nenhum do repositório.

O que existe é isto:

```
┌─────────────────────────────┐
│  Navegador                  │   HTML + CSS + JS estáticos,
│  (GitHub Pages)             │   servidos como arquivo
└──────────────┬──────────────┘
               │  HTTPS (fetch) e WebSocket
               ▼
┌─────────────────────────────┐
│  Supabase                   │   ← ESTE é o "backend"
│  ├── PostgREST  /rest/v1    │   traduz HTTP em SQL
│  ├── GoTrue     /auth/v1    │   login e token
│  ├── Realtime   /realtime/v1│   websocket de mudanças
│  └── PostgreSQL             │   as tabelas, o RLS, os triggers
└─────────────────────────────┘
```

O papel que normalmente é do backend — validar quem pode fazer o quê — aqui é
do **PostgreSQL**, através de RLS (Row Level Security) e de funções. Isso não é
gambiarra: é a arquitetura do Supabase. Mas tem uma consequência que você
precisa levar a sério desde o começo:

> **Toda validação que existe só no JavaScript não vale nada.**
> O navegador é do usuário. Ele pode abrir o console e chamar
> `sb.from('colaboradores').delete()` na mão. O que segura isso é o RLS no
> banco, não o `if` no módulo.

Onde o cliente do "backend" é criado:

| Arquivo | O que faz |
|---|---|
| [`supabase.js`](../supabase.js) | cria o client com URL e chave `anon`, e define `Auth` |
| [`src/utils/rede.js`](../src/utils/rede.js) | `withTimeout`, `withRetry`, `makeCache` |
| [`src/utils/mappers.js`](../src/utils/mappers.js) | traduz linha do banco → objeto da tela |

As duas primeiras linhas de `supabase.js`:

```js
const SUPABASE_URL  = 'https://smfiujgaxaodyfwvoxwy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOi...';   // chave pública
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
```

**A chave `anon` está no código de propósito e isso é seguro.** Ela só diz
"sou um cliente deste projeto" — não concede acesso a nada. Quem autoriza é o
RLS, avaliado a cada requisição contra o usuário logado. A chave que **nunca**
pode aparecer aqui é a `service_role`, que ignora RLS; existe um verificador de
CI para isso em [`scripts/checar-segredos.mjs`](../scripts/checar-segredos.mjs),
que decodifica o payload de qualquer JWT no repositório e reprova o build se
achar `role: service_role`.

---

## 2. As quatro camadas e onde cada uma mora

```
1. TELA          index.html  +  css/*.css
                 ↓ onsubmit / data-action
2. MÓDULO        src/modules/<assunto>.js        ← regra de negócio e render
                 ↓ chama o objeto de API
3. API           src/api/<área>.js               ← única camada que fala sb.*
                 ↓ HTTP
4. BANCO         database/migrations/*.sql       ← tabelas, RLS, triggers, RPC
```

**A regra que sustenta o desenho:** só a camada 3 conhece o `sb`. Nenhum módulo
em `src/modules/` chama o Supabase direto — ele recebe o objeto de API por
injeção de dependência em [`src/app.js`](../src/app.js). É por isso que os
módulos são testáveis sem rede: o teste passa um objeto falso no lugar.

### Inventário das camadas

**Camada 1 — tela**

| Arquivo | Conteúdo |
|---|---|
| [`index.html`](../index.html) | o app inteiro: todas as páginas e modais |
| [`sac.html`](../sac.html) | canal público do SAC (sem login) |
| [`privacidade.html`](../privacidade.html) | política de privacidade |
| [`css/tokens.css`](../css/tokens.css) | cores, fontes, medidas |
| [`css/components.css`](../css/components.css) | botões, cards, tabelas, modais |
| [`css/pages.css`](../css/pages.css) | estilos por página |

**Camada 2 — módulos** (19 arquivos em [`src/modules/`](../src/modules/))

`advertencias` · `beneficios` · `colaboradores` · `cronograma` ·
`desligamentos` · `epi` · `feedback` · `ferias` · `plano-carreiras` ·
`prestadores` · `prolabore` · `quadro` · `rotatividade` · `sac` · `salarios` ·
`vale-alimentacao` · `vale-combustivel` · `vale-importacao` · `vencimentos`

**Camada 3 — API** (6 arquivos em [`src/api/`](../src/api/))

| Arquivo | Objetos que expõe |
|---|---|
| [`pessoas.js`](../src/api/pessoas.js) | `Colaboradores`, `Departamentos`, `Cargos`, `HistoricoColaboradores`, `Desligamentos`, `Rotatividade`, `ContatosEmergencia` |
| [`compliance.js`](../src/api/compliance.js) | `Vencimentos`, `Epis`, `Treinamentos` |
| [`beneficios.js`](../src/api/beneficios.js) | `Ferias`, `Salarios`, `ValeCombustivel`, `ValeDescontos`, `Configuracoes`, `ValeAlimentacao`, `Afastamentos` |
| [`gestao.js`](../src/api/gestao.js) | `Advertencias`, `FeedbackClima`, `StorageDocs`, `PoliticasEmpresa`, `ProcedimentosEmpresa`, `PrestadoresServico`, `ProlaboreSocios`, `SacMensagens`, `RespostasPesquisa`, `Cronograma`, `Dashboard`, `PlanoCarreiras` |
| [`init.js`](../src/api/init.js) | `carregarDadosIniciais()` — a carga de abertura |
| [`realtime.js`](../src/api/realtime.js) | `setupRealTimeListeners()` — o websocket |

**Camada 4 — banco** (51 migrations em [`database/migrations/`](../database/migrations/))

| Arquivo | Papel |
|---|---|
| [`database/schema.sql`](../database/schema.sql) | as tabelas |
| [`database/schema.md`](../database/schema.md) | descrição das tabelas em texto |
| `database/migrations/001_criptografia_pii.sql` | criptografia de PII e o trigger |
| `database/migrations/010_rls_completo.sql` | RLS da maioria das tabelas |
| `database/migrations/013_rls_colaboradores_fix.sql` | RLS de `colaboradores` |
| `database/migrations/024_rpc_colaboradores_turno.sql` | a RPC de leitura segura |
| `database/migrations/049_endurecer_funcoes.sql` | `search_path` fixo e validação no SAC |
| `database/migrations/054_vale_desconto_no_credito.sql` | a migration mais recente |

**Utilitários compartilhados** ([`src/utils/`](../src/utils/))

| Arquivo | Tipo | Para que serve |
|---|---|---|
| [`base.js`](../src/utils/base.js) | script clássico | `h()`, `diasAte()`, `fmtBRL()`, `statusCasa()`, `noEfetivo()` |
| [`rede.js`](../src/utils/rede.js) | script clássico | `withTimeout`, `withRetry`, `makeCache` |
| [`mappers.js`](../src/utils/mappers.js) | script clássico | `mapColaborador` e irmãos |
| [`arrays.js`](../src/utils/arrays.js) | script clássico | `_preencherArray`, `_filtrarArray`, `_upsertArray` |
| [`carregamento.js`](../src/utils/carregamento.js) | script clássico | torna visível falha de carga |
| [`relatorio.js`](../src/utils/relatorio.js) | script clássico | impressão de relatório por módulo |
| [`ui.js`](../src/utils/ui.js) | ES module | `debounce`, `limparFormulario`, `competenciaAtual`… |
| [`formatting.js`](../src/utils/formatting.js) | ES module | formatação para os módulos |
| [`relatorio-vale.js`](../src/utils/relatorio-vale.js) | ES module | leitura do PDF de crédito do vale |

---

## 3. As rotas HTTP de verdade

Você nunca escreve uma URL neste código. Você escreve `sb.from(...)` e a
biblioteca monta a rota. Esta é a tabela de tradução — vale para **qualquer**
tabela do sistema:

| O que você escreve no código | Método HTTP | Rota | SQL que o Postgres executa |
|---|---|---|---|
| `sb.from('colaboradores').select()` | `GET` | `/rest/v1/colaboradores?select=*` | `SELECT` |
| `sb.from('colaboradores').insert(p)` | `POST` | `/rest/v1/colaboradores` | `INSERT` |
| `sb.from('colaboradores').update(p).eq('id', 42)` | `PATCH` | `/rest/v1/colaboradores?id=eq.42` | `UPDATE … WHERE id = 42` |
| `sb.from('colaboradores').delete().eq('id', 42)` | `DELETE` | `/rest/v1/colaboradores?id=eq.42` | `DELETE … WHERE id = 42` |
| `sb.from('t').upsert(p, { onConflict: 'a,b' })` | `POST` | `/rest/v1/t?on_conflict=a,b` | `INSERT … ON CONFLICT DO UPDATE` |
| `sb.rpc('listar_colaboradores_seguro')` | `POST` | `/rest/v1/rpc/listar_colaboradores_seguro` | `SELECT listar_colaboradores_seguro()` |
| `sb.auth.signInWithPassword(...)` | `POST` | `/auth/v1/token?grant_type=password` | — (GoTrue) |

Todas com o mesmo prefixo: `https://smfiujgaxaodyfwvoxwy.supabase.co`.

E todas com estes cabeçalhos, montados pela biblioteca:

```http
apikey:        <chave anon>
Authorization: Bearer <access_token do usuário logado>
Content-Type:  application/json
Prefer:        return=representation      ← quando há .select() depois
```

O `Authorization` é o que importa: é dele que o Postgres extrai quem você é
para avaliar o RLS. Sem login, o token é o próprio `anon`, e o RLS recusa
quase tudo.

> **`Prefer: return=representation`** é o que o `.select()` depois de um
> `insert` liga. Sem ele o banco grava e responde `201` vazio. Com ele,
> responde com a linha gravada — que é como o código consegue o `id` novo.

---

## 4. Aula prática: o cadastro de colaborador, do clique ao INSERT

Este é o caminho que a pergunta "qual rota o banco puxa para fazer o cadastro"
pede. Vamos seguir os doze passos, com arquivo e função em cada um.

### Passo 1 — o formulário

📄 [`index.html`](../index.html), linha ~2190

```html
<form id="form-colaborador" onsubmit="salvarColaborador(event)">
```

O `onsubmit` chama uma função **global**. Ela não está definida no HTML nem no
módulo: está no orquestrador.

### Passo 2 — o orquestrador liga o global ao módulo

📄 [`src/app.js`](../src/app.js) → dentro de `bootstrap()`

```js
window.salvarColaborador = (ev) => colaboradores.salvarColaborador(ev);
```

**Por que existe essa ponte?** Porque `app.js` é um ES module
(`<script type="module">`) e o escopo dele não é global. O `onsubmit` do HTML
só vê `window`. Então `app.js` cria os módulos e publica os métodos que o HTML
precisa. Se você adicionar um botão no HTML e esquecer de registrar o global, o
clique não faz nada — e é um erro silencioso, o tipo mais chato.

### Passo 3 — o módulo monta o payload

📄 [`src/modules/colaboradores.js`](../src/modules/colaboradores.js) →
`salvarColaborador(e)`

```js
async salvarColaborador(e) {
  e.preventDefault();
  const form = document.getElementById('form-colaborador');
  const data = Object.fromEntries(new FormData(form));
  // … valida dependentes, junta os documentos num JSON …
  const payload = {
    nome:            data.nome,
    cpf:             data.cpf || '',        // string vazia, não null
    data_admissao:   data.admissao,
    departamento_id: data.departamento_id ? parseInt(data.departamento_id, 10) : null,
    status:          data.status || 'ativo',
    // …
  };
```

Duas decisões que parecem detalhe e não são:

- **`cpf: data.cpf || ''`** — string vazia, nunca `null`. O trigger de
  criptografia usa isso para distinguir "o usuário limpou o campo" (`''`, então
  apaga o cifrado) de "este update não mexe no CPF" (ausente).
- **`parseInt(departamento_id, 10)`** — o `FormData` devolve tudo como texto,
  e a coluna é `integer`. Sem converter, o Postgres recusa.

### Passo 4 — o módulo chama a API

Mesmo arquivo, mais abaixo:

```js
const novo = await this.Colaboradores.criar(payload);
```

`this.Colaboradores` não é um import — foi **injetado** por `app.js`. É por isso
que o módulo pode ser testado sem banco: o teste injeta outro objeto.

### Passo 5 — a API fala com o Supabase

📄 [`src/api/pessoas.js`](../src/api/pessoas.js) → `Colaboradores.criar`

```js
async criar(payload) {
  const { data, error } = await withTimeout(
    sb.from('colaboradores').insert(payload).select().single()
  );
  if (error) throw error;
  Cache.invalidate();
  return mapColaborador(data);
}
```

Esta é a última linha de JavaScript antes da rede. `withTimeout` vem de
[`src/utils/rede.js`](../src/utils/rede.js) e corta em 6 segundos — sem ele, uma
requisição pendurada deixaria a tela travada para sempre.

### Passo 6 — a requisição HTTP

**Aqui está a rota do cadastro:**

```http
POST https://smfiujgaxaodyfwvoxwy.supabase.co/rest/v1/colaboradores

apikey: eyJhbGciOi…            (chave anon)
Authorization: Bearer eyJhbG…  (token do usuário logado)
Content-Type: application/json
Prefer: return=representation

{"nome":"João Silva","cpf":"123.456.789-00","data_admissao":"2026-01-15", …}
```

### Passo 7 — PostgREST traduz para SQL

O PostgREST recebe o POST, lê o token, abre a transação com o papel do usuário
e executa:

```sql
INSERT INTO public.colaboradores (nome, cpf, data_admissao, …)
VALUES ('João Silva', '123.456.789-00', '2026-01-15', …)
RETURNING *;
```

### Passo 8 — o RLS decide se pode

📄 `database/migrations/013_rls_colaboradores_fix.sql`

```sql
CREATE POLICY admin_rh_colaboradores_all ON public.colaboradores
  FOR ALL
  USING (private.get_user_role() = ANY (ARRAY['admin','rh']));
```

Se o usuário logado não for `admin` nem `rh`, o `INSERT` é recusado e a
resposta volta com **`new row violates row-level security policy`**. É o erro
mais comum do sistema, e ele quase nunca é bug de código: é permissão.

### Passo 9 — o trigger criptografa antes de gravar

📄 `database/migrations/001_criptografia_pii.sql` (atualizado na `017`)

```sql
CREATE TRIGGER trig_criptografar_pii
  BEFORE INSERT OR UPDATE ON public.colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION private.trigger_criptografar_pii();
```

E o corpo da função faz, para cada campo sensível:

```sql
IF NEW.cpf IS NOT NULL THEN
  NEW.cpf_enc = CASE WHEN NEW.cpf = '' THEN NULL
                     ELSE private.encrypt_pii(NEW.cpf) END;
END IF;
…
NEW.cpf = NULL;      -- ← o texto puro é APAGADO da linha
```

Ou seja: você mandou `cpf: '123.456.789-00'`, e o que fica gravado é
`cpf_enc` (bytea, AES via `pgp_sym_encrypt`) e `cpf = NULL`. A chave vem do
Supabase Vault e nunca aparece no banco em texto.

Isso vale para **CPF, RG, telefone, celular, endereço, data de nascimento e o
JSON de documentação**.

### Passo 10 — a resposta volta… sem o CPF

```json
[{ "id": 114, "nome": "João Silva", "cpf": null, "cpf_enc": "\\x c30d0409…" }]
```

O `cpf` volta `null` porque o trigger o apagou. **Não é bug.** É a razão pela
qual o próximo passo existe.

### Passo 11 — o módulo recarrega pela rota segura

Mesmo arquivo do passo 3:

```js
const todos = await this.Colaboradores.listar({ limit: 100000 });
this.COLABORADORES.length = 0;
this.COLABORADORES.push(...todos.data);
```

Por que não usar a resposta do `insert`? Porque ela tem a PII zerada. O
`listar()` vai pela RPC que descriptografa — o [passo 5 da seção seguinte](#5-por-que-gravar-e-ler-seguem-caminhos-diferentes).

Repare no `.length = 0` seguido de `push`: o array **nunca é reatribuído**.
Todos os módulos guardam a mesma referência, então trocar por um array novo
faria cada tela continuar olhando o array antigo. Os helpers que fazem isso
direito estão em [`src/utils/arrays.js`](../src/utils/arrays.js).

### Passo 12 — a tela redesenha

```js
this.render();                     // redesenha a lista
this.fecharModalColaborador();
this.showToast('Colaborador cadastrado', 'ok');
```

E, em paralelo, o websocket avisa **as outras abas e os outros usuários** —
[seção 8](#8-tempo-real-o-websocket).

### O caminho inteiro numa linha

```
index.html #form-colaborador
  → window.salvarColaborador            (src/app.js)
  → colaboradores.salvarColaborador()   (src/modules/colaboradores.js)
  → Colaboradores.criar(payload)        (src/api/pessoas.js)
  → sb.from('colaboradores').insert()   (supabase.js)
  → POST /rest/v1/colaboradores
  → RLS admin_rh_colaboradores_all      (013_rls_colaboradores_fix.sql)
  → TRIGGER trig_criptografar_pii       (001_criptografia_pii.sql)
  → INSERT em public.colaboradores
  → resposta (PII zerada)
  → Colaboradores.listar()  →  POST /rest/v1/rpc/listar_colaboradores_seguro
  → COLABORADORES (src/data-store.js)
  → render()
```

---

## 5. Por que gravar e ler seguem caminhos diferentes

Esta é a assimetria mais importante do sistema, e a que mais confunde quem
chega agora:

| | Grava | Lê |
|---|---|---|
| Rota | `POST /rest/v1/colaboradores` | `POST /rest/v1/rpc/listar_colaboradores_seguro` |
| Chamada | `sb.from('colaboradores').insert()` | `sb.rpc('listar_colaboradores_seguro')` |
| Quem autoriza | RLS da tabela | a própria função, no corpo |
| PII | criptografada pelo trigger | descriptografada na resposta |

**Ler a tabela direto não serve para nada.** Se você fizer
`sb.from('colaboradores').select('cpf')`, vem `null` para todo mundo: a coluna
de texto está vazia por desenho, e a `cpf_enc` é bytea que o navegador não tem
chave para abrir.

Por isso existe a RPC:

📄 `database/migrations/024_rpc_colaboradores_turno.sql`

```sql
CREATE OR REPLACE FUNCTION public.listar_colaboradores_seguro()
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER                      -- ← roda com o dono da função
 SET search_path TO 'public','private','extensions'
AS $function$
DECLARE v_role text;
BEGIN
  v_role := private.get_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin','rh','gerente') THEN
    RAISE EXCEPTION 'Acesso nao autorizado a dados de colaboradores';
  END IF;

  RETURN QUERY SELECT to_jsonb(t) FROM (
    SELECT c.id, c.nome, …,
      CASE WHEN c.cpf_enc IS NOT NULL
           THEN private.decrypt_pii(c.cpf_enc) ELSE c.cpf END AS cpf,
      d.nome AS setor, cg.nome AS cargo
    FROM public.colaboradores c
    LEFT JOIN public.departamentos d ON d.id = c.departamento_id
    LEFT JOIN public.cargos cg       ON cg.id = c.cargo_id
    ORDER BY c.nome
  ) t;
END;
$function$;
```

Três coisas para entender aqui:

1. **`SECURITY DEFINER`** faz a função rodar com os privilégios de quem a
   criou, não de quem chama. É o que permite descriptografar sem dar a chave
   ao usuário.
2. **Por isso ela verifica o papel na primeira linha.** Uma função
   `SECURITY DEFINER` sem essa checagem seria um buraco: qualquer usuário
   logado leria a PII de todos. A checagem *é* a segurança.
3. **`SET search_path`** fixo evita que alguém crie um schema no caminho e
   sequestre a resolução dos nomes. A migration `049` fez essa varredura em
   todas as funções.

E o lado JavaScript, que ainda cacheia o resultado:

📄 [`src/api/pessoas.js`](../src/api/pessoas.js) → `Colaboradores.listar`

```js
let todos = Cache.get('colabs_full');
if (!todos) {
  const { data, error } = await withRetry(() =>
    withTimeout(sb.rpc('listar_colaboradores_seguro'))
  );
  if (error) throw error;
  todos = (data || []).map(mapColaborador);
  Cache.set('colabs_full', todos);
}
// filtro, busca e paginação acontecem AQUI, no cliente
```

Note: a RPC não aceita parâmetros de filtro. Ela devolve tudo, o cliente
cacheia e filtra em memória. Funciona bem na escala atual (~90 cadastros) e
seria a primeira coisa a revisar se a empresa crescer muito.

O `mapColaborador` que aparece aí é o tradutor banco → tela:

📄 [`src/utils/mappers.js`](../src/utils/mappers.js)

```js
function mapColaborador(row) {
  return {
    id:        row.id,
    nome:      row.nome,
    matricula: row.cpf?.replace(/\D/g, '').slice(-6) || String(row.id).padStart(6, '0'),
    setor:     row.departamentos?.nome || row.setor || '—',
    admissao:  row.data_admissao || '',
    status:    row.status || 'ativo',
    // …
  };
}
```

**Por que ele existe num arquivo separado?** Porque enquanto morava dentro de
`supabase.js` não dava para testá-lo (o arquivo instancia o client ao carregar,
o que quebra fora do navegador). Os testes exercitavam uma **cópia** (no já removido
`tests/helpers.js`), e a cópia divergiu: os testes passavam verdes com a versão
de produção quebrada. Hoje o teste importa o arquivo real.

---

## 6. Quem autoriza: RLS

O sistema tem quatro papéis, e o RLS decide o que cada um vê:

| Papel | Colaboradores | Observação |
|---|---|---|
| `admin` | tudo | acesso total |
| `rh` | tudo | acesso total |
| `gerente` | só o próprio departamento | `departamento_id = private.get_departamento_id()` |
| `colaborador` | só a si mesmo | `usuario_id = private.get_user_id()` |

As políticas de `colaboradores` estão em
`database/migrations/013_rls_colaboradores_fix.sql`; as do resto do sistema em
`database/migrations/010_rls_completo.sql`. O padrão se repete em quase toda
tabela:

```sql
-- Admin e RH: tudo
CREATE POLICY admin_rh_<tabela>_all ON public.<tabela>
  FOR ALL USING (private.get_user_role() = ANY (ARRAY['admin','rh']));

-- Gerente: o departamento dele
CREATE POLICY gerente_<tabela>_select_dept ON public.<tabela>
  FOR SELECT USING (
    private.get_user_role() = 'gerente'
    AND colaborador_id IN (
      SELECT id FROM colaboradores
      WHERE departamento_id = private.get_departamento_id()
    ));

-- Colaborador: os próprios registros
CREATE POLICY colaborador_<tabela>_select_proprio ON public.<tabela>
  FOR SELECT USING (
    private.get_user_role() = 'colaborador'
    AND colaborador_id = private.get_colaborador_id());
```

As três funções auxiliares (`get_user_role`, `get_departamento_id`,
`get_colaborador_id`) leem a tabela `usuarios` a partir do `auth.uid()` do
token. Elas vivem no schema `private`, que não é exposto pelo PostgREST —
o cliente não consegue chamá-las direto.

> ⚠️ **Como depurar "violates row-level security policy":**
> não comece pelo JavaScript. Confira, nesta ordem: (1) existe sessão?
> (`await Auth.sessaoAtual()` no console); (2) qual o papel do usuário na
> tabela `usuarios`? (3) existe política para essa operação nessa tabela?
> Nove de dez vezes a resposta está no passo 2.

---

## 7. Login: a rota do token

📄 [`supabase.js`](../supabase.js) → objeto `Auth`

```js
const Auth = {
  async login(email, senha) {
    const { data, error } = await withTimeout(
      sb.auth.signInWithPassword({ email, password: senha })
    );
    if (error) throw error;
    Cache.invalidate();
    return data;
  },
  async logout()      { … },
  async sessaoAtual() { const { data } = await sb.auth.getSession(); return data.session; },
  onMudanca(cb)       { sb.auth.onAuthStateChange((_e, s) => cb(s)); },
};
```

A rota:

```http
POST https://smfiujgaxaodyfwvoxwy.supabase.co/auth/v1/token?grant_type=password
{"email":"…","password":"…"}
```

A resposta traz um `access_token` (JWT) que a biblioteca guarda no
`localStorage` e passa em `Authorization` de toda requisição seguinte. Dentro
dele vem o `sub` — o `auth.uid()` que o RLS usa.

Quem chama isso e o que faz depois está em [`src/auth.js`](../src/auth.js):
`verificarSessao()`, `handleLogin()`, `fazerLogout()` e a detecção de logout em
outra aba.

---

## 8. Tempo real: o websocket

📄 [`src/api/realtime.js`](../src/api/realtime.js) → `setupRealTimeListeners()`

```js
const canal = sb.channel('rh-realtime');
tabelas.forEach(tabela => {
  canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, handler);
});
canal.subscribe(status => { … });
```

Um único canal acumula os filtros de **24 tabelas** antes do `subscribe()`.
A conexão é `wss://smfiujgaxaodyfwvoxwy.supabase.co/realtime/v1/websocket`.

> 🐛 **Um bug que valeu aula:** a versão anterior usava `sb.on(...)`, sintaxe
> da v1 do supabase-js. Na v2 esse método não existe — então os listeners
> nunca conectavam, silenciosamente, e a interface exigia refresh manual.
> Nenhum erro aparecia no console. A lição: API que "não faz nada" é mais
> difícil de achar que API que quebra.

E o `handler` tem um detalhe que vem direto da seção 5:

```js
if (table === 'colaboradores') {
  if (eventType === 'DELETE') {
    _filtrarArray(COLABORADORES, x => x.id !== id);
  } else {
    // O payload do realtime traz a PII zerada pelo trigger, então não serve
    // para atualizar a tela: recarrega pela RPC que descriptografa.
    Cache.invalidate('colabs_full');
    Colaboradores.listar({ limit: 100000 }).then(res => {
      _preencherArray(COLABORADORES, res.data);
      …
    });
  }
}
```

Para as outras tabelas, que não têm PII, o payload é usado direto via
`_upsertArray` — mais barato.

---

## 9. Os outros cadastros seguem a mesma receita

Trocando o nome da tabela e do objeto de API, o caminho do passo 1 ao 12 é o
mesmo. Este é o mapa de "quero mexer em X, onde olho":

| Assunto | Módulo (camada 2) | Objeto de API (camada 3) | Tabela no banco |
|---|---|---|---|
| Colaboradores | `modules/colaboradores.js` | `Colaboradores` | `colaboradores` |
| Quadro de funcionários | `modules/quadro.js` | — (só lê `COLABORADORES`) | — |
| Advertências | `modules/advertencias.js` | `Advertencias` | `advertencias` |
| Férias | `modules/ferias.js` | `Ferias` | `ferias` |
| Afastamentos | `modules/colaboradores.js` | `Afastamentos` | `afastamentos` |
| Desligamentos | `modules/desligamentos.js` | `Desligamentos` | `desligamentos` |
| Rotatividade | `modules/rotatividade.js` | `Rotatividade` | `rotatividade` |
| Salários | `modules/salarios.js` | `Salarios` | `salario_atual` |
| Vale combustível | `modules/vale-combustivel.js` | `ValeCombustivel`, `ValeDescontos` | `vale_combustivel`, `vale_descontos` |
| Importação do vale | `modules/vale-importacao.js` | `ValeCombustivel`, `Configuracoes` | `vale_combustivel`, `configuracoes` |
| Vale alimentação | `modules/vale-alimentacao.js` | `ValeAlimentacao` | `vale_alimentacao` |
| Pró-labore | `modules/prolabore.js` | `ProlaboreSocios` | `prolabore_socios` |
| EPIs | `modules/epi.js` | `Epis` | `epis`, `epi_catalogo`, `epi_kits` |
| Vencimentos | `modules/vencimentos.js` | `Vencimentos` | `documentos`, `asos`, `participantes_treinamento` |
| Cronograma | `modules/cronograma.js` | `Cronograma` | `cronograma` |
| Organizacional | `modules/feedback.js` | `FeedbackClima`, `PoliticasEmpresa` | `feedbacks`, `pesquisas_clima`, `politicas_empresa` |
| Plano de carreiras | `modules/plano-carreiras.js` | `PlanoCarreiras` | `trilhas_carreira`, `plano_carreiras_colaborador` |
| Prestadores | `modules/prestadores.js` | `PrestadoresServico` | `prestadores_servico` |
| SAC | `modules/sac.js` | `SacMensagens` | `sac_mensagens` |
| Contatos de emergência | `modules/colaboradores.js` | `ContatosEmergencia` | `contatos_emergencia` |
| Configurações | vários | `Configuracoes` | `configuracoes` |

**Exercício:** escolha uma linha dessa tabela e rastreie os doze passos por
conta própria. Advertências é uma boa segunda escolha: tem o mesmo desenho,
mas sem criptografia, então o caminho de leitura é o simples
(`sb.from('advertencias').select()`) e dá para comparar.

---

## 10. Duas exceções que valem estudar

### 10.1 O SAC anônimo — quando a rota é uma função

O canal do SAC ([`sac.html`](../sac.html)) é usado por quem **não tem login**.
Um colaborador não pode ter permissão de `INSERT` em `sac_mensagens` sem
sessão, e também não pode ler a tabela. Então a gravação passa por uma função:

📄 [`sac.html`](../sac.html)

```js
const { data: protocolo, error } = await sb.rpc('sac_enviar', {
  p_categoria: categoria,
  p_mensagem:  mensagem,
});
```

Rota: `POST /rest/v1/rpc/sac_enviar`.

📄 `database/migrations/049_endurecer_funcoes.sql`

A função é `SECURITY DEFINER` (precisa gravar e devolver o protocolo a quem não
lê a tabela) e **valida no banco**: categoria dentro da lista, mensagem não
vazia e com tamanho limitado. Antes da `049` essa validação existia só no
navegador — ou seja, exatamente onde ela não vale nada, já que qualquer um pode
chamar o endpoint direto.

O número do protocolo (`SAC-01-27/08/2026`) também é gerado no banco, em
`042_sac_protocolo_sequencial.sql`. Gerar no cliente daria número repetido com
dois envios simultâneos.

### 10.2 A importação do PDF — quando não há banco nenhum

📄 [`src/utils/relatorio-vale.js`](../src/utils/relatorio-vale.js)
📄 [`src/modules/vale-importacao.js`](../src/modules/vale-importacao.js)

O relatório de crédito do vale combustível chega como PDF. A leitura acontece
**inteiramente no navegador**: o `pdf.js` é baixado do CDN por `import()`
dinâmico quando o modal abre, o texto é extraído, e
`lerRelatorioVale(linhas)` devolve os beneficiários já conferidos contra o
total da nota. Nada disso toca o banco.

Só depois de o operador confirmar é que a camada 3 entra, com duas chamadas:

```js
await this.ValeCombustivel.limparCompetencia(mesNum, ano);  // DELETE
await this.ValeCombustivel.upsertCotasEmLote(linhas);       // POST upsert
```

📄 [`src/api/beneficios.js`](../src/api/beneficios.js)

**Por que a leitura mora em `utils/` e não no módulo?** Porque é a parte onde
um erro custa caro: ela grava valor para dezenas de pessoas de uma vez. Sem
DOM, sem rede e sem PDF nas dependências, ela é testável a fundo —
[`tests/relatorio-vale.test.js`](../tests/relatorio-vale.test.js) tem 31 testes
só nela, incluindo o caso real em que o PDF imprime as células de uma mesma
linha em alturas diferentes e o leitor perdia a pessoa inteira.

---

## 11. Como conferir tudo isto no navegador

Nada aqui precisa de fé. Abra o sistema e o DevTools (F12).

**Ver a rota de um cadastro acontecendo**

1. aba **Network**, filtro `Fetch/XHR`
2. cadastre um colaborador
3. procure a linha `colaboradores` com método `POST`
4. clique nela: em **Headers** você vê a URL `/rest/v1/colaboradores`, o
   `apikey` e o `Authorization`; em **Payload**, o JSON que o passo 3 montou;
   em **Response**, a linha gravada — **com `cpf: null`**, exatamente como a
   seção 5 explica
5. logo depois, procure a chamada
   `rpc/listar_colaboradores_seguro` — é o passo 11 recarregando com a PII
   aberta

**Ver quem você é para o banco**

```js
// console do navegador
await Auth.sessaoAtual()        // a sessão inteira, com o access_token
COLABORADORES.length            // o array global em memória
Cache.get('colabs_full')?.length
```

**Ver o RLS recusando**

```js
// com um usuário sem papel admin/rh:
await sb.from('colaboradores').insert({ nome: 'Teste' })
// → error.message: 'new row violates row-level security policy…'
```

**Ver o realtime chegando**

Abra o sistema em duas abas, cadastre em uma e observe o console da outra:
`[RH] Listeners real-time ativados.` e a lista atualizando sem refresh.

**Rodar os testes** (30 arquivos, 535 testes)

```bash
npm test                # todos
npm test -- --coverage  # com cobertura
npx eslint .            # lint
```

---

## 12. Dívidas conhecidas

Documentar o que está torto faz parte da aula. Estes pontos são reais hoje:

| O quê | Onde | Por que incomoda |
|---|---|---|
| `private.get_user_role()`, `get_departamento_id()` e `get_colaborador_id()` não têm migration no repositório | foram criadas direto no painel do Supabase | recriar o banco do zero a partir de `database/migrations/` deixaria o RLS sem as funções que ele chama |
| `listar_colaboradores_seguro()` devolve a tabela inteira | `024_rpc_colaboradores_turno.sql` | filtro e paginação são no cliente; aguenta ~90 cadastros, não aguentaria milhares |
| A lista de colaboradores pagina no cliente sobre o cache | `src/api/pessoas.js` | já causou relatório impresso truncado — resolvido com `RELATORIO_HOOKS`, mas a causa segue |
| PII descriptografada fica em memória no navegador | `Cache` (`colabs_full`) | é o preço de filtrar no cliente; some ao fechar a aba, mas é bom saber que está lá |

---

## Para onde ir depois

| Quer entender | Leia |
|---|---|
| a ordem de carregamento e as camadas em geral | [`AULA_COMPLETA.md`](AULA_COMPLETA.md) |
| arquivo por arquivo, função por função | [`GUIA_CODIGO.md`](GUIA_CODIGO.md) |
| outros fluxos (editar, deletar, tempo real) | [`FLUXOS.md`](FLUXOS.md) |
| onde fica cada coisa, com roteiro de estudo | [`COMECE_AQUI.md`](COMECE_AQUI.md) |
| o que foi auditado em segurança | [`AUDIT_SEGURANCA.md`](AUDIT_SEGURANCA.md) |
| LGPD e proteção de dados | [`CHECKLIST_PROTECAO_DADOS.md`](CHECKLIST_PROTECAO_DADOS.md) |
