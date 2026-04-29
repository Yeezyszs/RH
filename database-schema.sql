-- ============================================================================
-- RH System Database Schema
-- Sistema de Gestão de Recursos Humanos
-- ============================================================================

-- ============================================================================
-- 1. TABELAS FUNDAMENTAIS
-- ============================================================================

-- Usuários do sistema
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(50) NOT NULL DEFAULT 'colaborador', -- admin, rh, gerente, colaborador
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Departamentos
CREATE TABLE IF NOT EXISTS departamentos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL UNIQUE,
  descricao TEXT,
  gerente_id INT REFERENCES usuarios(id),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cargos/Posições
CREATE TABLE IF NOT EXISTS cargos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL UNIQUE,
  descricao TEXT,
  nivel VARCHAR(50), -- junior, pleno, senior, liderança
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. MÓDULO PESSOAS
-- ============================================================================

-- Colaboradores
CREATE TABLE IF NOT EXISTS colaboradores (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  cpf VARCHAR(14) UNIQUE NOT NULL,
  data_nascimento DATE,
  genero VARCHAR(20),
  rg VARCHAR(20),
  telefone VARCHAR(20),
  celular VARCHAR(20),
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(10),
  numero_dependentes INT DEFAULT 0,
  departamento_id INT NOT NULL REFERENCES departamentos(id),
  cargo_id INT NOT NULL REFERENCES cargos(id),
  data_admissao DATE NOT NULL,
  data_desligamento DATE,
  tipo_contrato VARCHAR(50), -- CLT, PJ, Temporal, Estágio
  salario DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'ativo', -- ativo, inativo, afastado, desligado
  usuario_id INT REFERENCES usuarios(id),
  foto_url VARCHAR(500),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Histórico de mudanças de departamento/cargo
CREATE TABLE IF NOT EXISTS historico_colaboradores (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  departamento_anterior_id INT REFERENCES departamentos(id),
  departamento_novo_id INT REFERENCES departamentos(id),
  cargo_anterior_id INT REFERENCES cargos(id),
  cargo_novo_id INT REFERENCES cargos(id),
  salario_anterior DECIMAL(10, 2),
  salario_novo DECIMAL(10, 2),
  data_mudanca DATE NOT NULL,
  motivo VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rotatividade (Turnover)
CREATE TABLE IF NOT EXISTS rotatividade (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  data_desligamento DATE NOT NULL,
  motivo_desligamento VARCHAR(255),
  tipo_saida VARCHAR(50), -- demissão, pedido_exoneração, aposentadoria, falecimento
  aviso_previo_dias INT,
  entrevista_saida BOOLEAN DEFAULT false,
  feedback_saida TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Desligamentos
CREATE TABLE IF NOT EXISTS desligamentos (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  data_desligamento DATE NOT NULL,
  motivo VARCHAR(255),
  tipo VARCHAR(50), -- demissão_sem_causa, demissão_com_causa, pedido, aposentadoria
  dias_aviso_previo INT,
  encargos_rescisao DECIMAL(10, 2),
  data_pagamento DATE,
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. MÓDULO COMPLIANCE
-- ============================================================================

-- Documentos (ASO, exames, certificados, etc)
CREATE TABLE IF NOT EXISTS documentos (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo VARCHAR(100) NOT NULL, -- ASO, Certificado, Diploma, CNH, etc
  numero_documento VARCHAR(100),
  data_emissao DATE,
  data_vencimento DATE,
  url_arquivo VARCHAR(500),
  emitido_por VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ASO (Atestado de Saúde Ocupacional)
CREATE TABLE IF NOT EXISTS asos (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  resultado VARCHAR(50), -- apto, apto_com_restrição, inapto
  clinica_responsavel VARCHAR(255),
  medico_responsavel VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Treinamentos
CREATE TABLE IF NOT EXISTS treinamentos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  categoria VARCHAR(100), -- obrigatório, desenvolvimento, específico
  carga_horaria INT,
  data_inicio DATE,
  data_termino DATE,
  local VARCHAR(255),
  instrutor VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Participação em treinamentos
CREATE TABLE IF NOT EXISTS participantes_treinamento (
  id SERIAL PRIMARY KEY,
  treinamento_id INT NOT NULL REFERENCES treinamentos(id) ON DELETE CASCADE,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  data_conclusao DATE,
  certificado_url VARCHAR(500),
  avaliacao_final DECIMAL(3, 1), -- 0 a 10
  status VARCHAR(50), -- inscrito, em_andamento, concluído, faltante
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(treinamento_id, colaborador_id)
);

-- EPI (Equipamento de Proteção Individual)
CREATE TABLE IF NOT EXISTS epis (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo VARCHAR(100) NOT NULL, -- capacete, óculos, máscara, etc
  descricao TEXT,
  data_entrega DATE NOT NULL,
  data_vencimento DATE,
  quantidade INT DEFAULT 1,
  estado VARCHAR(50), -- novo, usado, danificado
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. MÓDULO BENEFÍCIOS
-- ============================================================================

-- Vale-Combustível
CREATE TABLE IF NOT EXISTS vale_combustivel (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  mes INT NOT NULL, -- 1-12
  ano INT NOT NULL,
  valor_mensal DECIMAL(10, 2),
  data_concessao DATE,
  status VARCHAR(50) DEFAULT 'ativo', -- ativo, suspenso, cancelado
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(colaborador_id, mes, ano)
);

-- Vale-Alimentação
CREATE TABLE IF NOT EXISTS vale_alimentacao (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  mes INT NOT NULL,
  ano INT NOT NULL,
  valor_mensal DECIMAL(10, 2),
  data_concessao DATE,
  status VARCHAR(50) DEFAULT 'ativo',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(colaborador_id, mes, ano)
);

-- Férias
CREATE TABLE IF NOT EXISTS ferias (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_termino DATE NOT NULL,
  dias_usados INT,
  dias_saldo INT,
  ano_referencia INT,
  aprovado BOOLEAN DEFAULT false,
  data_aprovacao DATE,
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Salários (restrito por perfil)
CREATE TABLE IF NOT EXISTS salarios (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  mes INT NOT NULL,
  ano INT NOT NULL,
  salario_base DECIMAL(10, 2),
  adicionais DECIMAL(10, 2),
  descontos DECIMAL(10, 2),
  salario_liquido DECIMAL(10, 2),
  data_pagamento DATE,
  banco VARCHAR(100),
  conta_numero VARCHAR(20),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(colaborador_id, mes, ano)
);

-- ============================================================================
-- 5. MÓDULO GESTÃO
-- ============================================================================

-- Advertências
CREATE TABLE IF NOT EXISTS advertencias (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo VARCHAR(100) NOT NULL, -- verbal, escrita, suspensão, demissão
  data_advertencia DATE NOT NULL,
  motivo TEXT NOT NULL,
  descricao TEXT,
  gerente_responsavel_id INT REFERENCES usuarios(id),
  data_prazo_resposta DATE,
  resposta_colaborador TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feedback & Clima (Pesquisas)
CREATE TABLE IF NOT EXISTS pesquisas_clima (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  data_inicio DATE NOT NULL,
  data_termino DATE NOT NULL,
  ativa BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Respostas de pesquisas
CREATE TABLE IF NOT EXISTS respostas_pesquisa (
  id SERIAL PRIMARY KEY,
  pesquisa_id INT NOT NULL REFERENCES pesquisas_clima(id) ON DELETE CASCADE,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  pergunta VARCHAR(255),
  resposta TEXT,
  rating INT, -- 1-5
  data_resposta TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feedbacks individuais
CREATE TABLE IF NOT EXISTS feedbacks (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  avaliador_id INT REFERENCES usuarios(id),
  data_feedback DATE NOT NULL,
  tipo VARCHAR(50), -- desempenho, comportamento, competência
  conteudo TEXT,
  avaliacao INT, -- 1-5
  confidencial BOOLEAN DEFAULT false,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cronograma (Eventos e Treinamentos)
CREATE TABLE IF NOT EXISTS cronograma (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  data_inicio TIMESTAMP NOT NULL,
  data_termino TIMESTAMP,
  local VARCHAR(255),
  tipo VARCHAR(100), -- treinamento, reunião, evento, feriado
  responsavel_id INT REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Participantes do cronograma
CREATE TABLE IF NOT EXISTS participantes_cronograma (
  id SERIAL PRIMARY KEY,
  cronograma_id INT NOT NULL REFERENCES cronograma(id) ON DELETE CASCADE,
  colaborador_id INT REFERENCES colaboradores(id) ON DELETE CASCADE,
  usuario_id INT REFERENCES usuarios(id),
  status VARCHAR(50) DEFAULT 'convidado', -- convidado, confirmado, rejeitado, ausente
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plano de Carreiras (Trilhas de desenvolvimento)
CREATE TABLE IF NOT EXISTS trilhas_carreira (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  cargo_inicial_id INT REFERENCES cargos(id),
  cargo_final_id INT REFERENCES cargos(id),
  tempo_estimado_meses INT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Acompanhamento de plano de carreiras
CREATE TABLE IF NOT EXISTS plano_carreiras_colaborador (
  id SERIAL PRIMARY KEY,
  colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  trilha_id INT NOT NULL REFERENCES trilhas_carreira(id),
  data_inicio DATE NOT NULL,
  data_previsao_conclusao DATE,
  etapa_atual VARCHAR(255),
  progresso_percentual INT DEFAULT 0, -- 0-100
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_colaboradores_departamento ON colaboradores(departamento_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_cargo ON colaboradores(cargo_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_status ON colaboradores(status);
CREATE INDEX IF NOT EXISTS idx_colaboradores_cpf ON colaboradores(cpf);
CREATE INDEX IF NOT EXISTS idx_colaboradores_email ON colaboradores(email);

CREATE INDEX IF NOT EXISTS idx_documentos_colaborador ON documentos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_documentos_vencimento ON documentos(data_vencimento);

CREATE INDEX IF NOT EXISTS idx_asos_colaborador ON asos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_asos_vencimento ON asos(data_vencimento);

CREATE INDEX IF NOT EXISTS idx_treinamentos_colaborador ON participantes_treinamento(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_treinamentos_data ON treinamentos(data_inicio);

CREATE INDEX IF NOT EXISTS idx_ferias_colaborador ON ferias(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ferias_ano ON ferias(ano_referencia);

CREATE INDEX IF NOT EXISTS idx_salarios_colaborador ON salarios(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_salarios_periodo ON salarios(mes, ano);

CREATE INDEX IF NOT EXISTS idx_advertencias_colaborador ON advertencias(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_advertencias_data ON advertencias(data_advertencia);

CREATE INDEX IF NOT EXISTS idx_feedbacks_colaborador ON feedbacks(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_avaliador ON feedbacks(avaliador_id);

CREATE INDEX IF NOT EXISTS idx_cronograma_data ON cronograma(data_inicio);

-- ============================================================================
-- 7. VIEWS ÚTEIS PARA ANÁLISES
-- ============================================================================

-- View: Aniversariantes do mês
CREATE OR REPLACE VIEW aniversariantes_mes AS
SELECT
  id,
  nome,
  data_nascimento,
  departamento_id,
  EXTRACT(DAY FROM data_nascimento) as dia,
  EXTRACT(MONTH FROM data_nascimento) as mes
FROM colaboradores
WHERE status = 'ativo';

-- View: Colaboradores com documentos vencidos
CREATE OR REPLACE VIEW documentos_vencidos AS
SELECT
  c.id,
  c.nome,
  d.tipo,
  d.data_vencimento,
  CURRENT_DATE - d.data_vencimento as dias_vencido
FROM colaboradores c
JOIN documentos d ON c.id = d.colaborador_id
WHERE d.data_vencimento < CURRENT_DATE
AND c.status = 'ativo';

-- View: ASO vencidos
CREATE OR REPLACE VIEW asos_vencidos AS
SELECT
  c.id,
  c.nome,
  a.data_vencimento,
  CURRENT_DATE - a.data_vencimento as dias_vencido
FROM colaboradores c
JOIN asos a ON c.id = a.colaborador_id
WHERE a.data_vencimento < CURRENT_DATE
AND c.status = 'ativo';

-- View: Saldo de férias por colaborador
CREATE OR REPLACE VIEW saldo_ferias AS
SELECT
  colaborador_id,
  COALESCE(SUM(dias_saldo), 0) as dias_disponivel,
  MAX(ano_referencia) as ultimo_ano
FROM ferias
WHERE aprovado = true
GROUP BY colaborador_id;

-- View: Dashboard - KPIs principais
CREATE OR REPLACE VIEW dashboard_kpis AS
SELECT
  (SELECT COUNT(*) FROM colaboradores WHERE status = 'ativo') as headcount_total,
  (SELECT COUNT(*) FROM colaboradores WHERE data_admissao > CURRENT_DATE - INTERVAL '12 months' AND status = 'ativo') as admissoes_ano,
  (SELECT COUNT(*) FROM rotatividade WHERE EXTRACT(YEAR FROM data_desligamento) = EXTRACT(YEAR FROM CURRENT_DATE)) as desligamentos_ano,
  (SELECT COUNT(*) FROM aniversariantes_mes WHERE mes = EXTRACT(MONTH FROM CURRENT_DATE)) as aniversariantes_este_mes,
  (SELECT COUNT(*) FROM asos_vencidos) as asos_vencidos,
  (SELECT COUNT(*) FROM documentos_vencidos) as documentos_vencidos;
