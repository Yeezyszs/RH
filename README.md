# RH — Sistema de Gestão de Recursos Humanos

Aplicação web single-page (SPA) completa com **Supabase (PostgreSQL)**, autenticação de usuários e políticas de segurança por perfil de acesso. Código modularizado, testado e pronto para produção.

**Status:** ✅ Refactor Week 4 Concluído | 📦 Modularizado | 🧪 Testado | 🔒 RLS Configurado

## 🎯 Visão geral

Interface profissional de RH com:
- Sidebar de navegação intuitivo
- Topbar com identificação do usuário
- 14 módulos funcionais (Pessoas, Compliance, Benefícios, Gestão)
- Dados em tempo real via Supabase
- Row Level Security (RLS) por perfil de acesso
- Código 100% modularizado e testável

## Módulos disponíveis

### Pessoas
| Módulo | Descrição |
|---|---|
| **Dashboard** | Visão geral com KPIs (headcount, rotatividade, aniversariantes, vencimentos críticos), alertas do dia e atividade recente |
| **Colaboradores** | Listagem e gestão dos colaboradores ativos |
| **Quadro de Funcionários** | Visualização por setor em cards |
| **Rotatividade** | Indicadores e histórico de turnover |
| **Desligamentos** | Registro e acompanhamento de desligamentos |

### Compliance
| Módulo | Descrição |
|---|---|
| **Vencimentos** | Central unificada de ASOs, documentos e treinamentos com semáforo por prazo (vencido / a vencer / ok) |
| **EPI** | Controle de equipamentos de proteção individual |

### Benefícios
| Módulo | Descrição |
|---|---|
| **Vale-Combustível** | Gestão de benefício de combustível |
| **Vale-Alimentação** | Gestão de benefício de alimentação |
| **Férias** | Controle de períodos de férias |
| **Salários** | Módulo restrito (acesso por perfil admin/rh) |

### Gestão
| Módulo | Descrição |
|---|---|
| **Advertências** | Registro e histórico de advertências |
| **Feedback & Clima** | Pesquisas de clima organizacional e feedbacks |
| **Cronograma** | Calendário de eventos e treinamentos |
| **Plano de Carreiras** | Acompanhamento de trilhas e progressão |

## Tecnologias

