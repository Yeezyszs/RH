# Guia Completo do Código — Sistema RH

> Documento de estudo para entender toda a estrutura, funções e padrões do projeto.

---

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Fluxo de Inicialização](#2-fluxo-de-inicialização)
3. [Camada de Dados — data-store.js](#3-camada-de-dados--data-storejs)
4. [Utilitários — utils/base.js e utils/formatting.js](#4-utilitários)
5. [Constantes — constants.js](#5-constantes--constantsjs)
6. [Cliente Supabase — supabase.js](#6-cliente-supabase--supabasejs)
7. [API Layer — src/api/](#7-api-layer--srcapi)
8. [Autenticação — auth.js](#8-autenticação--authjs)
9. [Dashboard e Navegação — dashboard.js](#9-dashboard-e-navegação--dashboardjs)
10. [Orquestrador — app.js](#10-orquestrador--appjs)
11. [Módulos de Página — src/modules/](#11-módulos-de-página--srcmodules)
12. [Padrões de Comunicação](#12-padrões-de-comunicação)
13. [CSS — Estrutura de Estilos](#13-css--estrutura-de-estilos)
14. [Como Adicionar Nova Funcionalidade](#14-como-adicionar-nova-funcionalidade)

---

## 1. Visão Geral da Arquitetura

O sistema é uma **SPA (Single Page Application)** sem framework. Todo HTML já existe no `index.html` — páginas e modais ficam ocultos e são exibidos via CSS (`.page.active`). Não há build step, sem bundler, sem `npm run build`.

### Diagrama de Dependências

```
index.html (DOM + ordem de carregamento de scripts)
    │
    ├── data-store.js        ← var globals: arrays e objetos vazios
    ├── utils/base.js        ← h(), diasAte(), fmtBRL() para scripts não-módulo
    ├── dashboard.js         ← goPage(), showToast(), charts, badge vencimentos
    ├── supabase.js          ← Auth, Cache, withTimeout, withRetry, mappers
    ├── api/pessoas.js       ← Colaboradores, Departamentos, Cargos, Desligamentos
    ├── api/compliance.js    ← Vencimentos, Epis, Treinamentos
    ├── api/beneficios.js    ← Ferias, Salarios, ValeCombustivel, ValeAlimentacao
    ├── api/gestao.js        ← Advertencias, FeedbackClima, Cronograma, PlanoCarreiras
    ├── api/init.js          ← inicializarSupabase(), setupRealTimeListeners()
    ├── auth.js              ← handleLogin(), fazerLogout(), verificarSessao()
    └── app.js (module)      ← importa módulos, injeta deps, expõe window.*
            │
            ├── modules/colaboradores.js
            ├── modules/advertencias.js
            ├── modules/ferias.js
            ├── modules/desligamentos.js
            ├── modules/cronograma.js
            ├── modules/vencimentos.js
            ├── modules/epi.js
            ├── modules/rotatividade.js
            ├── modules/salarios.js
            ├── modules/vale-combustivel.js
            ├── modules/vale-alimentacao.js
            ├── modules/feedback.js
            └── modules/plano-carreiras.js
```

### Regra de Ouro

> Scripts que carregam antes de `app.js` são **plain scripts** (sem `import/export`) e se comunicam via `window.*`.
> Scripts depois de `app.js` são **ES Modules** e se comunicam via parâmetros de função.

---

## 2. Fluxo de Inicialização

Sequência exata do que acontece desde abrir o browser até a tela aparecer:

```
Browser carrega index.html
    │
    ├─ 1. data-store.js carrega
    │       Arrays globais criados e expostos ao window.*
    │
    ├─ 2. utils/base.js carrega
    │       h(), diasAte(), fmtBRL() disponíveis globalmente
    │
    ├─ 3. dashboard.js carrega
    │       Registra listeners de navegação (.nav-item click → goPage)
    │       Registra listener de sub-abas (.view-tab click)
    │       Chama renderAll() — renderiza tudo com dados vazios (estado inicial)
    │
    ├─ 4. supabase.js carrega
    │       Cria o cliente Supabase (sb)
    │       Define Auth, Cache, withTimeout, withRetry, mappers
    │
    ├─ 5. api/pessoas.js, compliance.js, beneficios.js, gestao.js carregam
    │       Objetos CRUD disponíveis: Colaboradores, Ferias, Advertencias, etc.
    │
    ├─ 6. api/init.js carrega
    │       Define inicializarSupabase() — ainda não executa
    │       Define setupRealTimeListeners() — ainda não executa
    │
    ├─ 7. auth.js carrega
    │       Registra Auth.onMudanca() — detecta logout em outra aba
    │       DOMContentLoaded → chama verificarSessao()
    │           ├─ SE há sessão ativa:
    │           │       Atualiza topbar com nome/avatar do usuário
    │           │       Mostra #app, oculta #login-screen
    │           │       Chama inicializarSupabase()
    │           │           → Carrega dados do Supabase em paralelo (Promise.allSettled)
    │           │           → Preenche arrays globais (COLABORADORES, FERIAS, etc.)
    │           │           → popularFiltrosSetor() preenche selects de filtro
    │           │           → Chama todos os render*() para popular a UI
    │           │           → setupRealTimeListeners() assina eventos em tempo real
    │           └─ SE não há sessão:
    │                   Mostra #login-screen
    │
    └─ 8. app.js (module) carrega via DOMContentLoaded
            Importa módulos (ColaboradoresModule, etc.)
            Expõe utilities ao window (h, fmtDate, fmtBRL, etc.)
            Instancia cada módulo passando dependências
            Expõe todas as funções ao window (para onclick no HTML funcionar)
```

---

## 3. Camada de Dados — `data-store.js`

**Propósito:** Criar os arrays globais antes de qualquer outro script. Define o estado compartilhado da aplicação.

### Variáveis declaradas com `var` (não `const` ou `let`)

O uso de `var` é intencional. Com `var`, as variáveis tornam-se propriedades do `window`, permitindo que scripts não-módulo e módulos ES6 acessem a mesma referência de array.

```javascript
var COLABORADORES = [];   // Array de objetos colaborador
var ADVERTENCIAS  = [];   // Array de advertências
var FERIAS        = [];   // Array de períodos de férias
var DESLIGAMENTOS = [];   // Array de desligamentos
var EVENTOS       = [];   // Array de eventos do cronograma
var VENCIMENTOS   = [];   // Array de documentos/ASOs/treinamentos
var EPI_CATALOGO  = [];   // Array de tipos de EPI
var EPI_ENTREGAS  = [];   // Array de entregas de EPI
var EPI_KITS      = {};   // Objeto: { setor: [ids de EPI] }
var VALE_COTAS    = {};   // Objeto: { colaborador_id: valor_cota }
var VALE_LANCAMENTOS = []; // Array de lançamentos de combustível
var VA_BENEFICIOS = {};   // Objeto: { colaborador_id: config_vale_alimentacao }
var SALARIOS      = {};   // Objeto: { colaborador_id: { valor, data_alteracao } }
var FEEDBACK      = [];   // Array de feedbacks 1:1
var CLIMA         = [];   // Array de pesquisas de clima
var PC_CARGOS     = [];   // Array de cargos do plano de carreiras
var PC_PLANOS     = {};   // Objeto: { colaborador_id: plano_individual }
var ROTATIVIDADE  = [];   // Array de registros de rotatividade
var VALE_ALIMENTACAO = []; // Array de benefícios de vale alimentação
```

### Constantes de Configuração

```javascript
var PARENTESCO_OPTS = ['Cônjuge','Mãe','Pai','Filho(a)',...]; // Opções de parentesco

var FAIXAS = [             // Faixas salariais para filtros e gráficos
  { min: 0,    max: 2000,  label: 'Até R$ 2k',    short: '≤2k'  },
  { min: 2000, max: 3500,  label: 'R$ 2k – 3,5k', short: '2-3,5k' },
  // ...
];

var CHART_COLORS = {       // Paleta de cores dos gráficos
  phthalo:       '#123E6B', // Azul escuro principal
  phthaloLight:  '#2E7AB8', // Azul médio
  phthaloBright: '#4A9FD6', // Azul claro
  muted:         '#8A98A8', // Cinza para textos secundários
  grid:          '#E3EBF3', // Cinza claro para linhas do grid
  text:          '#5A6B7C', // Cor de texto dos gráficos
};
```

### Por que arrays em vez de objetos indexados?

Os dados chegam como arrays do Supabase e o código de renderização usa `.filter()`, `.map()`, `.find()` que funcionam naturalmente em arrays. Objetos seriam mais eficientes para lookup por ID, mas a quantidade de dados não justifica essa complexidade.

---

## 4. Utilitários

### `src/utils/base.js` — Utilitários para scripts não-módulo

Carregado como plain script antes de `dashboard.js`. Expõe funções ao `window.*` para que scripts que não usam `import` possam acessá-las.

```javascript
function h(s)
```
**Proteção XSS.** Substitui caracteres especiais HTML por entidades seguras.
Uso: sempre ao inserir dados do usuário em HTML via `.innerHTML`.
```javascript
h('<script>alert(1)</script>') // → '&lt;script&gt;alert(1)&lt;/script&gt;'
h('João & Maria')              // → 'João &amp; Maria'
```

```javascript
function diasAte(isoVenc)
```
Calcula quantos dias faltam (ou passaram) até uma data ISO (`'2025-06-15'`).
Retorna número negativo se já venceu.
```javascript
diasAte('2025-06-01') // → -5  (venceu há 5 dias)
diasAte('2025-07-01') // → 25  (vence em 25 dias)
```

```javascript
function fmtBRL(n)
```
Formata número como moeda brasileira.
```javascript
fmtBRL(2500)    // → 'R$ 2.500,00'
fmtBRL(null)    // → 'R$ 0,00'
```

---

### `src/utils/formatting.js` — Utilitários para ES Modules

Versão ES Module das mesmas funções + funções adicionais. Importado por `app.js` e exposto ao `window.*` para que módulos e HTML inline possam usar.

```javascript
export function h(s)             // Mesma lógica que base.js
export function fmtBRL(n)        // Mesma lógica que base.js
export function diasAte(isoVenc) // Mesma lógica que base.js
```

**Funções adicionais:**

```javascript
export function iniciais(nome)
```
Extrai iniciais do primeiro e último nome para o avatar.
```javascript
iniciais('João da Silva')  // → 'JS'
iniciais('Maria')          // → 'MM'
```

```javascript
export function fmtDate(iso)
```
Converte data ISO para formato brasileiro.
```javascript
fmtDate('2025-06-15') // → '15/06/2025'
fmtDate(null)         // → '—'
```

```javascript
export function tempoCasa(iso)
```
Calcula tempo de empresa desde a data de admissão.
```javascript
tempoCasa('2022-03-01') // → '3a 3m'
tempoCasa('2025-01-01') // → '5 meses'
```

```javascript
export function vencStatus(dias)
```
Classifica o status de um vencimento pelo número de dias.
```javascript
vencStatus(-1)  // → 'vencido'
vencStatus(5)   // → 'critico'   (≤7 dias)
vencStatus(20)  // → 'alerta'    (≤30 dias)
vencStatus(60)  // → 'ok'
```

```javascript
export function vencBadge(dias)
```
Retorna HTML do badge colorido para um vencimento.
```javascript
vencBadge(-3) // → '<span class="badge danger">Vencido</span>'
vencBadge(5)  // → '<span class="badge warn">Crítico</span>'
```

```javascript
export function mesChave(iso)
```
Extrai `'YYYY-MM'` de uma data ISO. Usado como chave para agrupar dados por mês.
```javascript
mesChave('2025-06-15') // → '2025-06'
```

```javascript
export function mesLabel(chave)
```
Converte chave `'YYYY-MM'` em label legível.
```javascript
mesLabel('2025-06') // → 'Jun/2025'
```

```javascript
export function addDays(iso, n)
```
Adiciona N dias a uma data ISO.
```javascript
addDays('2025-06-01', 30) // → '2025-07-01'
```

---

## 5. Constantes — `constants.js`

Mapeamentos de valor → aparência visual. Importado por `app.js` e passado como dependência aos módulos.

```javascript
export const STATUS_LABEL = {
  ativo:    { t: 'Ativo',    cls: 'ok'      }, // Badge verde
  ferias:   { t: 'Férias',   cls: 'info'    }, // Badge azul
  afastado: { t: 'Afastado', cls: 'warn'    }, // Badge amarelo
  inativo:  { t: 'Inativo',  cls: 'neutral' }, // Badge cinza
};
// Uso: STATUS_LABEL[colaborador.status].t → 'Ativo'
//      STATUS_LABEL[colaborador.status].cls → 'ok' (classe CSS do badge)
```

```javascript
export const ADV_TIPO_BADGE = {
  verbal:    { cls: 'warn',   t: 'Verbal'    },
  escrita:   { cls: 'danger', t: 'Escrita'   },
  suspensao: { cls: 'danger', t: 'Suspensão' },
};
```

```javascript
export const SETOR_ICON = {
  'Produção':       '⚙',
  'Administrativo': '📋',
  'Área Externa':   '🌾',
};
// Uso: SETOR_ICON[colaborador.setor] → '⚙'
```

---

## 6. Cliente Supabase — `supabase.js`

Ponto de conexão com o banco de dados. Define o cliente, utilitários de resiliência, cache e mappers.

### `withTimeout(promise, ms = 6000)`

Envolve qualquer Promise com um timer. Se a Promise não resolver em `ms` milissegundos, rejeita com erro de timeout. Evita que a UI fique congelada em conexões lentas.

```javascript
// Internamente: corre a promise contra um timer
const result = await Promise.race([promise, timeoutPromise]);
```

### `withRetry(fn, maxRetries = 3)`

Executa uma função assíncrona até 3 vezes com **exponential backoff**: 1s, 2s, 4s entre tentativas. Usado para operações de escrita que podem falhar por instabilidade de rede.

```javascript
await withRetry(() => sb.from('colaboradores').insert(dados));
// Tentativa 1 → falhou → aguarda 1s
// Tentativa 2 → falhou → aguarda 2s
// Tentativa 3 → sucesso → retorna resultado
```

### `Cache`

Cache em memória com TTL de 5 minutos. Evita requisições repetidas ao banco para dados que mudam pouco (como lista de departamentos).

```javascript
Cache.get('key')         // Retorna dados ou null se expirado
Cache.set('key', dados)  // Armazena com timestamp
Cache.invalidate('key')  // Remove uma chave específica
Cache.invalidate()       // Limpa todo o cache (chamado no login/logout)
```

### `Auth`

Wrapper em torno do `supabase.auth` com interface simplificada.

```javascript
Auth.login(email, senha)    // Chama signInWithPassword, invalida cache
Auth.logout()               // Chama signOut, invalida cache
Auth.sessaoAtual()          // Retorna a sessão atual (ou null)
Auth.onMudanca(callback)    // Assina mudanças de sessão (login/logout em outra aba)
```

### Mappers — Banco → UI

Funções que convertem o formato bruto do banco de dados (snake_case, joins aninhados) para o formato esperado pela UI.

```javascript
function mapColaborador(row)
```
Converte `row.departamentos.nome` → `setor`, gera matrícula dos últimos 6 dígitos do CPF, normaliza `genero` → `sexo` (`'M'`/`'F'`/`'O'`).

```javascript
function mapAdvertencia(row)
```
Normaliza campo `status`: verifica `row.resposta_colaborador` → `'respondida'` ou `'pendente'`.

```javascript
function mapFerias(row)
```
Calcula `status` automaticamente comparando `data_termino` com hoje: `'concluida'`, `'em_curso'` ou `'planejada'`.

```javascript
function mapDesligamento(row)
```
Achata o join com `colaboradores` (`row.colaboradores.nome`) para o nível raiz do objeto.

```javascript
function mapEvento(row)
```
Separa `data_inicio` (datetime) em campos `data` e `hora_inicio`.

---

## 7. API Layer — `src/api/`

Cada arquivo agrupa objetos CRUD por domínio. Todos seguem o mesmo padrão:

```javascript
const NomeRecurso = {
  async listar()        { /* SELECT * */ },
  async criar(dados)    { /* INSERT */  },
  async atualizar(id, d){ /* UPDATE */  },
  async excluir(id)     { /* DELETE */  },
};
```

### `src/api/pessoas.js`

| Objeto | Tabela Supabase | Principais métodos |
|--------|----------------|-------------------|
| `Colaboradores` | `colaboradores` | `listar()`, `criar()`, `atualizar()`, `excluir()` |
| `Departamentos` | `departamentos` | `listar()` — para popular selects |
| `Cargos` | `cargos` | `listar()` — para popular selects |
| `HistoricoColaboradores` | `historico_colaboradores` | `listar(colabId)`, `criar()` |
| `Desligamentos` | `desligamentos` | `listar()`, `criar()`, `registrarEntrevista()` |
| `Rotatividade` | `rotatividade` | `listar()` |

### `src/api/compliance.js`

| Objeto | Tabela | Principais métodos |
|--------|--------|-------------------|
| `Vencimentos` | `asos` + `documentos` | `listar()`, `criar()`, `renovar()`, `excluir()` |
| `Epis` | `epis`, `epi_tipos`, `epi_kits_setor` | `listar()`, `listarCatalogo()`, `listarKits()`, `salvarKit()` |
| `Treinamentos` | `participantes_treinamento` | `listarParticipacoes()` |

### `src/api/beneficios.js`

| Objeto | Tabela | Principais métodos |
|--------|--------|-------------------|
| `Ferias` | `ferias` | `listar()`, `criar()`, `excluir()` |
| `Salarios` | `salario_atual` | `listar()`, `salvar()` |
| `ValeCombustivel` | `vale_combustivel`, `vale_cotas` | `listar()`, `criar()`, `listarCotas()`, `salvarCota()` |
| `ValeAlimentacao` | `vale_alimentacao` | `listar()`, `salvar()`, `excluir()` |

### `src/api/gestao.js`

| Objeto | Tabela | Principais métodos |
|--------|--------|-------------------|
| `Advertencias` | `advertencias` | `listar()`, `criar()`, `marcarAssinada()`, `excluir()` |
| `FeedbackClima` | `feedbacks`, `pesquisas_clima` | `listarFeedbacks()`, `salvarFeedback()`, `listarPesquisas()`, `salvarPesquisa()` |
| `Cronograma` | `cronograma` | `listar()`, `criar()`, `atualizar()`, `excluir()` |
| `PlanoCarreiras` | `pc_cargos`, `pc_planos` | `listarCargos()`, `salvarCargo()`, `listarPlanos()`, `salvarPlano()` |

### `src/api/init.js` — Inicializador Central

Este arquivo contém as duas funções mais importantes para o funcionamento do sistema:

#### `inicializarSupabase()`

Executada logo após o login bem-sucedido. Sequência:
1. Verifica se há sessão ativa — se não há, encerra
2. Carrega **todos os dados em paralelo** com `Promise.allSettled` (15 recursos simultâneos)
3. Preenche cada array global apenas se a requisição foi bem-sucedida (`'fulfilled'`)
4. Chama `popularFiltrosSetor()` para preencher os selects de filtro
5. Chama todas as funções `render*()` para popular a UI
6. Chama `setupRealTimeListeners()` para ativar sincronização em tempo real

O uso de `Promise.allSettled` (em vez de `Promise.all`) é crucial: se uma requisição falhar, as outras 14 continuam normalmente — a tela não fica em branco.

#### `setupRealTimeListeners()`

Assina eventos PostgreSQL de 15 tabelas com **um único handler**. Quando qualquer dado muda no banco (de qualquer dispositivo), o handler:
1. Identifica a tabela e o tipo de evento (`INSERT`, `UPDATE`, `DELETE`)
2. Atualiza o array global correspondente
3. Chama o `render*()` específico daquela tabela

```javascript
// Exemplo: alguém em outro computador adiciona uma advertência
// → handler recebe { table: 'advertencias', eventType: 'INSERT', new: {...} }
// → ADVERTENCIAS.unshift(mapAdvertencia(novoReg))
// → renderAdvertencias()  ← tela atualiza em tempo real
```

#### `popularFiltrosSetor()`

Extrai os setores únicos do array `COLABORADORES` (após carregamento) e preenche todos os `<select id="*-filter-setor">` de todas as páginas.

```javascript
function popularFiltrosSetor() {
  const setores = [...new Set(COLABORADORES.map(c => c.setor).filter(Boolean))].sort();
  // Popula: rot-filter-setor, fer-filter-setor, vale-filter-setor,
  //         va-filter-setor, sal-filter-setor, fb-filter-setor
}
```

---

## 8. Autenticação — `auth.js`

### `verificarSessao()`

Chamada no `DOMContentLoaded`. Verifica se há sessão ativa no Supabase. Se sim, mostra a aplicação e carrega os dados. Se não, mostra a tela de login.

```
DOMContentLoaded
    └── verificarSessao()
            ├── Auth.sessaoAtual()
            ├── SE tem sessão → atualizarTopbarUsuario() + mostrar app + inicializarSupabase()
            └── SE não tem → mostrar #login-screen
```

### `handleLogin(event)`

Chamada pelo `onsubmit` do formulário de login. Sequência:
1. Previne o submit padrão do formulário
2. Coloca o botão em estado "loading" para feedback visual
3. Chama `Auth.login(email, senha)` — comunica com Supabase
4. Em caso de sucesso: atualiza topbar, mostra app, inicializa dados
5. Em caso de erro: exibe mensagem de erro, restaura botão

### `fazerLogout()`

1. Remove todos os canais WebSocket ativos (`sb.removeAllChannels`)
2. Chama `Auth.logout()`
3. Mostra tela de login, oculta app
4. Reseta o formulário de login

### `atualizarTopbarUsuario(sessao)`

Lê `sessao.user.user_metadata` para extrair nome e perfil. Atualiza os elementos `.user-name`, `.user-role` e `.avatar` no topbar. Se não há metadados, usa a parte antes do `@` do email como nome.

### Detecção de logout em outra aba

```javascript
Auth.onMudanca(async (sessao) => {
  if (autenticadoAntes && !sessao) fazerLogout();
  autenticadoAntes = !!sessao;
});
```
O Supabase dispara `onAuthStateChange` em todas as abas quando o estado de auth muda. Se o usuário fizer logout em uma aba, todas as outras abas automaticamente chamam `fazerLogout()`.

---

## 9. Dashboard e Navegação — `dashboard.js`

### `goPage(name)`

Navegação SPA sem recarregar a página.
1. Remove `.active` de todos os `.nav-item` e adiciona apenas no que tem `data-page === name`
2. Remove `.active` de todas as `.page` e adiciona apenas em `#page-{name}`
3. Rola o scroll para o topo

```javascript
goPage('colaboradores')
// → nav-item[data-page="colaboradores"] recebe .active
// → section#page-colaboradores recebe .active (fica visível via CSS)
```

### `showToast(msg, type = '')`

Exibe notificação temporária (3 segundos) no canto inferior da tela.
- `type = 'ok'` → toast verde
- `type = 'err'` → toast vermelho
- sem type → toast neutro

```javascript
showToast('Colaborador salvo!', 'ok')
showToast('Erro ao conectar.', 'err')
```

### Sistema de Sub-abas

Listener global de clique detecta cliques em `.view-tab`. Quando clicado:
1. Ativa a aba clicada dentro da section pai
2. Mostra o `.view-content` cujo `id="view-{name}"`

Exemplo: EPI tem as abas `epi-entregas`, `epi-catalogo`, `epi-kits`.

### `renderDashboard()`

Calcula e exibe todos os KPIs e widgets do dashboard a partir dos dados em memória:

| Elemento | Cálculo |
|----------|---------|
| Headcount | `COLABORADORES.filter(c => c.status !== 'inativo').length` |
| Rotatividade 30d | `(admissões30d + desligamentos30d) / 2 / headcount * 100` |
| Aniversariantes do mês | Filtra `c.nascimento` pelo mês atual |
| Vencimentos críticos | `VENCIMENTOS.filter(v => diasAte(v.vencimento) <= 7)` |
| Atividade recente | Une admissões + desligamentos + advertências + férias dos últimos 7 dias |
| Widget Alertas | Vencimentos ≤7d, ordenados por urgência |
| Widget Aniversariantes | Colaboradores com aniversário nos próximos 7 dias |

### `renderDashboardCharts()`

Renderiza os 2 gráficos do dashboard usando Chart.js:
- **Rotatividade (linha):** Taxa dos últimos 6 meses, calculada a partir de COLABORADORES e DESLIGAMENTOS
- **Headcount por setor (donut):** Conta ativos agrupados por `c.setor`

Destrói instâncias anteriores antes de criar novas (`_chartRot?.destroy()`) para evitar vazamento de memória ao re-renderizar.

### Sistema de Popup de Vencimentos

```javascript
mostrarPopupVencimentos()   // Exibe popup com vencimentos urgentes
fecharPopupVencimentos()    // Fecha e marca como "dismissed" (não reaparece)
abrirVencimentosDoPopup()   // Fecha popup e navega para página de Vencimentos
```

O popup aparece automaticamente ao clicar em "Colaboradores" na sidebar (com delay de 200ms para não competir com a animação de transição de página). Uma vez dispensado (`_popupVencDismissed = true`), não reaparece na mesma sessão.

### `atualizarBadgeVencimentos()`

Adiciona/atualiza/remove o badge numérico no item "Vencimentos" da sidebar. Badge vermelho se há vencidos, amarelo se há apenas críticos.

---

## 10. Orquestrador — `app.js`

O `app.js` é o arquivo mais importante da aplicação. Ele é um **ES Module** carregado por último.

### O que ele faz

1. **Importa** todos os módulos e utilitários via `import`
2. **Expõe** utilities ao `window.*` para que HTML inline e scripts não-módulo possam usar
3. **Instancia** cada módulo passando as dependências necessárias
4. **Expõe** cada método de módulo ao `window.*` para que `onclick="..."` no HTML funcione

### Por que expor ao `window.*`?

O HTML tem atributos como:
```html
<button onclick="abrirModalColaborador()">+ Novo</button>
```

Esses `onclick` executam no escopo global. Como os módulos são ES Modules com escopo privado, suas funções precisam ser explicitamente colocadas no `window` para ficarem acessíveis.

### Função `bootstrap()`

```javascript
function bootstrap() {
  // 1. Cria helper $() para querySelector
  const $ = (sel) => document.querySelector(sel);

  // 2. Expõe utilities ao window
  window.h        = h;
  window.fmtDate  = fmtDate;
  window.fmtBRL   = fmtBRL;
  // ...

  // 3. Lê arrays globais do window (preenchidos por data-store.js)
  const COLABORADORES = window.COLABORADORES;
  const FERIAS        = window.FERIAS;
  // ...

  // 4. Instancia módulos com injeção de dependências
  const colaboradores = new ColaboradoresModule({
    $, h, fmtDate, fmtBRL,
    COLABORADORES, DEPENDENTES,
    Colaboradores: window.Colaboradores, // objeto CRUD da API
    Auth: window.Auth,
  });

  // 5. Expõe métodos ao window
  window.abrirModalColaborador = (id) => colaboradores.abrirModalColaborador(id);
  window.salvarColaborador     = (ev) => colaboradores.salvarColaborador(ev);
  // ...
}
```

### `faixaIdx(valor)`

Função local do `app.js` que retorna o índice da faixa salarial para um valor. Usa o array `FAIXAS` do `window` (definido em `data-store.js`).

```javascript
faixaIdx(1800)  // → 0  (Até R$ 2k)
faixaIdx(4000)  // → 2  (R$ 3,5k – 5k)
```

---

## 11. Módulos de Página — `src/modules/`

Todos os módulos seguem o mesmo padrão de classe ES6 com injeção de dependências.

### Estrutura Padrão de um Módulo

```javascript
export class NomeModule {
  constructor(deps) {
    // 1. Recebe e armazena todas as dependências
    this.$ = deps.$;
    this.h = deps.h;
    this.DADOS = deps.DADOS;
    this.ApiObject = deps.ApiObject;

    // 2. Estado interno do módulo
    this._editandoId = null;

    // 3. Inicializa
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    // Registra eventos: busca, filtros, cliques
    document.addEventListener('input', (e) => {
      if (e.target.id === 'xxx-search') this.render();
    });
    document.addEventListener('change', (e) => {
      if (e.target.id === 'xxx-filter') this.render();
    });
  }

  render() {
    // Lê estado atual dos filtros
    const busca  = this.$('#xxx-search')?.value || '';
    const filtro = this.$('#xxx-filter')?.value || '';

    // Filtra dados
    const itens = this.DADOS.filter(item =>
      item.nome.toLowerCase().includes(busca.toLowerCase()) &&
      (!filtro || item.campo === filtro)
    );

    // Gera HTML e insere no DOM
    this.$('#tb-xxx').innerHTML = itens.map(item =>
      `<tr><td>${this.h(item.nome)}</td></tr>`
    ).join('');
  }

  async salvar(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target));
    await this.ApiObject.criar(dados);
    this.fecharModal();
    this.render();
  }
}
```

### Os 13 Módulos

| Módulo | Arquivo | Responsabilidade Principal |
|--------|---------|--------------------------|
| `ColaboradoresModule` | `colaboradores.js` | Tabela, drawer de detalhes, modal com abas (dados, docs, dependentes, emergência), quadro por setor |
| `AdvertenciasModule` | `advertencias.js` | Tabela com filtros, drawer de histórico, gráficos de distribuição e evolução |
| `FeriasModule` | `ferias.js` | Tabela com saldo CLT, timeline visual anual, modal de agendamento de períodos |
| `DesligamentosModule` | `desligamentos.js` | Tabela, drawer com entrevista de saída |
| `CronogramaModule` | `cronograma.js` | Calendário mensal, navegação de meses, modal de evento |
| `VencimentosModule` | `vencimentos.js` | Tabela semáforo, gráfico timeline 90 dias, filtro por status |
| `EpiModule` | `epi.js` | 3 sub-abas: entregas, catálogo, kits por setor |
| `RotatividadeModule` | `rotatividade.js` | KPIs + 3 gráficos (movimentação, taxa, motivos), tabela de movimentações |
| `SalariosModule` | `salarios.js` | Tabela restrita, 2 gráficos (por setor, por faixa), exportação CSV |
| `ValeCombustivelModule` | `vale-combustivel.js` | Tabela mensal, modal de lançamentos, modal de cotas |
| `ValeAlimentacaoModule` | `vale-alimentacao.js` | Tabela de benefícios, suporte a valor fixo e por dia útil |
| `FeedbackClimaModule` | `feedback.js` | 2 sub-abas: feedbacks individuais e pesquisas de clima com gráficos |
| `PlanoCarreirasModule` | `plano-carreiras.js` | 2 sub-abas: trilhas & cargos (estrutura) e planos individuais |

### Módulo de Destaque: `ColaboradoresModule`

É o módulo mais complexo por ter múltiplas sub-seções:

```
ColaboradoresModule
    ├── render()                    → Tabela paginada (50 por página) com filtros
    ├── renderQuadro()              → Cards agrupados por setor
    ├── abrirDrawerColab(id)        → Painel lateral com detalhes completos
    │       ├── renderDadosDrawer()     → Dados pessoais e profissionais
    │       ├── renderContatosEmergencia() → Lista de contatos
    │       ├── renderDocsDrawer()      → Documentos e vencimentos do colaborador
    │       ├── renderEpiDrawer()       → EPIs do colaborador
    │       └── renderHistoricoDrawer() → Histórico de cargos/salários
    ├── abrirModalColaborador(id)   → Modal com 4 abas
    │       ├── dados       → Campos pessoais, cargo, setor, status
    │       ├── docs        → RG, CPF, CTPS, CNH, conta bancária
    │       ├── dependentes → Lista de dependentes com campo escola para ≤14 anos
    │       └── emergencia  → Contatos de emergência
    └── popularFiltroSetores()      → Carrega setores do banco (Departamentos.listar())
```

---

## 12. Padrões de Comunicação

### Entre Módulo e API

```javascript
// Leitura — usa dados já em memória
const ativos = this.COLABORADORES.filter(c => c.status === 'ativo');

// Escrita — vai ao banco e atualiza memória indiretamente via real-time
await this.Colaboradores.criar(dados);
// O setupRealTimeListeners() detecta o INSERT e atualiza COLABORADORES
// Em seguida chama renderColaboradores() automaticamente
```

### Entre Módulos (via window globals)

Módulos não se comunicam diretamente entre si. A comunicação ocorre via arrays globais:

```javascript
// Em FeriasModule: precisa dos dados de salário para calcular provisão
const salario = this.SALARIOS[colaborador.id]; // Lê do objeto global
```

### HTML inline → Módulo (via window.*)

```html
<!-- HTML -->
<button onclick="abrirModalColaborador(123)">Editar</button>
```

```javascript
// app.js expôs:
window.abrirModalColaborador = (id) => colaboradores.abrirModalColaborador(id);
// Então o onclick chama o método do módulo via window
```

### Atualização em Tempo Real (WebSocket → UI)

```
Usuário B insere dado no banco
    ↓
PostgreSQL emite evento de change
    ↓
Supabase WebSocket entrega para todos os clientes conectados
    ↓
handler em setupRealTimeListeners() recebe { table, eventType, new }
    ↓
Atualiza array global (COLABORADORES.unshift(novo))
    ↓
Chama render*() específico
    ↓
UI atualiza sem recarregar a página
```

---

## 13. CSS — Estrutura de Estilos

O CSS é dividido em 5 arquivos por responsabilidade, importados em ordem por `css/style.css`.

### Hierarquia de Importação

```
css/style.css
    @import 'tokens.css'      ← Deve ser primeiro (define variáveis)
    @import 'layout.css'      ← Usa variáveis de tokens
    @import 'components.css'  ← Usa variáveis de tokens
    @import 'pages.css'       ← Pode usar componentes
    @import 'login.css'       ← Independente, mas last para não sobrescrever
```

### `css/tokens.css` (~62 linhas)

Variáveis CSS (design tokens), import de fontes e reset global.

```css
:root {
  --phthalo:      #123E6B;  /* Cor primária — azul escuro */
  --primary:      #1a5fa8;  /* Cor de ação — botões, links */
  --danger:       #dc2626;  /* Vermelho — alertas críticos */
  --warn:         #d97706;  /* Amarelo — atenção */
  --success:      #16a34a;  /* Verde — positivo */
  --border:       #D6E4F0;  /* Bordas padrão */
  --text-main:    #1E2D3D;  /* Texto principal */
  --text-soft:    #6B7F8F;  /* Texto secundário */
  --white:        #FFFFFF;
  --bg:           #F0F5FA;  /* Fundo da aplicação */
}
```

### `css/layout.css` (~250 linhas)

Estrutura macro: topbar, sidebar, área de conteúdo, sistema de páginas.

- `.topbar` — barra superior fixa
- `.sidebar` — navegação lateral
- `.app-shell` — flex container: sidebar + main
- `.page` — visibilidade via `display:none` / `.page.active { display:block }`
- `.page` animação de entrada: `@keyframes fadeInUp`

### `css/components.css` (~595 linhas)

Componentes reutilizáveis que aparecem em múltiplas páginas:

- **KPIs:** `.kpi-grid`, `.kpi-card`, `.kpi-value`, `.kpi-trend`
- **Widgets:** `.widget`, `.widget-header`, `.widget-title`, `.widget-badge`
- **Tabela:** `.data`, `.table-card`, `.table-wrapper`, `.pagination-bar`
- **Botões:** `.btn`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-sm`
- **Badges:** `.badge.ok`, `.badge.warn`, `.badge.danger`, `.badge.info`
- **Modais:** `.modal`, `.modal-box`, `.modal-header`, `.modal-body`, `.modal-footer`
- **Drawer:** `.drawer`, `.drawer-backdrop`, `.drawer-header`, `.drawer-tabs`
- **Formulários:** `.form-grid`, `.form-group`, `.form-group.full`
- **Toolbar:** `.toolbar`, `.toolbar-search`, `.toolbar-spacer`
- **Stats:** `.stats-row`, `.stat`, `.stat-success`, `.stat-warn`, `.stat-danger`

### `css/pages.css` (~630 linhas)

Estilos específicos de cada página que não se repetem:

- **Quadro de Funcionários:** `.setor-grid`, `.setor-card`, `.setor-member`
- **Cronograma:** `.cal-wrapper`, `.cal-grid`, `.cal-day`, `.cal-event`
- **Férias:** `.fer-timeline`, `.fer-bar` (timeline visual dos períodos)
- **Popup de Vencimentos:** `.alert-popup`, `.alert-popup-item`
- **Toast:** `.toast`, `.toast.show`, `.toast-ok`, `.toast-err`
- **Rating (1-5):** `.rating-group`, `.rating-input button`
- **Banner sensível:** `.sensitive-banner`, `.sb-icon`, `.sb-title`
- **Sub-abas:** `.view-tabs`, `.view-tab`, `.view-tab.active`

### `css/login.css` (~155 linhas)

Tela de login completamente independente:

- `.login-container` — card centralizado
- `.login-logo` — quadrado azul com "RH"
- `.login-button.loading` — estado de carregamento com spinner CSS
- `.login-error.show` — mensagem de erro animada

---

## 14. Como Adicionar Nova Funcionalidade

### Adicionar uma Nova Página

**1. Criar o módulo em `src/modules/nova-pagina.js`:**
```javascript
export class NovaPaginaModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.MEUS_DADOS = deps.MEUS_DADOS;
    this.init();
  }

  init() { this.setupEventListeners(); this.render(); }

  render() {
    this.$('#tb-nova-pagina').innerHTML = this.MEUS_DADOS.map(item =>
      `<tr><td>${this.h(item.nome)}</td></tr>`
    ).join('');
  }
}
```

**2. Adicionar variável em `src/data-store.js`:**
```javascript
var MEUS_DADOS = [];
window.MEUS_DADOS = MEUS_DADOS;
```

**3. Criar objeto CRUD no arquivo de API adequado:**
```javascript
const NovoRecurso = {
  async listar() { ... },
  async criar(dados) { ... },
};
window.NovoRecurso = NovoRecurso;
```

**4. Carregar dados em `src/api/init.js`:**
```javascript
// Adicionar ao Promise.allSettled
const novosDados = await NovoRecurso.listar();

// Tratar o resultado
if (novosDados.status === 'fulfilled') {
  MEUS_DADOS = novosDados.value;
}

// Chamar render após carregar
if (typeof renderNovaPagina === 'function') renderNovaPagina();
```

**5. Importar e instanciar em `src/app.js`:**
```javascript
import { NovaPaginaModule } from './modules/nova-pagina.js';

const novaPagina = new NovaPaginaModule({
  $, h, MEUS_DADOS: window.MEUS_DADOS,
  NovoRecurso: window.NovoRecurso,
});

window.renderNovaPagina = () => novaPagina.render();
```

**6. Adicionar HTML em `index.html`:**
```html
<!-- Sidebar -->
<div class="nav-item" data-page="nova-pagina">
  <span class="nav-icon">◈</span>
  <span>Nova Página</span>
</div>

<!-- Seção -->
<section id="page-nova-pagina" class="page">
  <div class="page-header">
    <h1 class="page-title">Nova Página</h1>
  </div>
  <div class="table-card">
    <table class="data">
      <thead><tr><th>Nome</th></tr></thead>
      <tbody id="tb-nova-pagina"></tbody>
    </table>
  </div>
</section>
```

### Adicionar um Novo Campo a um Formulário Existente

1. Adicionar `<input name="novo_campo">` no `<form>` em `index.html`
2. O campo é capturado automaticamente por `new FormData(event.target)` no método `salvar()` do módulo
3. Incluir o campo no mapper correspondente em `supabase.js` se necessário
4. Verificar se a coluna existe na tabela do Supabase

### Adicionar um Novo Gráfico

Usar o padrão existente em qualquer módulo:
```javascript
// Na classe do módulo
this._meuChart = null;

// No método render
if (this._meuChart) this._meuChart.destroy(); // Sempre destruir antes
const ctx = this.$('#meu-canvas');
this._meuChart = new Chart(ctx, {
  type: 'bar',
  data: { labels: [...], datasets: [{ data: [...] }] },
  options: { responsive: true, maintainAspectRatio: false },
});
```

---

## Referência Rápida de IDs do DOM

| ID | Onde está | Preenchido por |
|----|-----------|----------------|
| `dash-kpi-headcount` | Dashboard | `renderDashboard()` |
| `tb-colaboradores` | Colaboradores | `ColaboradoresModule.render()` |
| `setor-grid` | Quadro | `ColaboradoresModule.renderQuadro()` |
| `tb-vencimentos` | Vencimentos | `VencimentosModule.render()` |
| `tb-epi-entregas` | EPI / Entregas | `EpiModule.render()` |
| `cal-grid` | Cronograma | `CronogramaModule.render()` |
| `tb-ferias` | Férias | `FeriasModule.render()` |
| `tb-salarios` | Salários | `SalariosModule.render()` |
| `tb-advertencias` | Advertências | `AdvertenciasModule.render()` |
| `dash-alerts-list` | Dashboard | `renderDashboard()` |
| `dash-bday-list` | Dashboard | `renderDashboard()` |
| `toast` | Global | `showToast()` |
| `alert-popup-vencimentos` | Global | `mostrarPopupVencimentos()` |

---

*Documento gerado em 2026-05-27. Reflete a estrutura após as refatorações P1–P5.*
