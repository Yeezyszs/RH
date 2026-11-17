// Importação do relatório de crédito de um benefício.
//
// Serve aos dois vales. O que muda entre eles é o leitor do arquivo — cada
// operadora emite num layout — e para onde o valor vai. O resto é igual:
// conferir contra o total do relatório, cruzar com o cadastro, mostrar o que
// não casou e só gravar depois que o operador confirma. Essa parte está aqui
// uma vez só; um segundo importador copiado seria a mesma conferência em dois
// lugares, com as correções chegando a um deles.
//
// O RH recebe da operadora, a cada crédito, um PDF "Produto de Carga" com o
// valor de cada beneficiário. Antes disto a competência era digitada à mão,
// linha por linha — dezenas de campos por mês, sem nenhuma conferência contra
// o total da nota. Aqui o PDF entra inteiro: o sistema lê, cruza com o
// cadastro, mostra o que casou e o que não casou, e só grava depois que o
// operador confere.
//
// A leitura e o cruzamento moram em utils/relatorio-vale.js (sem DOM, sem
// rede, testados à parte). Este módulo é a tela: arquivo, conferência, gravação.

import {
  lerRelatorioVale, conciliarRelatorio, linhasDeItens, soDigitos, arredondar,
} from '../utils/relatorio-vale.js?v=dev';
import { competenciaAtual } from '../utils/ui.js?v=dev';

