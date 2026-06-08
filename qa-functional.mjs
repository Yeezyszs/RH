import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const BASE_URL = 'http://127.0.0.1:8000';

async function testFunctional() {
  try {
    console.log('\n🧪 TESTE DE FUNCIONALIDADES — SISTEMA RH\n');
    console.log('═'.repeat(70));

    const response = await fetch(BASE_URL);
    const html = await response.text();
    const dom = new JSDOM(html, { runScripts: 'outside-only', resources: 'usable' });
    const { document, window } = dom.window;

    let passed = 0;
    let failed = 0;

    function test(name, condition, message = '') {
      const status = condition ? 'PASS' : 'FAIL';
      const icon = condition ? '✅' : '❌';
      console.log(`${icon} ${name}${message ? ' — ' + message : ''}`);
      if (condition) passed++; else failed++;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 1. VERIFICAÇÃO DE FUNÇÕES GLOBAIS
    // ═════════════════════════════════════════════════════════════════════════

    console.log('\n📌 1. Funções Globais Necessárias:');

    const globalFuncs = [
      'goPage', 'showToast', 'abrirDrawerColab', 'abrirModalVencimento',
      'devolverEpi', 'abrirModalEpiEntrega', 'handleLogin', 'fazerLogout'
    ];

    globalFuncs.forEach(func => {
      const exists = document.body.innerHTML.includes(`onclick="` + func) ||
                     document.body.innerHTML.includes(`function ${func}`) ||
                     document.body.innerHTML.includes(`${func}(`) ||
                     document.body.innerHTML.includes(`"${func}"`);
      test(`Função: ${func}`, exists, 'Referência encontrada no DOM');
    });

    // ═════════════════════════════════════════════════════════════════════════
    // 2. VERIFICAÇÃO DE EVENT LISTENERS
    // ═════════════════════════════════════════════════════════════════════════

    console.log('\n📌 2. Event Listeners:');

    const hasInputListener = html.includes('addEventListener') && html.includes('input');
    test('Input listeners', hasInputListener, 'listeners para busca/filtros');

    const hasClickListener = html.includes('addEventListener') && html.includes('click');
    test('Click listeners', hasClickListener, 'listeners para botões');

    const hasChangeListener = html.includes('addEventListener') && html.includes('change');
    test('Change listeners', hasChangeListener, 'listeners para selects');

    // ═════════════════════════════════════════════════════════════════════════
    // 3. VERIFICAÇÃO DE ESTRUTURA DE FORMULÁRIOS
    // ═════════════════════════════════════════════════════════════════════════

    console.log('\n📌 3. Formulários — Validação de Campos:');

    const forms = {
      'login': ['email', 'senha'],
      'colaborador': ['nome', 'cpf', 'email', 'data_admissao', 'setor', 'cargo'],
      'vencimento': ['colaborador_id', 'categoria', 'item', 'vencimento'],
      'epi-entrega': ['colaborador_id', 'epi_tipo_id', 'data_entrega', 'proxima_troca'],
      'advertencia': ['colaborador_id', 'tipo', 'data_advertencia'],
      'ferias-periodo': ['colaborador_id', 'data_inicio', 'data_fim'],
      'desligamento': ['colaborador_id', 'motivo', 'data_desligamento'],
    };

    Object.entries(forms).forEach(([formId, expectedFields]) => {
      const form = document.getElementById(formId) || document.getElementById(`form-${formId}`);
      const hasForm = !!form;

      if (!hasForm) {
        // Tenta versões alternativas
        const altForm = Array.from(document.querySelectorAll('form')).find(f =>
          f.id?.includes(formId.replace('-', '')) ||
          f.innerHTML.includes(expectedFields[0])
        );

        if (altForm) {
          test(`Formulário: ${formId}`, true, 'Encontrado com padrão alternativo');
        } else {
          test(`Formulário: ${formId}`, false, 'Não encontrado');
          return;
        }
      }

      const foundFields = expectedFields.filter(field => {
        const hasField = !!form?.elements[field] ||
                         form?.querySelector(`[name="${field}"]`) ||
                         form?.innerHTML.includes(`name="${field}"`);
        return hasField;
      });

      test(`  Campos em ${formId}`, foundFields.length >= Math.ceil(expectedFields.length * 0.7),
           `${foundFields.length}/${expectedFields.length} campos críticos`);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // 4. VERIFICAÇÃO DE TABELAS
    // ═════════════════════════════════════════════════════════════════════════

    console.log('\n📌 4. Tabelas de Dados:');

    const tables = {
      'tb-colaboradores': ['Colaborador', 'CPF', 'Email', 'Setor'],
      'tb-vencimentos': ['Colaborador', 'Categoria', 'Item', 'Vencimento'],
      'tb-epi-entregas': ['Colaborador', 'EPI', 'Data Entrega', 'Próxima Troca'],
      'tb-advertencias': ['Colaborador', 'Tipo', 'Data', 'Status'],
      'tb-ferias': ['Colaborador', 'Período', 'Dias', 'Status'],
    };

    Object.entries(tables).forEach(([tableId, expectedHeaders]) => {
      const table = document.getElementById(tableId);
      if (!table) {
        test(`Tabela: ${tableId}`, false, 'Não encontrada');
        return;
      }

      const thead = table.querySelector('thead');
      const headerText = thead?.textContent || '';

      const foundHeaders = expectedHeaders.filter(h =>
        headerText.toLowerCase().includes(h.toLowerCase())
      );

      test(`Tabela: ${tableId}`, foundHeaders.length >= expectedHeaders.length * 0.5,
           `${foundHeaders.length}/${expectedHeaders.length} headers`);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // 5. VERIFICAÇÃO DE FILTROS
    // ═════════════════════════════════════════════════════════════════════════

    console.log('\n📌 5. Filtros e Buscas:');

    const filters = {
      'colab-search': 'Busca de colaboradores',
      'epi-search': 'Busca de EPIs',
      'colab-filter-setor': 'Filtro de setor',
      'epi-filter-tipo': 'Filtro de tipo de EPI',
      'epi-filter-status': 'Filtro de status EPI',
    };

    Object.entries(filters).forEach(([filterId, description]) => {
      const filter = document.getElementById(filterId);
      test(`Filtro: ${description}`, !!filter, filterId);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // 6. VERIFICAÇÃO DE BADGES E STATUS
    // ═════════════════════════════════════════════════════════════════════════

    console.log('\n📌 6. Elementos de Status:');

    const hasVencidoBadge = html.includes('badge danger') && html.includes('vencido');
    test('Badge de vencimento (Vermelho)', hasVencidoBadge, 'Status crítico');

    const hasAlertaBadge = html.includes('badge warn') && html.includes('alerta');
    test('Badge de alerta (Amarelo)', hasAlertaBadge, 'Status atenção');

    const hasOkBadge = html.includes('badge ok') && html.includes('vigente');
    test('Badge OK (Verde)', hasOkBadge, 'Status normal');

    // ═════════════════════════════════════════════════════════════════════════
    // 7. VERIFICAÇÃO DE ÍCONES E SVG
    // ═════════════════════════════════════════════════════════════════════════

    console.log('\n📌 7. Ícones e Visual:');

    const hasIcons = html.includes('🔍') || html.includes('✎') || html.includes('🗑');
    test('Ícones/Emojis presentes', hasIcons, 'UI visual completa');

    const hasSectionHeaders = html.match(/<h[1-4]/g);
    test('Headers estruturais', hasSectionHeaders && hasSectionHeaders.length > 5,
         `${hasSectionHeaders?.length || 0} headers`);

    // ═════════════════════════════════════════════════════════════════════════
    // 8. VERIFICAÇÃO DE STORE GLOBAL
    // ═════════════════════════════════════════════════════════════════════════

    console.log('\n📌 8. Data Store Global:');

    const stores = [
      'COLABORADORES', 'DEPENDENTES', 'CONTATOS_EMERG', 'ADVERTENCIAS',
      'FERIAS', 'DESLIGAMENTOS', 'EVENTOS', 'VENCIMENTOS', 'EPI_CATALOGO',
      'EPI_ENTREGAS', 'EPI_KITS', 'SALARIOS', 'FEEDBACK', 'CLIMA'
    ];

    const hasDataStore = html.includes('data-store.js');
    test('Data Store Script', hasDataStore, 'Globais declaradas');

    stores.forEach(store => {
      const hasStore = html.includes(`window.${store}`) || html.includes(`${store} =`);
      test(`  Store: ${store}`, hasStore, 'Declarada globalmente');
    });

    // ═════════════════════════════════════════════════════════════════════════
    // 9. VERIFICAÇÃO DE MÓDULOS
    // ═════════════════════════════════════════════════════════════════════════

    console.log('\n📌 9. Módulos ES6:');

    const modules = [
      'colaboradores.js', 'advertencias.js', 'ferias.js', 'desligamentos.js',
      'cronograma.js', 'vencimentos.js', 'epi.js', 'rotatividade.js',
      'salarios.js', 'vale-combustivel.js', 'vale-alimentacao.js',
      'feedback-clima.js', 'plano-carreiras.js'
    ];

    modules.forEach(module => {
      const hasModule = html.includes(module);
      test(`Módulo: ${module}`, hasModule, 'Importado');
    });

    // ═════════════════════════════════════════════════════════════════════════
    // 10. VERIFICAÇÃO DE CSS CLASSES PADRÃO
    // ═════════════════════════════════════════════════════════════════════════

    console.log('\n📌 10. Classes CSS Padrão:');

    const cssClasses = [
      'container', 'btn', 'btn-primary', 'badge', 'card', 'modal', 'drawer',
      'table', 'form', 'input-group', 'nav-item', 'sidebar', 'topbar'
    ];

    cssClasses.forEach(cls => {
      const hasClass = html.includes(`class="${cls}`) || html.includes(`class=".*${cls}`);
      test(`Classe CSS: .${cls}`, hasClass, 'Estilizada');
    });

    // ═════════════════════════════════════════════════════════════════════════
    // RELATÓRIO FINAL
    // ═════════════════════════════════════════════════════════════════════════

    const total = passed + failed;
    const percentage = ((passed / total) * 100).toFixed(1);

    console.log('\n' + '═'.repeat(70));
    console.log(`📊 RESULTADO FINAL`);
    console.log('═'.repeat(70));
    console.log(`✅ Testes passou: ${passed}/${total} (${percentage}%)`);
    console.log(`❌ Testes falharam: ${failed}/${total}`);
    console.log('═'.repeat(70));

    if (failed === 0) {
      console.log('\n🎉 TODAS AS FUNCIONALIDADES CRÍTICAS ESTÃO PRESENTES!\n');
      return 0;
    } else {
      console.log(`\n⚠️  ${failed} funcionalidade(s) incompleta(s).\n`);
      return 1;
    }

  } catch (error) {
    console.error('Erro fatal:', error.message);
    return 1;
  }
}

testFunctional().then(code => process.exit(code));
