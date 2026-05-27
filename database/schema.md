# Esquema de Banco de Dados — RH System

Documentação completa da estrutura de banco de dados para o Sistema de Gestão de Recursos Humanos.

## 📋 Visão Geral

O banco de dados está organizado em **7 seções principais**:
1. **Tabelas Fundamentais** — Base do sistema
2. **Módulo Pessoas** — Gerenciamento de colaboradores
3. **Módulo Compliance** — Conformidade e documentação
4. **Módulo Benefícios** — Gestão de benefícios
5. **Módulo Gestão** — Desenvolvimento e acompanhamento
6. **Índices** — Otimização de performance
7. **Views** — Análises e dashboards

---

## 1️⃣ Tabelas Fundamentais

### `usuarios`
Sistema de autenticação e controle de acesso.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| nome | VARCHAR(255) | Nome do usuário |
| email | VARCHAR(255) | Email único |
| senha_hash | VARCHAR(255) | Senha criptografada |
| perfil | VARCHAR(50) | admin, rh, gerente, colaborador |
| ativo | BOOLEAN | Status do usuário |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última atualização |

### `departamentos`
Estrutura organizacional da empresa.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| nome | VARCHAR(255) | Nome único do departamento |
| descricao | TEXT | Descrição/objetivo |
| gerente_id | INT | Referência para usuários (gerente) |
| ativo | BOOLEAN | Status do departamento |
| criado_em | TIMESTAMP | Data de criação |

### `cargos`
Posições/funções disponíveis na empresa.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| nome | VARCHAR(255) | Nome único do cargo |
| descricao | TEXT | Responsabilidades |
| nivel | VARCHAR(50) | junior, pleno, senior, liderança |
| ativo | BOOLEAN | Status do cargo |
| criado_em | TIMESTAMP | Data de criação |

---

## 2️⃣ Módulo Pessoas

### `colaboradores`
Cadastro principal de funcionários.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| nome | VARCHAR(255) | Nome completo |
| email | VARCHAR(255) | Email corporativo único |
| cpf | VARCHAR(14) | CPF único |
| data_nascimento | DATE | Data de nascimento |
| genero | VARCHAR(20) | M/F/Outro |
| rg | VARCHAR(20) | Número RG |
| telefone | VARCHAR(20) | Telefone residencial |
| celular | VARCHAR(20) | Celular |
| endereco | TEXT | Endereço completo |
| cidade | VARCHAR(100) | Cidade |
| estado | VARCHAR(2) | Estado (UF) |
| cep | VARCHAR(10) | CEP |
| numero_dependentes | INT | Quantidade de dependentes |
| departamento_id | INT FK | Departamento do colaborador |
| cargo_id | INT FK | Cargo do colaborador |
| data_admissao | DATE | Data de entrada |
| data_desligamento | DATE | Data de saída (se houver) |
| tipo_contrato | VARCHAR(50) | CLT, PJ, Temporal, Estágio |
| salario | DECIMAL(10,2) | Salário base |
| status | VARCHAR(50) | ativo, inativo, afastado, desligado |
| usuario_id | INT FK | Usuário vinculado |
| foto_url | VARCHAR(500) | URL da foto de perfil |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última atualização |

**Índices:**
- email, CPF, departamento_id, cargo_id, status

### `historico_colaboradores`
Rastreamento de mudanças de departamento/cargo/salário.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| departamento_anterior_id | INT FK | Dept anterior |
| departamento_novo_id | INT FK | Dept novo |
| cargo_anterior_id | INT FK | Cargo anterior |
| cargo_novo_id | INT FK | Cargo novo |
| salario_anterior | DECIMAL(10,2) | Salário anterior |
| salario_novo | DECIMAL(10,2) | Salário novo |
| data_mudanca | DATE | Data da mudança |
| motivo | VARCHAR(255) | Motivo da mudança |
| criado_em | TIMESTAMP | Data de criação |

