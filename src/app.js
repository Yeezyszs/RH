// App Orchestrator
// Imports all modules, injects dependencies, and exposes globals for index.html

import { h, iniciais, fmtDate, fmtBRL, addDays, tempoCasa, diasAte, mesChave, mesLabel } from './utils/formatting.js';
import { CHART_COLORS, STATUS_LABEL, VENC_CAT_BADGE, ADV_TIPO_BADGE, ADV_STATUS_BADGE, SETOR_ICON } from './constants.js';

import { ColaboradoresModule }    from './modules/colaboradores.js';
import { AdvertenciasModule }     from './modules/advertencias.js';
import { FeriasModule }           from './modules/ferias.js';
import { DesligamentosModule }    from './modules/desligamentos.js';
import { CronogramaModule }       from './modules/cronograma.js';
import { VencimentosModule }      from './modules/vencimentos.js';
import { EpiModule }              from './modules/epi.js';
import { RotatividadeModule }     from './modules/rotatividade.js';
import { SalariosModule }         from './modules/salarios.js';
import { ValeCombustivelModule }  from './modules/vale-combustivel.js';
import { ValeAlimentacaoModule }  from './modules/vale-alimentacao.js';
import { FeedbackClimaModule }    from './modules/feedback.js';
import { PlanoCarreirasModule }   from './modules/plano-carreiras.js';

// faixaIdx depends on FAIXAS which lives in index.html — read from window
function faixaIdx(valor) {
  const FAIXAS = window.FAIXAS || [];
  for (let i = 0; i < FAIXAS.length; i++) {
    if (valor >= FAIXAS[i].min && valor < FAIXAS[i].max) return i;
  }
  return Math.max(0, FAIXAS.length - 1);
}

