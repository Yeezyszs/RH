-- ============================================================================
-- Migration 004: Seed de dados iniciais
-- Popula: usuarios (admin), departamentos, cargos e colaboradores
-- ============================================================================
-- Pré-requisito: o usuário admin@rh.com deve estar criado no Supabase Auth.
-- O auth_id abaixo é o UUID retornado pelo Supabase Auth para esse usuário.
-- Ajuste o auth_id se recriar o projeto ou o usuário admin.
-- ============================================================================

-- ── Usuário admin vinculado ao Supabase Auth ─────────────────────────────────
INSERT INTO public.usuarios (nome, email, senha_hash, perfil, ativo, auth_id)
VALUES (
  'Administrador',
  'admin@rh.com',
  '',        -- autenticação via Supabase Auth; senha_hash não é usada
  'admin',
  true,
  '150cb715-a77a-4ee8-baf6-496afeb2734e'  -- UUID do auth.users
)
ON CONFLICT (email) DO UPDATE
  SET auth_id = EXCLUDED.auth_id,
      perfil   = EXCLUDED.perfil,
      ativo    = EXCLUDED.ativo;

-- ── Departamentos ─────────────────────────────────────────────────────────────
INSERT INTO public.departamentos (nome, descricao, ativo) VALUES
  ('Administrativo', 'Setor administrativo, financeiro e gestão',    true),
  ('Produção',       'Setor de produção e operações industriais',     true),
  ('Área Externa',   'Setor de atividades externas e agropecuária',  true)
ON CONFLICT (nome) DO NOTHING;

-- ── Cargos ───────────────────────────────────────────────────────────────────
INSERT INTO public.cargos (nome, descricao, nivel, ativo) VALUES
  ('Analista RH',           'Analista de Recursos Humanos',        'pleno',  true),
  ('Op. Produção',          'Operador de Produção',                 'junior', true),
  ('Mecânico Industrial',   'Mecânico Industrial',                  'pleno',  true),
  ('Coord. Administrativo', 'Coordenador Administrativo',           'senior', true),
  ('Motorista',             'Motorista',                            'junior', true),
  ('Analista Financeiro',   'Analista Financeiro',                  'pleno',  true),
  ('Op. Máquina',           'Operador de Máquina',                  'junior', true),
  ('Vendedor',              'Vendedor Comercial',                   'junior', true),
  ('Trabalhador Rural',     'Trabalhador Rural',                    'junior', true),
  ('Médico Veterinário',    'Médico Veterinário',                   'senior', true),
  ('Aux. Veterinária',      'Auxiliar de Veterinária',              'junior', true),
  ('Tratorista',            'Operador de Trator / Maquinário',      'junior', true)
ON CONFLICT (nome) DO NOTHING;

-- ── Colaboradores (14 registros iniciais, espelham os dados mock da UI) ───────
INSERT INTO public.colaboradores
  (nome, email, cpf, genero, data_nascimento, data_admissao, status,
   telefone, celular, endereco, departamento_id, cargo_id, tipo_contrato)