### `rotatividade`
Histórico de desligamentos e análise de turnover.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| data_desligamento | DATE | Data de saída |
| motivo_desligamento | VARCHAR(255) | Motivo |
| tipo_saida | VARCHAR(50) | demissão, pedido, aposentadoria, falecimento |
| aviso_previo_dias | INT | Dias de aviso prévio |
| entrevista_saida | BOOLEAN | Realizada entrevista? |
| feedback_saida | TEXT | Feedback da saída |
| criado_em | TIMESTAMP | Data de criação |

### `desligamentos`
Acompanhamento formal de desligamentos.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| data_desligamento | DATE | Data de saída |
| motivo | VARCHAR(255) | Motivo |
| tipo | VARCHAR(50) | Tipo de desligamento |
| dias_aviso_previo | INT | Dias de aviso |
| encargos_rescisao | DECIMAL(10,2) | Valor da rescisão |
| data_pagamento | DATE | Data de pagamento |
| observacoes | TEXT | Observações |
| criado_em | TIMESTAMP | Data de criação |

---

## 3️⃣ Módulo Compliance

### `documentos`
Controle centralizado de documentos e certificados.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| tipo | VARCHAR(100) | ASO, Certificado, Diploma, CNH, etc |
| numero_documento | VARCHAR(100) | Número do documento |
| data_emissao | DATE | Data de emissão |
| data_vencimento | DATE | Data de vencimento |
| url_arquivo | VARCHAR(500) | URL do arquivo |
| emitido_por | VARCHAR(255) | Órgão/entidade |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última atualização |

**Índice:** colaborador_id, data_vencimento

### `asos`
Atestados de Saúde Ocupacional — Controle específico.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| data_emissao | DATE | Data de emissão |
| data_vencimento | DATE | Data de vencimento |
| resultado | VARCHAR(50) | apto, apto_com_restrição, inapto |
| clinica_responsavel | VARCHAR(255) | Clínica que emitiu |
| medico_responsavel | VARCHAR(255) | Médico responsável |
| criado_em | TIMESTAMP | Data de criação |

**Índice:** colaborador_id, data_vencimento

### `treinamentos`
Catálogo de treinamentos disponíveis.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| nome | VARCHAR(255) | Nome do treinamento |
| descricao | TEXT | Descrição/conteúdo |
| categoria | VARCHAR(100) | obrigatório, desenvolvimento, específico |
| carga_horaria | INT | Horas totais |
| data_inicio | DATE | Data de início |
| data_termino | DATE | Data de término |
| local | VARCHAR(255) | Local/Plataforma |
| instrutor | VARCHAR(255) | Nome do instrutor |
| criado_em | TIMESTAMP | Data de criação |

### `participantes_treinamento`
Inscrição e acompanhamento de participações.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| treinamento_id | INT FK | Referência ao treinamento |
| colaborador_id | INT FK | Referência ao colaborador |
| data_conclusao | DATE | Data de conclusão |
| certificado_url | VARCHAR(500) | URL do certificado |
| avaliacao_final | DECIMAL(3,1) | Nota de 0 a 10 |
| status | VARCHAR(50) | inscrito, em_andamento, concluído, faltante |
| criado_em | TIMESTAMP | Data de criação |

**Índice:** colaborador_id, data de início

### `epis`
Controle de Equipamentos de Proteção Individual.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| tipo | VARCHAR(100) | capacete, óculos, máscara, etc |
| descricao | TEXT | Descrição detalhada |
| data_entrega | DATE | Data de entrega |
| data_vencimento | DATE | Data de expiração |
| quantidade | INT | Quantidade entregue |
| estado | VARCHAR(50) | novo, usado, danificado |
| observacoes | TEXT | Observações |
| criado_em | TIMESTAMP | Data de criação |

---

## 4️⃣ Módulo Benefícios

### `vale_combustivel`
Controle mensal de vale-combustível.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| mes | INT | Mês (1-12) |
| ano | INT | Ano |
| valor_mensal | DECIMAL(10,2) | Valor do benefício |
| data_concessao | DATE | Data de concessão |
| status | VARCHAR(50) | ativo, suspenso, cancelado |
| criado_em | TIMESTAMP | Data de criação |

