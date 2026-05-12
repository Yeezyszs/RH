# Plano de Modularização — RH System

## ✅ Completado (Commit atual)

### 1. CSS Extraction
- **Arquivo**: `src/styles/main.css`
- **Redução**: 2.278 linhas de CSS removidas do `index.html`
- **Novo tamanho do index.html**: 8.350 linhas (antes: 10.628)
- **Status**: ✅ Completo

### 2. Estrutura de Pastas
```
src/
├── modules/
│   ├── colaboradores.js    ✅ Criado (exemplo de estrutura)
│   ├── advertencias.js     ✅ Criado
│   ├── ferias.js           ⏳ Pendente
│   ├── desligamentos.js    ⏳ Pendente
│   ├── eventos.js          ⏳ Pendente
│   ├── docs.js             ⏳ Pendente
│   └── relatorios.js       ⏳ Pendente
│
├── ui/
│   ├── table.js            ⏳ Pendente
│   ├── modal.js            ⏳ Pendente
│   ├── pagination.js       ⏳ Pendente
│   └── filters.js          ⏳ Pendente
│
└── styles/
    └── main.css            ✅ Completo
```

## 📋 Próximos Passos

### Fase 1: Modularizar Seções (Priority)
1. **Advertências** — lógica similar a colaboradores
2. **Férias** — com timeline/cronograma
3. **Desligamentos** — entrevista de saída + cálculos
4. **Eventos** — calendário + filtros por tipo
5. **Docs** — gerenciador de documentos
6. **Relatórios** — gráficos e exportação

### Fase 2: Componentes Reutilizáveis
- `table.js` — renderização genérica de tabelas
- `modal.js` — modais reutilizáveis com abas
- `pagination.js` — componente paginação (extrair de colaboradores)
- `filters.js` — sistema de filtros unificado

### Fase 3: App Orquestrador
- `src/app.js` — carrega módulos sob demanda
- Remove funções globais inline do index.html
- Event hub centralizado

### Fase 4: Refactor Final
- Atualizar index.html para usar módulos
- Remover funções globais
- Garantir que todos os testes passam
- Commit: "Refactor completo para arquitetura modular"

## 📊 Estimativa

- **CSS extraction**: 1 commit ✅
- **Cada módulo de seção**: ~1-2 commits
- **Componentes UI**: ~1 commit cada
- **App orquestrador**: ~1 commit
- **Refactor final**: ~2-3 commits

**Total estimado**: 15-20 commits incrementais

## 🎯 Objetivo Final

- Reduzir `index.html` de 8.350 para ~2.000-2.500 linhas
- Cada seção em seu próprio módulo
- Componentes reutilizáveis testáveis
- Estrutura escalável para novos recursos

## 💾 Commits Já Feitos

1. `718c5ba` — Extrair CSS do index.html para src/styles/main.css
2. `2ba916c` — Criar módulo ColaboradoresModule
3. `77c6009` — Criar MODULARIZATION_PLAN.md com roadmap detalhado
4. `2aa898c` — Criar módulo AdvertenciasModule com charts e drawer