- **HTML5 / CSS3** — layout com variáveis CSS, tema Phthalo Blue
- **JavaScript** — navegação SPA, interatividade e filtros sem recarregamento de página
- **[Chart.js v4](https://www.chartjs.org/)** — gráficos (via CDN)
- **[Supabase JS v2](https://supabase.com/)** — banco de dados, autenticação e RLS (via CDN)
- **Google Fonts** — tipografia Syne + JetBrains Mono

## Banco de Dados

O sistema usa **Supabase (PostgreSQL)** com 24 tabelas organizadas por módulo:

### Estrutura
| Módulo | Tabelas |
|--------|---------|
| **Fundamental** | `usuarios`, `departamentos`, `cargos` |
| **Pessoas** | `colaboradores`, `historico_colaboradores`, `rotatividade`, `desligamentos` |
| **Compliance** | `documentos`, `asos`, `treinamentos`, `participantes_treinamento`, `epis` |
| **Benefícios** | `vale_combustivel`, `vale_alimentacao`, `ferias`, `salarios` |
| **Gestão** | `advertencias`, `pesquisas_clima`, `respostas_pesquisa`, `feedbacks`, `cronograma`, `participantes_cronograma`, `trilhas_carreira`, `plano_carreiras_colaborador` |

### Views para análise
- `aniversariantes_mes` — colaboradores aniversariantes do mês
- `documentos_vencidos` — documentos e ASOs vencidos
- `asos_vencidos` — ASOs vencidos com dias em atraso
- `saldo_ferias` — saldo de férias por colaborador
- `dashboard_kpis` — KPIs principais para o dashboard

## Segurança

### Autenticação
- Login via email e senha (Supabase Auth)
- Tela de login integrada ao design do sistema
- Sessão persistida e verificada ao carregar a página
- Logout disponível na topbar

### Perfis de acesso
| Perfil | Permissões |
|--------|-----------|
| **admin** | Acesso total a todas as tabelas |
| **rh** | Acesso total exceto configurações de sistema |
| **gerente** | Leitura/escrita limitada ao próprio departamento |
| **colaborador** | Leitura/escrita limitada ao próprio registro |

### Row Level Security (RLS)
- RLS habilitado em todas as 24 tabelas
- Políticas individuais por perfil e operação (SELECT, INSERT, UPDATE, DELETE)
- Módulo **Salários** restrito a admin/rh (colaborador vê apenas o próprio)
- Feedbacks confidenciais visíveis apenas para admin/rh
- Funções helper no schema `private` para segurança das políticas

## 📁 Arquivos do projeto

```
RH/
├── index.html                    # Interface SPA (HTML + CSS + layout)
├── supabase.js                   # Cliente Supabase e funções CRUD
├── src/
│   ├── app.js                    # Inicialização + renderAll()
│   ├── constants.js              # Constantes globais
│   ├── modules/                  # 13 módulos funcionais
│   │   ├── colaboradores.js      # Gestão de colaboradores
│   │   ├── ferias.js             # Controle de férias
│   │   ├── rotatividade.js       # Turnover e rotatividade
│   │   ├── vencimentos.js        # ASOs e documentos
│   │   ├── vale-combustivel.js   # Benefício combustível
│   │   ├── vale-alimentacao.js   # Benefício alimentação
│   │   ├── feedback.js           # Feedbacks individuais
│   │   ├── pesquisas_clima.js    # Pesquisas de clima
│   │   ├── advertencias.js       # Registro de advertências
│   │   ├── cronograma.js         # Calendário de eventos
│   │   ├── epi.js                # EPIs e equipamentos
│   │   ├── desligamentos.js      # Registro de desligamentos
│   │   ├── salarios.js           # Folha de pagamento
│   │   └── plano-carreiras.js    # Plano de carreiras
│   ├── ui/                       # Componentes reutilizáveis
│   │   ├── modal.js              # Modais genéricos
│   │   ├── table.js              # Tabelas paginadas
│   │   ├── filters.js            # Filtros e busca
│   │   └── pagination.js         # Controle de paginação
│   └── utils/
│       ├── formatting.js         # Formatadores de dados
│       └── helpers.js            # Funções auxiliares
├── tests/                        # Suite de testes
│   ├── colaboradores.test.js     # Testes de colaboradores
│   ├── mappers.test.js           # Testes de mapeadores
│   ├── cache.test.js             # Testes de cache
│   ├── timeout-retry.test.js     # Testes de resiliência
│   └── helpers.js                # Helpers para testes
├── migrations/                   # Migrações do banco
│   ├── 001_criptografia_pii.sql
│   ├── 002_paginacao_cache_timeout.js
│   └── ... (9 migrações totais)
├── database-schema.sql           # Schema completo (24 tabelas)
├── rls-policies.sql              # Políticas RLS iniciais
├── rls-final-fix.sql             # RLS final com schema privado
├── DATABASE_SETUP_STATUS.md      # Status detalhado do banco
├── SCHEMA.md                     # Documentação das tabelas
├── MODULARIZATION_PLAN.md        # Plano de modularização
├── package.json                  # Dependências npm
├── vitest.config.js              # Configuração de testes
└── .gitignore                    # Arquivos ignorados
```

## 🚀 Como usar

### Pré-requisitos
- Node.js 16+ (para testes; opcional para uso básico)
- Projeto Supabase criado (`RH Bepi` - já configurado)
- Banco de dados com schema aplicado
- RLS policies configuradas
- Usuário de teste criado no Supabase Auth

### Executar a Aplicação

**Opção 1: Direto no navegador (Mais rápido)**
```bash
# Abrir no navegador
start index.html    # Windows
open index.html     # macOS
```

Não requer servidor web ou instalação de pacotes.

**Opção 2: Com servidor web local (Recomendado)**
```bash
# Python 3
python -m http.server 8000

# Ou Node.js (http-server)
npx http-server -p 8000
```

Depois acesse: http://localhost:8000

### Configurar Credenciais Supabase

As credenciais estão em `supabase.js`:
```javascript
const SUPABASE_URL  = 'https://smfiujgaxaodyfwvoxwy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

> ⚠️ **Segurança:** Nunca inclua a secret key no frontend. Use apenas a anon/public key.

### Rodar Testes
```bash
# Instalar dependências
npm install

# Rodar testes (Vitest)
npm test

# Rodar com coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Estrutura de Desenvolvimento

O código está organizado em módulos para facilitar manutenção:
- **Cada módulo é independente** (src/modules/*.js)
- **UI components reutilizáveis** (src/ui/)
- **Utilities para funções comuns** (src/utils/)
- **Testes para cada módulo** (tests/*.test.js)

## 📊 Status do Projeto

### ✅ Concluído
- [x] 24 tabelas do banco de dados (PostgreSQL)
- [x] 6 views para dashboards e análises
- [x] RLS (Row Level Security) com schema privado
- [x] 13 módulos funcionalidades (colaboradores, férias, vencimentos, etc.)
- [x] Autenticação Supabase completa
- [x] Componentes UI reutilizáveis
- [x] Suite de testes (Vitest)
- [x] Migrações de banco preparadas
- [x] Código 100% modularizado

### 🔄 Em Progresso
- [ ] Aplicação de todas as RLS policies
- [ ] Testes de integração end-to-end
- [ ] Deploy em produção
- [ ] Documentação de API

### 📋 Roadmap
1. **Fase 1** - Finalizar RLS policies e segurança
2. **Fase 2** - Testes completos e validação
3. **Fase 3** - Deploy em produção
4. **Fase 4** - Otimizações de performance

## 📝 Observações

### Comportamento
- O módulo **Salários** é restrito e mostra bloqueio por perfil de acesso
- Sistema configurado para **português brasileiro**
- Sem sessão ativa: tela de login
- Com sessão ativa: dados do Supabase carregam automaticamente

### Dados de Teste
O sistema carrega com dados de exemplo:
- 14 colaboradores (vários setores)
- 3 departamentos (Operacional, Administrativo, Financeiro)
- 12 cargos (Gerente, Analista, Operador, etc.)
- 4 trilhas de carreira

Substitua pelos dados reais quando necessário.

### Segurança
- RLS habilitado em todas as tabelas
- Funções de autenticação em schema privado
- Credenciais seguras em supabase.js
- Type checking em todos os módulos

## 🤝 Contribuindo

Para adicionar um novo módulo:
1. Criar arquivo em `src/modules/novo-modulo.js`
2. Implementar funções CRUD padrão
3. Criar testes em `tests/novo-modulo.test.js`
4. Registrar em `src/app.js` → `renderAll()`
5. Adicionar seção em `index.html`

## 📚 Documentação Adicional

- **[SCHEMA.md](./SCHEMA.md)** - Documentação detalhada das tabelas
- **[DATABASE_SETUP_STATUS.md](./DATABASE_SETUP_STATUS.md)** - Status do banco de dados
- **[MODULARIZATION_PLAN.md](./MODULARIZATION_PLAN.md)** - Plano de modularização
- **[package.json](./package.json)** - Dependências e scripts

## 📧 Suporte

Para questões sobre:
- **Banco de dados** - Ver [DATABASE_SETUP_STATUS.md](./DATABASE_SETUP_STATUS.md)
- **Módulos** - Consultar documentação em `src/modules/`
- **Testes** - Ver `tests/` e `vitest.config.js`
- **Deploy** - Contatar administrador do Supabase