// pdf.js sai do mesmo CDN que o Chart.js e o supabase-js. É carregado só quando
// o modal abre: são ~350 kB que não fazem falta em nenhuma outra tela.
const PDFJS_VERSAO = '4.10.38';
const PDFJS_BASE   = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSAO}`;

/**
 * O que distingue um benefício do outro nesta tela.
 *
 * `prefixo` nomeia os elementos do modal (`<prefixo>-file`, `-drop`,
 * `-competencia`, `-modo`, `-resultado`, `-forcar`), e daí saem também o id
 * do modal e o do botão de confirmar.
 */
export const BENEFICIO_COMBUSTIVEL = {
  chave: 'combustivel',
  prefixo: 'vale-imp',
  modal: 'modal-vale-import',
  botao: 'btn-vale-imp-confirmar',
  rotulo: 'vale combustível',
  chaveIgnorados: 'vale_importacao_ignorados',
};

export class ValeImportacaoModule {
  constructor(deps) {
    this.$        = deps.$;
    this.h        = deps.h;
    this.fmtBRL   = deps.fmtBRL;
    this.mesLabel = deps.mesLabel;
    // O benefício que esta instância importa. Sem ele, combustível — que era
    // o único quando esta tela nasceu.
    this.b = deps.beneficio || BENEFICIO_COMBUSTIVEL;
    this.ler = deps.ler || lerRelatorioVale;
    // Como o valor conciliado vira linha gravada. Fica fora daqui porque cada
    // benefício tem a sua tabela e o seu espelho em memória.
    this.gravar = deps.gravar || ((dados) => this._gravarCombustivel(dados));
    this.COLABORADORES  = deps.COLABORADORES;
    this.VALE_COTAS     = deps.VALE_COTAS;
    this.VALE_COTAS_MES = deps.VALE_COTAS_MES;
    this.VALE_USO_MES   = deps.VALE_USO_MES;
    this.VALE_SALDO_INI = deps.VALE_SALDO_INI;
    this.CONFIG         = deps.CONFIG || {};
    this.Auth              = deps.Auth;
    this.ValeCombustivel   = deps.ValeCombustivel;
    this.Configuracoes     = deps.Configuracoes;
    this.showToast         = deps.showToast;
    this.aoImportar        = deps.aoImportar || (() => {});
    // Injetável para os testes — em produção baixa o pdf.js do CDN.
    this.carregarPdfJs     = deps.carregarPdfJs || (() => this._pdfjsDoCdn());

    this._relatorio = null;
    this._vinculos  = {};   // cpf → id escolhido à mão
    this._marcados  = {};   // cpf → true quando "ignorar sempre" está marcado
    this._forcar    = false; // liberação manual quando a soma não bate com a nota
    this._ocupado   = false;

    this._ligarEventos();
  }

  _ligarEventos() {
    document.addEventListener('change', (e) => {
      if (e.target.id === `${this.b.prefixo}-file`) this.lerArquivo(e.target.files?.[0]);
      if (e.target.id === `${this.b.prefixo}-competencia` || e.target.id === `${this.b.prefixo}-modo`) this._renderPreview();
      if (e.target.dataset?.vinculo) {
        this._vinculos[e.target.dataset.vinculo] = e.target.value ? Number(e.target.value) : undefined;
        if (!e.target.value) delete this._vinculos[e.target.dataset.vinculo];
        this._renderPreview();
      }
      if (e.target.dataset?.ignorar) {
        this._marcados[e.target.dataset.ignorar] = e.target.checked;
      }
      if (e.target.id === `${this.b.prefixo}-forcar`) {
        this._forcar = e.target.checked;
        this._renderPreview();
      }
    });

    const zona = () => this.$(`#${this.b.prefixo}-drop`);
    ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, (e) => {
      if (!zona()?.contains(e.target)) return;
      e.preventDefault();
      zona().classList.add('dragging');
    }));
    ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, (e) => {
      if (!zona()?.contains(e.target)) return;
      e.preventDefault();
      zona().classList.remove('dragging');
      if (ev === 'drop') this.lerArquivo(e.dataTransfer?.files?.[0]);
    }));
  }

  // ─── Modal ──────────────────────────────────────────────────────────────────

  abrirModal() {
    this._relatorio = null;
    this._vinculos  = {};
    this._marcados  = {};
    this._forcar    = false;
    const file = this.$(`#${this.b.prefixo}-file`);
    if (file) file.value = '';
    const res = this.$(`#${this.b.prefixo}-resultado`);
    if (res) res.innerHTML = '';
    this._habilitarConfirmar(false);
    this.$(`#${this.b.modal}`)?.classList.add('active');
  }

  fecharModal() {
    this.$(`#${this.b.modal}`)?.classList.remove('active');
  }

  escolherArquivo() {
    this.$(`#${this.b.prefixo}-file`)?.click();
  }

  // ─── Leitura do PDF ─────────────────────────────────────────────────────────

  async _pdfjsDoCdn() {
    if (this._pdfjs) return this._pdfjs;
    const lib = await import(/* webpackIgnore: true */ `${PDFJS_BASE}/build/pdf.min.mjs`);
    lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/build/pdf.worker.min.mjs`;
    this._pdfjs = lib;
    return lib;
  }

  /** Texto do PDF, linha a linha, na ordem em que aparece impresso. */
  async _linhasDoPdf(arquivo) {
    const pdfjs = await this.carregarPdfJs();
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const doc   = await pdfjs.getDocument({ data: bytes }).promise;
    const linhas = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pagina = await doc.getPage(p);
      linhas.push(...linhasDeItens((await pagina.getTextContent()).items));
    }
    return linhas;
  }

  async lerArquivo(arquivo) {
    if (!arquivo) return;
    if (!/\.pdf$/i.test(arquivo.name) && arquivo.type !== 'application/pdf') {
      this.showToast('O relatório precisa ser um PDF', 'err');
      return;
    }

    this._estado(`<div class="empty">Lendo ${this.h(arquivo.name)}…</div>`);
    this._habilitarConfirmar(false);

    try {
      const linhas = await this._linhasDoPdf(arquivo);
      this._relatorio = this.ler(linhas);
      this._relatorio.arquivo = arquivo.name;
      this._vinculos = {};
      this._marcados = {};
      this._forcar   = false;
      this._preencherCompetencia(this._relatorio.competencia);
      this._renderPreview();
    } catch (err) {
      this._relatorio = null;
      this._estado(`<div class="alerta-erro">Não foi possível ler o PDF.<br><small>${this.h(err.message)}</small></div>`);
    }
  }

  _estado(html) {
    const el = this.$(`#${this.b.prefixo}-resultado`);
    if (el) el.innerHTML = html;
  }

  _habilitarConfirmar(pode) {
    const btn = this.$(`#${this.b.botao}`);
    if (btn) btn.disabled = !pode;
  }

  // A competência vem da emissão do relatório, mas fica editável: nota avulsa
  // emitida no começo do mês seguinte é caso real, e só quem opera sabe.
  _preencherCompetencia(mes) {
    const el = this.$(`#${this.b.prefixo}-competencia`);
    if (el) el.value = mes || competenciaAtual();
  }

  // ─── Conferência ────────────────────────────────────────────────────────────

  _ignoradosSalvos() {
    try {
      const bruto = JSON.parse(this.CONFIG[this.b.chaveIgnorados] || '[]');
      return Array.isArray(bruto) ? bruto.map(soDigitos).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  _conciliacao() {
    if (!this._relatorio) return null;
    return conciliarRelatorio(this._relatorio, this.COLABORADORES, {
      ignorados: this._ignoradosSalvos(),
      vinculos:  this._vinculos,
    });
  }

  /**
   * A conta aberta: total do relatório = importado + o que fica de fora.
   *
   * Sem esta linha o modal mostra dois números grandes e diferentes — o total
   * de crédito da nota e o que vai ser gravado — sem dizer que a diferença é
   * justamente quem não entra. Depois de importado, a tela do vale passa a
   * mostrar o segundo número, e a diferença para a nota vira dúvida.
   */
  _contaAberta(r, c) {
    const parcelas = [
      [c.somaCasados,     `${c.casados.length} importado(s)`],
      [c.somaSemCadastro, `${c.semCadastro.length} sem cadastro`],
      [c.somaIgnorados,   `${c.ignorados.length} ignorado(s)`],
    ].filter(([v]) => v > 0);

    if (parcelas.length <= 1) return '';

    return `
      <div class="conta-aberta">
        <strong>${this.fmtBRL(r.soma)}</strong> no relatório
        = ${parcelas.map(([v, rot]) => `<strong>${this.fmtBRL(v)}</strong> <span>(${rot})</span>`).join(' + ')}
      </div>`;
  }

  _renderPreview() {
    const r = this._relatorio;
    if (!r) return;
    const c = this._conciliacao();
    const mes  = this.$(`#${this.b.prefixo}-competencia`)?.value || r.competencia;
    const modo = this.$(`#${this.b.prefixo}-modo`)?.value || 'substituir';

    const linhaConf = (rot, val, cor = '') =>
      `<div class="info-item"><div class="info-label">${rot}</div>
       <div class="info-value mono" ${cor ? `style="color:${cor};font-weight:700"` : ''}>${val}</div></div>`;

    // Duas conferências diferentes, e as duas travam a gravação.
    //
    // A primeira é interna: cada beneficiário lido tem que estar em algum
    // balde (importado, sem cadastro ou ignorado).
    const naoImportado = arredondar(c.somaIgnorados + c.somaSemCadastro);
    const fecha = arredondar(c.somaCasados + naoImportado) === arredondar(r.soma);

    // A segunda é contra a nota: a soma dos beneficiários lidos tem que dar o
    // "Total de crédito" do relatório. É a que pega leitura incompleta — se o
    // leitor perder uma linha, a competência entra faltando gente e ninguém
    // percebe. Só que há relatório com diferença conhecida, então em vez de
    // proibir de vez a gravação fica atrás de um "importar mesmo assim".
    const bateComANota = r.totalCredito == null
      || arredondar(r.totalCredito) === arredondar(r.soma);

    const avisos = [...r.problemas];
    if (!fecha) {
      avisos.push('A conferência interna não fechou — não importe sem conferir o PDF.');
    }
    if (c.semCadastro.length) {
      avisos.push(`${c.semCadastro.length} beneficiário(s) do relatório não têm cadastro. `
        + 'Ligue cada um a um colaborador ou marque para ignorar — quem ficar sem ligação não será importado.');
    }

    const liberacao = bateComANota ? '' : `
      <label class="alerta-liberar">
        <input type="checkbox" id="${this.b.prefixo}-forcar" ${this._forcar ? 'checked' : ''}>
        Conferi o PDF e a diferença é conhecida — importar mesmo assim.
      </label>`;

    const cabecalho = `
      <div class="info-grid" style="margin:14px 0 10px;">
        ${linhaConf('Competência do relatório', this.h(r.competencia ? this.mesLabel(r.competencia) : '—'))}
        ${linhaConf('Nota', this.h(r.nota || '—'))}
        ${linhaConf('Emitido em', this.h(r.emitidoBR || '—'))}
        ${linhaConf('Beneficiários no PDF', r.registros.length)}
        ${linhaConf('Total de crédito', this.fmtBRL(r.totalCredito ?? r.soma))}
        ${r.totalServico
          ? linhaConf('Taxa de serviço (não é crédito)', this.fmtBRL(r.totalServico), 'var(--text-muted)')
          : ''}
      </div>`;

    const resumo = `
      <div class="info-grid" style="margin-bottom:10px;">
        ${linhaConf('Vai ser importado', `${c.casados.length} · ${this.fmtBRL(c.somaCasados)}`, 'var(--success)')}
        ${linhaConf('Ignorados pelo RH', `${c.ignorados.length} · ${this.fmtBRL(c.somaIgnorados)}`, 'var(--text-muted)')}
        ${linhaConf('Sem cadastro', `${c.semCadastro.length} · ${this.fmtBRL(c.somaSemCadastro)}`,
          c.semCadastro.length ? 'var(--danger)' : '')}
        ${linhaConf('Ativos fora do relatório', c.ausentes.length,
          c.ausentes.length ? 'var(--warning)' : '')}
      </div>
      ${this._contaAberta(r, c)}`;

    const opcoesColab = (escolhido) => ['<option value="">— não importar —</option>']
      .concat(this.COLABORADORES
        .filter(x => x.status !== 'inativo' || x.id === escolhido)
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map(x => `<option value="${x.id}"${x.id === escolhido ? ' selected' : ''}>${this.h(x.nome)}</option>`))
      .join('');

    // A linha que já foi ligada à mão continua na lista, com a ligação à vista:
    // some da tabela só quem o próprio cruzamento resolveu. Assim dá para
    // desfazer uma ligação errada sem ter que recomeçar a importação.
    const aResolver = [
      ...c.semCadastro.map(({ registro, motivo }) => ({ registro, motivo, escolhido: null })),
      ...c.casados.filter(x => x.via === 'manual')
        .map(x => ({ registro: x.registro, motivo: 'Ligado à mão', escolhido: x.colab.id })),
    ];

    const pendentes = aResolver.length ? `
      <div class="widget" style="margin-bottom:10px;">
        <div class="widget-header"><div class="widget-title">Beneficiários sem correspondência automática</div></div>
        <div class="table-wrapper">
          <table class="data"><thead><tr>
            <th>No relatório</th><th style="text-align:right">Valor</th>
            <th style="width:34%">Ligar a</th><th>Ignorar sempre</th>
          </tr></thead><tbody>
            ${aResolver.map(({ registro, motivo, escolhido }) => `
              <tr>
                <td><div class="cell-person-name">${this.h(registro.nome)}</div>
                    <div class="cell-person-sub">${this.h(registro.cpf)} · ${this.h(motivo)}</div></td>
                <td class="cell-mono" style="text-align:right">${this.fmtBRL(registro.valor)}</td>
                <td><select data-vinculo="${this.h(soDigitos(registro.cpf))}">${opcoesColab(escolhido)}</select></td>
                <td style="text-align:center">
                  <input type="checkbox" data-ignorar="${this.h(soDigitos(registro.cpf))}"
                         ${this._marcados[soDigitos(registro.cpf)] ? 'checked' : ''}>
                </td>
              </tr>`).join('')}
          </tbody></table>
        </div>
      </div>` : '';

    const ignorados = c.ignorados.length ? `
      <div style="font-size:.78rem; color:var(--text-muted); margin-bottom:10px;">
        Ignorados por configuração: ${c.ignorados.map(x => this.h(x.registro.nome)).join(', ')}.
      </div>` : '';

    const efeito = modo === 'substituir'
      ? `A competência <strong>${this.h(this.mesLabel(mes))}</strong> passa a ser exatamente este relatório: `
        + `${c.casados.length} linha(s), ${this.fmtBRL(c.somaCasados)}. O que houver gravado nela hoje é apagado.`
      : `Os ${c.casados.length} valor(es) deste relatório são somados ao que já existe em `
        + `<strong>${this.h(this.mesLabel(mes))}</strong>. Use para nota avulsa/complementar.`;

    this._estado(`
      ${cabecalho}
      ${avisos.length
        ? `<div class="alerta-erro">${avisos.map(a => `<div>${this.h(a)}</div>`).join('')}${liberacao}</div>`
        : ''}
      ${resumo}
      ${pendentes}
      ${ignorados}
      <div class="info-item" style="background:var(--bluish-bg); border-radius:8px; padding:10px 12px;">
        <div class="info-label">O que vai acontecer</div>
        <div style="font-size:.82rem; line-height:1.5;">${efeito}</div>
      </div>
    `);

    this._habilitarConfirmar(c.casados.length > 0 && fecha && (bateComANota || this._forcar));
  }

  // ─── Gravação ───────────────────────────────────────────────────────────────

  /**
   * Gravação do vale combustível — o adaptador padrão desta tela.
   *
   * Cada benefício tem a sua tabela e o seu espelho em memória, então esta é
   * a parte que o segundo benefício troca por outra (via `deps.gravar`). A do
   * combustível fica aqui porque foi a primeira e é a que os testes da tela
   * exercitam de ponta a ponta.
   */
  async _gravarCombustivel({ casados, mes, mesNum, ano, modo, temSessao }) {
    const hoje = new Date().toISOString().slice(0, 10);
    // No modo complementar o valor do relatório SOMA ao que já está gravado —
    // é o caso da nota avulsa emitida depois do crédito principal do mês.
    const atual = (id) => parseFloat(this.VALE_COTAS_MES[`${id}|${mes}`]) || 0;
    const linhas = casados.map(({ registro, colab }) => ({
      colaborador_id: colab.id,
      mes: mesNum,
      ano,
      valor_mensal: arredondar(modo === 'complementar' ? atual(colab.id) + registro.valor : registro.valor),
      utilizado:     parseFloat(this.VALE_USO_MES[`${colab.id}|${mes}`]) || 0,
      saldo_inicial: parseFloat(this.VALE_SALDO_INI[`${colab.id}|${mes}`]) || 0,
      data_concessao: hoje,
      status: 'ativo',
    }));

    if (temSessao && this.ValeCombustivel) {
      if (modo === 'substituir') await this.ValeCombustivel.limparCompetencia(mesNum, ano);
      await this.ValeCombustivel.upsertCotasEmLote(linhas);
    }

    // Espelha no estado local. Substituir apaga a competência inteira também
    // aqui — senão quem saiu do relatório continuaria aparecendo na tela.
    if (modo === 'substituir') {
      const sufixo = `|${mes}`;
      [this.VALE_COTAS_MES, this.VALE_USO_MES, this.VALE_SALDO_INI].forEach(mapa => {
        Object.keys(mapa).forEach(k => { if (k.endsWith(sufixo)) delete mapa[k]; });
      });
    }
    linhas.forEach(l => {
      this.VALE_COTAS_MES[`${l.colaborador_id}|${mes}`] = l.valor_mensal;
      this.VALE_USO_MES[`${l.colaborador_id}|${mes}`]   = l.utilizado;
      this.VALE_SALDO_INI[`${l.colaborador_id}|${mes}`] = l.saldo_inicial;
      if (this.VALE_COTAS) this.VALE_COTAS[l.colaborador_id] = l.valor_mensal;
    });
  }

  async confirmar() {
    if (this._ocupado || !this._relatorio) return;
    const c = this._conciliacao();
    const mes  = this.$(`#${this.b.prefixo}-competencia`)?.value || this._relatorio.competencia;
    const modo = this.$(`#${this.b.prefixo}-modo`)?.value || 'substituir';
    if (!/^\d{4}-\d{2}$/.test(mes)) { this.showToast('Informe a competência', 'err'); return; }
    if (!c.casados.length) { this.showToast('Nenhum beneficiário para importar', 'err'); return; }

    const [ano, mesNum] = mes.split('-').map(n => parseInt(n, 10));

    const novosIgnorados = Object.entries(this._marcados)
      .filter(([, marcado]) => marcado).map(([cpf]) => cpf);

    this._ocupado = true;
    this._habilitarConfirmar(false);
    try {
      const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);

      // Quem sabe montar a linha e onde gravá-la é o benefício. A tela só
      // entrega o que foi conferido: casados, competência e modo.
      await this.gravar({
        casados: c.casados, mes, mesNum, ano, modo, temSessao,
      });

      if (novosIgnorados.length) {
        const lista = [...new Set([...this._ignoradosSalvos(), ...novosIgnorados])];
        if (temSessao && this.Configuracoes) {
          await this.Configuracoes.definir(this.b.chaveIgnorados, JSON.stringify(lista));
        }
        this.CONFIG[this.b.chaveIgnorados] = JSON.stringify(lista);
      }
    } catch (err) {
      this.showToast('Erro ao importar: ' + err.message, 'err');
      this._ocupado = false;
      this._habilitarConfirmar(true);
      return;
    }
    this._ocupado = false;

    this.fecharModal();
    this.showToast(
      `${c.casados.length} crédito(s) importados em ${this.mesLabel(mes)} — ${this.fmtBRL(c.somaCasados)}`, 'ok');
    this.aoImportar(mes);
  }
}

export default ValeImportacaoModule;
