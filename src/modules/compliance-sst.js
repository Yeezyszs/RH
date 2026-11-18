// Compliance de SST — três assuntos que viviam numa planilha e em PDFs soltos:
// a matriz de treinamentos de NR, as CATs e os programas do eSocial com o
// plano de ação que o PGR traz.
//
// As contas (vencimento da reciclagem, situação do programa, progresso do
// plano) moram em utils/compliance-sst.js, sem DOM e testadas à parte. Este
// módulo é a tela.

import { limparFormulario } from '../utils/ui.js?v=dev';
import {
  NORMAS, NORMA_POR_CHAVE, TIPOS_ACIDENTE, TIPOS_PROGRAMA, STATUS_PLANO,
  montarMatriz, resumoMatriz, diasAfastado, situacaoPrograma, progressoPlano,
  painelDoColaborador, perfilDoSetor,
} from '../utils/compliance-sst.js?v=dev';

export class ComplianceSstModule {
  constructor(deps) {
    this.$        = deps.$;
    this.h        = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate  = deps.fmtDate;
    this.COLABORADORES   = deps.COLABORADORES;
    this.TREINAMENTOS_NR = deps.TREINAMENTOS_NR;
    this.CAT             = deps.CAT;
    this.PROGRAMAS       = deps.PROGRAMAS;
    this.PLANO_ACAO      = deps.PLANO_ACAO;
    this.Auth              = deps.Auth;
    this.TreinamentosNR    = deps.TreinamentosNR;
    this.CatAcidentes      = deps.CatAcidentes;
    this.ProgramasEsocial  = deps.ProgramasEsocial;
    this.StorageDocs       = deps.StorageDocs;
    this.showToast         = deps.showToast || (() => {});

    this._programaAberto = null;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'sst-busca') {
        clearTimeout(this._t);
        this._t = setTimeout(() => this.renderTreinamentos(), 250);
      }
    });
    document.addEventListener('change', (e) => {
      if (['sst-filtro-norma', 'sst-filtro-situacao'].includes(e.target.id)) this.renderTreinamentos();
      if (e.target.id === 'cat-filtro-ano') this.renderCat();
    });
    // Os cards de situação filtram a matriz. Delegado por atributo em vez de
    // `onclick` no HTML: é o caminho que o projeto segue, e há teste que
    // cobra o número de handlers inline no index.html.
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-sst-situacao]');
      if (!card) return;
      this.filtrarPorSituacao(card.dataset.sstSituacao);
    });

    document.querySelectorAll('.nav-item[data-page="compliance-sst"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  render() {
    this.renderTreinamentos();
    this.renderCat();
    this.renderProgramas();
  }

  _ativos() {
    return this.COLABORADORES.filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  // ─── Aba 1: matriz de treinamentos ────────────────────────────────────────

  renderTreinamentos() {
    const tb = this.$('#tb-sst-matriz');
    if (!tb) return;

    const busca = (this.$('#sst-busca')?.value || '').trim().toLowerCase();
    const fNorma = this.$('#sst-filtro-norma')?.value || '';
    const fSit   = this.$('#sst-filtro-situacao')?.value || '';

    this._preencherFiltroNormas();

    // A matriz sempre traz todas as normas conhecidas: aqui o RH preenche, e
    // coluna que só aparece depois do primeiro registro não dá onde clicar.
    const matriz = montarMatriz(this._ativos(), this.TREINAMENTOS_NR, {
      normasExtras: NORMAS.map(n => n.chave),
    });

    const normas = fNorma ? matriz.normas.filter(n => n.chave === fNorma) : matriz.normas;
    const linhas = matriz.linhas.filter(l => {
      if (busca && !l.colab.nome.toLowerCase().includes(busca)
          && !(l.colab.cargo || '').toLowerCase().includes(busca)) return false;
      if (fSit) {
        const alvo = normas.filter(n => fNorma ? true : true).map(n => n.chave);
        const tem = l.celulas.some(c => alvo.includes(c.norma.chave) && c.situacao.chave === fSit);
        if (!tem) return false;
      }
      return true;
    });

    this.$('#sst-matriz-cab').innerHTML = `
      <tr>
        <th style="min-width:210px; position:sticky; left:0; background:var(--bluish-bg); z-index:2">Colaborador</th>
        ${normas.map(n => `<th style="text-align:center" title="${this.h(n.descricao)}">${this.h(n.rotulo)}</th>`).join('')}
      </tr>`;

    tb.innerHTML = linhas.length ? linhas.map(l => `
      <tr>
        <td style="position:sticky; left:0; background:var(--white); z-index:1; cursor:pointer"
            onclick="abrirPainelSst(${l.colab.id})" title="Ver as NR exigidas no setor">
          <div class="cell-person-name">${this.h(l.colab.nome)}</div>
          <div class="cell-person-sub">${this.h(l.colab.cargo || '—')}${l.colab.setor ? ` · ${this.h(l.colab.setor)}` : ''}</div>
        </td>
        ${l.celulas.filter(c => normas.includes(c.norma)).map(c => {
          const s = c.situacao;
          const texto = c.registro?.data_realizacao
            ? this.fmtDate(c.registro.data_realizacao)
            : (s.chave === 'realizar' ? 'REALIZAR' : '—');
          const titulo = s.vencimento ? `${s.rotulo} · vence em ${this.fmtDate(s.vencimento)}` : s.rotulo;
          return `<td class="sst-cel sst-${s.cls}" title="${this.h(titulo)}"
                      onclick="abrirModalTreinamentoNR(${l.colab.id}, '${this.h(c.norma.chave)}')">${texto}</td>`;
        }).join('')}
      </tr>`).join('')
      : `<tr><td colspan="${normas.length + 1}" class="empty">Nenhum colaborador encontrado</td></tr>`;

    const r = resumoMatriz({ normas, linhas });
    const def = (id, v) => { const el = this.$(id); if (el) el.textContent = v; };
    def('#sst-stat-pessoas',   r.pessoas);
    def('#sst-stat-emdia',     r.emDia);
    def('#sst-stat-vencendo',  r.vencendo);
    def('#sst-stat-vencidos',  r.vencidos);
    def('#sst-stat-realizar',  r.aRealizar);
  }

  /**
   * Clicar num card filtra a matriz por aquela situação.
   *
   * O número no card responde "quantos"; o RH precisa de "quais". Antes a
   * resposta estava no seletor ao lado, e ninguém liga um ao outro.
   */
  filtrarPorSituacao(chave) {
    const sel = this.$('#sst-filtro-situacao');
    if (!sel) return;
    // Clicar de novo no mesmo card desfaz o filtro.
    sel.value = sel.value === chave ? '' : chave;
    this.renderTreinamentos();
    this.$('#tb-sst-matriz')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ─── Painel do colaborador ────────────────────────────────────────────────

  /**
   * O que o setor daquela pessoa exige, o que ela tem e o que falta.
   *
   * A matriz mostra tudo de todo mundo e é boa para varrer; aqui a pergunta
   * é outra — "este da logística está qualificado?" —, e a resposta é a
   * lista das normas do setor dele com o estado de cada uma.
   */
  abrirPainel(colabId) {
    const colab = this.COLABORADORES.find(c => c.id === colabId);
    if (!colab) return;
    this._painelColabId = colabId;

    const p = painelDoColaborador(colab, this.COLABORADORES, this.TREINAMENTOS_NR);
    const perfil = Object.fromEntries(
      perfilDoSetor(this.COLABORADORES, this.TREINAMENTOS_NR, colab.setor).map(e => [e.chave, e]));

    this.$('#dsst-avatar').textContent = this.iniciais(colab.nome);
    this.$('#dsst-nome').textContent = colab.nome;
    this.$('#dsst-cargo').textContent =
      `${colab.cargo || '—'}${colab.setor ? ` · ${colab.setor}` : ''}`;

    const cartao = (rotulo, valor, cor) => `
      <div class="dsst-num"><span>${rotulo}</span><strong ${cor ? `style="color:${cor}"` : ''}>${valor}</strong></div>`;

    this.$('#dsst-resumo').innerHTML = `
      <div class="dsst-nums">
        ${cartao('Em dia', p.emDia.length, 'var(--success)')}
        ${cartao('Vencendo', p.vencendo.length, p.vencendo.length ? 'var(--warning)' : '')}
        ${cartao('Vencidos', p.vencidos.length, p.vencidos.length ? 'var(--danger)' : '')}
        ${cartao('A realizar', p.aRealizar.length, '')}
        ${cartao('Faltando', p.faltando.length, p.faltando.length ? 'var(--danger)' : '')}
      </div>`;

    const linha = (l) => {
      const s = l.situacao;
      const quantos = perfil[l.norma.chave];
      return `
        <tr onclick="abrirModalTreinamentoNR(${colabId}, '${this.h(l.norma.chave)}')" style="cursor:pointer">
          <td>
            <div class="cell-person-name">${this.h(l.norma.rotulo)}</div>
            <div class="cell-person-sub">${this.h(l.norma.descricao || '')}</div>
            ${quantos ? `<div class="fer-dica">${quantos.quantos} de ${quantos.total} no setor</div>` : ''}
          </td>
          <td class="cell-mono">${l.registro?.data_realizacao ? this.fmtDate(l.registro.data_realizacao) : '—'}</td>
          <td class="cell-mono">${s.vencimento ? this.fmtDate(s.vencimento) : '—'}</td>
          <td><span class="sst-pino sst-${s.cls}">${this.h(s.rotulo)}</span></td>
        </tr>`;
    };

    const tabela = (titulo, linhas, vazio) => `
      <div class="fer-secao" style="margin-top:14px;">${titulo}</div>
      ${linhas.length ? `
        <div class="table-card" style="box-shadow:none;">
          <div class="table-wrapper">
            <table class="data">
              <thead><tr><th>Norma</th><th>Realizado</th><th>Vence</th><th>Situação</th></tr></thead>
              <tbody>${linhas.map(linha).join('')}</tbody>
            </table>
          </div>
        </div>` : `<div class="fer-dica">${vazio}</div>`}`;

    this.$('#dsst-corpo').innerHTML = `
      ${p.faltando.length ? `
        <div class="alerta-erro" style="margin-bottom:10px;">
          <strong>${p.faltando.length} norma(s) do setor sem registro:</strong>
          ${p.faltando.map(l => this.h(l.norma.rotulo)).join(', ')}.
        </div>` : ''}
      ${tabela(`Exigidas no setor ${this.h(p.setor)}`, p.doSetor,
        'Ainda não dá para dizer o que este setor exige — as normas aparecem aqui quando metade do setor tiver registro.')}
      ${p.extras.length
        ? tabela('Outras normas registradas para esta pessoa', p.extras, '')
        : ''}
      <div class="fer-dica" style="margin-top:12px;">
        As normas do setor saem do próprio quadro: conta como exigida a que
        metade ou mais do setor tem registrada. Clique numa linha para lançar ou alterar.
      </div>`;

    this.$('#drawer-backdrop-sst').classList.add('active');
    this.$('#drawer-sst').classList.add('active');
  }

  fecharPainel() {
    this.$('#drawer-backdrop-sst')?.classList.remove('active');
    this.$('#drawer-sst')?.classList.remove('active');
    this._painelColabId = null;
  }

  _preencherFiltroNormas() {
    const sel = this.$('#sst-filtro-norma');
    if (!sel || sel.options.length > 1) return;
    sel.innerHTML = '<option value="">Todas as normas</option>'
      + NORMAS.map(n => `<option value="${n.chave}">${this.h(n.rotulo)} — ${this.h(n.descricao)}</option>`).join('');
  }

  abrirModalTreinamento(colabId, nr) {
    const form = this.$('#form-treinamento-nr');
    if (!form) return;
    limparFormulario(form);

    const colab = this.COLABORADORES.find(c => c.id === colabId);
    const reg = this.TREINAMENTOS_NR.find(r => r.colaborador_id === colabId && r.nr === nr);
    const norma = NORMA_POR_CHAVE[nr];

    this.$('#trn-titulo').textContent = `${colab?.nome || ''} — ${norma?.rotulo || nr}`;
    this.$('#trn-subtitulo').textContent = norma?.descricao || '';
    form.elements['colaborador_id'].value = colabId;
    form.elements['nr'].value = nr;
    form.elements['id'].value = reg?.id || '';
    form.elements['data_realizacao'].value = reg?.data_realizacao || '';
    form.elements['pendente'].checked = !!reg?.pendente;
    form.elements['validade_meses'].value = reg?.validade_meses ?? '';
    form.elements['validade_meses'].placeholder = norma?.validade
      ? `padrão da norma: ${norma.validade} meses` : 'não vence';
    form.elements['observacoes'].value = reg?.observacoes || '';

    const btn = this.$('#btn-trn-excluir');
    if (btn) btn.style.display = reg?.id ? '' : 'none';

    this.$('#modal-treinamento-nr').classList.add('active');
  }

  fecharModalTreinamento() {
    this.$('#modal-treinamento-nr')?.classList.remove('active');
  }

  async salvarTreinamento(ev) {
    ev.preventDefault();
    const form = this.$('#form-treinamento-nr');
    const d = Object.fromEntries(new FormData(form));

    const payload = {
      colaborador_id: parseInt(d.colaborador_id, 10),
      nr: d.nr,
      data_realizacao: d.data_realizacao || null,
      pendente: form.elements['pendente'].checked,
      validade_meses: d.validade_meses ? parseInt(d.validade_meses, 10) : null,
      observacoes: (d.observacoes || '').trim() || null,
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    let salvo = { id: d.id ? parseInt(d.id, 10) : Date.now(), ...payload };
    if (temSessao && this.TreinamentosNR) {
      try {
        salvo = await this.TreinamentosNR.salvar(d.id ? { id: parseInt(d.id, 10), ...payload } : payload);
      } catch (err) { this.showToast('Erro ao salvar: ' + err.message, 'err'); return; }
    }

    const i = this.TREINAMENTOS_NR.findIndex(r =>
      r.colaborador_id === payload.colaborador_id && r.nr === payload.nr);
    if (i >= 0) this.TREINAMENTOS_NR[i] = salvo; else this.TREINAMENTOS_NR.push(salvo);

    this.fecharModalTreinamento();
    this.renderTreinamentos();
    if (this._painelColabId != null) this.abrirPainel(this._painelColabId);
    this.showToast('Treinamento registrado', 'ok');
  }

  async excluirTreinamento() {
    const form = this.$('#form-treinamento-nr');
    const id = parseInt(form?.elements['id']?.value, 10);
    if (!id || !confirm('Apagar este registro de treinamento?')) return;

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao && this.TreinamentosNR) {
      try { await this.TreinamentosNR.excluir(id); }
      catch (err) { this.showToast('Erro ao excluir: ' + err.message, 'err'); return; }
    }
    const i = this.TREINAMENTOS_NR.findIndex(r => r.id === id);
    if (i >= 0) this.TREINAMENTOS_NR.splice(i, 1);

    this.fecharModalTreinamento();
    this.renderTreinamentos();
    if (this._painelColabId != null) this.abrirPainel(this._painelColabId);
    this.showToast('Registro apagado', 'ok');
  }

  // ─── Aba 2: CAT ───────────────────────────────────────────────────────────

  renderCat() {
    const tb = this.$('#tb-sst-cat');
    if (!tb) return;

    this._preencherAnosCat();
    const fAno = this.$('#cat-filtro-ano')?.value || '';
    const lista = this.CAT
      .filter(c => !fAno || String(c.data_acidente || '').startsWith(fAno))
      .sort((a, b) => String(b.data_acidente).localeCompare(String(a.data_acidente)));

    tb.innerHTML = lista.length ? lista.map(c => {
      const colab = this.COLABORADORES.find(x => x.id === c.colaborador_id);
      const dias = diasAfastado(c);
      const afast = !c.houve_afastamento
        ? '<span class="badge neutral">Sem afastamento</span>'
        : dias == null
          ? '<span class="badge warn">Afastado — sem retorno</span>'
          : `<span class="badge info">${dias} dia${dias === 1 ? '' : 's'}</span>`;
      return `
        <tr>
          <td>
            <div class="cell-person-name">${this.h(colab?.nome || '—')}</div>
            <div class="cell-person-sub">${this.h(colab?.setor || '')}</div>
          </td>
          <td class="cell-mono">${this.fmtDate(c.data_acidente)}${c.hora ? ` ${this.h(c.hora)}` : ''}</td>
          <td>${this.h(TIPOS_ACIDENTE[c.tipo] || c.tipo)}
            ${c.parte_corpo ? `<div class="cell-person-sub">${this.h(c.parte_corpo)}</div>` : ''}</td>
          <td>${afast}</td>
          <td class="cell-mono">${this.h(c.numero_cat || '—')}</td>
          <td>${c.arquivo_path
            ? `<button class="btn btn-ghost btn-sm" onclick="abrirDocumentoCat(${c.id})">📄 ${this.h(c.arquivo_nome || 'CAT')}</button>`
            : '<span style="color:var(--text-soft)">sem documento</span>'}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalCat(${c.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirCat(${c.id})">🗑</button>
          </td>
        </tr>`;
    }).join('') : '<tr><td colspan="7" class="empty">Nenhum acidente registrado</td></tr>';

    const comAfast = lista.filter(c => c.houve_afastamento);
    const diasTotais = comAfast.reduce((s, c) => s + (diasAfastado(c) || 0), 0);
    const def = (id, v) => { const el = this.$(id); if (el) el.textContent = v; };
    def('#cat-stat-total', lista.length);
    def('#cat-stat-afastamento', comAfast.length);
    def('#cat-stat-dias', diasTotais);
    def('#cat-stat-semdoc', lista.filter(c => !c.arquivo_path).length);
  }

  _preencherAnosCat() {
    const sel = this.$('#cat-filtro-ano');
    if (!sel) return;
    const anos = [...new Set(this.CAT.map(c => String(c.data_acidente || '').slice(0, 4)).filter(Boolean))]
      .sort().reverse();
    const assinatura = anos.join(',');
    if (sel._assinatura === assinatura) return;
    const anterior = sel.value;
    sel.innerHTML = '<option value="">Todos os anos</option>'
      + anos.map(a => `<option value="${a}">${a}</option>`).join('');
    sel._assinatura = assinatura;
    if (anterior && anos.includes(anterior)) sel.value = anterior;
  }

  abrirModalCat(id = null) {
    const form = this.$('#form-cat');
    if (!form) return;
    limparFormulario(form);

    form.elements['colaborador_id'].innerHTML = this._ativos()
      .map(c => `<option value="${c.id}">${this.h(c.nome)} — ${this.h(c.setor || '')}</option>`).join('');

    const c = id != null ? this.CAT.find(x => x.id === id) : null;
    this.$('#cat-modal-titulo').textContent = c ? 'Editar CAT' : 'Registrar acidente (CAT)';
    form.elements['id'].value = c?.id || '';
    if (c) {
      form.elements['colaborador_id'].value = c.colaborador_id;
      ['data_acidente', 'hora', 'tipo', 'descricao', 'parte_corpo',
        'afastamento_inicio', 'afastamento_fim', 'numero_cat'].forEach(k => {
        if (form.elements[k]) form.elements[k].value = c[k] || '';
      });
      form.elements['houve_afastamento'].checked = !!c.houve_afastamento;
    }
    this._arquivoCat = null;
    const nome = this.$('#cat-arquivo-nome');
    if (nome) nome.textContent = c?.arquivo_nome || 'nenhum arquivo escolhido';

    this.$('#modal-cat').classList.add('active');
  }

  fecharModalCat() { this.$('#modal-cat')?.classList.remove('active'); }

  arquivoCatEscolhido(input) {
    this._arquivoCat = input?.files?.[0] || null;
    const nome = this.$('#cat-arquivo-nome');
    if (nome) nome.textContent = this._arquivoCat?.name || 'nenhum arquivo escolhido';
  }

  async salvarCat(ev) {
    ev.preventDefault();
    const form = this.$('#form-cat');
    const d = Object.fromEntries(new FormData(form));
    const id = d.id ? parseInt(d.id, 10) : null;

    const payload = {
      colaborador_id: parseInt(d.colaborador_id, 10),
      data_acidente: d.data_acidente,
      hora: d.hora || null,
      tipo: d.tipo || 'tipico',
      descricao: (d.descricao || '').trim() || null,
      parte_corpo: (d.parte_corpo || '').trim() || null,
      houve_afastamento: form.elements['houve_afastamento'].checked,
      afastamento_inicio: d.afastamento_inicio || null,
      afastamento_fim: d.afastamento_fim || null,
      numero_cat: (d.numero_cat || '').trim() || null,
    };

    if (!payload.colaborador_id || !payload.data_acidente) {
      this.showToast('Informe o colaborador e a data do acidente', 'err'); return;
    }
    if (payload.houve_afastamento && !payload.afastamento_inicio) {
      this.showToast('Informe o início do afastamento', 'err'); return;
    }
    if (payload.afastamento_fim && payload.afastamento_inicio
        && payload.afastamento_fim < payload.afastamento_inicio) {
      this.showToast('O retorno não pode ser antes do início do afastamento', 'err'); return;
    }

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    try {
      if (this._arquivoCat && temSessao && this.StorageDocs) {
        const { path, nome } = await this.StorageDocs.upload(this._arquivoCat, 'cat');
        payload.arquivo_path = path;
        payload.arquivo_nome = nome;
      } else if (this._arquivoCat) {
        payload.arquivo_nome = this._arquivoCat.name;
      }

      let salvo = { id: id ?? Date.now(), ...payload };
      if (temSessao && this.CatAcidentes) {
        salvo = id ? await this.CatAcidentes.atualizar(id, payload)
                   : await this.CatAcidentes.criar(payload);
      }
      const i = this.CAT.findIndex(x => x.id === id);
      if (i >= 0) this.CAT[i] = { ...this.CAT[i], ...salvo }; else this.CAT.unshift(salvo);
    } catch (err) {
      this.showToast('Erro ao salvar: ' + err.message, 'err'); return;
    }

    this.fecharModalCat();
    this.renderCat();
    this.showToast(id ? 'CAT atualizada' : 'CAT registrada', 'ok');
  }

  async excluirCat(id) {
    if (!confirm('Excluir este registro de acidente?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao && this.CatAcidentes) {
      try { await this.CatAcidentes.excluir(id); }
      catch (err) { this.showToast('Erro ao excluir: ' + err.message, 'err'); return; }
    }
    const i = this.CAT.findIndex(x => x.id === id);
    if (i >= 0) this.CAT.splice(i, 1);
    this.renderCat();
    this.showToast('Registro excluído', 'ok');
  }

  async abrirDocumentoCat(id) {
    const c = this.CAT.find(x => x.id === id);
    if (!c?.arquivo_path || !this.StorageDocs) return;
    try {
      const url = await this.StorageDocs.urlAssinada(c.arquivo_path);
      window.open(url, '_blank');
    } catch (err) {
      this.showToast('Não foi possível abrir o documento: ' + err.message, 'err');
    }
  }

  // ─── Aba 3: programas do eSocial + plano de ação ──────────────────────────

  renderProgramas() {
    const alvo = this.$('#sst-programas');
    if (!alvo) return;

    const lista = [...this.PROGRAMAS]
      .sort((a, b) => String(b.data_documento || '').localeCompare(String(a.data_documento || '')));

    alvo.innerHTML = lista.length ? lista.map(p => {
      const s = situacaoPrograma(p);
      const itens = this.PLANO_ACAO.filter(i => i.programa_id === p.id);
      const prog = progressoPlano(itens);
      return `
        <div class="widget" style="margin-bottom:12px;">
          <div class="widget-header">
            <div>
              <div class="widget-title">${this.h(p.tipo)}${p.titulo ? ` — ${this.h(p.titulo)}` : ''}</div>
              <div class="cell-person-sub">
                ${p.data_documento ? `Emitido em ${this.fmtDate(p.data_documento)}` : 'sem data'}
                ${p.validade ? ` · válido até ${this.fmtDate(p.validade)}` : ''}
                ${p.responsavel ? ` · ${this.h(p.responsavel)}` : ''}
              </div>
            </div>
            <span class="badge ${s.cls}">${s.rotulo}</span>
          </div>

          <div style="display:flex; gap:6px; flex-wrap:wrap; padding:0 2px 10px;">
            ${p.arquivo_path
              ? `<button class="btn btn-ghost btn-sm" onclick="abrirDocumentoPrograma(${p.id})">📄 ${this.h(p.arquivo_nome || 'documento')}</button>`
              : '<span class="fer-dica">sem documento anexado</span>'}
            <div style="margin-left:auto; display:flex; gap:4px;">
              <button class="btn btn-ghost btn-sm" onclick="abrirModalItemPlano(${p.id})">+ Item do plano</button>
              <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalPrograma(${p.id})">✎</button>
              <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirPrograma(${p.id})">🗑</button>
            </div>
          </div>

          ${itens.length ? `
            <div class="sst-plano-barra" title="${prog.concluidos} de ${prog.total} concluídos">
              <span style="width:${prog.percentual}%"></span>
            </div>
            <div class="cell-person-sub" style="margin:4px 2px 8px;">
              Plano de ação: ${prog.concluidos}/${prog.total} concluídos
              ${prog.atrasados ? ` · <strong style="color:var(--danger)">${prog.atrasados} com prazo vencido</strong>` : ''}
            </div>
            <div class="table-wrapper">
              <table class="data">
                <thead><tr>
                  <th>Ação</th><th>Risco</th><th>Responsável</th>
                  <th>Prazo</th><th>Situação</th><th style="width:70px"></th>
                </tr></thead>
                <tbody>
                  ${itens.map(i => {
                    const st = STATUS_PLANO[i.status] || STATUS_PLANO.pendente;
                    const atrasado = i.status !== 'concluido' && i.prazo
                      && i.prazo < new Date().toISOString().slice(0, 10);
                    return `
                      <tr>
                        <td>${this.h(i.item)}</td>
                        <td class="cell-person-sub">${this.h(i.risco || '—')}</td>
                        <td>${this.h(i.responsavel || '—')}</td>
                        <td class="cell-mono" ${atrasado ? 'style="color:var(--danger); font-weight:700"' : ''}>
                          ${i.prazo ? this.fmtDate(i.prazo) : '—'}</td>
                        <td><span class="badge ${st.cls}">${st.rotulo}</span></td>
                        <td class="actions">
                          <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalItemPlano(${p.id}, ${i.id})">✎</button>
                          <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirItemPlano(${i.id})">🗑</button>
                        </td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>` : '<div class="fer-dica" style="padding:0 2px 8px;">Sem plano de ação lançado.</div>'}
        </div>`;
    }).join('') : '<div class="empty">Nenhum programa cadastrado. Use “+ Novo programa” para anexar o PGR, o LTCAT ou o PCMSO.</div>';
  }

  abrirModalPrograma(id = null) {
    const form = this.$('#form-programa');
    if (!form) return;
    limparFormulario(form);

    form.elements['tipo'].innerHTML = TIPOS_PROGRAMA
      .map(t => `<option value="${t}">${t}</option>`).join('');

    const p = id != null ? this.PROGRAMAS.find(x => x.id === id) : null;
    this.$('#prog-modal-titulo').textContent = p ? 'Editar programa' : 'Novo programa';
    form.elements['id'].value = p?.id || '';
    if (p) {
      ['tipo', 'titulo', 'data_documento', 'validade', 'responsavel', 'observacoes'].forEach(k => {
        if (form.elements[k]) form.elements[k].value = p[k] || '';
      });
    }
    this._arquivoPrograma = null;
    const nome = this.$('#prog-arquivo-nome');
    if (nome) nome.textContent = p?.arquivo_nome || 'nenhum arquivo escolhido';

    this.$('#modal-programa').classList.add('active');
  }

  fecharModalPrograma() { this.$('#modal-programa')?.classList.remove('active'); }

  arquivoProgramaEscolhido(input) {
    this._arquivoPrograma = input?.files?.[0] || null;
    const nome = this.$('#prog-arquivo-nome');
    if (nome) nome.textContent = this._arquivoPrograma?.name || 'nenhum arquivo escolhido';
  }

  async salvarPrograma(ev) {
    ev.preventDefault();
    const form = this.$('#form-programa');
    const d = Object.fromEntries(new FormData(form));
    const id = d.id ? parseInt(d.id, 10) : null;

    const payload = {
      tipo: d.tipo,
      titulo: (d.titulo || '').trim() || null,
      data_documento: d.data_documento || null,
      validade: d.validade || null,
      responsavel: (d.responsavel || '').trim() || null,
      observacoes: (d.observacoes || '').trim() || null,
    };
    if (!payload.tipo) { this.showToast('Escolha o tipo de programa', 'err'); return; }

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    try {
      if (this._arquivoPrograma && temSessao && this.StorageDocs) {
        const { path, nome } = await this.StorageDocs.upload(this._arquivoPrograma, 'programas');
        payload.arquivo_path = path;
        payload.arquivo_nome = nome;
      } else if (this._arquivoPrograma) {
        payload.arquivo_nome = this._arquivoPrograma.name;
      }

      let salvo = { id: id ?? Date.now(), ...payload };
      if (temSessao && this.ProgramasEsocial) {
        salvo = id ? await this.ProgramasEsocial.atualizar(id, payload)
                   : await this.ProgramasEsocial.criar(payload);
      }
      const i = this.PROGRAMAS.findIndex(x => x.id === id);
      if (i >= 0) this.PROGRAMAS[i] = { ...this.PROGRAMAS[i], ...salvo }; else this.PROGRAMAS.unshift(salvo);
    } catch (err) {
      this.showToast('Erro ao salvar: ' + err.message, 'err'); return;
    }

    this.fecharModalPrograma();
    this.renderProgramas();
    this.showToast(id ? 'Programa atualizado' : 'Programa cadastrado', 'ok');
  }

  async excluirPrograma(id) {
    const itens = this.PLANO_ACAO.filter(i => i.programa_id === id).length;
    const aviso = itens
      ? `Excluir este programa apaga junto ${itens} item(ns) do plano de ação. Continuar?`
      : 'Excluir este programa?';
    if (!confirm(aviso)) return;

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao && this.ProgramasEsocial) {
      try { await this.ProgramasEsocial.excluir(id); }
      catch (err) { this.showToast('Erro ao excluir: ' + err.message, 'err'); return; }
    }
    const i = this.PROGRAMAS.findIndex(x => x.id === id);
    if (i >= 0) this.PROGRAMAS.splice(i, 1);
    // O banco apaga em cascata; o espelho local precisa acompanhar.
    for (let k = this.PLANO_ACAO.length - 1; k >= 0; k--) {
      if (this.PLANO_ACAO[k].programa_id === id) this.PLANO_ACAO.splice(k, 1);
    }
    this.renderProgramas();
    this.showToast('Programa excluído', 'ok');
  }

  async abrirDocumentoPrograma(id) {
    const p = this.PROGRAMAS.find(x => x.id === id);
    if (!p?.arquivo_path || !this.StorageDocs) return;
    try {
      window.open(await this.StorageDocs.urlAssinada(p.arquivo_path), '_blank');
    } catch (err) {
      this.showToast('Não foi possível abrir o documento: ' + err.message, 'err');
    }
  }

  abrirModalItemPlano(programaId, itemId = null) {
    const form = this.$('#form-item-plano');
    if (!form) return;
    limparFormulario(form);

    const p = this.PROGRAMAS.find(x => x.id === programaId);
    const item = itemId != null ? this.PLANO_ACAO.find(x => x.id === itemId) : null;

    this.$('#plano-modal-titulo').textContent = item ? 'Editar ação' : 'Nova ação do plano';
    this.$('#plano-modal-sub').textContent = p ? `${p.tipo}${p.titulo ? ` — ${p.titulo}` : ''}` : '';
    form.elements['programa_id'].value = programaId;
    form.elements['id'].value = item?.id || '';
    if (item) {
      ['item', 'risco', 'responsavel', 'prazo', 'status', 'conclusao', 'observacoes'].forEach(k => {
        if (form.elements[k]) form.elements[k].value = item[k] || '';
      });
    }
    this.$('#modal-item-plano').classList.add('active');
  }

  fecharModalItemPlano() { this.$('#modal-item-plano')?.classList.remove('active'); }

  async salvarItemPlano(ev) {
    ev.preventDefault();
    const form = this.$('#form-item-plano');
    const d = Object.fromEntries(new FormData(form));
    const id = d.id ? parseInt(d.id, 10) : null;

    const payload = {
      programa_id: parseInt(d.programa_id, 10),
      item: (d.item || '').trim(),
      risco: (d.risco || '').trim() || null,
      responsavel: (d.responsavel || '').trim() || null,
      prazo: d.prazo || null,
      status: d.status || 'pendente',
      conclusao: d.conclusao || null,
      observacoes: (d.observacoes || '').trim() || null,
    };
    if (!payload.item) { this.showToast('Descreva a ação', 'err'); return; }
    // Concluído sem data de conclusão é o que faz a auditoria perguntar
    // "quando?". A data de hoje é o palpite certo e poupa digitação.
    if (payload.status === 'concluido' && !payload.conclusao) {
      payload.conclusao = new Date().toISOString().slice(0, 10);
    }

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    let salvo = { id: id ?? Date.now(), ...payload };
    if (temSessao && this.ProgramasEsocial) {
      try {
        salvo = await this.ProgramasEsocial.salvarItemPlano(id ? { id, ...payload } : payload);
      } catch (err) { this.showToast('Erro ao salvar: ' + err.message, 'err'); return; }
    }
    const i = this.PLANO_ACAO.findIndex(x => x.id === id);
    if (i >= 0) this.PLANO_ACAO[i] = salvo; else this.PLANO_ACAO.push(salvo);

    this.fecharModalItemPlano();
    this.renderProgramas();
    this.showToast('Ação salva', 'ok');
  }

  async excluirItemPlano(id) {
    if (!confirm('Excluir esta ação do plano?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao && this.ProgramasEsocial) {
      try { await this.ProgramasEsocial.excluirItemPlano(id); }
      catch (err) { this.showToast('Erro ao excluir: ' + err.message, 'err'); return; }
    }
    const i = this.PLANO_ACAO.findIndex(x => x.id === id);
    if (i >= 0) this.PLANO_ACAO.splice(i, 1);
    this.renderProgramas();
    this.showToast('Ação excluída', 'ok');
  }
}

export default ComplianceSstModule;
