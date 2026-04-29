# RH — Sistema de Gestão de Recursos Humanos

Aplicação web single-page (SPA) com banco de dados real via **Supabase (PostgreSQL)**, autenticação de usuários e políticas de segurança por perfil de acesso.

## Visão geral

Interface completa de RH com sidebar de navegação, topbar com identificação do usuário e múltiplas seções funcionais organizadas por tema. Os dados são persistidos em banco de dados relacional com Row Level Security (RLS).

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

## Arquivos do projeto

```
RH/
├── index.html              # Aplicação SPA completa (HTML + CSS + JS)
├── supabase.js             # Cliente Supabase, Auth e funções CRUD
├── database-schema.sql     # Schema completo do banco de dados
├── SCHEMA.md               # Documentação detalhada das tabelas
├── rls-policies.sql        # Políticas RLS por perfil
├── rls-final-fix.sql       # Funções helper no schema privado
└── rls-auth-fix.sql        # Correção de autenticação e permissões
```

## Como usar

### Pré-requisitos
- Projeto Supabase criado e configurado
- Banco de dados inicializado com `database-schema.sql`
- Políticas RLS aplicadas com `rls-policies.sql` e `rls-final-fix.sql`
- Usuário criado via **Supabase Dashboard → Authentication → Users**

### Executar localmente
```bash
# Basta abrir o arquivo no navegador
start index.html   # Windows
open index.html    # macOS
```

Não é necessário servidor web, instalação de pacotes ou configuração de ambiente.

### Configuração do Supabase
As credenciais de conexão estão em `supabase.js`:
```js
const SUPABASE_URL  = 'https://<seu-projeto>.supabase.co';
const SUPABASE_ANON = '<sua-anon-key>';
```

> **Nunca inclua a secret key no frontend.** Use apenas a anon/public key.

## Observações

- O módulo **Salários** é restrito e exibe indicação de bloqueio por perfil de acesso.
- O sistema está configurado para o idioma **português brasileiro**.
- Sem sessão ativa, o sistema exibe a tela de login e não carrega dados.
- Com sessão ativa, os dados do Supabase substituem os dados demonstrativos automaticamente.