VALUES
  ('Ana Paula Costa',       'ana.costa@empresa.com',       '123.456.789-00', 'Feminino',  '1988-07-12', '2021-03-15', 'ferias',   '(11) 98765-4321', '(11) 98765-4321', 'Rua das Flores, 120',          (SELECT id FROM departamentos WHERE nome='Administrativo'), (SELECT id FROM cargos WHERE nome='Analista RH'),           'CLT'),
  ('Carlos Eduardo Mendes', 'carlos.mendes@empresa.com',   '234.567.890-11', 'Masculino', '1995-02-08', '2026-04-20', 'ativo',    '(11) 99123-4567', '(11) 99123-4567', 'Av. Paulista, 2000',           (SELECT id FROM departamentos WHERE nome='Produção'),       (SELECT id FROM cargos WHERE nome='Op. Produção'),          'CLT'),
  ('José Silva Ramos',      'jose.silva@empresa.com',      '345.678.901-22', 'Masculino', '1979-11-30', '2018-08-02', 'ativo',    '(11) 98888-1111', '(11) 98888-1111', 'Rua do Porto, 15',             (SELECT id FROM departamentos WHERE nome='Produção'),       (SELECT id FROM cargos WHERE nome='Mecânico Industrial'),   'CLT'),
  ('Maria Santos Oliveira', 'maria.santos@empresa.com',    '456.789.012-33', 'Feminino',  '1985-04-22', '2019-11-18', 'ativo',    '(11) 97777-2222', '(11) 97777-2222', 'Rua XV de Novembro, 200',      (SELECT id FROM departamentos WHERE nome='Administrativo'), (SELECT id FROM cargos WHERE nome='Coord. Administrativo'), 'CLT'),
  ('Pedro Henrique Souza',  'pedro.souza@empresa.com',     '567.890.123-44', 'Masculino', '1990-09-15', '2020-06-05', 'afastado', '(11) 96666-3333', '(11) 96666-3333', 'Rua das Palmeiras, 88',        (SELECT id FROM departamentos WHERE nome='Produção'),       (SELECT id FROM cargos WHERE nome='Motorista'),             'CLT'),
  ('Rafael Fernandes Lima', 'rafael.lima@empresa.com',     '678.901.234-55', 'Masculino', '1992-04-27', '2022-01-12', 'ativo',    '(11) 95555-4444', '(11) 95555-4444', 'Av. Brasil, 450',              (SELECT id FROM departamentos WHERE nome='Produção'),       (SELECT id FROM cargos WHERE nome='Motorista'),             'CLT'),
  ('Marcela Pinto Oliveira','marcela.pinto@empresa.com',   '789.012.345-66', 'Feminino',  '1993-04-25', '2020-02-10', 'ativo',    '(11) 94444-5555', '(11) 94444-5555', 'Rua do Sol, 77',               (SELECT id FROM departamentos WHERE nome='Administrativo'), (SELECT id FROM cargos WHERE nome='Analista Financeiro'),   'CLT'),
  ('João Silveira Matos',   'joao.silveira@empresa.com',   '890.123.456-77', 'Masculino', '1982-04-23', '2017-05-20', 'ativo',    '(11) 93333-6666', '(11) 93333-6666', 'Rua Lagoa Azul, 33',           (SELECT id FROM departamentos WHERE nome='Produção'),       (SELECT id FROM cargos WHERE nome='Op. Máquina'),           'CLT'),
  ('Paulo Rocha Almeida',   'paulo.rocha@empresa.com',     '901.234.567-88', 'Masculino', '1994-06-11', '2023-07-14', 'ativo',    '(11) 92222-7777', '(11) 92222-7777', 'Rua Verde, 900',               (SELECT id FROM departamentos WHERE nome='Produção'),       (SELECT id FROM cargos WHERE nome='Op. Produção'),          'CLT'),
  ('Luiz Araújo Pereira',   'luiz.araujo@empresa.com',     '012.345.678-99', 'Masculino', '1987-12-01', '2019-09-03', 'inativo',  '(11) 91111-8888', '(11) 91111-8888', 'Rua Amarela, 450',             (SELECT id FROM departamentos WHERE nome='Administrativo'), (SELECT id FROM cargos WHERE nome='Vendedor'),              'CLT'),
  ('Antônio Ferreira Lopes','antonio.ferreira@empresa.com','111.222.333-44', 'Masculino', '1975-03-18', '2016-04-11', 'ativo',    '(11) 90000-1000', '(11) 90000-1000', 'Sítio Boa Vista, s/n',         (SELECT id FROM departamentos WHERE nome='Área Externa'),   (SELECT id FROM cargos WHERE nome='Trabalhador Rural'),     'CLT'),
  ('Roberto Campos Alves',  'roberto.campos@empresa.com',  '222.333.444-55', 'Masculino', '1986-05-09', '2022-09-05', 'ativo',    '(11) 90000-2000', '(11) 90000-2000', 'Rua do Campo, 12',             (SELECT id FROM departamentos WHERE nome='Área Externa'),   (SELECT id FROM cargos WHERE nome='Médico Veterinário'),    'CLT'),
  ('Cristina Moura Dias',   'cristina.moura@empresa.com',  '333.444.555-66', 'Feminino',  '1996-08-22', '2024-02-14', 'ativo',    '(11) 90000-3000', '(11) 90000-3000', 'Estrada Rural km 3',           (SELECT id FROM departamentos WHERE nome='Área Externa'),   (SELECT id FROM cargos WHERE nome='Aux. Veterinária'),      'CLT'),
  ('Edivaldo Pereira Souza','edivaldo.pereira@empresa.com','444.555.666-77', 'Masculino', '1980-01-30', '2020-11-22', 'ativo',    '(11) 90000-4000', '(11) 90000-4000', 'Sítio Boa Vista, s/n',         (SELECT id FROM departamentos WHERE nome='Área Externa'),   (SELECT id FROM cargos WHERE nome='Tratorista'),            'CLT')
ON CONFLICT DO NOTHING;
