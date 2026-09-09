# 🚀 COMECE AQUI — Guia para Entender o Código

> **Objetivo:** Aprender a navegar e entender o código do sistema RH, do iniciante ao avançado.

---

## 📍 Seus 3 objetivos principais

Escolha o que você quer entender:

### 🎯 Objetivo 1: "Como uma ação funciona?" (ex: clicar em Salvar)
→ Leia: [`docs/FLUXOS.md`](FLUXOS.md)

**Você aprenderá:**
- Clique em "Salvar" → JavaScript chamado → API contactada → Banco atualizado → Tabela re-renderizada
- Cada passo do caminho exato com código real
- Onde procurar cada parte do código

**Tempo:** 30 minutos

---

### 🎯 Objetivo 2: "Como o banco de dados funciona?" (Supabase)
→ Leia: [`docs/AULA_BACKEND_E_BANCO.md`](AULA_BACKEND_E_BANCO.md)

**Você aprenderá:**
- que **não existe backend próprio** — quem faz esse papel é o Supabase
- **qual rota o cadastro usa** (`POST /rest/v1/colaboradores`) e a tabela de
  tradução de `sb.from(...)` para HTTP
- os doze passos do cadastro de colaborador, com arquivo e função em cada um
- por que gravar e ler seguem caminhos diferentes (o trigger de PII e a RPC)
- quem autoriza cada operação (RLS) e como depurar
  `violates row-level security policy`
- como conferir tudo isso na aba Network do navegador

**Tempo:** 45 minutos

---

