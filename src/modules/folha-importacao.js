// Importação da folha de pagamento.
//
// A contabilidade exporta um PDF com os recibos do mês. Até aqui o salário de
// cada pessoa era digitado um a um na tela de Salários — e, na prática, não
// era digitado: a tabela estava vazia. Aqui a folha entra inteira, o sistema
// mostra o que mudaria e grava só depois que o operador confere.
//
// A leitura e o cruzamento moram em utils/folha-pagamento.js (sem DOM, sem
// rede, testados à parte). Este módulo é a tela: arquivo, conferência, gravação.
//
// O que é gravado é o **salário base** — o salário contratual. Vencimentos,
// descontos e líquido aparecem na conferência como contexto, mas não viram
// cadastro: variam todo mês com horas extras, faltas e adiantamentos.

import { lerFolhaPagamento, conciliarFolha } from '../utils/folha-pagamento.js?v=dev';
import { linhasDeItens } from '../utils/texto-pdf.js?v=dev';

// Mesmo CDN do Chart.js e do supabase-js; carregado só quando o modal abre.
const PDFJS_VERSAO = '4.10.38';
const PDFJS_BASE   = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSAO}`;

// Ligações código-da-folha → id do colaborador que o RH fez à mão.
const CHAVE_VINCULOS = 'folha_vinculos';

export class FolhaImportacaoModule {
  constructor(deps) {
    this.$        = deps.$;
    this.h        = deps.h;
    this.fmtBRL   = deps.fmtBRL;
    this.mesLabel = deps.mesLabel;
    this.COLABORADORES = deps.COLABORADORES;
    this.SALARIOS      = deps.SALARIOS;
    this.CONFIG        = deps.CONFIG || {};
    this.Auth          = deps.Auth;
    this.Salarios      = deps.Salarios;
    this.Configuracoes = deps.Configuracoes;
    this.showToast     = deps.showToast;
    this.aoImportar    = deps.aoImportar || (() => {});
    this.carregarPdfJs = deps.carregarPdfJs || (() => this._pdfjsDoCdn());

    this._folha    = null;
    this._vinculos = {};   // código da folha → id, escolhido nesta sessão
    this._lembrar  = {};   // código da folha → true quando marcado "lembrar"
    this._ocupado  = false;

    this._ligarEventos();
  }

  _ligarEventos() {
    document.addEventListener('change', (e) => {
      if (e.target.id === 'folha-file') this.lerArquivo(e.target.files?.[0]);
      if (e.target.dataset?.folhaVinculo) {
        const cod = e.target.dataset.folhaVinculo;
        if (e.target.value) this._vinculos[cod] = Number(e.target.value);
        else delete this._vinculos[cod];
        this._renderPreview();
      }
      if (e.target.dataset?.folhaLembrar) {
        this._lembrar[e.target.dataset.folhaLembrar] = e.target.checked;
      }
    });

    const zona = () => this.$('#folha-drop');
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
    this._folha = null;
    this._vinculos = { ...this._vinculosSalvos() };
    this._lembrar = {};
    const file = this.$('#folha-file');
    if (file) file.value = '';
    const res = this.$('#folha-resultado');
    if (res) res.innerHTML = '';
    this._habilitarConfirmar(false);
    this.$('#modal-folha-import')?.classList.add('active');
  }

  fecharModal() { this.$('#modal-folha-import')?.classList.remove('active'); }

  escolherArquivo() { this.$('#folha-file')?.click(); }

  // ─── Leitura do PDF ─────────────────────────────────────────────────────────

  async _pdfjsDoCdn() {
    if (this._pdfjs) return this._pdfjs;
    const lib = await import(/* webpackIgnore: true */ `${PDFJS_BASE}/build/pdf.min.mjs`);
    lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/build/pdf.worker.min.mjs`;
    this._pdfjs = lib;
    return lib;
  }

  async _linhasDoPdf(arquivo) {
    const pdfjs = await this.carregarPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
    const linhas = [];
    for (let p = 1; p <= doc.numPages; p++) {
      linhas.push(...linhasDeItens((await (await doc.getPage(p)).getTextContent()).items));
    }
    return linhas;
  }

  async lerArquivo(arquivo) {
    if (!arquivo) return;
    if (!/\.pdf$/i.test(arquivo.name) && arquivo.type !== 'application/pdf') {
      this.showToast('A folha precisa ser um PDF', 'err');
      return;
    }

    this._estado(`<div class="empty">Lendo ${this.h(arquivo.name)}…</div>`);
    this._habilitarConfirmar(false);

    try {
      this._folha = lerFolhaPagamento(await this._linhasDoPdf(arquivo));
      this._folha.arquivo = arquivo.name;
      this._lembrar = {};
      this._renderPreview();
    } catch (err) {
      this._folha = null;
      this._estado(`<div class="alerta-erro">Não foi possível ler o PDF.<br><small>${this.h(err.message)}</small></div>`);
    }
  }

  _estado(html) { const el = this.$('#folha-resultado'); if (el) el.innerHTML = html; }

  _habilitarConfirmar(pode) {
    const btn = this.$('#btn-folha-confirmar');
    if (btn) btn.disabled = !pode;
  }

  // ─── Conferência ────────────────────────────────────────────────────────────

  _vinculosSalvos() {
    try {
      const bruto = JSON.parse(this.CONFIG[CHAVE_VINCULOS] || '{}');
      return (bruto && typeof bruto === 'object' && !Array.isArray(bruto)) ? bruto : {};
    } catch {
      return {};
    }
  }

  _conciliacao() {
    if (!this._folha) return null;
    return conciliarFolha(this._folha, this.COLABORADORES, this.SALARIOS, { vinculos: this._vinculos });
  }

  _renderPreview() {
    const f = this._folha;
    if (!f) return;
    const c = this._conciliacao();

    const item = (rot, val, cor = '') =>
      `<div class="info-item"><div class="info-label">${rot}</div>
       <div class="info-value mono"${cor ? ` style="color:${cor};font-weight:700"` : ''}>${val}</div></div>`;

    const avisos = [...f.problemas];
    if (c.semCadastro.length) {
      avisos.push(`${c.semCadastro.length} pessoa(s) da folha não têm cadastro correspondente. `
        + 'Ligue cada uma a um colaborador — quem ficar sem ligação não será importado.');
    }

    const cabecalho = `
      <div class="info-grid" style="margin:14px 0 10px;">
        ${item('Competência', this.h(f.competencia ? this.mesLabel(f.competencia) : '—'))}
        ${item('Empresa', this.h((f.empresa || '—').slice(0, 34)))}
        ${item('Holerites no PDF', f.holerites.length)}
        ${item('Soma dos salários base', this.fmtBRL(f.totalBase))}
      </div>`;

    const resumo = `
      <div class="info-grid" style="margin-bottom:10px;">
        ${item('Salários que mudam', c.mudancas.length, c.mudancas.length ? 'var(--primary)' : '')}
        ${item('Já conferem', c.iguais.length, 'var(--success)')}
        ${item('Sem cadastro', c.semCadastro.length, c.semCadastro.length ? 'var(--danger)' : '')}
        ${item('Ativos fora da folha', c.ausentes.length, c.ausentes.length ? 'var(--warning)' : '')}
      </div>`;

    const seta = (d) => d > 0
      ? `<span style="color:var(--success);font-weight:700">▲ ${this.fmtBRL(d)}</span>`
      : `<span style="color:var(--danger);font-weight:700">▼ ${this.fmtBRL(Math.abs(d))}</span>`;

    const mudancas = c.mudancas.length ? `
      <div class="widget" style="margin-bottom:10px;">
        <div class="widget-header">
          <div class="widget-title">O que vai mudar</div>
          <span class="widget-badge">${this.fmtBRL(c.somaAtual)} → ${this.fmtBRL(c.somaNova)}</span>
        </div>
        <div class="table-wrapper">
          <table class="data"><thead><tr>
            <th style="width:32%">Colaborador</th>
            <th style="text-align:right">No sistema</th>
            <th style="text-align:right">Na folha</th>
            <th style="text-align:right">Diferença</th>
            <th>Observações</th>
          </tr></thead><tbody>
            ${c.mudancas.map(m => `
              <tr>
                <td>
                  <div class="cell-person-name">${this.h(m.colab.nome)}</div>
                  <div class="cell-person-sub">${this.h(m.holerite.cargo || '—')}${m.via === 'manual' ? ' · ligado à mão' : ''}</div>
                </td>
                <td class="cell-mono" style="text-align:right">${m.atual ? this.fmtBRL(m.atual) : '<span style="color:var(--text-soft)">não cadastrado</span>'}</td>
                <td class="cell-mono" style="text-align:right;font-weight:600">${this.fmtBRL(m.novo)}</td>
                <td class="cell-mono" style="text-align:right">${m.atual ? seta(m.diferenca) : '—'}</td>
                <td class="cell-person-sub">${this.h(m.avisos.join(' · ') || '—')}</td>
              </tr>`).join('')}
          </tbody></table>
        </div>
      </div>` : '';

    const opcoes = (escolhido) => ['<option value="">— não importar —</option>']
      .concat(this.COLABORADORES
        .filter(x => x.status !== 'inativo' || x.id === escolhido)
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map(x => `<option value="${x.id}"${x.id === escolhido ? ' selected' : ''}>${this.h(x.nome)}</option>`))
      .join('');

    // Quem foi ligado à mão continua na lista, para a ligação poder ser desfeita.
    const aResolver = [
      ...c.semCadastro.map(({ holerite, motivo }) => ({ holerite, motivo, escolhido: null })),
      ...c.mudancas.concat(c.iguais).filter(x => x.via === 'manual')
        .map(x => ({ holerite: x.holerite, motivo: 'Ligado à mão', escolhido: x.colab.id })),
    ];

    const pendentes = aResolver.length ? `
      <div class="widget" style="margin-bottom:10px;">
        <div class="widget-header"><div class="widget-title">Sem correspondência automática</div></div>
        <div class="table-wrapper">
          <table class="data"><thead><tr>
            <th>Na folha</th><th style="text-align:right">Salário base</th>
            <th style="width:32%">Ligar a</th><th>Lembrar</th>
          </tr></thead><tbody>
            ${aResolver.map(({ holerite, motivo, escolhido }) => `
              <tr>
                <td><div class="cell-person-name">${this.h(holerite.nome)}</div>
                    <div class="cell-person-sub">cód. ${this.h(holerite.codigo)} · ${this.h(motivo)}</div></td>
                <td class="cell-mono" style="text-align:right">${this.fmtBRL(holerite.salarioBase || 0)}</td>
                <td><select data-folha-vinculo="${this.h(holerite.codigo)}">${opcoes(escolhido)}</select></td>
                <td style="text-align:center">
                  <input type="checkbox" data-folha-lembrar="${this.h(holerite.codigo)}"
                         ${this._lembrar[holerite.codigo] ? 'checked' : ''}
                         title="Guardar esta ligação para as próximas folhas">
                </td>
              </tr>`).join('')}
          </tbody></table>
        </div>
      </div>` : '';

    const ausentes = c.ausentes.length ? `
      <div style="font-size:.78rem; color:var(--text-muted); margin-bottom:10px;">
        Ativos no sistema que não vieram nesta folha (${c.ausentes.length}):
        ${c.ausentes.slice(0, 12).map(a => this.h(a.nome)).join(', ')}${c.ausentes.length > 12 ? '…' : ''}
      </div>` : '';

    this._estado(`
      ${cabecalho}
      ${avisos.length ? `<div class="alerta-erro">${avisos.map(a => `<div>${this.h(a)}</div>`).join('')}</div>` : ''}
      ${resumo}
      ${mudancas}
      ${pendentes}
      ${ausentes}
      ${c.mudancas.length === 0 && c.iguais.length
        ? '<div class="empty">Todos os salários da folha já conferem com o sistema — nada a atualizar.</div>'
        : ''}
    `);

    this._habilitarConfirmar(c.mudancas.length > 0 && f.problemas.length === 0);
  }

  // ─── Gravação ───────────────────────────────────────────────────────────────

  async confirmar() {
    if (this._ocupado || !this._folha) return;
    const c = this._conciliacao();
    if (!c.mudancas.length) { this.showToast('Nenhum salário a atualizar', 'err'); return; }

    const hoje = new Date().toISOString().slice(0, 10);
    const obs = `Folha de ${this.mesLabel(this._folha.competencia)}`;

    this._ocupado = true;
    this._habilitarConfirmar(false);

    const temSessao = this.Salarios && this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    let gravados = 0;
    try {
      for (const m of c.mudancas) {
        const payload = { colaborador_id: m.colab.id, valor: m.novo, data_alteracao: hoje, observacoes: obs };
        if (temSessao) {
          const existente = this.SALARIOS[m.colab.id];
          const salvo = existente?.id
            ? await this.Salarios.atualizar(existente.id, payload)
            : await this.Salarios.criar(payload);
          this.SALARIOS[m.colab.id] = {
            id: salvo?.id ?? existente?.id,
            valor: m.novo, data_alteracao: hoje, observacoes: obs,
          };
        } else {
          this.SALARIOS[m.colab.id] = { ...this.SALARIOS[m.colab.id], valor: m.novo, data_alteracao: hoje, observacoes: obs };
        }
        gravados++;
      }

      // As ligações marcadas ficam guardadas: na folha do mês que vem, quem
      // tem o nome grafado diferente já casa sozinho.
      const novos = Object.entries(this._lembrar)
        .filter(([cod, marcado]) => marcado && this._vinculos[cod] != null);
      if (novos.length) {
        const mapa = { ...this._vinculosSalvos() };
        novos.forEach(([cod]) => { mapa[cod] = this._vinculos[cod]; });
        const json = JSON.stringify(mapa);
        if (temSessao && this.Configuracoes) await this.Configuracoes.definir(CHAVE_VINCULOS, json);
        this.CONFIG[CHAVE_VINCULOS] = json;
      }
    } catch (err) {
      this.showToast(`Erro ao gravar (${gravados} já gravados): ` + err.message, 'err');
      this._ocupado = false;
      this._habilitarConfirmar(true);
      return;
    }
    this._ocupado = false;

    this.fecharModal();
    this.showToast(`${gravados} salário(s) atualizados pela folha de ${this.mesLabel(this._folha.competencia)}`, 'ok');
    this.aoImportar(this._folha.competencia);
  }
}

export default FolhaImportacaoModule;
