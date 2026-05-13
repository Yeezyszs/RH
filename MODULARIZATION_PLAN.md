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
│   ├── colaboradores.js    ✅ Criado
│   ├── advertencias.js     ✅ Criado
│   ├── ferias.js           ✅ Criado
│   ├── desligamentos.js    ✅ Criado
│   ├── cronograma.js       ✅ Criado (calendário + feriados BR)
│   ├── vencimentos.js      ✅ Criado (ASO / docs / treinamentos)
│   ├── epi.js              ⏳ Pendente
│   ├── valesCombustivel.js ⏳ Pendente
│   └── relatorios.js       ⏳ Pendente (rotatividade)
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

### Fase 1: Modularizar Seções
1. **Colaboradores** ✅
2. **Advertências** ✅
3. **Férias** ✅
4. **Desligamentos** ✅
5. **Cronograma** ✅ (calendário + feriados BR)
6. **Vencimentos** ✅ (ASO / docs / treinamentos)
7. **EPI** ⏳ — catálogo + entregas
8. **Rotatividade** ⏳ — gráficos de turnover
9. **Salários** ⏳ — tabela restrita + charts

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
2. `2ba916c` — Criar ColaboradoresModule
3. `77c6009` — Criar MODULARIZATION_PLAN.md com roadmap
4. `2aa898c` — Criar AdvertenciasModule (charts + drawer)
5. `c81ced8` — Criar FeriasModule (timeline + cálculos CLT)
6. `526289d` — Criar DesligamentosModule, CronogramaModule, VencimentosModule