**Constraint:** UNIQUE(colaborador_id, mes, ano)

### `vale_alimentacao`
Controle mensal de vale-alimentação.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| mes | INT | Mês (1-12) |
| ano | INT | Ano |
| valor_mensal | DECIMAL(10,2) | Valor do benefício |
| data_concessao | DATE | Data de concessão |
| status | VARCHAR(50) | ativo, suspenso, cancelado |
| criado_em | TIMESTAMP | Data de criação |

**Constraint:** UNIQUE(colaborador_id, mes, ano)

### `ferias`
Controle de períodos de férias.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| data_inicio | DATE | Data de início |
| data_termino | DATE | Data de término |
| dias_usados | INT | Dias utilizados |
| dias_saldo | INT | Dias restantes |
| ano_referencia | INT | Ano de referência |
| aprovado | BOOLEAN | Status de aprovação |
| data_aprovacao | DATE | Data de aprovação |
| observacoes | TEXT | Observações |
| criado_em | TIMESTAMP | Data de criação |

**Índice:** colaborador_id, ano_referencia

### `salarios`
Histórico de folha de pagamento (RESTRITO).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| mes | INT | Mês (1-12) |
| ano | INT | Ano |
| salario_base | DECIMAL(10,2) | Salário base |
| adicionais | DECIMAL(10,2) | Gratificações, bônus |
| descontos | DECIMAL(10,2) | INSS, IR, etc |
| salario_liquido | DECIMAL(10,2) | Salário líquido |
| data_pagamento | DATE | Data de pagamento |
| banco | VARCHAR(100) | Banco |
| conta_numero | VARCHAR(20) | Número da conta |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última atualização |

**Constraint:** UNIQUE(colaborador_id, mes, ano)
**Índice:** colaborador_id, mes/ano

---

## 5️⃣ Módulo Gestão

### `advertencias`
Registro de advertências disciplinares.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| tipo | VARCHAR(100) | verbal, escrita, suspensão, demissão |
| data_advertencia | DATE | Data da advertência |
| motivo | TEXT | Motivo |
| descricao | TEXT | Descrição detalhada |
| gerente_responsavel_id | INT FK | Gerente que registrou |
| data_prazo_resposta | DATE | Prazo para resposta |
| resposta_colaborador | TEXT | Resposta do colaborador |
| criado_em | TIMESTAMP | Data de criação |

**Índice:** colaborador_id, data_advertencia

### `pesquisas_clima`
Pesquisas de clima organizacional.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| titulo | VARCHAR(255) | Título da pesquisa |
| descricao | TEXT | Descrição |
| data_inicio | DATE | Data de início |
| data_termino | DATE | Data de término |
| ativa | BOOLEAN | Status |
| criado_em | TIMESTAMP | Data de criação |

### `respostas_pesquisa`
Respostas individuais das pesquisas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| pesquisa_id | INT FK | Referência à pesquisa |
| colaborador_id | INT FK | Referência ao colaborador |
| pergunta | VARCHAR(255) | Pergunta respondida |
| resposta | TEXT | Resposta em texto |
| rating | INT | Escala 1-5 |
| data_resposta | TIMESTAMP | Data da resposta |

### `feedbacks`
Feedbacks individuais contínuos.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| avaliador_id | INT FK | Avaliador |
| data_feedback | DATE | Data do feedback |
| tipo | VARCHAR(50) | desempenho, comportamento, competência |
| conteudo | TEXT | Conteúdo do feedback |
| avaliacao | INT | Escala 1-5 |
| confidencial | BOOLEAN | Feedback confidencial? |
| criado_em | TIMESTAMP | Data de criação |

**Índice:** colaborador_id, avaliador_id

