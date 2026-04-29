# RH — Sistema de Gestão de Recursos Humanos

Aplicação web single-page (SPA) desenvolvida inteiramente em HTML, CSS e JavaScript puro — sem frameworks, sem dependências de back-end. Basta abrir o arquivo `index.html` no navegador para utilizá-la.

## Visão geral

Interface completa de RH com sidebar de navegação, topbar com identificação do usuário e múltiplas seções funcionais organizadas por tema.

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
| **Salários** | Módulo restrito (acesso por perfil) |

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
- **Google Fonts** — tipografia Syne + JetBrains Mono

## Como usar

```bash
# Basta abrir o arquivo no navegador
start index.html   # Windows
open index.html    # macOS
```

Não é necessário servidor web, instalação de pacotes ou configuração de ambiente.

## Estrutura do projeto

```
RH/
└── index.html   # Toda a aplicação (HTML + CSS + JS em arquivo único)
```

## Observações

- Os dados exibidos são **estáticos/demonstrativos** — não há persistência ou integração com banco de dados.
- O módulo **Salários** é restrito e exibe indicação de bloqueio por perfil de acesso.
- O sistema está configurado para o idioma **português brasileiro**.

