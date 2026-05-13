// App Orchestrator
// Importa todos os módulos, injeta dependências e expõe globais para o index.html

import { ColaboradoresModule }  from './modules/colaboradores.js';
import { AdvertenciasModule }   from './modules/advertencias.js';
import { FeriasModule }         from './modules/ferias.js';
import { DesligamentosModule }  from './modules/desligamentos.js';
import { CronogramaModule }     from './modules/cronograma.js';
import { VencimentosModule }    from './modules/vencimentos.js';
import { EpiModule }            from './modules/epi.js';
import { RotatividadeModule }   from './modules/rotatividade.js';
import { SalariosModule }       from './modules/salarios.js';

// ─── Bootstrap ─────────────────────────────────────────────────────────────────────────────
// Chamado pelo index.html após os dados mock serem definidos.
// Exemplo:  <script type="module" src="src/app.js"></script>
// O index.html precisa expor os dados em window.APP_DATA antes deste script
// rodar, ou este módulo pode ler as variáveis inline após DOMContentLoaded.

function bootstrap() {
  const $ = (sel) => document.querySelector(sel);

  // Helpers compartilhados (definidos inline no index.html — lidos via window)
  const h         = window.h;
  const iniciais  = window.iniciais;
  const fmtDate   = window.fmtDate;
  const fmtBRL    = window.fmtBRL;
  const addDays   = window.addDays;
  const tempoCasa = window.tempoCasa;
  const diasAte   = window.diasAte;
  const faixaIdx  = window.faixaIdx;

  // Dados compartilhados
  const COLABORADORES   = window.COLABORADORES;
  const ADVERTENCIAS    = window.ADVERTENCIAS;
  const FERIAS          = window.FERIAS;
  const DESLIGAMENTOS   = window.DESLIGAMENTOS;
  const EVENTOS         = window.EVENTOS;
  const VENCIMENTOS     = window.VENCIMENTOS;
  const EPI_CATALOGO    = window.EPI_CATALOGO;
  const EPI_ENTREGAS    = window.EPI_ENTREGAS;
  const EPI_KITS        = window.EPI_KITS;
  const SALARIOS        = window.SALARIOS;
  const FAIXAS          = window.FAIXAS;
  const ROT_MOCK        = window.ROT_MOCK;
  const SETOR_ICON      = window.SETOR_ICON;
  const CHART_COLORS    = window.CHART_COLORS;
  const ADV_TIPO_BADGE  = window.ADV_TIPO_BADGE;
  const ADV_STATUS_BADGE = window.ADV_STATUS_BADGE;
  const STATUS_LABEL    = window.STATUS_LABEL;

  // ─── Instanciar módulos ────────────────────────────────────────────────────────────────────────

  const colaboradores = new ColaboradoresModule({
    $, h, iniciais, fmtDate, tempoCasa,
    COLABORADORES, STATUS_LABEL,
    Colaboradores: window.Colaboradores,
    Departamentos: window.Departamentos,
    Auth: window.Auth,
  });

  const advertencias = new AdvertenciasModule({
    $, h, iniciais, fmtDate,
    ADVERTENCIAS, COLABORADORES, ADV_TIPO_BADGE, ADV_STATUS_BADGE, CHART_COLORS,
  });

  const ferias = new FeriasModule({
    $, h, iniciais, fmtDate, fmtBRL,
    FERIAS, COLABORADORES, SALARIOS: window.SALARIOS,
  });

  const desligamentos = new DesligamentosModule({
    $, h, iniciais, fmtDate,
    DESLIGAMENTOS, COLABORADORES,
  });

  const cronograma = new CronogramaModule({
    $, h, addDays, EVENTOS,
  });

  const vencimentos = new VencimentosModule({
    $, h, iniciais, fmtDate,
    VENCIMENTOS, COLABORADORES, CHART_COLORS,
  });

  const epi = new EpiModule({
    $, h, iniciais, fmtDate, diasAte,
    EPI_CATALOGO, EPI_ENTREGAS, EPI_KITS, COLABORADORES, SETOR_ICON,
  });

  const rotatividade = new RotatividadeModule({
    $, h, iniciais, fmtDate, faixaIdx,
    COLABORADORES, SALARIOS, CHART_COLORS, ROT_MOCK,
  });

  const salarios = new SalariosModule({
    $, h, iniciais, fmtDate, fmtBRL, faixaIdx,
    COLABORADORES, SALARIOS, FAIXAS, CHART_COLORS,
  });

  // ─── Expor globais para onclick inline no index.html ────────────────────────────

  // Colaboradores
  window.colabIrPagina            = (p)    => colaboradores.irPagina(p);
  window.renderColaboradores      = ()     => colaboradores.render();

  // Advertências
  window.abrirDrawerAdv           = (id)   => advertencias.abrirDrawer(id);
  window.fecharDrawerAdv          = ()     => advertencias.fecharDrawer();
  window.marcarAssinadaDoDrawer   = ()     => advertencias.marcarAssinada();
  window.abrirModalAdvertencia    = (id)   => advertencias.abrirModal(id);
  window.fecharModalAdvertencia   = ()     => advertencias.fecharModal();
  window.salvarAdvertencia        = (ev)   => advertencias.salvar(ev);
  window.excluirAdvertencia       = (id)   => advertencias.excluir(id);
  window.mostrarAlertaReincidencia= ()     => advertencias.mostrarAlertaReincidencia();
  window.renderAdvertencias       = ()     => advertencias.render();

  // Férias (modal gerenciado pelo index.html; módulo só faz render da tabela/timeline)
  window.renderFerias             = ()     => ferias.render();

  // Desligamentos
  window.abrirDrawerDesl          = (id)   => desligamentos.abrirDrawer(id);
  window.fecharDrawerDesl         = ()     => desligamentos.fecharDrawer();
  window.abrirModalDesligamento        = (id)   => desligamentos.abrirModalDesligamento(id);
  window.fecharModalDesligamento       = ()     => desligamentos.fecharModalDesligamento();
  window.salvarDesligamento            = (ev)   => desligamentos.salvarDesligamento(ev);
  window.excluirDesligamento           = (id)   => desligamentos.excluirDesligamento(id);
  window.abrirModalEntrevista          = (id)   => desligamentos.abrirModalEntrevista(id);
  window.fecharModalEntrevista         = ()     => desligamentos.fecharModalEntrevista();
  window.salvarEntrevista              = (ev)   => desligamentos.salvarEntrevista(ev);
  window.abrirModalEntrevistaDoDrawer  = ()     => desligamentos.abrirModalEntrevistaDoDrawer();
  window.renderDesligamentos           = ()     => desligamentos.render();

  // Cronograma
  window.navCalendar              = (d)    => cronograma.navCalendar(d);
  window.abrirModalEvento         = (id, data) => cronograma.abrirModalEvento(id, data);
  window.fecharModalEvento        = ()     => cronograma.fecharModalEvento();
  window.salvarEvento             = (ev)   => cronograma.salvarEvento(ev);
  window.excluirEventoAtual       = ()     => cronograma.excluirEventoAtual();
  window.renderCronograma         = ()     => cronograma.render();

  // Vencimentos
  window.setFiltroVenc            = (st)   => vencimentos.setFiltroStatus(st);
  window.setVencStatus            = (st)   => vencimentos.setFiltroStatus(st);
  window.abrirModalVencimento     = (id)   => vencimentos.abrirModalVencimento(id);
  window.fecharModalVencimento    = ()     => vencimentos.fecharModalVencimento();
  window.salvarVencimento         = (ev)   => vencimentos.salvarVencimento(ev);
  window.renovarVencimento        = (id)   => vencimentos.renovarVencimento(id);
  window.excluirVencimento        = (id)   => vencimentos.excluirVencimento(id);
  window.renderVencimentos        = ()     => vencimentos.render();

  // EPI
  window.abrirModalEpiEntrega     = (id, colabId) => epi.abrirModalEntrega(id, colabId);
  window.fecharModalEpiEntrega    = ()     => epi.fecharModalEntrega();
  window.salvarEpiEntrega         = (ev)   => epi.salvarEntrega(ev);
  window.devolverEpi              = (id)   => epi.devolver(id);
  window.excluirEpi               = (id)   => epi.excluirEntrega(id);
  window.editarEpiCatalogo        = (id)   => epi.editarCatalogo(id);
  window.resetEpiCatalogoForm     = ()     => epi.resetCatalogoForm();
  window.salvarEpiCatalogo        = (ev)   => epi.salvarCatalogo(ev);
  window.excluirEpiCatalogo       = (id)   => epi.excluirCatalogo(id);
  window.abrirModalEpiKit         = (s)    => epi.abrirModalKit(s);
  window.fecharModalEpiKit        = ()     => epi.fecharModalKit();
  window.salvarEpiKit             = ()     => epi.salvarKit();
  window.renderEpi                = ()     => epi.render();
  window.renderEpiCatalogo        = ()     => epi.renderCatalogo();
  window.renderEpiKits            = ()     => epi.renderKits();

  // Rotatividade
  window.limparFiltrosRotatividade= ()     => rotatividade.limparFiltros();
  window.renderRotatividade       = ()     => rotatividade.render();

  // Salários
  window.abrirModalSalario        = (id)   => salarios.abrirModal(id);
  window.fecharModalSalario       = ()     => salarios.fecharModal();
  window.salvarSalario            = (ev)   => salarios.salvar(ev);
  window.renderSalarios           = ()     => salarios.render();

  return {
    colaboradores, advertencias, ferias, desligamentos,
    cronograma, vencimentos, epi, rotatividade, salarios,
  };
}

// Auto-inicializa após DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

export { bootstrap };
