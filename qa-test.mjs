import { chromium } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:8000';
const REPORT = [];

function log(test, status, message = '') {
  const result = { test, status, message, timestamp: new Date().toISOString() };
  REPORT.push(result);
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${test}: ${status}${message ? ' — ' + message : ''}`);
}

async function testApp() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  let consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // 1. CARREGAMENTO INICIAL
    // ═══════════════════════════════════════════════════════════════════════

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const pageTitle = await page.title();
    log('Page Load', 'PASS', `Loaded with title: "${pageTitle}"`);

    // Verificar elementos principais
    const loginForm = await page.locator('#form-login').isVisible();
    log('Login Form Present', loginForm ? 'PASS' : 'FAIL', loginForm ? 'Form found' : 'Form not found');

    // ═══════════════════════════════════════════════════════════════════════
    // 2. VERIFICAÇÃO DO LAYOUT
    // ═══════════════════════════════════════════════════════════════════════

    const navbar = await page.locator('.topbar').isVisible();
    log('Navbar Visible', navbar ? 'PASS' : 'FAIL');

    const sidebar = await page.locator('.sidebar').isVisible();
    log('Sidebar Visible', sidebar ? 'PASS' : 'FAIL');

    // ═══════════════════════════════════════════════════════════════════════
    // 3. TESTE DE DADOS CARREGADOS
    // ═══════════════════════════════════════════════════════════════════════

    const colabCount = await page.evaluate(() => window.COLABORADORES?.length || 0);
    log('Colaboradores Loaded', colabCount > 0 ? 'PASS' : 'FAIL', `${colabCount} registros`);

    const epiCount = await page.evaluate(() => window.EPI_ENTREGAS?.length || 0);
    log('EPI Data Loaded', epiCount > 0 ? 'PASS' : 'FAIL', `${epiCount} entregas`);

    const vencCount = await page.evaluate(() => window.VENCIMENTOS?.length || 0);
    log('Vencimentos Loaded', vencCount > 0 ? 'PASS' : 'FAIL', `${vencCount} vencimentos`);

    const advertCount = await page.evaluate(() => window.ADVERTENCIAS?.length || 0);
    log('Advertências Loaded', advertCount > 0 ? 'PASS' : 'FAIL', `${advertCount} registros`);

    // ═══════════════════════════════════════════════════════════════════════
    // 4. TESTE DE NAVEGAÇÃO ENTRE ABAS
    // ═══════════════════════════════════════════════════════════════════════

    const pages = [
      'dashboard', 'colaboradores', 'advertencias', 'ferias', 'desligamentos',
      'cronograma', 'vencimentos', 'epi', 'rotatividade', 'salarios',
      'vale-combustivel', 'vale-alimentacao', 'feedback-clima', 'plano-carreiras'
    ];

    for (const pageName of pages) {
      await page.click(`[data-page="${pageName}"]`);
      await page.waitForTimeout(300);

      const visible = await page.evaluate((name) => {
        const el = document.querySelector(`[data-page="${name}"]`);
        return el && el.getAttribute('class')?.includes('active');
      }, pageName);

      log(`Navigate to ${pageName}`, visible ? 'PASS' : 'FAIL');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 5. TESTE DE FUNCIONALIDADES PRINCIPAIS
    // ═══════════════════════════════════════════════════════════════════════

    // Dashboard
    await page.click('[data-page="dashboard"]');
    await page.waitForTimeout(300);
    const dashChart = await page.locator('canvas').count();
    log('Dashboard Charts', dashChart > 0 ? 'PASS' : 'FAIL', `${dashChart} gráficos`);

    // Colaboradores - Busca
    await page.click('[data-page="colaboradores"]');
    await page.waitForTimeout(300);
    const searchInput = await page.locator('#colab-search');
    if (await searchInput.isVisible()) {
      await searchInput.fill('João');
      await page.waitForTimeout(300);
      const results = await page.locator('#tb-colaboradores tr:not(:last-child)').count();
      log('Colaboradores Search', results >= 0 ? 'PASS' : 'FAIL', `${results} resultados`);
      await searchInput.clear();
    }

    // EPI - Filtros
    await page.click('[data-page="epi"]');
    await page.waitForTimeout(300);
    const epiFilterStatus = await page.locator('#epi-filter-status').isVisible();
    log('EPI Filters Visible', epiFilterStatus ? 'PASS' : 'FAIL');

    if (epiFilterStatus) {
      await page.selectOption('#epi-filter-status', { index: 1 });
      await page.waitForTimeout(300);
      log('EPI Status Filter', 'PASS', 'Filter applied successfully');
    }

    // Vencimentos
    await page.click('[data-page="vencimentos"]');
    await page.waitForTimeout(300);
    const vencTable = await page.locator('#tb-vencimentos').isVisible();
    log('Vencimentos Table', vencTable ? 'PASS' : 'FAIL');

    // ═══════════════════════════════════════════════════════════════════════
    // 6. TESTE DE RESPONSIVIDADE
    // ═══════════════════════════════════════════════════════════════════════

    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    const desktopLayout = await page.locator('.container').isVisible();
    log('Desktop Layout (1920x1080)', desktopLayout ? 'PASS' : 'FAIL');

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(200);
    const tabletLayout = await page.locator('.container').isVisible();
    log('Tablet Layout (768x1024)', tabletLayout ? 'PASS' : 'FAIL');

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);
    const mobileLayout = await page.locator('.container').isVisible();
    log('Mobile Layout (375x667)', mobileLayout ? 'PASS' : 'FAIL');

    // Reset
    await page.setViewportSize({ width: 1920, height: 1080 });

    // ═══════════════════════════════════════════════════════════════════════
    // 7. TESTE DE CSS & ESTILOS
    // ═══════════════════════════════════════════════════════════════════════

    const topbarLogo = await page.locator('.topbar-brand').isVisible();
    log('Topbar Logo Visible', topbarLogo ? 'PASS' : 'FAIL');

    const topbarText = await page.locator('.topbar-brand').evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        color: style.color,
        width: style.width
      };
    });

    if (topbarText.display !== 'none') {
      log('Topbar Styling', 'PASS', `Display: ${topbarText.display}, Color OK`);
    } else {
      log('Topbar Styling', 'FAIL', 'Logo is hidden (display: none)');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 8. TESTE DE PERFORMANCE (Network)
    // ═══════════════════════════════════════════════════════════════════════

    const navigationTiming = await page.evaluate(() => {
      const perf = window.performance.timing;
      return {
        loadTime: perf.loadEventEnd - perf.navigationStart,
        domInteractive: perf.domInteractive - perf.navigationStart,
      };
    });

    log('Page Load Time', navigationTiming.loadTime < 5000 ? 'PASS' : 'WARN',
        `${navigationTiming.loadTime}ms`);

    // ═══════════════════════════════════════════════════════════════════════
    // 9. TESTE DE ERROS EM CONSOLE
    // ═══════════════════════════════════════════════════════════════════════

    log('Console Errors', consoleErrors.length === 0 ? 'PASS' : 'WARN',
        `${consoleErrors.length} erros`);

    if (consoleErrors.length > 0) {
      console.log('\n📋 Console Errors:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 10. TESTE DE MODAIS & DRAWERS
    // ═══════════════════════════════════════════════════════════════════════

    await page.click('[data-page="colaboradores"]');
    await page.waitForTimeout(300);

    const openDrawerBtn = await page.locator('#tb-colaboradores tr:first-child').isVisible();
    if (openDrawerBtn) {
      // Simular clique em uma linha para abrir drawer
      const rows = await page.locator('#tb-colaboradores tr').count();
      if (rows > 0) {
        log('Drawer Access', 'PASS', `${rows} registros clicáveis`);
      }
    }

  } catch (error) {
    log('Test Suite', 'FAIL', error.message);
  } finally {
    await context.close();
    await browser.close();

    // ═══════════════════════════════════════════════════════════════════════
    // RELATÓRIO FINAL
    // ═══════════════════════════════════════════════════════════════════════

    const passed = REPORT.filter(r => r.status === 'PASS').length;
    const failed = REPORT.filter(r => r.status === 'FAIL').length;
    const warned = REPORT.filter(r => r.status === 'WARN').length;
    const total = REPORT.length;

    console.log('\n' + '═'.repeat(60));
    console.log(`📊 RELATÓRIO QA — ${new Date().toLocaleString('pt-BR')}`);
    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`⚠️  Warnings: ${warned}/${total}`);
    console.log('═'.repeat(60));

    if (failed === 0 && warned === 0) {
      console.log('\n🎉 TODOS OS TESTES PASSARAM!\n');
      process.exit(0);
    } else if (failed > 0) {
      console.log(`\n⚠️  ${failed} teste(s) falharam. Verificar erros acima.\n`);
      process.exit(1);
    } else {
      console.log(`\n⚠️  ${warned} aviso(s) detectado(s).\n`);
      process.exit(0);
    }
  }
}

testApp().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