// ─── Bootstrap ──────────────────────────────────────────────────────────────
function bootstrap() {
  const $ = (sel) => document.querySelector(sel);

  // showToast lives in index.html — bridge to window
  const showToast = (...args) => window.showToast?.(...args);

  // Expose utilities to window so inline HTML event handlers can call them
  window.h         = h;
  window.iniciais  = iniciais;
  window.fmtDate   = fmtDate;
  window.fmtBRL    = fmtBRL;
  window.addDays   = addDays;
  window.tempoCasa = tempoCasa;
  window.diasAte   = diasAte;
  window.mesChave  = mesChave;
  window.mesLabel  = mesLabel;
  window.faixaIdx  = faixaIdx;

  // Shared data arrays — defined as globals in index.html
  const COLABORADORES    = window.COLABORADORES;
  const ADVERTENCIAS     = window.ADVERTENCIAS;
  const FERIAS           = window.FERIAS;
  const DESLIGAMENTOS    = window.DESLIGAMENTOS;
  const EVENTOS          = window.EVENTOS;
  const VENCIMENTOS      = window.VENCIMENTOS;
  const EPI_CATALOGO     = window.EPI_CATALOGO;
  const EPI_ENTREGAS     = window.EPI_ENTREGAS;
  const EPI_KITS         = window.EPI_KITS;
  const SALARIOS         = window.SALARIOS;
  const FAIXAS           = window.FAIXAS;
const VALE_LANCAMENTOS = window.VALE_LANCAMENTOS;
  const VALE_COTAS       = window.VALE_COTAS;
  const VA_BENEFICIOS    = window.VA_BENEFICIOS;
  const FEEDBACK         = window.FEEDBACK;
  const CLIMA            = window.CLIMA;
  const PC_CARGOS        = window.PC_CARGOS;
  const PC_PLANOS        = window.PC_PLANOS;

  // ─── Instanciar módulos ─────────────────────────────────────────────────────

  const DEPENDENTES    = window.DEPENDENTES;
  const CONTATOS_EMERG = window.CONTATOS_EMERG;

  const colaboradores = new ColaboradoresModule({
    $, h, iniciais, fmtDate, fmtBRL, tempoCasa, showToast,
    COLABORADORES, DEPENDENTES, CONTATOS_EMERG,
    EPI_ENTREGAS, VENCIMENTOS,
    STATUS_LABEL, SETOR_ICON,
    Colaboradores: window.Colaboradores,
    Departamentos: window.Departamentos,
    HistoricoColaboradores: window.HistoricoColaboradores,
    Auth: window.Auth,
  });

  const advertencias = new AdvertenciasModule({
    $, h, iniciais, fmtDate,
    ADVERTENCIAS, COLABORADORES, ADV_TIPO_BADGE, ADV_STATUS_BADGE, CHART_COLORS,
    Auth: window.Auth, Advertencias: window.Advertencias,
  });

  const ferias = new FeriasModule({
    $, h, iniciais, fmtDate, fmtBRL,
    FERIAS, COLABORADORES, SALARIOS,
    Auth: window.Auth, Ferias: window.Ferias,
    Colaboradores: window.Colaboradores,
  });

  const desligamentos = new DesligamentosModule({
    $, h, iniciais, fmtDate,
    DESLIGAMENTOS, COLABORADORES,
    Auth: window.Auth, Desligamentos: window.Desligamentos,
  });

  const cronograma = new CronogramaModule({
    $, h, addDays, EVENTOS,
    Auth: window.Auth, Cronograma: window.Cronograma,
  });

  const vencimentos = new VencimentosModule({
    $, h, iniciais, fmtDate,
    VENCIMENTOS, COLABORADORES, CHART_COLORS,
    Auth: window.Auth, Vencimentos: window.Vencimentos,
  });

  const epi = new EpiModule({
    $, h, iniciais, fmtDate, diasAte,
    EPI_CATALOGO, EPI_ENTREGAS, EPI_KITS, COLABORADORES, SETOR_ICON,
    Auth: window.Auth, Epis: window.Epis,
  });

  const rotatividade = new RotatividadeModule({
    $, h, iniciais, fmtDate, faixaIdx,
    COLABORADORES, DESLIGAMENTOS, SALARIOS, CHART_COLORS,
  });

  const salarios = new SalariosModule({
    $, h, iniciais, fmtDate, fmtBRL, faixaIdx,
    COLABORADORES, SALARIOS, FAIXAS, CHART_COLORS,
    Auth: window.Auth, Salarios: window.Salarios,
  });

  const valeCombustivel = new ValeCombustivelModule({
    $, h, iniciais, fmtDate, fmtBRL, mesChave, mesLabel,
    COLABORADORES, VALE_LANCAMENTOS, VALE_COTAS, CHART_COLORS,
    Auth: window.Auth, ValeCombustivel: window.ValeCombustivel, showToast,
  });

  const valeAlimentacao = new ValeAlimentacaoModule({
    $, h, iniciais, fmtDate, fmtBRL, mesLabel,
    COLABORADORES, VA_BENEFICIOS, CHART_COLORS, showToast,
  });

  const feedbackClima = new FeedbackClimaModule({
    $, h, iniciais, fmtDate,
    COLABORADORES, FEEDBACK, CLIMA, CHART_COLORS,
    Auth: window.Auth, FeedbackClima: window.FeedbackClima,
    RespostasPesquisa: window.RespostasPesquisa, showToast,
  });

  const planoCarreiras = new PlanoCarreirasModule({
    $, h, iniciais, fmtDate, fmtBRL, tempoCasa,
    COLABORADORES, SALARIOS, PC_CARGOS, PC_PLANOS,
    Auth: window.Auth, PlanoCarreiras: window.PlanoCarreiras, showToast,
  });

  // ─── Expor globais para onclick inline no index.html ────────────────────────

  // Colaboradores
  window.colabIrPagina              = (p)    => colaboradores.irPagina(p);
  window.renderColaboradores        = ()     => colaboradores.render();
  window.abrirDrawerColab           = (id)   => colaboradores.abrirDrawerColab(id);
  window.fecharDrawerColab          = ()     => colaboradores.fecharDrawerColab();
  window.editarColaboradorDoDrawer  = ()     => colaboradores.editarColaboradorDoDrawer();
  window.abrirModalColaborador      = (id)   => colaboradores.abrirModalColaborador(id);
  window.fecharModalColaborador     = ()     => colaboradores.fecharModalColaborador();
  window.salvarColaborador          = (ev)   => colaboradores.salvarColaborador(ev);
  window.excluirColaborador         = (id)   => colaboradores.excluirColaborador(id);
  window.renderDepsModal            = ()     => colaboradores.renderDepsModal();
  window.adicionarDepModal          = ()     => colaboradores.adicionarDepModal();
  window.removerDepModal            = (s)    => colaboradores.removerDepModal(s);
  window.renderEmergsModal          = ()     => colaboradores.renderEmergsModal();
  window.adicionarEmergModal        = ()     => colaboradores.adicionarEmergModal();
  window.removerEmergModal          = (s)    => colaboradores.removerEmergModal(s);
  window.renderContatosEmergencia   = (id)   => colaboradores.renderContatosEmergencia(id);
  window.abrirModalContato          = (id)   => colaboradores.abrirModalContato(id);
  window.fecharModalContato         = ()     => colaboradores.fecharModalContato();
  window.salvarContato              = (ev)   => colaboradores.salvarContato(ev);
  window.excluirContato             = (id)   => colaboradores.excluirContato(id);
  window.exportColaboradores        = ()     => colaboradores.exportColaboradores();
  window.renderQuadro               = ()     => colaboradores.renderQuadro();
  window.popularFiltroSetores       = ()     => colaboradores.popularFiltroSetores();
  window._depUpdate                 = (s, k, v) => colaboradores._depUpdate(s, k, v);
  window._emergUpdate               = (s, k, v) => colaboradores._emergUpdate(s, k, v);

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

  // Férias
  window.renderFerias             = ()     => ferias.render();
  window.abrirModalFerias         = (id)   => ferias.abrirModalFerias(id);
  window.fecharModalFerias        = ()     => ferias.fecharModalFerias();
  window.renderFeriasModal        = ()     => ferias.renderFeriasModal();
  window.calcDiasFerias           = ()     => ferias.calcDiasFerias();
  window.salvarFeriasPeriodo      = (ev)   => ferias.salvarFeriasPeriodo(ev);
  window.excluirFerias            = (id)   => ferias.excluirFerias(id);

  // Desligamentos
  window.abrirDrawerDesl               = (id)  => desligamentos.abrirDrawer(id);
  window.fecharDrawerDesl              = ()     => desligamentos.fecharDrawer();
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
  window.navCalendar              = (d)         => cronograma.navCalendar(d);
  window.abrirModalEvento         = (id, data)  => cronograma.abrirModalEvento(id, data);
  window.fecharModalEvento        = ()          => cronograma.fecharModalEvento();
  window.salvarEvento             = (ev)        => cronograma.salvarEvento(ev);
  window.excluirEventoAtual       = ()          => cronograma.excluirEventoAtual();
  window.renderCronograma         = ()          => cronograma.render();

  // Vencimentos
  window.setFiltroVenc            = (st)  => vencimentos.setFiltroStatus(st);
  window.setVencStatus            = (st)  => vencimentos.setFiltroStatus(st);
  window.abrirModalVencimento     = (id)  => vencimentos.abrirModalVencimento(id);
  window.fecharModalVencimento    = ()    => vencimentos.fecharModalVencimento();
  window.salvarVencimento         = async (ev) => { await vencimentos.salvarVencimento(ev); window.atualizarBadgeVencimentos?.(); };
  window.renovarVencimento        = (id)  => vencimentos.renovarVencimento(id);
  window.excluirVencimento        = async (id) => { await vencimentos.excluirVencimento(id); window.atualizarBadgeVencimentos?.(); };
  window.renderVencimentos        = ()    => vencimentos.render();

  // EPI
  window.abrirModalEpiEntrega     = (id, colabId) => epi.abrirModalEntrega(id, colabId);
  window.fecharModalEpiEntrega    = ()    => epi.fecharModalEntrega();
  window.salvarEpiEntrega         = (ev)  => epi.salvarEntrega(ev);
  window.devolverEpi              = (id)  => epi.devolver(id);
  window.excluirEpi               = (id)  => epi.excluirEntrega(id);
  window.editarEpiCatalogo        = (id)  => epi.editarCatalogo(id);
  window.resetEpiCatalogoForm     = ()    => epi.resetCatalogoForm();
  window.salvarEpiCatalogo        = (ev)  => epi.salvarCatalogo(ev);
  window.excluirEpiCatalogo       = (id)  => epi.excluirCatalogo(id);
  window.abrirModalEpiKit         = (s)   => epi.abrirModalKit(s);
  window.fecharModalEpiKit        = ()    => epi.fecharModalKit();
  window.salvarEpiKit             = ()    => epi.salvarKit();
  window.renderEpi                = ()    => epi.render();
  window.renderEpiCatalogo        = ()    => epi.renderCatalogo();
  window.renderEpiKits            = ()    => epi.renderKits();

  // Rotatividade
  window.limparFiltrosRotatividade= ()    => rotatividade.limparFiltros();
  window.renderRotatividade       = ()    => rotatividade.render();

  // Salários
  window.abrirModalSalario        = (id)  => salarios.abrirModal(id);
  window.fecharModalSalario       = ()    => salarios.fecharModal();
  window.salvarSalario            = (ev)  => salarios.salvar(ev);
  window.exportSalarios           = ()    => salarios.exportSalarios();
  window.renderSalarios           = ()    => salarios.render();

  // Vale Combustível
  window.renderVale                = ()           => valeCombustivel.render();
  window.abrirModalValeLancamento  = (id, cId)    => valeCombustivel.abrirModalLancamento(id, cId);
  window.fecharModalValeLancamento = ()           => valeCombustivel.fecharModalLancamento();
  window.salvarValeLancamento      = (ev)         => valeCombustivel.salvarLancamento(ev);
  window.excluirValeLancamento     = (id)         => valeCombustivel.excluirLancamento(id);
  window.abrirModalValeDetalhe     = (cId, mes)   => valeCombustivel.abrirModalDetalhe(cId, mes);
  window.fecharModalValeDetalhe    = ()           => valeCombustivel.fecharModalDetalhe();
  window.abrirModalCotas           = ()           => valeCombustivel.abrirModalCotas();
  window.fecharModalCotas          = ()           => valeCombustivel.fecharModalCotas();

  // Vale Alimentação
  window.renderValeAlimentacao          = ()     => valeAlimentacao.render();
  window.abrirModalValeAlimentacao      = (cId)  => valeAlimentacao.abrirModal(cId);
  window.fecharModalValeAlimentacao     = ()     => valeAlimentacao.fecharModal();
  window.salvarValeAlimentacao          = (ev)   => valeAlimentacao.salvar(ev);
  window.removerValeAlimentacao         = ()     => valeAlimentacao.remover();
  window.preencherValeAlimentacaoExistente = ()  => valeAlimentacao.preencherExistente();
  window.alternarValeAlimentacaoTipo    = ()     => valeAlimentacao.alternarTipo();

  // Feedback & Clima
  window.renderFeedback               = ()    => feedbackClima.renderFeedback();
  window.abrirModalFeedback           = (id)  => feedbackClima.abrirModalFeedback(id);
  window.fecharModalFeedback          = ()    => feedbackClima.fecharModalFeedback();
  window.salvarFeedback               = (ev)  => feedbackClima.salvarFeedback(ev);
  window.excluirFeedback              = (id)  => feedbackClima.excluirFeedback(id);
  window.renderClima                  = ()    => feedbackClima.renderClima();
  window.abrirModalClima              = (id)  => feedbackClima.abrirModalClima(id);
  window.fecharModalClima             = ()    => feedbackClima.fecharModalClima();
  window.salvarClima                  = (ev)  => feedbackClima.salvarClima(ev);
  window.excluirClima                 = (id)  => feedbackClima.excluirClima(id);
  window.abrirModalRespostasPesquisa  = (id)  => feedbackClima.abrirModalRespostasPesquisa(id);
  window.fecharModalRespostasPesquisa = ()    => feedbackClima.fecharModalRespostasPesquisa();

  // Plano de Carreiras
  window.renderPlanoCarreiras    = ()    => planoCarreiras.render();
  window.abrirModalPcCargo       = (id)  => planoCarreiras.abrirModalCargo(id);
  window.fecharModalPcCargo      = ()    => planoCarreiras.fecharModalCargo();
  window.salvarPcCargo           = (ev)  => planoCarreiras.salvarCargo(ev);
  window.excluirPcCargoAtual     = ()    => planoCarreiras.excluirCargoAtual();
  window.abrirModalPcPlano       = (id)  => planoCarreiras.abrirModalPlano(id);
  window.fecharModalPcPlano      = ()    => planoCarreiras.fecharModalPlano();
  window.salvarPcPlano           = (ev)  => planoCarreiras.salvarPlano(ev);
  window.excluirPcPlanoAtual     = ()    => planoCarreiras.excluirPlanoAtual();

  return {
    colaboradores, advertencias, ferias, desligamentos,
    cronograma, vencimentos, epi, rotatividade, salarios,
    valeCombustivel, valeAlimentacao, feedbackClima, planoCarreiras,
  };
}

// Auto-inicializa após DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

export { bootstrap };
