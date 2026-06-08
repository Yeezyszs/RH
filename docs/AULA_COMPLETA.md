# 🎓 AULA COMPLETA — Sistema de Gestão de RH (SPA)

## Bem-vindo!

Este documento é uma **aula prática e completa** sobre a arquitetura e funcionamento do seu sistema de Recursos Humanos. Vamos explorar desde os conceitos fundamentais até exemplos práticos de código.

---

# 📚 ÍNDICE

1. [Visão Geral e Arquitetura](#visão-geral-e-arquitetura)
2. [Conceitos Fundamentais](#conceitos-fundamentais)
3. [Fluxo de Inicialização Passo a Passo](#fluxo-de-inicialização-passo-a-passo)
4. [Camadas da Aplicação](#camadas-da-aplicação)
5. [Padrões de Design Utilizados](#padrões-de-design-utilizados)
6. [Exemplos Práticos de Código](#exemplos-práticos-de-código)
7. [Fluxo de Dados (Data Flow)](#fluxo-de-dados)
8. [Como Adicionar Nova Funcionalidade](#como-adicionar-nova-funcionalidade)
9. [Troubleshooting Comum](#troubleshooting-comum)

---

# 🏛️ VISÃO GERAL E ARQUITETURA

## O que é uma SPA?

**SPA** = **Single Page Application** (Aplicação de Página Única)

- Um único arquivo HTML (`index.html`)
- Todo o conteúdo já está no HTML (oculto com CSS)
- Não há recarga de página — tudo é feito com JavaScript
- Navegação entre "páginas" é apenas CSS show/hide

## Seu Sistema é diferente?

**Sim!** Seu sistema é uma SPA **sem framework** (React, Vue, Angular):

```
❌ NÃO usa: React, Vue, Angular, Next.js, etc.
✅ USA: JavaScript vanilla (ES6+ puro)
✅ USA: CSS Grid/Flexbox para layout
✅ USA: Supabase para backend (PostgreSQL + Auth)
✅ USA: Modules (import/export) apenas após app.js
```

## Arquitetura em 3 Camadas

```
┌─────────────────────────────────────────────────────────────┐
│                      APRESENTAÇÃO                           │
│  (HTML + CSS + módulos de página)                           │
│  └─ index.html (119 KB)                                     │
│  └─ src/modules/*.js (13 arquivos)                          │
│  └─ css/*.css (5 arquivos)                                  │
└─────────────────────────────────────────────────────────────┘
                          △
                          │
                    COMUNICAÇÃO (window.*)
                          │
                          ▽
┌─────────────────────────────────────────────────────────────┐
│                    LÓGICA (Scripts)                         │
│  app.js, dashboard.js, auth.js                              │
│  └─ Gerencia estado                                         │
│  └─ Renderiza views                                         │
│  └─ Trata eventos do usuário                                │
└─────────────────────────────────────────────────────────────┘
                          △
                          │
                   API REST (HTTP)
                          │
                          ▽
┌─────────────────────────────────────────────────────────────┐
│                      DADOS                                  │
│  Supabase (PostgreSQL + RLS)                                │
│  └─ 18+ tabelas                                             │
│  └─ Row Level Security (RLS)                                │
│  └─ Autenticação                                            │
│  └─ Webhooks em tempo real                                  │
└─────────────────────────────────────────────────────────────┘
```

---

# 💡 CONCEITOS FUNDAMENTAIS

## 1. Scripts Plain vs. ES Modules

Seu projeto tem **dois tipos de scripts**:

### Scripts Plain (sem import/export)
**Carregam ANTES de app.js** — se comunicam via `window.*`

Exemplos:
- `data-store.js` — define variáveis globais
- `utils/base.js` — expõe `h()`, `diasAte()` ao `window`
- `dashboard.js` — expõe `goPage()`, `showToast()` ao `window`
- `auth.js` — carrega listeners de autenticação

```javascript
// ✅ CORRETO - data-store.js (plain script)
var COLABORADORES = [];
var VENCIMENTOS = [];

window.COLABORADORES = COLABORADORES;
window.VENCIMENTOS = VENCIMENTOS;
```

### ES Modules (import/export)
**Carregam DEPOIS de app.js** — se comunicam via parâmetros

```javascript
// ✅ CORRETO - modules/colaboradores.js (ES Module)
export class ColaboradoresModule {
  constructor(deps) {
    this.COLABORADORES = deps.COLABORADORES;  // recebe do construtor
  }
}
```

## 2. Dependency Injection

Padrão usado em todos os módulos para passar dependências:

```javascript
// Exemplo: ColaboradoresModule
export class ColaboradoresModule {
  constructor(deps) {
    // deps = { $, h, fmtDate, COLABORADORES, Auth, API_OBJETO }
    this.$ = deps.$;              // seletor DOM
    this.h = deps.h;              // escapar HTML
    this.COLABORADORES = deps.COLABORADORES;  // dados
  }
}
```

**Por que?** Desacoplamento. Cada módulo não precisa saber de onde vem a dependência.

## 3. Armazenamento de Dados (Data Store)

Seu app usa uma abordagem simples e poderosa:

```javascript
// data-store.js — UMA ÚNICA FONTE DE VERDADE
var COLABORADORES = [];      // array de objetos
var VENCIMENTOS = [];        // array de objetos
var SALARIOS = {};           // objeto com key=colab_id
var EPI_KITS = {};           // objeto com key=setor

// Expõe globalmente para acesso em qualquer script
window.COLABORADORES = COLABORADORES;
window.VENCIMENTOS = VENCIMENTOS;
// ... etc
```

**Quando algo muda:**

1. API retorna novo dado
2. Array/objeto é atualizado: `window.COLABORADORES.push(novo)`
3. Render é chamado: `renderColaboradores()` — re-renderiza a tabela
4. Todos os módulos veem o dado novo (mesmo array, mesma referência)

---

# ⏳ FLUXO DE INICIALIZAÇÃO PASSO A PASSO

## Sequência Exata de Carregamento

### Passo 1: Browser abre `index.html`

```
index.html carrega
    ↓
<script src="src/data-store.js"></script>
    ↓
Arrays globais criados: COLABORADORES=[], VENCIMENTOS=[], etc.
Expostos ao window: window.COLABORADORES, window.VENCIMENTOS, etc.
```

**O que acontece:** Seu app começa com "caixas vazias" prontas para receber dados.

### Passo 2: Utilitários carregam

```
<script src="src/utils/base.js"></script>
    ↓
Funções h(), diasAte(), fmtBRL() definidas
Expostas ao window: window.h, window.diasAte, window.fmtBRL
    ↓
dashboard.js precisa dessas funções → já estão prontas
```

### Passo 3: Dashboard carrega

```
<script src="src/dashboard.js"></script>
    ↓
Registra event listeners:
  - Clique em .nav-item → goPage(name)
  - Clique em .view-tab → showPage(name)
    ↓
Chama renderAll() — renderiza tudo com dados vazios
  (tabelas aparecem com "Carregando...")
```

### Passo 4: Supabase carrega

```
<script src="supabase.js"></script>
    ↓
Cria cliente: sb = new SupabaseClient(...)
Define: Auth, Cache, withTimeout(), withRetry()
Define: mappers (mapColaborador, mapVencimento, etc)
    ↓
Supabase está pronto para ser usado
```

### Passo 5: API Objects carregam

```
<script src="src/api/pessoas.js"></script>
<script src="src/api/compliance.js"></script>
<script src="src/api/beneficios.js"></script>
<script src="src/api/gestao.js"></script>
    ↓
Objetos CRUD criados:
  - Colaboradores.criar(), Colaboradores.ler(), etc
  - Vencimentos.criar(), Vencimentos.ler(), etc
  - ... 18 objetos no total
    ↓
API está pronta para fazer requisições ao Supabase
```

### Passo 6: Inicialização carrega

```
<script src="src/api/init.js"></script>
    ↓
Define inicializarSupabase() — ainda NÃO executa
Define setupRealTimeListeners() — ainda NÃO executa
    ↓
Espera o app.js carregar
```

### Passo 7: Autenticação carrega

```
<script src="src/auth.js"></script>
    ↓
Registra: Auth.onMudanca() — detecta logout em outra aba
window.addEventListener('DOMContentLoaded', ...)
    ↓
DOMContentLoaded dispara → verificarSessao()
```

### Passo 8: App (módulos) carregam

```
<script type="module" src="src/app.js"></script>
    ↓
Importa todos os 13 módulos ES6
Cria dependências: deps = { $, h, fmtDate, COLABORADORES, ... }
Instancia cada módulo: new ColaboradoresModule(deps)
Injeta no window: window.render*, window.abrir*, etc
    ↓
Executa bootstrap():
  1. aguarda DOMContentLoaded
  2. inicializarSupabase() ← AQUI COMEÇAM OS DADOS A CHEGAR
  3. setupRealTimeListeners() ← ATIVA WEBSOCKETS
```

### Passo 9: Dados começam a chegar

```
inicializarSupabase():
    ↓
Promise.allSettled([
  Colaboradores.ler(),    ← carrega 50 colaboradores
  Vencimentos.ler(),      ← carrega 300 vencimentos
  Epis.ler(),             ← carrega 500 entregas
  ... 15 tabelas
])
    ↓
Cada resultado atualiza o global:
  window.COLABORADORES = resultado
  window.VENCIMENTOS = resultado
    ↓
Chama renderAll() — RE-RENDERIZA TUDO COM DADOS REAIS
    ↓
setupRealTimeListeners() ativa:
  postgres_changes → Supabase websoket
  Qualquer INSERT/UPDATE/DELETE dispara listener
  Re-renderiza a tabela automaticamente
```

### Timeline Completa

```
0ms  ├─ Browser abre index.html
10ms ├─ data-store.js carrega (arrays vazios)
15ms ├─ utils/base.js carrega (funções h, diasAte, fmtBRL)
20ms ├─ dashboard.js carrega (renderAll com dados vazios)
25ms ├─ supabase.js carrega (cliente Supabase criado)
30ms ├─ api/pessoas.js, compliance.js, etc carregam
35ms ├─ api/init.js carrega
40ms ├─ auth.js carrega
45ms ├─ app.js carrega e DOMContentLoaded dispara
50ms ├─ inicializarSupabase() COMEÇA
100ms ├─ Dados começam a chegar (Promise.allSettled)
150ms ├─ window.COLABORADORES = [50 objetos]
160ms ├─ window.VENCIMENTOS = [300 objetos]
...
300ms ├─ renderAll() atualiza TODAS as tabelas
310ms ├─ setupRealTimeListeners() ativa (websocket aberto)
320ms └─ APP PRONTO! Usuário pode interagir
```

---

# 🏗️ CAMADAS DA APLICAÇÃO

## 1. Data Store (Camada de Dados)

**Arquivo:** `src/data-store.js`

**Responsabilidade:** Manter o estado global

```javascript
// Arrays — dados que são listas
var COLABORADORES = [];      // [{id:1, nome:'...', ...}, ...]
var DEPENDENTES = [];
var VENCIMENTOS = [];
var FERIAS = [];
var ADVERTENCIAS = [];
var DESLIGAMENTOS = [];
var EVENTOS = [];
var EPI_ENTREGAS = [];

// Objetos — dados organizados por chave
var SALARIOS = {};           // {1: {bruto: 5000}, 2: {...}}
var VALE_COTAS = {};         // {1: {saldo: 100}, ...}
var EPI_KITS = {};           // {'Produção': [1,2,3], ...}
var VA_BENEFICIOS = {};      // {1: {valor: 300}, ...}

// Tabelas lookup
var PC_CARGOS = [];          // Plano de carreiras
var PC_PLANOS = {};          // {cargo_id: [...planos]}
var CHART_COLORS = {...};    // Cores para gráficos
var PARENTESCO_OPTS = [...]; // Opções de dropdown

// Expõe tudo ao window para acesso global
window.COLABORADORES = COLABORADORES;
window.VENCIMENTOS = VENCIMENTOS;
// ... 28 exports ao todo
```

**Padrão:** Uma única fonte de verdade. Se algo mudar, todos os módulos veem a mudança imediatamente.

## 2. Utilitários (Funções Compartilhadas)

**Arquivos:** `src/utils/base.js` (plain) e `src/utils/formatting.js` (módulo)

### base.js — Para scripts plain

```javascript
// Escape HTML (prevenção XSS)
function h(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])
  );
}
// h('<script>') → '&lt;script&gt;' (seguro para inserir em HTML)

// Dias até uma data
function diasAte(isoVenc) {
  const hoje = new Date();
  const futuro = new Date(isoVenc + 'T00:00:00');
  return Math.round((futuro - hoje) / 86400000);
}
// diasAte('2026-06-15') → 7 (dias faltando)

// Formatar moeda BRL
function fmtBRL(n) {
  return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
// fmtBRL(1234.5) → 'R$ 1.234,50'

window.h = h;
window.diasAte = diasAte;
window.fmtBRL = fmtBRL;
```

### formatting.js — Para módulos ES6

```javascript
export function h(s) { /* ... */ }
export function iniciais(nome) { /* retorna 'JC' para 'João Carlos' */ }
export function fmtDate(iso) { /* '2026-06-08' → '08/06/2026' */ }
export function fmtBRL(n) { /* ... */ }
export function tempoCasa(iso) { /* '2020-01-01' → '6 anos' */ }
// ... 7 funções de utilidade
```

**Diferença:** `base.js` carrega cedo como plain script, `formatting.js` é importado por módulos que precisam de mais funções.

## 3. Constantes

**Arquivo:** `src/constants.js`

```javascript
export const CHART_COLORS = {
  phthalo:       '#123E6B',  // azul escuro
  phthaloLight:  '#2E7AB8',  // azul claro
  phthaloBright: '#4A9FD6',  // azul brilhante
  muted:         '#8A98A8',  // cinza
  grid:          '#E3EBF3',  // cinza muito claro
  text:          '#5A6B7C',  // texto
};

export const STATUS_LABEL = {
  ativo:    { t: 'Ativo',    cls: 'ok'      },
  ferias:   { t: 'Férias',   cls: 'info'    },
  afastado: { t: 'Afastado', cls: 'warn'    },
  inativo:  { t: 'Inativo',  cls: 'neutral' },
};

export const SETOR_ICON = {
  'Produção':       '⚙',
  'Administrativo': '📋',
  'Área Externa':   '🌾',
};

// Uso no módulo:
import { STATUS_LABEL } from '../constants.js';
const label = STATUS_LABEL['ativo'].t; // 'Ativo'
```

## 4. Cliente Supabase

**Arquivo:** `supabase.js`

```javascript
// Criar cliente Supabase (como banco de dados remoto)
const sb = new SupabaseClient(URL_SUPABASE, ANON_KEY);

// Exportar para uso em outros scripts
window.sb = sb;

// Auth — Gerenciar login/logout/sessão
export const Auth = {
  sessaoAtual: () => sb.auth.getSession(),
  login: (email, senha) => sb.auth.signInWithPassword({email, password: senha}),
  logout: () => sb.auth.signOut(),
  onMudanca: (callback) => sb.auth.onAuthStateChange(callback),
};

// Cache — Evitar requisições repetidas
export const Cache = {
  set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
  get: (key) => JSON.parse(localStorage.getItem(key) || 'null'),
  clear: () => localStorage.clear(),
};

// Retry — Tentar novamente se falhar
export const withRetry = async (fn, tentativas = 3) => {
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === tentativas - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // esperar antes de tentar novamente
    }
  }
};

// Timeout — Não ficar pendurado se não responder
export const withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
};

// Mappers — Transformar dados do banco para a app
export const mapColaborador = (row) => ({
  id: row.id,
  nome: row.nome,
  cpf: row.cpf,
  email: row.email,
  setor: row.setor,
  cargo: row.cargo,
  status: row.status,
  data_admissao: row.data_admissao,
  // ... 20+ campos
});
```

## 5. Camada de API

**Arquivos:** `src/api/pessoas.js`, `compliance.js`, `beneficios.js`, `gestao.js`

Cada arquivo define objetos CRUD (Create, Read, Update, Delete):

```javascript
// pessoas.js
export const Colaboradores = {
  ler: async () => {
    const { data, error } = await sb
      .from('colaboradores')
      .select('*')
      .eq('empresa_id', sessao.user.id);
    if (error) throw error;
    return data.map(mapColaborador);
  },

  criar: async (payload) => {
    const { data, error } = await sb
      .from('colaboradores')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return mapColaborador(data);
  },

  atualizar: async (id, payload) => {
    const { data, error } = await sb
      .from('colaboradores')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapColaborador(data);
  },

  excluir: async (id) => {
    const { error } = await sb
      .from('colaboradores')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

export const Departamentos = { /* ... */ };
export const Cargos = { /* ... */ };
// ... 18 objetos CRUD ao todo
```

**Padrão:** Cada tabela do banco tem um objeto com métodos ler/criar/atualizar/excluir.

## 6. Inicialização e Listeners

**Arquivo:** `src/api/init.js`

```javascript
// Carrega todos os dados quando app inicia
export const inicializarSupabase = async () => {
  const [colab, venc, epi, ferias, ...] = await Promise.allSettled([
    Colaboradores.ler(),
    Vencimentos.ler(),
    EpiEntregas.ler(),
    Ferias.ler(),
    // ... 15 tabelas
  ]);

  // Atualiza globals (data-store.js)
  window.COLABORADORES = colab.value || [];
  window.VENCIMENTOS = venc.value || [];
  window.EPI_ENTREGAS = epi.value || [];
  window.FERIAS = ferias.value || [];
  // ...

  // Chama render em tudo
  if (typeof window.renderAll === 'function') {
    window.renderAll();
  }
};

// Escuta mudanças em tempo real no Supabase (websocket)
export const setupRealTimeListeners = () => {
  // Exemplo: qualquer INSERT/UPDATE em colaboradores
  sb.from('colaboradores')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, payload => {
      // Atualiza global
      window.COLABORADORES = atualizarArrayComNovoDado(window.COLABORADORES, payload.new);
      // Re-renderiza
      window.renderColaboradores?.();
    })
    .subscribe();
  // ... 15 listeners ao total (uma para cada tabela)
};
```

**O que faz:** Sincroniza dados em tempo real. Se outro usuário criar um colaborador, você vê aparecer na tabela automaticamente.

---

# 🎨 PADRÕES DE DESIGN UTILIZADOS

## 1. Dependency Injection (DI)

**Problema:** Módulos precisam de dados, mas não devem "saber" de onde vêm.

**Solução:** Passar tudo pelo constructor:

```javascript
// Sem DI (ruim — acoplamento forte)
export class ColaboradoresModule {
  constructor() {
    this.colaboradores = window.COLABORADORES;  // ← hardcoded
    this.fmtDate = window.fmtDate;              // ← hardcoded
  }
}

// Com DI (bom — desacoplado)
export class ColaboradoresModule {
  constructor(deps) {
    this.colaboradores = deps.COLABORADORES;  // ← vem de fora
    this.fmtDate = deps.fmtDate;              // ← vem de fora
  }
}

// app.js injecta:
const deps = {
  $: (sel) => document.querySelector(sel),
  h,
  fmtDate,
  COLABORADORES: window.COLABORADORES,
  // ... 30 deps ao total
};
new ColaboradoresModule(deps);
```

**Benefício:** Fácil testar (passar mock), trocar implementação sem quebrar tudo.

## 2. Observer Pattern (Listeners)

**Problema:** Quando dados mudam, múltiplas partes do app precisam saber.

**Solução:** Listeners que reagem a mudanças:

```javascript
// Setup (em dashboard.js)
document.addEventListener('click', (e) => {
  if (e.target.id === 'colab-search') {
    window.renderColaboradores(); // ← qualquer tipo no input, re-renderiza
  }
});

// Em um módulo (colaboradores.js)
setupEventListeners() {
  document.addEventListener('input', (e) => {
    if (e.target.id === 'colab-search') {
      this.render();
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'colab-filter-setor') {
      this.render();
    }
  });
}
```

**Benefício:** Mudanças no input → tabela atualiza automaticamente (sem submeter formulário).

## 3. Module Pattern

**Problema:** Variáveis globais poluem o namespace.

**Solução:** Cada módulo é uma classe auto-contida:

```javascript
// ✅ Isolado
export class VencimentosModule {
  constructor(deps) {
    this.$ = deps.$;
    this.VENCIMENTOS = deps.VENCIMENTOS;  // ← dado privado ao módulo
  }

  render() {
    // ← só este módulo modifica sua tabela
  }
}

// ✅ Expõe apenas o necessário ao window
window.renderVencimentos = module.render.bind(module);
window.abrirModalVencimento = module.abrirModal.bind(module);
// Não expõe: module.$, module.VENCIMENTOS, module.setupEventListeners(), etc
```

**Benefício:** Cada módulo é responsável por sua própria UI e lógica. Mudanças em um não quebram outro.

## 4. Active Record Pattern

**Problema:** Lógica CRUD espalhada.

**Solução:** Cada tabela tem um objeto com CRUD:

```javascript
export const Colaboradores = {
  ler: async () => { /* SELECT */ },
  criar: async (data) => { /* INSERT */ },
  atualizar: async (id, data) => { /* UPDATE */ },
  excluir: async (id) => { /* DELETE */ },
};

// Uso
const colaboradores = await Colaboradores.ler();
const novo = await Colaboradores.criar({nome: 'João'});
await Colaboradores.atualizar(novo.id, {email: 'joao@example.com'});
await Colaboradores.excluir(novo.id);
```

**Benefício:** Operações de banco em um só lugar. Fácil adicionar validação/logging.

## 5. Factory Pattern

**Problema:** Criar múltiplos objetos similares.

**Solução:** app.js cria ("fabrica") instâncias de todos os módulos:

```javascript
// app.js
const collaboradoresModule = new ColaboradoresModule(deps);
const advertenciasModule = new AdvertenciasModule(deps);
const feriasModule = new FeriasModule(deps);
// ... 13 módulos criados com a mesma fórmula

// Cada um já é renderizado, listeners já estão setup
// Novo usuário não precisa saber de nada — só importar e pronto
```

**Benefício:** Adicionar nova aba é simples — criar classe, importar em app.js, booom já funciona.

---

# 💻 EXEMPLOS PRÁTICOS DE CÓDIGO

## Exemplo 1: Criar um novo colaborador

```javascript
// Usuário clica em "Novo Colaborador" → abre modal
async function salvarColaborador(event) {
  event.preventDefault();

  // 1. Ler dados do formulário
  const form = document.getElementById('form-colaborador');
  const dados = Object.fromEntries(new FormData(form));

  // 2. Validar (exemplo simples)
  if (!dados.nome || !dados.email) {
    showToast('Preencha todos os campos', 'err');
    return;
  }

  // 3. Enviar para o banco
  try {
    const novo = await Colaboradores.criar({
      nome: dados.nome,
      email: dados.email,
      cpf: dados.cpf,
      setor: dados.setor,
      cargo: dados.cargo,
      // ... outros campos
    });

    // 4. Atualizar global (data-store.js)
    window.COLABORADORES.unshift(novo);  // ← adiciona no início

    // 5. Re-renderizar tabela
    window.renderColaboradores();

    // 6. Fechar modal e mostrar sucesso
    fecharModalColaborador();
    showToast(`${novo.nome} adicionado!`, 'ok');

  } catch (erro) {
    showToast(`Erro: ${erro.message}`, 'err');
  }
}
```

**O que aconteceu:**
- 1-2: Ler e validar input
- 3: Fazer POST ao Supabase
- 4: Atualizar array global
- 5: Re-renderizar (tabela atualiza)
- 6: Feedback ao usuário

## Exemplo 2: Filtrar colaboradores por setor

```javascript
// HTML: <select id="colab-filter-setor" onchange="...">
// JavaScript: setupEventListeners em ColaboradoresModule

render() {
  // 1. Ler valor do filtro
  const filtroSetor = document.getElementById('colab-filter-setor').value || '';

  // 2. Filtrar dados
  const filtered = window.COLABORADORES.filter(c => {
    if (filtroSetor && c.setor !== filtroSetor) return false; // ← filtrar
    return true;
  });

  // 3. Renderizar tabela
  const tbody = document.getElementById('tb-colaboradores');
  tbody.innerHTML = filtered.length
    ? filtered.map(c => `
        <tr onclick="abrirDrawerColab(${c.id})">
          <td>${this.h(c.nome)}</td>
          <td>${this.h(c.setor)}</td>
          <td>${this.h(c.cargo)}</td>
          <td>${this.fmtDate(c.data_admissao)}</td>
          <td>
            <button onclick="event.stopPropagation(); editarColaborador(${c.id})">✎</button>
            <button onclick="event.stopPropagation(); deletarColaborador(${c.id})">🗑</button>
          </td>
        </tr>
      `).join('')
    : `<tr><td colspan="5">Nenhum colaborador encontrado</td></tr>`;
}

// Listener: quando dropdown muda, render() é chamado
setupEventListeners() {
  document.addEventListener('change', (e) => {
    if (e.target.id === 'colab-filter-setor') {
      this.render();  // ← atualiza tabela
    }
  });
}
```

**O que aconteceu:**
- 1: Ler seleção do dropdown
- 2: Filtrar array com base na seleção
- 3: Re-renderizar tabela
- Listener: Qualquer mudança no dropdown, tabela atualiza automaticamente

## Exemplo 3: Salvar dados em localStorage

```javascript
// Cache — evitar requisições repetidas
const Cache = {
  set: (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  },

  get: (key) => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  },

  clear: () => localStorage.clear(),
};

// Uso
// 1. Salvar dados
Cache.set('usuario_logado', { id: 1, nome: 'João' });

// 2. Recuperar dados
const usuario = Cache.get('usuario_logado');
console.log(usuario.nome); // 'João'

// 3. Limpar cache (logout)
Cache.clear();
```

## Exemplo 4: Tratamento de erros com retry

```javascript
// Tentar requisição 3 vezes antes de desistir
const dados = await withRetry(
  () => Colaboradores.ler(),  // função a executar
  3  // número de tentativas
);

// Dentro de withRetry:
// Tentativa 1: falha → espera 1s
// Tentativa 2: falha → espera 2s
// Tentativa 3: falha → lança erro
// Se uma conseguir, retorna resultado imediatamente
```

---

# 🔄 FLUXO DE DADOS (DATA FLOW)

## Fluxo de Uma Ação do Usuário

```
┌────────────────────────────────────────────────────────────────────┐
│                    USUÁRIO INTERAGE                               │
│  Clica botão "Novo Colaborador"                                   │
└────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────┐
│                    HTML/DOM REAGE                                 │
│  onclick="abrirModalColaborador()" é executado                    │
│  Modal abre (CSS: .modal.active { display: block })               │
└────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────┐
│                   USUÁRIO PREENCHE FORM                           │
│  Digita nome, email, setor, cargo                                 │
│  Cada input dispara (opcional): renderagem dinamicamente          │
└────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────┐
│                 USUÁRIO CLICA "SALVAR"                            │
│  onclick="salvarColaborador(event)" dispara                       │
└────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────┐
│              salvarColaborador() EXECUTADA                         │
│  1. FormData lê input do HTML                                     │
│  2. Validação (nome != '', email != '', etc)                      │
└────────────────────────────────────────────────────────────────────┘
                            ↓
                      [Validação OK]
                            ↓
┌────────────────────────────────────────────────────────────────────┐
│            Colaboradores.criar(payload) CHAMADO                   │
│  POST ao Supabase: INSERT INTO colaboradores VALUES (...)         │
└────────────────────────────────────────────────────────────────────┘
                            ↓
                   [Resposta do Supabase]
                            ↓
┌────────────────────────────────────────────────────────────────────┐
│           GLOBAL window.COLABORADORES ATUALIZADO                  │
│  window.COLABORADORES.unshift(novo)                               │
│  Array agora tem +1 item                                          │
└────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────┐
│            renderColaboradores() CHAMADO                          │
│  Lê window.COLABORADORES                                          │
│  Gera HTML para cada item                                         │
│  Insere em tbody da tabela                                        │
└────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────┐
│                    TABELA ATUALIZA                                │
│  Nova linha aparece NO TOPO da tabela                             │
│  Se há filtros ativos, item aparece se passar no filtro           │
└────────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────────┐
│              FEEDBACK AO USUÁRIO                                  │
│  showToast('João Silva adicionado!', 'ok')                        │
│  Toast verde aparece no topo direito                              │
│  Modal fecha                                                      │
│  Form limpa                                                       │
└────────────────────────────────────────────────────────────────────┘
```

## Atualização em Tempo Real (Websocket)

Se outro usuário está usando o sistema ao mesmo tempo:

```
┌──────────────────────────────────────────────────────────────────────┐
│            OUTRO USUÁRIO CRIA COLABORADOR                           │
│  Seu app não sabe disso ainda                                       │
└──────────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────────┐
│         BANCO DE DADOS RECEBE INSERT                                │
│  Supabase websoket dispara evento: postgres_changes                 │
└──────────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────────┐
│     setupRealTimeListeners() LISTENER REAGE                         │
│  sb.from('colaboradores').on('postgres_changes', (payload) => {...})│
│  payload.new = novo objeto do banco                                 │
└──────────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────────┐
│         window.COLABORADORES ATUALIZADO                             │
│  Novo item adicionado ao array                                      │
└──────────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────────┐
│         TABELA RENDERIZA AUTOMATICAMENTE                            │
│  window.renderColaboradores() é chamado                             │
│  Novo colaborador aparece na sua tela (SEM VOCÊ FAZER NADA)         │
└──────────────────────────────────────────────────────────────────────┘
```

---

# 🚀 COMO ADICIONAR NOVA FUNCIONALIDADE

Vamos criar uma nova aba: "Feedback Individual" (avaliações de desempenho).

## Passo 1: Design (SQL)

**Criar tabela no Supabase:**

```sql
CREATE TABLE feedbacks_individuais (
  id BIGSERIAL PRIMARY KEY,
  empresa_id UUID NOT NULL,  -- RLS
  colaborador_id BIGINT NOT NULL,
  avaliador_id BIGINT NOT NULL,
  periodo VARCHAR,  -- '2024-Q1', '2024-Q2', etc
  desempenho INT,   -- 1-5
  comportamento INT, -- 1-5
  comunicacao INT,   -- 1-5
  lideranca INT,     -- 1-5 (null se não aplicável)
  observacoes TEXT,
  data_avaliacao DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id),
  FOREIGN KEY (avaliador_id) REFERENCES colaboradores(id)
);

-- RLS
ALTER TABLE feedbacks_individuais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários veem apenas da sua empresa" ON feedbacks_individuais
  FOR SELECT USING (empresa_id = (SELECT empresa_id FROM auth.users WHERE id = auth.uid()));
```

## Passo 2: API (CRUD)

**Arquivo: `src/api/gestao.js`**

```javascript
export const FeedbacksIndividuais = {
  ler: async () => {
    const { data, error } = await sb
      .from('feedbacks_individuais')
      .select('*, colaborador:colaborador_id(id,nome), avaliador:avaliador_id(id,nome)')
      .order('data_avaliacao', { ascending: false });
    if (error) throw error;
    return data.map(row => ({
      id: row.id,
      colaborador: row.colaborador.nome,
      avaliador: row.avaliador.nome,
      periodo: row.periodo,
      desempenho: row.desempenho,
      comportamento: row.comportamento,
      comunicacao: row.comunicacao,
      lideranca: row.lideranca,
      media: (row.desempenho + row.comportamento + row.comunicacao + (row.lideranca || 0)) / 3,
      data_avaliacao: row.data_avaliacao,
    }));
  },

  criar: async (payload) => {
    const { data, error } = await sb
      .from('feedbacks_individuais')
      .insert([payload])
      .select();
    if (error) throw error;
    return data[0];
  },

  // ... atualizar, excluir
};
```

## Passo 3: Data Store

**Adicionar em `src/data-store.js`:**

```javascript
var FEEDBACKS_INDIVIDUAIS = [];
window.FEEDBACKS_INDIVIDUAIS = FEEDBACKS_INDIVIDUAIS;
```

## Passo 4: HTML (UI)

**Adicionar em `index.html` (buscar seção de feedbacks):**

```html
<!-- Nav item -->
<div class="nav-item" data-page="feedback-individual">
  📊 Feedback Individual
</div>

<!-- Página -->
<div class="page" data-page="feedback-individual">
  <div class="page-header">
    <h2>Feedback Individual</h2>
    <button class="btn btn-primary" onclick="abrirModalFeedbackIndividual()">+ Nova Avaliação</button>
  </div>

  <div class="filters">
    <input type="text" id="fb-search" placeholder="Buscar colaborador...">
    <select id="fb-filter-periodo">
      <option value="">Todos os períodos</option>
      <option value="2024-Q1">2024 Q1</option>
      <option value="2024-Q2">2024 Q2</option>
    </select>
  </div>

  <table id="tb-feedbacks-individuais">
    <thead>
      <tr>
        <th>Colaborador</th>
        <th>Avaliador</th>
        <th>Período</th>
        <th>Média</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>
</div>

<!-- Modal -->
<div class="modal" id="modal-feedback-individual">
  <form id="form-feedback-individual" onsubmit="salvarFeedbackIndividual(event)">
    <input type="hidden" name="id">
    <select name="colaborador_id" required>
      <option value="">Selecione o colaborador...</option>
    </select>
    <select name="avaliador_id" required>
      <option value="">Selecione o avaliador...</option>
    </select>
    <input type="text" name="periodo" placeholder="2024-Q1">
    
    <label>Desempenho (1-5)
      <input type="number" name="desempenho" min="1" max="5" required>
    </label>
    <label>Comportamento (1-5)
      <input type="number" name="comportamento" min="1" max="5" required>
    </label>
    <label>Comunicação (1-5)
      <input type="number" name="comunicacao" min="1" max="5" required>
    </label>
    <label>Liderança (1-5)
      <input type="number" name="lideranca" min="1" max="5">
    </label>
    
    <textarea name="observacoes" placeholder="Observações..."></textarea>
    <input type="date" name="data_avaliacao" required>
    
    <button type="submit">Salvar</button>
    <button type="button" onclick="fecharModalFeedbackIndividual()">Cancelar</button>
  </form>
</div>
```

## Passo 5: Módulo (Lógica)

**Arquivo: `src/modules/feedback-individual.js`**

```javascript
export class FeedbackIndividualModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.fmtDate = deps.fmtDate;
    this.FEEDBACKS_INDIVIDUAIS = deps.FEEDBACKS_INDIVIDUAIS;
    this.COLABORADORES = deps.COLABORADORES;
    this.FeedbacksIndividuais = deps.FeedbacksIndividuais;
    this.Auth = deps.Auth;

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Busca
    document.addEventListener('input', (e) => {
      if (e.target.id === 'fb-search') this.render();
    });

    // Filtro período
    document.addEventListener('change', (e) => {
      if (e.target.id === 'fb-filter-periodo') this.render();
    });

    // Aba clicada
    document.querySelectorAll('.nav-item[data-page="feedback-individual"]').forEach(el => {
      el.addEventListener('click', () => {
        setTimeout(() => this.render(), 60);
      });
    });
  }

  render() {
    const tb = this.$('#tb-feedbacks-individuais');
    if (!tb) return;

    const q = (this.$('#fb-search')?.value || '').toLowerCase();
    const periodo = this.$('#fb-filter-periodo')?.value || '';

    const filtered = this.FEEDBACKS_INDIVIDUAIS.filter(fb => {
      if (periodo && fb.periodo !== periodo) return false;
      if (q && !fb.colaborador.toLowerCase().includes(q)) return false;
      return true;
    });

    tb.innerHTML = filtered.length
      ? filtered.map(fb => `
          <tr>
            <td>${this.h(fb.colaborador)}</td>
            <td>${this.h(fb.avaliador)}</td>
            <td>${fb.periodo}</td>
            <td>⭐ ${fb.media.toFixed(1)}</td>
            <td>
              <button onclick="event.stopPropagation(); editarFeedbackIndividual(${fb.id})">✎</button>
              <button onclick="event.stopPropagation(); deletarFeedbackIndividual(${fb.id})">🗑</button>
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="5">Nenhum feedback encontrado</td></tr>`;
  }

  abrirModal(id = null) {
    // ... similar ao padrão de outros módulos
  }

  async salvar(event) {
    // ... similar ao padrão de outros módulos
  }
}

export default FeedbackIndividualModule;
```

## Passo 6: Integração em app.js

**Adicionar em `src/app.js`:**

```javascript
import FeedbackIndividualModule from './modules/feedback-individual.js';
import { FeedbacksIndividuais } from './api/gestao.js';

// Na função bootstrap, após criar outros módulos:
const fbIndividualModule = new FeedbackIndividualModule({
  ...deps,
  FEEDBACKS_INDIVIDUAIS: window.FEEDBACKS_INDIVIDUAIS,
  FeedbacksIndividuais,
});

window.renderFeedbackIndividual = fbIndividualModule.render.bind(fbIndividualModule);
window.abrirModalFeedbackIndividual = fbIndividualModule.abrirModal.bind(fbIndividualModule);
// ... outros métodos
```

## Passo 7: Inicialização

**Adicionar em `src/api/init.js`:**

```javascript
export const inicializarSupabase = async () => {
  const [colab, venc, epi, ..., feedbackIndiv] = await Promise.allSettled([
    Colaboradores.ler(),
    Vencimentos.ler(),
    EpiEntregas.ler(),
    // ...
    FeedbacksIndividuais.ler(),  // ← ADICIONAR
  ]);

  window.FEEDBACKS_INDIVIDUAIS = feedbackIndiv.value || [];
  // ... outros assigns
};

export const setupRealTimeListeners = () => {
  // ...
  sb.from('feedbacks_individuais')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'feedbacks_individuais' }, (payload) => {
      window.FEEDBACKS_INDIVIDUAIS = atualizarArray(window.FEEDBACKS_INDIVIDUAIS, payload.new);
      window.renderFeedbackIndividual?.();
    })
    .subscribe();
};
```

## Pronto! 🎉

A nova aba está completa:
- ✅ Tabela criada
- ✅ API CRUD criada
- ✅ Dados carregam na inicialização
- ✅ Edição/exclusão funcionam
- ✅ Filtros funcionam
- ✅ Atualizações em tempo real

---

# 🐛 TROUBLESHOOTING COMUM

## Problema 1: Dados não aparecem na tabela

```
Symptoms:
  - Tabela fica vazia mesmo após API responder
  - Console mostra: "Cannot read property 'map' of undefined"

Causa:
  - window.DADOS não foi atualizado
  - render() não foi chamado
  - Array está null em vez de []

Solução:
  1. Verificar se api/init.js chama inicializarSupabase()
  2. Verificar se window.DADOS é atualizado:
     console.log(window.COLABORADORES) // deve ser array
  3. Chamar render manualmente:
     window.renderColaboradores()
```

## Problema 2: Modal não abre

```
Symptoms:
  - Clica botão "Novo" mas nada acontece
  - Ou abre modal de outro módulo

Causa:
  - Modal tem id errado em HTML
  - onclick="abrirModal()" referencia módulo errado
  - Modal tem display: none permanente em CSS

Solução:
  1. Verificar HTML:
     <div class="modal" id="modal-colaborador">
       ← ID precisa ser exato
  2. Verificar onclick:
     onclick="abrirModalColaborador()"
     ← Função exportada em window
  3. Verificar CSS:
     .modal { display: none; }
     .modal.active { display: block; }
```

## Problema 3: Filtro não funciona

```
Symptoms:
  - Muda dropdown mas tabela não atualiza
  - Filtro anterior fica aplicado

Causa:
  - addEventListener não está registrado
  - render() não é chamado no listener
  - Valor do filtro é undefined

Solução:
  1. Verificar setupEventListeners:
     document.addEventListener('change', (e) => {
       if (e.target.id === 'colab-filter-setor') {
         this.render();  // ← precisa estar aqui
       }
     });
  2. Debug:
     console.log(this.$('#colab-filter-setor').value)
     ← deve mostrar o valor selecionado
```

## Problema 4: CRUD falha silenciosamente

```
Symptoms:
  - Clica "Salvar" mas nada acontece
  - Modal não fecha
  - Sem mensagem de erro

Causa:
  - try/catch não tem console.error
  - Erro no Supabase não é logado
  - Promise não resolve/rejeita

Solução:
  1. Adicionar logs:
     try {
       const result = await Colaboradores.criar(payload);
       console.log('Sucesso:', result);
     } catch (err) {
       console.error('Erro ao salvar:', err);
       showToast(`Erro: ${err.message}`, 'err');
     }
  2. Abrir DevTools (F12) e verificar Console
  3. Verificar Network tab para erro HTTP
```

## Problema 5: Dados não sincronizam em tempo real

```
Symptoms:
  - Outro usuário cria item, sua tabela não atualiza
  - Precisa dar F5 para ver mudanças

Causa:
  - setupRealTimeListeners() não foi chamado
  - Websocket não conectou
  - Listener referencia tabela errada

Solução:
  1. Verificar se setupRealTimeListeners() é chamado em api/init.js
  2. Abrir DevTools → Network → WS (WebSocket tab)
  3. Deve haver conexão para "realtime"
  4. Se não:
     - Verificar SUPABASE_URL e ANON_KEY corretos
     - Verificar se RLS não está bloqueando SELECT
```

---

# 📖 RESUMO EXECUTIVO

## O que você criou:

✅ **Uma SPA completa sem framework**
- 15 páginas/abas
- 18 tabelas de dados
- 18 formulários CRUD
- 134 botões de ação
- 50+ campos de entrada/filtro

✅ **Arquitetura modular e escalável**
- Dependency Injection
- Observer Pattern (listeners)
- Module Pattern (isolamento)
- Factory Pattern (criação de módulos)

✅ **Segurança**
- RLS (Row Level Security) no Supabase
- XSS prevention (função h())
- Sem credenciais expostas

✅ **Performance**
- Sincronização em tempo real via websocket
- Cache em localStorage
- Retry automático em falhas de rede

## Como aprender mais:

1. **Leia o GUIA_CODIGO.md** — Documentação detalhada
2. **Abra DevTools (F12)** — Veja console, network, storage
3. **Modifique um módulo** — Altere renderização, adicione campo
4. **Crie uma nova aba** — Siga passo a passo acima
5. **Teste CRUD** — Crie, edite, delete colaboradores

---

**🎓 Parabéns por criar este sistema! Você aprendeu padrões profissionais de JavaScript. 🚀**
