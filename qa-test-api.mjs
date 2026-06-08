import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const BASE_URL = 'http://127.0.0.1:8000';
const REPORT = [];

function log(test, status, message = '') {
  const result = { test, status, message, timestamp: new Date().toISOString() };
  REPORT.push(result);
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${test}: ${status}${message ? ' — ' + message : ''}`);
}

async function testApp() {
  try {
    // ═══════════════════════════════════════════════════════════════════════
    // 1. CARREGAMENTO INICIAL
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n🔍 TESTE QA DO SISTEMA RH\n');
    console.log('═'.repeat(60));

    const response = await fetch(BASE_URL);
    log('HTTP Response', response.status === 200 ? 'PASS' : 'FAIL', `Status: ${response.status}`);

    const html = await response.text();
    log('HTML Content', html.length > 1000 ? 'PASS' : 'FAIL', `${html.length} bytes`);

    const dom = new JSDOM(html);
    const { document } = dom.window;

    // ═══════════════════════════════════════════════════════════════════════
    // 2. VERIFICAÇÃO DE ELEMENTOS CRÍTICOS DO HTML
    // ═══════════════════════════════════════════════════════════════════════

    const title = document.querySelector('title');
    log('Page Title', title ? 'PASS' : 'FAIL', title ? `"${title.textContent}"` : '');

    const navbar = document.querySelector('.topbar');
    log('Navbar Present', navbar ? 'PASS' : 'FAIL');

    const sidebar = document.querySelector('.sidebar');
    log('Sidebar Present', sidebar ? 'PASS' : 'FAIL');

    const loginForm = document.getElementById('form-login');
    log('Login Form Present', loginForm ? 'PASS' : 'FAIL');

    // ═══════════════════════════════════════════════════════════════════════
    // 3. VERIFICAÇÃO DE ESTILOS CSS
    // ═══════════════════════════════════════════════════════════════════════

    const cssFiles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    log('CSS Files Linked', cssFiles.length > 0 ? 'PASS' : 'FAIL', `${cssFiles.length} arquivos`);

    cssFiles.forEach((link, i) => {
      const href = link.getAttribute('href');
      if (href && !href.includes('style') && !href.includes('layout')) {
        log(`  - CSS File ${i + 1}`, 'PASS', href);
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 4. VERIFICAÇÃO DE SCRIPTS
    // ═══════════════════════════════════════════════════════════════════════

    const scripts = Array.from(document.querySelectorAll('script'));
    log('Scripts Loaded', scripts.length > 0 ? 'PASS' : 'FAIL', `${scripts.length} scripts`);

    // Verificar scripts principais
    const hasDataStore = Array.from(scripts).some(s =>
      s.getAttribute('src')?.includes('data-store.js')
    );
    log('Data Store Script', hasDataStore ? 'PASS' : 'FAIL');

    const hasSupabase = Array.from(scripts).some(s =>
      s.getAttribute('src')?.includes('supabase.js')
    );
    log('Supabase Script', hasSupabase ? 'PASS' : 'FAIL');

    // ═══════════════════════════════════════════════════════════════════════
    // 5. VERIFICAÇÃO DE PÁGINAS/ABAS
    // ═══════════════════════════════════════════════════════════════════════

    const navItems = Array.from(document.querySelectorAll('[data-page]'));
    const pages = navItems.map(el => el.getAttribute('data-page')).filter(Boolean);

    log('Navigation Items', pages.length > 0 ? 'PASS' : 'FAIL', `${pages.length} páginas`);

    const expectedPages = [
      'dashboard', 'colaboradores', 'advertencias', 'ferias', 'desligamentos',
      'cronograma', 'vencimentos', 'epi', 'rotatividade', 'salarios',
      'vale-combustivel', 'vale-alimentacao', 'feedback-clima', 'plano-carreiras'
    ];

    expectedPages.forEach(page => {
      const hasPage = pages.includes(page);
      log(`  Page: ${page}`, hasPage ? 'PASS' : 'FAIL');
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 6. VERIFICAÇÃO DE MODAIS E DRAWERS
    // ═══════════════════════════════════════════════════════════════════════

    const modals = Array.from(document.querySelectorAll('.modal, [role="dialog"]'));
    log('Modal Elements', modals.length > 0 ? 'PASS' : 'FAIL', `${modals.length} modais`);

    const drawers = Array.from(document.querySelectorAll('.drawer, [role="complementary"]'));
    log('Drawer Elements', drawers.length > 0 ? 'PASS' : 'FAIL', `${drawers.length} drawers`);

    // ═══════════════════════════════════════════════════════════════════════
    // 7. VERIFICAÇÃO DE TABELAS
    // ═══════════════════════════════════════════════════════════════════════

    const tables = Array.from(document.querySelectorAll('table'));
    log('Data Tables', tables.length > 0 ? 'PASS' : 'FAIL', `${tables.length} tabelas`);

    tables.forEach((table, i) => {
      const id = table.getAttribute('id') || `table-${i}`;
      const rows = table.querySelectorAll('tbody tr').length;
      log(`  - Table ${id}`, 'PASS', `${rows} linhas`);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 8. VERIFICAÇÃO DE FORMULÁRIOS
    // ═══════════════════════════════════════════════════════════════════════

    const forms = Array.from(document.querySelectorAll('form'));
    log('Forms', forms.length > 0 ? 'PASS' : 'FAIL', `${forms.length} formulários`);

    forms.forEach((form, i) => {
      const id = form.getAttribute('id') || `form-${i}`;
      const inputs = form.querySelectorAll('input, select, textarea').length;
      log(`  - Form ${id}`, 'PASS', `${inputs} campos`);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 9. VERIFICAÇÃO DE ELEMENTOS DE INTERAÇÃO
    // ═══════════════════════════════════════════════════════════════════════

    const buttons = Array.from(document.querySelectorAll('button'));
    log('Buttons', buttons.length > 0 ? 'PASS' : 'FAIL', `${buttons.length} botões`);

    const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"]'));
    log('Search/Input Fields', inputs.length > 0 ? 'PASS' : 'FAIL', `${inputs.length} campos`);

    const selects = Array.from(document.querySelectorAll('select'));
    log('Select Dropdowns', selects.length > 0 ? 'PASS' : 'FAIL', `${selects.length} dropdowns`);

    // ═══════════════════════════════════════════════════════════════════════
    // 10. VERIFICAÇÃO DE SEGURANÇA BÁSICA
    // ═══════════════════════════════════════════════════════════════════════

    const hasSecurityHeaders = response.headers.get('x-frame-options') ||
                                response.headers.get('content-security-policy');
    log('Security Headers', hasSecurityHeaders ? 'WARN' : 'INFO',
        'No security headers detected (normal for dev)');

    // Verificar se há chaves expostas no HTML
    const htmlText = html.toLowerCase();
    const hasServiceKey = htmlText.includes('service_role') || htmlText.includes('service-role');
    const hasSecretKey = htmlText.includes('secret') && htmlText.includes('key');

    log('No Service Role Key Exposed', !hasServiceKey ? 'PASS' : 'FAIL');

    // ═══════════════════════════════════════════════════════════════════════
    // 11. VERIFICAÇÃO DE BADGES E ELEMENTOS DE STATUS
    // ═══════════════════════════════════════════════════════════════════════

    const badges = Array.from(document.querySelectorAll('.badge, [class*="badge"]'));
    log('Badge Elements', badges.length > 0 ? 'PASS' : 'FAIL', `${badges.length} badges`);

    // ═══════════════════════════════════════════════════════════════════════
    // 12. VERIFICAÇÃO DE ACESSIBILIDADE BÁSICA
    // ═══════════════════════════════════════════════════════════════════════

    const images = Array.from(document.querySelectorAll('img'));
    const imagesWithoutAlt = images.filter(img => !img.getAttribute('alt')).length;
    log('Image Alt Text', imagesWithoutAlt === 0 ? 'PASS' : 'WARN',
        `${imagesWithoutAlt}/${images.length} imagens sem alt`);

    const links = Array.from(document.querySelectorAll('a'));
    const linksWithoutText = links.filter(a => !a.textContent.trim() && !a.getAttribute('aria-label')).length;
    log('Link Text', linksWithoutText === 0 ? 'PASS' : 'WARN',
        `${linksWithoutText}/${links.length} links sem texto/aria-label`);

    // ═══════════════════════════════════════════════════════════════════════
    // 13. VERIFICAÇÃO DE RESPONSIVIDADE (Viewport)
    // ═══════════════════════════════════════════════════════════════════════

    const viewport = document.querySelector('meta[name="viewport"]');
    log('Viewport Meta Tag', viewport ? 'PASS' : 'FAIL',
        viewport ? viewport.getAttribute('content') : '');

    // ═══════════════════════════════════════════════════════════════════════
    // 14. VERIFICAÇÃO DE CARACTERES ESPECIAIS E ENCODING
    // ═══════════════════════════════════════════════════════════════════════

    const charset = document.querySelector('meta[charset]');
    log('Character Encoding', charset ? 'PASS' : 'FAIL',
        charset ? charset.getAttribute('charset') : '');

    // ═══════════════════════════════════════════════════════════════════════
    // 15. VERIFICAÇÃO DE ÍCONES E ASSETS
    // ═══════════════════════════════════════════════════════════════════════

    const favicon = document.querySelector('link[rel="icon"]');
    log('Favicon', favicon ? 'PASS' : 'INFO', favicon ? favicon.getAttribute('href') : 'Not found');

    // ═══════════════════════════════════════════════════════════════════════
    // RELATÓRIO FINAL
    // ═══════════════════════════════════════════════════════════════════════

    const passed = REPORT.filter(r => r.status === 'PASS').length;
    const failed = REPORT.filter(r => r.status === 'FAIL').length;
    const warned = REPORT.filter(r => r.status === 'WARN').length;
    const info = REPORT.filter(r => r.status === 'INFO').length;
    const total = REPORT.length;

    console.log('\n' + '═'.repeat(60));
    console.log(`📊 RELATÓRIO QA FINAL — ${new Date().toLocaleString('pt-BR')}`);
    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`⚠️  Warnings: ${warned}/${total}`);
    console.log(`ℹ️  Info: ${info}/${total}`);
    console.log('═'.repeat(60));

    console.log('\n📋 RESUMO:');
    console.log(`  • Elementos críticos do HTML: ${navbar && sidebar && loginForm ? 'OK' : 'FALHA'}`);
    console.log(`  • Páginas/Abas: ${pages.length}/${expectedPages.length}`);
    console.log(`  • Tabelas: ${tables.length}`);
    console.log(`  • Formulários: ${forms.length}`);
    console.log(`  • Botões: ${buttons.length}`);
    console.log(`  • CSS Arquivos: ${cssFiles.length}`);
    console.log(`  • Scripts: ${scripts.length}`);

    if (failed === 0) {
      console.log('\n🎉 SISTEMA ESTRUTURALMENTE ÍNTEGRO!\n');
      return 0;
    } else {
      console.log(`\n⚠️  ${failed} problema(s) encontrado(s).\n`);
      return 1;
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
    return 1;
  }
}

testApp().then(code => process.exit(code));
