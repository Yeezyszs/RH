# RH — Sistema de Gestão de Recursos Humanos

Aplicação web single-page (SPA) completa com **Supabase (PostgreSQL)**, autenticação de usuários e políticas de segurança por perfil de acesso. Código modularizado, testado, com CI/CD automático e pronto para **produção**.

**Status:** ✅ **PRODUÇÃO v1.0** | 📦 Modularizado | 🧪 177 Testes | 🔒 RLS Completo | ⚙️ CI/CD GitHub Actions | 🌐 GitHub Pages

## 🎯 Visão geral

Interface profissional de RH com:
- **Sidebar de navegação intuitivo** com 13 módulos funcionais
- **Topbar com identificação do usuário** e controle de sessão
- **13 módulos funcionais** (Pessoas, Compliance, Benefícios, Gestão)
- **Dashboard com KPIs reais:** headcount, rotatividade calculada, atividade recente, vencimentos críticos
- **Dados em tempo real via Supabase** com sincronização via websockets
- **Row Level Security (RLS)** por perfil de acesso em todas as 24 tabelas
- **Código 100% modularizado** com CSS separado
- **177 testes automatizados** com cobertura ≥80%
- **CI/CD automático:** GitHub Actions com testes, lint, segurança e deploy
- **Deploy automático** em GitHub Pages após validação
- **Sem dados de amostra:** pronto para dados reais de produção

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
├── index.html                    # Interface SPA (HTML + layout)
├── supabase.js                   # Cliente Supabase e funções CRUD
├── privacidade.html              # Página de Política de Privacidade
├── css/
│   └── style.css                 # Estilos (2.3k linhas)
├── src/
│   ├── app.js                    # Bootstrap + injeção de dependências
│   ├── constants.js              # Constantes globais
│   ├── modules/                  # 13 módulos funcionais
│   │   ├── colaboradores.js
│   │   ├── advertencias.js
│   │   ├── ferias.js
│   │   ├── desligamentos.js
│   │   ├── vencimentos.js
│   │   ├── epi.js
│   │   ├── rotatividade.js
│   │   ├── salarios.js
│   │   ├── vale-combustivel.js
│   │   ├── vale-alimentacao.js
│   │   ├── feedback.js
│   │   ├── cronograma.js
│   │   └── plano-carreiras.js
│   ├── ui/                       # Componentes reutilizáveis
│   │   ├── modal.js
│   │   ├── table.js
│   │   ├── filters.js
│   │   └── pagination.js
│   └── utils/
│       └── formatting.js         # 52+ funções utilitárias
├── tests/                        # 177 testes automatizados
│   ├── formatting.test.js        # 52 testes
│   ├── rls-logic.test.js         # 33 testes
│   ├── mappers-extra.test.js     # 30 testes
│   ├── mappers.test.js           # 27 testes
│   ├── colaboradores.test.js     # 15 testes
│   ├── timeout-retry.test.js     # 11 testes
│   ├── cache.test.js             # 9 testes
│   └── helpers.js
├── database/
│   ├── schema.sql                # Schema completo (24 tabelas)
│   ├── schema.md                 # Documentação das tabelas
│   └── migrations/               # 12 migrações SQL históricas
├── docs/
│   ├── POLITICA_PRIVACIDADE.md   # Política de Privacidade LGPD
│   └── CHECKLIST_PROTECAO_DADOS.md
├── .github/workflows/
│   ├── ci.yml                    # CI: testes, lint, segurança
│   └── deploy.yml                # CD: deploy automático GitHub Pages
├── package.json
├── vitest.config.js
├── .env.example
└── README.md
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