### 🎯 Objetivo 3: "Qual arquivo faz o quê?" (estrutura do código)
→ Leia: o mapa completo [logo abaixo, neste arquivo](#-estrutura-do-código--mapa-completo)

**Você aprenderá:**
- Para cada pasta e arquivo: responsabilidade
- Qual arquivo editar para fazer X
- Como tudo se conecta

**Tempo:** 25 minutos

---

## 🗺️ ESTRUTURA DO CÓDIGO — Mapa Completo

### 📦 Raiz do Projeto

| Arquivo | O que é? | Por que existe? |
|---------|----------|-----------------|
| `index.html` | HTML único da SPA | Contém toda a interface: as páginas, os modais e a ordem de carregamento dos scripts (no fim do arquivo) |
| `sac.html` | Página pública do SAC | Canal sem login — grava por RPC, não pela tabela |
| `privacidade.html` | Política de privacidade | Exigência de LGPD, servida junto com o app |
| `supabase.js` | Cliente Supabase | Cria o `sb` e define o objeto `Auth`. **Único lugar com a URL e a chave `anon`** |
| `package.json` | Dependências e scripts | `npm test`, `npm run coverage`; exige Node ≥ 22 |
| `vitest.config.js` | Config de testes | Cobertura medida sobre `src/**`, com pisos por pasta (ver o próprio arquivo — os números são o piso do que já está coberto, não uma meta) |
| `eslint.config.js` | Config do lint | Declara as globais dos scripts clássicos; sem isso o lint acusa `no-undef` à toa |

**Onde ficam as rotas do banco?** Em nenhum desses. Não existe servidor neste
projeto — quem faz o papel de backend é o Supabase. Isso está explicado em
[`AULA_BACKEND_E_BANCO.md`](AULA_BACKEND_E_BANCO.md).

---

### 📁 `/src` — Código JavaScript

#### `/src/data-store.js`
**O que:** Arrays globais que armazenam TODOS os dados
**Por que:** Um único lugar para dados = fácil compartilhar entre módulos
**Exemplo:**
```javascript
var COLABORADORES = [];
var VENCIMENTOS = [];
var SALARIOS = {};
// Cada um exposto ao window
window.COLABORADORES = COLABORADORES;
```
**Quando editar:** Nunca (é auto-preenchido)

---

#### `supabase.js` (na raiz, não em `/src`)
**O que:** Cliente que se conecta ao banco remoto
**Por que:** Ponte entre JavaScript e PostgreSQL
**O que faz:**
- cria o `sb` com a URL do projeto e a chave `anon`
- define `Auth` — login, logout, `sessaoAtual()`, `onMudanca()`
- monta o `Cache` chamando `makeCache()`

**O que NÃO faz mais:** `withTimeout`, `withRetry`, `makeCache` e os mappers
saíram daqui. Eles foram para `src/utils/rede.js` e `src/utils/mappers.js` para
poderem ser testados — este arquivo instancia o client ao carregar, o que
impede importá-lo fora do navegador. O arquivo caiu de 213 para 54 linhas.

**Quando editar:** Se precisar mudar de projeto Supabase (URL, chave)

---

#### `/src/constants.js`
**O que:** Cores, labels, ícones, padrões
**Por que:** Reutilização — não repetir código
**Exemplo:**
```javascript
export const STATUS_LABEL = {
  ativo: { t: 'Ativo', cls: 'ok' },
  ferias: { t: 'Férias', cls: 'info' },
};
```
**Quando editar:** Se mudar paleta de cores ou adicionar novo status

---

#### `/src/app.js`
**O que:** Orquestrador — importa e conecta tudo
**Por que:** Ponto central onde módulos se conhecem
**O que faz:**
1. Importa todas as utilidades
2. Importa todos os 13 módulos
3. Cria dependências (deps)
4. Instancia cada módulo com `new ModuleClass(deps)`
5. Expõe funções ao `window.*` para HTML chamar
6. Executa `bootstrap()` para inicializar

**Quando editar:** Se adicionar novo módulo ou dependência

---

#### `/src/dashboard.js`
**O que:** Navegação e layout da SPA
**Por que:** Gerenciar mudança de página sem reload
**O que faz:**
- `goPage(name)` — muda para outra aba
- `showToast()` — mensagens flutuantes
- Renderiza dashboard com gráficos e widgets
- Popup de vencimentos críticos
- Badge de notificações

**Quando editar:** Se mudar design da topbar, sidebar ou dashboard

---

#### `/src/auth.js`
**O que:** Autenticação (login/logout/sessão)
**Por que:** Saber quem está usando o sistema
**O que faz:**
- `handleLogin()` — clique em "Entrar"
- `fazerLogout()` — clique em "Sair"
- `verificarSessao()` — app inicia (recupera sessão anterior)
- Detecta logout em outra aba automaticamente

**Quando editar:** Se mudar fluxo de autenticação

---

#### `/src/utils/`

Nove arquivos — a tabela completa está mais abaixo, em
[`/src/utils` — Utilitários compartilhados](#-srcutils--utilitários-compartilhados).
Os dois de entrada:

**`base.js`** (script clássico, carregado antes de tudo)
```javascript
h()           // Escape HTML (prevenção XSS)
diasAte()     // Dias até uma data
fmtBRL()      // Formatar moeda
statusCasa()  // O colaborador casa com o filtro de status?
noEfetivo()   // Ele faz parte do efetivo da empresa?
```

**`formatting.js`** (ES module)
```javascript
h(), iniciais(), fmtDate(), fmtBRL(), tempoCasa(), diasAte(),
vencStatus(), vencBadge(), mesChave(), mesLabel(), addDays()
```

**Quando editar:** Se criar novas funções reutilizáveis. Se a função precisa
valer tanto para script clássico quanto para ES module — como `statusCasa` —
ela vai em `base.js` e é **injetada** nos módulos por `app.js`.

---

#### `/src/api/` — CRUD por Domínio

Cada arquivo define operações de banco para um domínio:

> 🔑 **Esta é a única camada que fala com o banco.** Nenhum arquivo em
> `src/modules/` chama `sb.*` — ele recebe o objeto de API por injeção em
> `app.js`. É o que permite testar os módulos sem rede.

**`pessoas.js`**
- `Colaboradores` — `listar`, `buscar`, `criar`, `atualizar`, `excluir`
- `Departamentos`, `Cargos` — setores e cargos
- `HistoricoColaboradores` — histórico de mudanças
- `Desligamentos`, `Rotatividade`, `ContatosEmergencia`

**`compliance.js`**
- `Vencimentos` — ASO, documentos, treinamentos
- `Epis` — EPIs, catálogo e kits
- `Treinamentos` — cursos e capacitações

**`beneficios.js`**
- `Ferias` — períodos de férias
- `Salarios` — salários por período (tabela `salario_atual`)
- `ValeCombustivel` — crédito por competência, `limparCompetencia`, `upsertCotasEmLote`
- `ValeDescontos` — descontos, adições e justificativa de crédito reduzido
- `Configuracoes` — chave/valor (ex.: valor padrão do vale)
- `ValeAlimentacao`, `Afastamentos`

**`gestao.js`**
- `Advertencias`, `FeedbackClima`, `Cronograma`, `PlanoCarreiras`
- `PoliticasEmpresa`, `ProcedimentosEmpresa`, `PrestadoresServico`
- `ProlaboreSocios`, `SacMensagens`, `RespostasPesquisa`
- `StorageDocs` (arquivos), `Dashboard` (agregados)

**`init.js`** (Especial!)
- `carregarDadosIniciais()` — carrega TODOS os dados ao abrir, em paralelo, e
  reporta o que falhou em vez de falhar calado

**`realtime.js`** (Especial!)
- `setupRealTimeListeners()` — um canal websocket com filtro para 24 tabelas.
  Saiu do `init.js`, que tinha três assuntos no mesmo arquivo

---

#### `/src/modules/` — Lógica de Cada Página

19 módulos:

```
colaboradores.js       → Aba de Colaboradores (cadastro, drawer, afastamentos)
quadro.js              → Quadro de Funcionários (extraído de colaboradores.js)
advertencias.js        → Aba de Advertências
ferias.js              → Aba de Férias (regras da CLT)
desligamentos.js       → Aba de Desligamentos
rotatividade.js        → Aba de Rotatividade
cronograma.js          → Aba de Cronograma
vencimentos.js         → Aba de Vencimentos (ASO, docs, treinamentos)
epi.js                 → Aba de EPI
salarios.js            → Aba de Salários
vale-combustivel.js    → Vale Combustível (crédito, descontos, adições)
vale-importacao.js     → Importa o PDF de crédito do vale
vale-alimentacao.js    → Vale Alimentação
beneficios.js          → Painel consolidado de benefícios
prolabore.js           → Pró-labore e Cooper dos sócios
prestadores.js         → Prestadores de serviço
feedback.js            → Organizacional (clima, feedback, políticas)
plano-carreiras.js     → Plano de Carreiras
sac.js                 → SAC (tratativa das mensagens recebidas)
```

**Por que `quadro.js` é separado de `colaboradores.js`?** Porque
`colaboradores.js` passou de 1.100 linhas com seis assuntos dentro. O quadro
era o único bloco sem amarras — não chamava nenhum método do módulo de origem,
só lia `COLABORADORES` e desenhava. Foi o primeiro a sair.

**Cada módulo segue o padrão:**
```javascript
export class ColaboradoresModule {
  constructor(deps) {
    // Recebe dependências (dados, funções, API)
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Registra listeners para input, change, click, etc
  }

  render() {
    // Gera HTML da tabela/página baseado em dados
  }

  abrirModal() { /* ... */ }
  fecharModal() { /* ... */ }
  async salvarDado() { /* ... */ }
  async deletarDado() { /* ... */ }
}
```

---

### 📁 `/src/utils` — Utilitários compartilhados

Dois sabores, e a diferença importa: **script clássico** é carregado por
`<script src>` e publica no `window`; **ES module** é importado com `import`.
Script clássico não pode importar de ES module.

| Arquivo | Tipo | O que oferece |
|---------|------|---------------|
| `base.js` | clássico | `h()` (escape de HTML), `diasAte()`, `fmtBRL()`, `statusCasa()`, `noEfetivo()` |
| `rede.js` | clássico | `withTimeout` (6 s), `withRetry`, `makeCache` |
| `mappers.js` | clássico | `mapColaborador` e irmãos — traduzem linha do banco em objeto de tela |
| `arrays.js` | clássico | `_preencherArray`, `_filtrarArray`, `_upsertArray` — mexem no array **sem reatribuir** |
| `carregamento.js` | clássico | `descreverErro`, `coletarFalhas`, `resumirFalhas` — fazem falha de carga aparecer |
| `relatorio.js` | clássico | impressão de relatório por módulo (clona a página, limpa e abre a janela) |
| `ui.js` | ES module | `debounce`, `limparFormulario`, `competenciaAtual`, `optionsColaboradores` |
| `formatting.js` | ES module | formatação para os módulos |
| `relatorio-vale.js` | ES module | leitura do PDF de crédito do vale combustível |

---

### 📁 `/scripts` — Ferramentas de build

| Arquivo | O que faz |
|---------|-----------|
| `versionar.mjs` | troca `?v=dev` pelo hash do commit no deploy (cache-busting) |
| `checar-segredos.mjs` | decodifica todo JWT do repositório e reprova o build se achar `service_role` |

### 📁 `/.github/workflows` — CI e deploy

| Arquivo | Roda |
|---------|------|
| `ci.yml` | lint, testes, cobertura e a checagem de segredos |
| `deploy.yml` | versiona os arquivos e publica no GitHub Pages |

---

### 📁 `/css` — Estilos

| Arquivo | Responsável por |
|---------|-----------------|
| `tokens.css` | Variáveis CSS (cores, espaçamento, tipografia) |
| `layout.css` | Grid layout (topbar, sidebar, main) |
| `components.css` | Componentes reutilizáveis (btn, badge, modal, form) |
| `pages.css` | Estilo específico de cada aba |
| `login.css` | Página de login |

**Quando editar:** Se mudar cores, tamanhos ou design

---

### 📁 `/database` — Schema SQL

| Arquivo | Contém |
|---------|---------|
| `schema.sql` | as 24 tabelas do desenho inicial |
| `schema.md` | descrição das tabelas em texto |
| `migrations/` | **51 migrations numeradas** — a história real do banco |

As migrations são a fonte da verdade, não o `schema.sql`: metade do banco de
hoje (criptografia de PII, RLS, RPCs, protocolo do SAC, colunas do vale) nasceu
nelas. As que vale conhecer:

| Migration | O que trouxe |
|-----------|--------------|
| `001_criptografia_pii.sql` | criptografia de CPF, RG, telefone, endereço, nascimento + o trigger |
| `010_rls_completo.sql` | RLS da maioria das tabelas |
| `013_rls_colaboradores_fix.sql` | RLS de `colaboradores` (a causa do erro "violates row-level security") |
| `024_rpc_colaboradores_turno.sql` | `listar_colaboradores_seguro()` — a rota de leitura com PII aberta |
| `042_sac_protocolo_sequencial.sql` | protocolo `SAC-01-27/08/2026` gerado no banco |
| `049_endurecer_funcoes.sql` | `search_path` fixo e validação do SAC no banco, não só no navegador |
| `053_vale_zerar_para_importacao.sql` | zera o vale para ele passar a vir do PDF |
| `054_vale_desconto_no_credito.sql` | justificativa do crédito que já veio menor |

**Quando editar:** ao mudar o banco, sempre por uma migration nova numerada —
nunca alterando uma antiga. Editar migration aplicada faz o banco recriado do
zero divergir do banco em produção.

---

### 📁 `/docs` — Documentação

| Arquivo | Leia quando... |
|---------|--------|
| **`COMECE_AQUI.md`** | Quer saber por onde começar (este arquivo!) |
| **`AULA_BACKEND_E_BANCO.md`** | Quer saber **qual rota o cadastro usa**, como o banco autoriza e por que ler é diferente de gravar |
| **`FLUXOS.md`** | Quer entender como uma ação funciona |
| **`AULA_COMPLETA.md`** | Quer aprender a fundo (padrões, exemplos) |
| **`aula-visual.html`** | Quer estudar com design visual (abrir no navegador) |
| **`GUIA_CODIGO.md`** | Quer documentação técnica detalhada |
| **`AUDIT_SEGURANCA.md`** | Quer entender a segurança |
| **`CHECKLIST_PROTECAO_DADOS.md`** | Quer o checklist de LGPD |
| **`POLITICA_PRIVACIDADE.md`** | Quer ver conformidade LGPD |

---

### 📁 `/tests` — Testes Automatizados

São 30 arquivos de teste. Os que valem conhecer primeiro:

```
tests/
├── base.test.js                   → h(), fmtBRL, statusCasa/noEfetivo (o efetivo da empresa)
├── mappers.test.js                → banco → tela, com o arquivo REAL de produção
├── timeout-retry.test.js          → withTimeout e withRetry
├── cache.test.js                  → o cache que evita rebaixar a RPC
├── rls-logic.test.js              → a lógica de papéis do RLS
├── relatorio-vale.test.js         → leitura do PDF de crédito (31 testes)
├── vale-importacao.test.js        → a tela de importação, com pdf.js falso
├── vale-credito-reduzido.test.js  → crédito abaixo do valor cheio e o gráfico
├── ferias-calculo.test.js         → regras de férias (CLT)
├── relatorio-lista-completa.test.js → o relatório impresso não sai truncado
├── handlers-inline.test.js        → todo onclick do HTML tem função registrada
├── formulario-id.test.js          → form.reset() não limpa input hidden
├── ambiente.test.js               → a versão do Node bate com a do CI
└── helpers-efetivo.js             → carrega base.js real e reexporta (não é cópia)
```

> **Um princípio que este projeto aprendeu na dor:** teste nunca deve exercitar
> uma **cópia** do código de produção. Já aconteceu — os mappers tinham uma
> cópia num `tests/helpers.js` (hoje removido), ela divergiu, e a suíte ficou verde com a
> produção quebrada. Por isso `helpers-efetivo.js` carrega o arquivo real.
```

**195 testes**, **100% de cobertura**, rodados via `npm run test:coverage`

---

## 📖 Roteiro de Estudo Recomendado

### 🔰 Nível 1: Iniciante (0-2 horas)

**Meta:** Entender como uma ação (clique em "Salvar") funciona

1. Leia `docs/COMECE_AQUI.md` (este arquivo) — 10 min
2. Leia `docs/FLUXOS.md` seção 1 (Criar colaborador) — 15 min
3. Abra `index.html` no navegador
4. Clique em "Colaboradores" → "Novo Colaborador"
5. Preencha dados e clique "Salvar"
6. Abra DevTools (F12) → Network tab
7. Veja requisição POST acontecendo em tempo real
8. Leia `src/api/pessoas.js` (comentários JSDoc)
9. Releia `docs/FLUXOS.md` seção 5 (Stack Completo)

---

### 🟡 Nível 2: Intermediário (2-5 horas)

**Meta:** Entender como cada módulo funciona

1. Escolha uma aba (ex: Vencimentos)
2. Abra `src/modules/vencimentos.js`
3. Leia a classe inteira
4. Para cada função, veja qual é ativada quando
5. Leia `src/api/compliance.js` → `Vencimentos` object
6. Trace o fluxo: HTML clique → módulo → API → banco
7. Faça o mesmo com 2-3 outras abas
8. Leia `docs/AULA_COMPLETA.md` — seção "Padrões de Design"

---

### 🔴 Nível 3: Avançado (5-10 horas)

**Meta:** Dominar a arquitetura e criar uma nova aba

1. Leia `src/app.js` completamente
2. Entenda Dependency Injection
3. Leia `docs/AULA_COMPLETA.md` — seção "7 passos para nova funcionalidade"
4. Crie uma nova aba do zero (seguindo o guia)
5. Rode `npm run test:coverage` para validar
6. Leia `tests/` — entenda como testar
7. Estude RLS (`database/schema.sql` — policies)

---

## 🎯 Quick Reference — Onde Procurar?

| Quero entender... | Comece em... | Depois leia... |
|-------------------|-------------|----------------|
| **Fluxo de uma ação** | `docs/FLUXOS.md` | `src/modules/*.js` |
| **Autenticação** | `src/auth.js` | `supabase.js` → Auth object |
| **Carregamento inicial** | `src/api/init.js` | `src/app.js` → bootstrap() |
| **Como renderizar tabela** | `src/modules/colaboradores.js` | `src/utils/formatting.js` |
| **Banco de dados** | `docs/AULA_BACKEND_E_BANCO.md` | `database/migrations/` |
| **Qual rota faz o cadastro** | `docs/AULA_BACKEND_E_BANCO.md` seção 4 | `src/api/pessoas.js` → `criar()` |
| **Permissão / RLS** | `docs/AULA_BACKEND_E_BANCO.md` seção 6 | `database/migrations/013_rls_colaboradores_fix.sql` |
| **Criptografia de CPF** | `database/migrations/001_criptografia_pii.sql` | `database/migrations/024_rpc_colaboradores_turno.sql` |
| **Tempo real (websocket)** | `src/api/realtime.js` | `docs/AULA_BACKEND_E_BANCO.md` seção 8 |
| **Impressão de relatório** | `src/utils/relatorio.js` | `RELATORIO_HOOKS` em `src/app.js` |
| **Padrões do código** | `docs/AULA_COMPLETA.md` | Todos os módulos |
| **Testes** | `tests/base.test.js` | `npm run test:coverage` |
| **CSS/Design** | `css/tokens.css` | `css/components.css` |
| **Integração Supabase** | `supabase.js` | `src/api/pessoas.js` → comentários JSDoc |
| **Efetivo da empresa** | `src/utils/base.js` → `statusCasa()` | `src/modules/quadro.js` |
| **Adicionar aba nova** | `docs/AULA_COMPLETA.md` seção 14 | Clonar `src/modules/colaboradores.js` |

---

## 💡 Dicas Essenciais

### ✅ Use DevTools (F12)

```
1. Abra F12
2. Vá para "Console"
3. Digite: console.log(window.COLABORADORES)
4. Veja os dados reais
5. Vá para "Network" tab
6. Faça uma ação (ex: clique em Salvar)
7. Veja requisição POST sendo feita em tempo real
```

### ✅ Rastreie um Fluxo Completo

Escolha uma ação (ex: "Criar Colaborador"):
1. Qual HTML é clicado? (`index.html` → `onclick=`)
2. Qual função JavaScript é chamada? (window.abrirModalColaborador)
3. Qual módulo a implementa? (`src/modules/colaboradores.js`)
4. Qual API ela chama? (`src/api/pessoas.js` → Colaboradores.criar)
5. Qual SQL é executado? (INSERT INTO colaboradores...)
6. Como volta ao front? (resposta JSON com novo ID)
7. O que acontece? (array atualizado → render → tabela muda)

### ✅ Use Busca de Código (Ctrl+Shift+F)

Busque por:
- `abrirModalColaborador` → vê onde é definido e onde é usado
- `Colaboradores.criar` → vê como é chamado
- `window.COLABORADORES` → vê todo acesso aos dados

---

## 🚀 Próximo Passo

Escolha o que você quer fazer:

1. **Entender uma ação específica** → Leia [`FLUXOS.md`](FLUXOS.md)
2. **Aprender todos os padrões** → Leia [`AULA_COMPLETA.md`](AULA_COMPLETA.md)
3. **Criar uma nova aba** → Siga [`AULA_COMPLETA.md` seção 14](AULA_COMPLETA.md#como-adicionar-nova-funcionalidade)
4. **Debugar um bug** → Abra DevTools (F12) e rastreie o fluxo
5. **Entender a segurança** → Leia [`AUDIT_SEGURANCA.md`](AUDIT_SEGURANCA.md)

---

**🎓 Boa sorte! Este é um sistema bem estruturado — você consegue aprender! 🚀**
