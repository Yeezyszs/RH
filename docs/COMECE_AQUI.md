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
→ Leia: [`supabase.js`](../supabase.js) (comentários com `//`)

**Você aprenderá:**
- O que é Supabase
- Como se conecta ao PostgreSQL
- Como criar, ler, atualizar, deletar dados

**Tempo:** 20 minutos

---

### 🎯 Objetivo 3: "Qual arquivo faz o quê?" (estrutura do código)
→ Leia: [`ESTRUTURA.md`](ESTRUTURA.md) (abaixo)

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
| `index.html` | HTML único da SPA | Contém toda a interface (15 páginas, 18 modais, 18 tabelas, 134 botões) |
| `supabase.js` | Cliente Supabase | Se conecta ao banco de dados PostgreSQL |
| `package.json` | Dependências | Define vitest para testes automatizados |
| `vitest.config.js` | Config de testes | Define cobertura mínima de 80% |

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

#### `/src/supabase.js`
**O que:** Cliente que se conecta ao banco remoto
**Por que:** Ponte entre JavaScript e PostgreSQL
**O que faz:**
- `Auth` — login/logout
- `Cache` — localStorage
- `withRetry()` — tenta novamente se falhar
- `withTimeout()` — não fica pendurado
- Mappers — transforma dados do banco

**Quando editar:** Se precisar mudar Supabase de projeto (URL, chave)

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

**`base.js`** (plain script, carregado cedo)
```javascript
h()          // Escape HTML (prevenção XSS)
diasAte()    // Dias até uma data
fmtBRL()     // Formatar moeda
```

**`formatting.js`** (módulo ES6)
```javascript
h(), iniciais(), fmtDate(), fmtBRL(), tempoCasa(), diasAte(), 
vencStatus(), vencBadge(), mesChave(), mesLabel(), addDays()
```

**Quando editar:** Se criar novas funções reutilizáveis

---

#### `/src/api/` — CRUD por Domínio

Cada arquivo define operações de banco para um domínio:

**`pessoas.js`**
- `Colaboradores` — listar, buscar, criar, atualizar, excluir
- `Departamentos` — dados de setores
- `Cargos` — nomes de cargos
- `HistoricoColaboradores` — histórico de mudanças

**`compliance.js`**
- `Vencimentos` — ASO, documentos, treinamentos
- `Epis` — equipamentos de proteção
- `Treinamentos` — cursos/capacitações

**`beneficios.js`**
- `Ferias` — períodos de férias
- `Salarios` — salários por período
- `ValeCombustivel` — combustível
- `ValeAlimentacao` — vale refeição

**`gestao.js`**
- `Advertencias` — advertências formais
- `FeedbackClima` — pesquisas de clima
- `Cronograma` — eventos e reuniões
- `PlanoCarreiras` — cargos e progressão

**`init.js`** (Especial!)
- `inicializarSupabase()` — carrega TODOS os dados ao iniciar
- `setupRealTimeListeners()` — ativa websocket para atualizações em tempo real

---

#### `/src/modules/` — Lógica de Cada Página

13 módulos, um para cada aba do sistema:

```
colaboradores.js       → Aba de Colaboradores
advertencias.js        → Aba de Advertências
ferias.js             → Aba de Férias
desligamentos.js      → Aba de Desligamentos
cronograma.js         → Aba de Cronograma
vencimentos.js        → Aba de Vencimentos
epi.js                → Aba de EPI
rotatividade.js       → Aba de Rotatividade
salarios.js           → Aba de Salários
vale-combustivel.js   → Aba de Vale Combustível
vale-alimentacao.js   → Aba de Vale Alimentação
feedback.js           → Aba de Feedback & Clima
plano-carreiras.js    → Aba de Plano de Carreiras
```

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
| `schema.sql` | 24 tabelas PostgreSQL |
| `schema.md` | Documentação das tabelas |
| `migrations/` | Scripts SQL de criação do banco |

**Quando editar:** Nunca (banco é gerenciado pelo Supabase)

---

### 📁 `/docs` — Documentação

| Arquivo | Leia quando... |
|---------|--------|
| **`COMECE_AQUI.md`** | Quer saber por onde começar (este arquivo!) |
| **`FLUXOS.md`** | Quer entender como uma ação funciona |
| **`AULA_COMPLETA.md`** | Quer aprender a fundo (padrões, exemplos) |
| **`aula-visual.html`** | Quer estudar com design visual (abrir no navegador) |
| **`GUIA_CODIGO.md`** | Quer documentação técnica detalhada |
| **`ESTRUTURA.md`** | Quer saber cada pasta e arquivo (em breve) |
| **`AUDIT_SEGURANCA.md`** | Quer entender a segurança |
| **`POLITICA_PRIVACIDADE.md`** | Quer ver conformidade LGPD |

---

### 📁 `/tests` — Testes Automatizados

```
tests/
├── base.test.js              → Testes da função h()
├── formatting.test.js        → Testes de formatação
├── colaboradores.test.js     → Testes do CRUD de colaboradores
├── mappers.test.js           → Testes de transformação de dados
├── mappers-extra.test.js     → Mais testes de mappers
├── rls-logic.test.js         → Testes de Row Level Security
├── timeout-retry.test.js     → Testes de retry/timeout
├── cache.test.js             → Testes de cache
└── helpers.js                → Funções auxiliares para testes
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
| **Banco de dados** | `database/schema.sql` | `src/api/*.js` |
| **Padrões do código** | `docs/AULA_COMPLETA.md` | Todos os módulos |
| **Testes** | `tests/base.test.js` | `npm run test:coverage` |
| **CSS/Design** | `css/tokens.css` | `css/components.css` |
| **Integração Supabase** | `supabase.js` | `src/api/pessoas.js` → comentários JSDoc |
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