# Watch mode (desenvolvimento)
npm run test:watch
```

### Deploy em Produção

O sistema é deployed automaticamente via **GitHub Actions** sempre que código é enviado para `main`:

1. **CI Pipeline** (testes + validação)
   - npm ci (instalação reproducível)
   - npm test (177 testes automatizados)
   - npm run test:coverage (cobertura ≥80%)
   - npm audit (verificação de vulnerabilidades)
   - Validação de secrets hardcoded
   - Verificação de .env não commitado

2. **Deploy Pipeline** (apenas se CI passar)
   - Preparação de artefatos
   - Cópia de arquivos para _site/
   - Criação de 404.html para SPA routing
   - Upload para GitHub Pages
   - Deploy automático para github.io

**URL de Produção:** https://yeezyszs.github.io/rh

### Estrutura de Desenvolvimento

O código está organizado em módulos para facilitar manutenção:
- **Cada módulo é independente** (src/modules/*.js)
- **UI components reutilizáveis** (src/ui/)
- **Utilities para funções comuns** (src/utils/)
- **Testes para cada módulo** (tests/*.test.js)

## 📊 Status do Projeto

### ✅ Concluído (Produção v1.0)

**Arquitetura & Banco**
- [x] 24 tabelas PostgreSQL (Supabase)
- [x] RLS (Row Level Security) em todas as 24 tabelas com 13 policies
- [x] Schema privado para funções de segurança
- [x] Criptografia em trânsito (TLS) e repouso (AES-256)
- [x] Backup automático com retenção 7 dias
- [x] Real-time sync via websockets em 15 tabelas

**Frontend & Módulos**
- [x] 13 módulos funcionais completos
- [x] Dashboard com KPIs reais e tempo-real
- [x] Rotatividade com dados calculados dinamicamente
- [x] Vencimentos com badge atualizado em tempo-real
- [x] Autenticação Supabase completa + MFA para admin/rh
- [x] CSS modularizado (2.3k linhas em arquivo externo)
- [x] Código 100% modularizado e reutilizável

**Qualidade & Automação**
- [x] 177 testes automatizados com Vitest (cobertura ≥80%)
- [x] CI/CD com GitHub Actions (3 jobs: CI, deploy)
- [x] Validação de segurança: npm audit, secrets scanning, .env verification
- [x] Deploy automático em GitHub Pages após testes
- [x] Package-lock.json para reproducibilidade
- [x] Pre-commit hooks para validação

**Segurança & Conformidade**
- [x] Row Level Security por role (admin, rh, gerente, colaborador)
- [x] Chave de serviço bloqueada em CI/CD
- [x] Documento jurídico-técnico completo (LGPD, CLT, NRs)
- [x] Sem dados de amostra em produção
- [x] HTTPS obrigatório em GitHub Pages

### 🔄 Roadmap Futuro (Não-Crítico)
- [ ] Servidor proxy backend para operações sensíveis
- [ ] Key rotation automática (90 dias)
- [ ] Incident response plan documentado
- [ ] Teste de penetração profissional
- [ ] Auditoria LGPD por consultoria especializada
- [ ] ISO 27001 (se organizacionalmente necessário)
- [ ] Dashboard de auditoria com query logs
- [ ] CMS para Política de Privacidade

## 📝 Observações

### Comportamento
- O módulo **Salários** é restrito e mostra bloqueio por perfil de acesso
- Sistema configurado para **português brasileiro**
- Sem sessão ativa: tela de login
- Com sessão ativa: dados do Supabase carregam automaticamente

### Dados
O sistema está **limpo e pronto para dados reais** em produção:
- ✓ Todos os dados de amostra foram removidos
- ✓ Banco de dados vazio (exceto configurações base)
- ✓ Dashboard calcula KPIs dinamicamente a partir dos dados reais
- ✓ Rotatividade calculada automaticamente
- ✓ Atividade recente carregada em tempo real
- ✓ Sistema pronto para importação de dados corporativos

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

- **[DOCUMENTO_JURIDICO_SISTEMA_RH](https://docs.google.com/document/d/11XjAH1tz-Wcl9lvtHmzRZkVb8QQ56wDD5hAjr58HQjw)** (Google Drive) — Análise jurídica-técnica completa: LGPD, CLT, NRs, RLS, segurança, conformidade (Status: **PRODUÇÃO v1.0 — Maio 2026**)
- **[docs/POLITICA_PRIVACIDADE.md](./docs/POLITICA_PRIVACIDADE.md)** — Política de Privacidade LGPD completa (21 seções)
- **[docs/CHECKLIST_PROTECAO_DADOS.md](./docs/CHECKLIST_PROTECAO_DADOS.md)** — Checklist de implementação LGPD (7 fases)
- **[database/schema.md](./database/schema.md)** — Documentação das 24 tabelas
- **[database/schema.sql](./database/schema.sql)** — Schema completo do banco
- **[database/migrations/](./database/migrations/)** — 12 migrações SQL
- **[.github/workflows/ci.yml](./.github/workflows/ci.yml)** — Pipeline de CI (testes, cobertura, audit, segurança)
- **[.github/workflows/deploy.yml](./.github/workflows/deploy.yml)** — Pipeline de CD (deploy automático GitHub Pages)

## 📧 Suporte

Para questões sobre:
- **Banco de dados** - Ver [DATABASE_SETUP_STATUS.md](./DATABASE_SETUP_STATUS.md)
- **Módulos** - Consultar documentação em `src/modules/`
- **Testes** - Ver `tests/` e `vitest.config.js`
- **Deploy** - Contatar administrador do Supabase