### `cronograma`
Calendário de eventos, treinamentos e reuniões.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| titulo | VARCHAR(255) | Título do evento |
| descricao | TEXT | Descrição |
| data_inicio | TIMESTAMP | Data/hora de início |
| data_termino | TIMESTAMP | Data/hora de término |
| local | VARCHAR(255) | Local/plataforma |
| tipo | VARCHAR(100) | treinamento, reunião, evento, feriado |
| responsavel_id | INT FK | Responsável |
| criado_em | TIMESTAMP | Data de criação |

**Índice:** data_inicio

### `participantes_cronograma`
Participantes de eventos do cronograma.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| cronograma_id | INT FK | Referência ao evento |
| colaborador_id | INT FK | Colaborador (opcional) |
| usuario_id | INT FK | Usuário (opcional) |
| status | VARCHAR(50) | convidado, confirmado, rejeitado, ausente |
| criado_em | TIMESTAMP | Data de criação |

### `trilhas_carreira`
Planos de carreira predefinidos.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| nome | VARCHAR(255) | Nome da trilha |
| descricao | TEXT | Descrição |
| cargo_inicial_id | INT FK | Cargo de entrada |
| cargo_final_id | INT FK | Cargo de destino |
| tempo_estimado_meses | INT | Tempo estimado |
| criado_em | TIMESTAMP | Data de criação |

### `plano_carreiras_colaborador`
Acompanhamento individual de plano de carreiras.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Chave primária |
| colaborador_id | INT FK | Referência ao colaborador |
| trilha_id | INT FK | Trilha seguida |
| data_inicio | DATE | Data de início |
| data_previsao_conclusao | DATE | Data prevista |
| etapa_atual | VARCHAR(255) | Etapa atual |
| progresso_percentual | INT | Progresso 0-100% |
| observacoes | TEXT | Observações |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última atualização |

---

## 📊 Views (Análises e Dashboards)

### `aniversariantes_mes`
Colaboradores que fazem aniversário neste mês.

```sql
SELECT id, nome, data_nascimento, departamento_id, dia, mes
FROM aniversariantes_mes
WHERE mes = EXTRACT(MONTH FROM CURRENT_DATE);
```

### `documentos_vencidos`
Documentos que venceram ou estão vencendo.

```sql
SELECT id, nome, tipo, data_vencimento, dias_vencido
FROM documentos_vencidos
ORDER BY dias_vencido DESC;
```

### `asos_vencidos`
ASOs vencidos ou a vencer.

```sql
SELECT id, nome, data_vencimento, dias_vencido
FROM asos_vencidos;
```

### `saldo_ferias`
Saldo de férias por colaborador.

```sql
SELECT colaborador_id, dias_disponivel, ultimo_ano
FROM saldo_ferias;
```

### `dashboard_kpis`
KPIs principais para dashboard.

```sql
SELECT
  headcount_total,           -- Total de colaboradores ativos
  admissoes_ano,             -- Admissões no ano
  desligamentos_ano,         -- Desligamentos no ano
  aniversariantes_este_mes,  -- Aniversariantes deste mês
  asos_vencidos,             -- ASOs vencidos
  documentos_vencidos        -- Documentos vencidos
FROM dashboard_kpis;
```

---

## 🔐 Segurança e Permissões

- **Tabela `salarios`**: Restrita a perfil RH/Admin (implementar no aplicativo)
- **Dados sensíveis**: CPF, salário, informações médicas devem estar em campos separados
- **Auditoria**: Timestamps criado_em/atualizado_em em todas as tabelas
- **Soft delete**: Usar campo `ativo` em vez de deletar registros

---

## 🚀 Próximas Etapas

1. **Criar banco de dados** no Supabase ou PostgreSQL local
2. **Executar migrations** com arquivo `database-schema.sql`
3. **Adicionar dados de seed** para teste/demo
4. **Implementar RLS** (Row Level Security) para controlar acesso por perfil
5. **Conectar frontend** com API REST/GraphQL

---

## 📝 Notas

- Todos os campos de data usam formato ISO (YYYY-MM-DD)
- UUIDs podem ser usados em vez de SERIAL para melhor escalabilidade
- Implementar trigger para `atualizado_em` automaticamente
- Views estão prontas para integração com frontend
