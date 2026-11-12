// Organizacional Module
// Manages individual feedback, climate surveys, company policies, and survey responses

import { limparFormulario } from '../utils/ui.js?v=dev';
import {
  ESCALA, DIMENSOES, DIM_LABEL, PERGUNTAS,
  perguntasDe, totalRespostas, notaPergunta, notasPorDimensao,
  scoreGeral, dimensaoMaisFraca, favorabilidade, pctParticipacao,
} from '../utils/clima.js?v=dev';

export class FeedbackClimaModule {
  constructor(deps) {
    this.$                = deps.$;
    this.h                = deps.h;
    this.iniciais         = deps.iniciais;
    this.fmtDate          = deps.fmtDate;
    this.COLABORADORES    = deps.COLABORADORES;
    this.FEEDBACK         = deps.FEEDBACK;
    this.CLIMA            = deps.CLIMA;
    this.POLITICAS        = deps.POLITICAS;
    this.PROCEDIMENTOS    = deps.PROCEDIMENTOS;
    this.CHART_COLORS     = deps.CHART_COLORS;
    this.Auth             = deps.Auth;
    this.FeedbackClima    = deps.FeedbackClima;
    this.PoliticasEmpresa = deps.PoliticasEmpresa;
    this.ProcedimentosEmpresa = deps.ProcedimentosEmpresa;
    this.StorageDocs      = deps.StorageDocs;
    this.RespostasPesquisa = deps.RespostasPesquisa;
    this.showToast        = deps.showToast;

    this._chartClEvo  = null;
    this._chartClDims = null;

    this.init();
  }

  init() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'fb-search') { clearTimeout(this._searchT); this._searchT = setTimeout(() => this.renderFeedback(), 250); }
    });
    document.addEventListener('change', (e) => {
      if (e.target.id === 'fb-filter-setor') this.renderFeedback();
    });
    document.querySelectorAll('.nav-item[data-page="feedback-clima"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => {
        this.renderFeedback();
        this.renderClima();
        this.renderPoliticas();
        this.renderProcedimentos();
      }, 60));
    });
  }

  _notaGeral(f) {
    return (f.nota_entrega + f.nota_comportamento + f.nota_colaboracao) / 3;
  }

  // O score deixou de ser digitado: sai da distribuição de respostas de cada
  // pergunta (src/utils/clima.js). Entra o dado bruto, sai o resumo.
  _scoreGeral(p) {
    return scoreGeral(p);
  }

  _pctParticipacao(p) {
    return pctParticipacao(p);
  }

  renderFeedback() {
    const tb = this.$('#tb-feedback');
    if (!tb) return;

    const q    = (this.$('#fb-search')?.value || '').trim().toLowerCase();
    const fSet = this.$('#fb-filter-setor')?.value || '';

    const enriched = this.FEEDBACK.map(f => {
      const c = this.COLABORADORES.find(x => x.id === f.colaborador_id);
      return { ...f, _colab: c, _geral: this._notaGeral(f) };
    });

    const lista = enriched.filter(f => {
      if (fSet && f._colab?.setor !== fSet) return false;
      if (q) {
        const hay = [f._colab?.nome, f.avaliador].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data));

    tb.innerHTML = lista.length ? lista.map(f => {
      const c = f._colab;
      const dot = (n) => `<span class="rating" title="${n}/5">${[1, 2, 3, 4, 5].map(i =>
        `<span class="dot ${i <= n ? 'on-' + n : ''}"></span>`).join('')}</span>`;
      return `
        <tr onclick="if(${c?.id || 0}) abrirDrawerColab(${c?.id || 0})">
          <td>
            ${c ? `
              <div class="cell-person">
                <div class="cell-avatar">${this.h(this.iniciais(c.nome))}</div>
                <div>
                  <div class="cell-person-name">${this.h(c.nome)}</div>
                  <div class="cell-person-sub">${this.h(c.setor)}</div>
                </div>
              </div>` : `<span style="color:var(--text-soft)">—</span>`}
          </td>
          <td>${this.h(f.avaliador)}</td>
          <td class="cell-mono">${this.fmtDate(f.data)}</td>
          <td>${dot(f.nota_entrega)}</td>
          <td>${dot(f.nota_comportamento)}</td>
          <td>${dot(f.nota_colaboracao)}</td>
          <td class="cell-mono" style="text-align:right; font-weight:700; color:var(--phthalo-dark)">${f._geral.toFixed(1).replace('.', ',')}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalFeedback(${f.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirFeedback(${f.id})">🗑</button>
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="8" class="empty">Nenhum feedback encontrado</td></tr>`;

    const now           = new Date();
    const mesChaveAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.$('#fb-stat-mes').textContent   = this.FEEDBACK.filter(f => f.data.startsWith(mesChaveAtual)).length;
    const media = this.FEEDBACK.length
      ? this.FEEDBACK.reduce((s, f) => s + this._notaGeral(f), 0) / this.FEEDBACK.length : 0;
    this.$('#fb-stat-nota').textContent  = media ? media.toFixed(1).replace('.', ',') + '/5' : '—';

    const limite = new Date();
    limite.setMonth(limite.getMonth() - 6);
    const limiteIso = limite.toISOString().slice(0, 10);
    const ativos = this.COLABORADORES.filter(c => c.status !== 'inativo');
    let semFb = 0;
    ativos.forEach(c => {
      const ult = this.FEEDBACK.filter(f => f.colaborador_id === c.id)
        .sort((a, b) => b.data.localeCompare(a.data))[0];
      if (!ult || ult.data < limiteIso) semFb++;
    });
    this.$('#fb-stat-sem').textContent   = semFb;
    this.$('#fb-stat-total').textContent = this.FEEDBACK.length;
  }

  // Reacende as estrelas ao editar. O valor já vai para o input escondido pelo
  // laço de Object.entries; sem isto só a parte visível fica em branco, e o
  // formulário passa a mentir sobre o próprio estado.
  _setRating(field, value) {
    if (!value) return;
    const grupo = document.querySelector(`#form-feedback .rating-input[data-rating-field="${field}"]`);
    if (grupo) {
      grupo.querySelectorAll('button').forEach(b =>
        b.classList.toggle('active', parseInt(b.dataset.ratingVal, 10) === value));
    }
    const input = document.querySelector(`#form-feedback [name="${field}"]`);
    if (input) input.value = value;
  }

  abrirModalFeedback(id = null) {
    const form = this.$('#form-feedback');
    limparFormulario(form);
    document.querySelectorAll('#form-feedback .rating-input').forEach(g => {
      g.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    });
    this.$('#form-fb-colab').innerHTML = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => `<option value="${c.id}">${this.h(c.nome)} — ${this.h(c.setor)}</option>`).join('');

    if (id != null) {
      const f = this.FEEDBACK.find(x => x.id === id);
      if (f) {
        this.$('#fb-modal-title').textContent = 'Editar feedback';
        for (const [k, v] of Object.entries(f)) {
          const fld = form.elements[k];
          if (fld) fld.value = v ?? '';
        }
        this._setRating('nota_entrega',       f.nota_entrega);
        this._setRating('nota_comportamento', f.nota_comportamento);
        this._setRating('nota_colaboracao',   f.nota_colaboracao);
      }
    } else {
      this.$('#fb-modal-title').textContent = 'Registrar feedback';
      form.elements['data'].value = new Date().toISOString().slice(0, 10);
    }
    this.$('#modal-feedback').classList.add('active');
  }

  fecharModalFeedback() {
    this.$('#modal-feedback').classList.remove('active');
  }

  async salvarFeedback(ev) {
    ev.preventDefault();
    const form = this.$('#form-feedback');
    const data = Object.fromEntries(new FormData(form));
    const id   = data.id ? parseInt(data.id, 10) : null;

    const payload = {
      colaborador_id:     parseInt(data.colaborador_id, 10),
      avaliador:          data.avaliador,
      data:               data.data,
      nota_entrega:       parseInt(data.nota_entrega, 10)       || 0,
      nota_comportamento: parseInt(data.nota_comportamento, 10) || 0,
      nota_colaboracao:   parseInt(data.nota_colaboracao, 10)   || 0,
      pontos_fortes:      data.pontos_fortes || '',
      pontos_desenvolver: data.pontos_desenvolver || '',
      plano_acao:         data.plano_acao || '',
    };

    if (!payload.nota_entrega || !payload.nota_comportamento || !payload.nota_colaboracao) {
      this.showToast('Preencha as 3 notas', 'err');
      return;
    }

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        if (id != null) {
          const saved = await this.FeedbackClima.atualizarFeedback(id, payload);
          const i = this.FEEDBACK.findIndex(x => x.id === id);
          if (i >= 0) this.FEEDBACK[i] = saved;
        } else {
          const saved = await this.FeedbackClima.criarFeedback(payload);
          this.FEEDBACK.unshift(saved);
        }
      } catch (err) { this.showToast('Erro ao salvar: ' + err.message, 'err'); return; }
    } else {
      if (id != null) {
        const i = this.FEEDBACK.findIndex(x => x.id === id);
        if (i >= 0) this.FEEDBACK[i] = { ...this.FEEDBACK[i], ...payload };
      } else {
        const nextId = Math.max(0, ...this.FEEDBACK.map(x => x.id)) + 1;
        this.FEEDBACK.unshift({ id: nextId, ...payload });
      }
    }
    this.showToast(id != null ? 'Feedback atualizado' : 'Feedback registrado', 'ok');
    this.fecharModalFeedback();
    this.renderFeedback();
  }

  async excluirFeedback(id) {
    if (!confirm('Excluir este feedback?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try { await this.FeedbackClima.excluirFeedback(id); } catch (err) { this.showToast('Erro: ' + err.message, 'err'); return; }
    }
    const idx = this.FEEDBACK.findIndex(x => x.id === id);
    if (idx >= 0) this.FEEDBACK.splice(idx, 1);
    this.renderFeedback();
    this.showToast('Feedback excluído');
  }

  renderClima() {
    const tb = this.$('#tb-clima');
    if (!tb) return;

    const ordenadas = [...this.CLIMA].sort((a, b) => a.inicio.localeCompare(b.inicio));
    const ultima    = ordenadas[ordenadas.length - 1];

    tb.innerHTML = [...this.CLIMA].sort((a, b) => b.inicio.localeCompare(a.inicio)).map(p => {
      const part = this._pctParticipacao(p);
      const sc   = this._scoreGeral(p);
      const partBadge = part >= 80 ? `<span class="badge ok">${part.toFixed(0)}%</span>`
                      : part >= 60 ? `<span class="badge warn">${part.toFixed(0)}%</span>`
                                   : `<span class="badge danger">${part.toFixed(0)}%</span>`;
      return `
        <tr>
          <td style="font-weight:600">${this.h(p.titulo)}</td>
          <td class="cell-mono">${this.fmtDate(p.inicio)} → ${this.fmtDate(p.fim)}</td>
          <td class="cell-mono" style="text-align:right">${p.convidados}</td>
          <td class="cell-mono" style="text-align:right">${p.responderam}</td>
          <td>${partBadge}</td>
          <td class="cell-mono" style="text-align:right; font-weight:700; color:var(--phthalo-dark)">${sc.toFixed(2).replace('.', ',')}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm btn-icon" title="Ver respostas" onclick="abrirModalRespostasPesquisa(${p.id})">☰</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalClima(${p.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirClima(${p.id})">🗑</button>
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="7" class="empty">Nenhuma pesquisa cadastrada</td></tr>`;

    if (ultima) {
      this.$('#cl-stat-ultima').textContent = `${ultima.titulo} · ${this.fmtDate(ultima.fim)}`;
      this.$('#cl-stat-part').textContent   = this._pctParticipacao(ultima).toFixed(0) + '%';
      this.$('#cl-stat-score').textContent  = this._scoreGeral(ultima).toFixed(2).replace('.', ',');
      const pior = dimensaoMaisFraca(ultima);
      this.$('#cl-stat-fraca').textContent = pior
        ? `${pior.rotulo} · ${pior.nota.toFixed(1).replace('.', ',')}`
        : '—';
    } else {
      this.$('#cl-stat-ultima').textContent = '—';
      this.$('#cl-stat-part').textContent   = '—';
      this.$('#cl-stat-score').textContent  = '—';
      this.$('#cl-stat-fraca').textContent  = '—';
    }

    this._renderPerguntas(ultima);

    this._chartClEvo?.destroy();
    this._chartClEvo = new Chart(this.$('#chart-cl-evolucao'), {
      type: 'line',
      data: {
        labels: ordenadas.map(p => p.titulo),
        datasets: [{
          label: 'Score geral',
          data: ordenadas.map(p => this._scoreGeral(p)),
          borderColor: this.CHART_COLORS.phthalo,
          backgroundColor: 'rgba(46,122,184,.12)',
          borderWidth: 2.5,
          tension: .35,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: this.CHART_COLORS.phthaloBright,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 10, grid: { color: this.CHART_COLORS.grid } },
          x: { grid: { display: false } },
        },
      },
    });

    this._chartClDims?.destroy();
    if (ultima) {
      // Só as dimensões com resposta entram no gráfico — dimensão sem resposta
      // apareceria como barra zerada, que é nota péssima, não ausência.
      const notas = notasPorDimensao(ultima);
      const dims  = DIMENSOES.map(d => d.chave).filter(d => notas[d] != null);
      this._chartClDims = new Chart(this.$('#chart-cl-dimensoes'), {
        type: 'bar',
        data: {
          labels: dims.map(d => DIM_LABEL[d]),
          datasets: [{
            label: 'Score',
            data: dims.map(d => notas[d]),
            backgroundColor: dims.map(d => {
              const v = notas[d];
              return v >= 7.5 ? '#10B981' : v >= 6.0 ? '#F59E0B' : '#EF4444';
            }),
            borderRadius: 4,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { min: 0, max: 10, grid: { color: this.CHART_COLORS.grid } },
            y: { grid: { display: false } },
          },
        },
      });
    }
  }

  /**
   * Pergunta a pergunta: a distribuição crua, a favorabilidade e a nota.
   *
   * A barra empilhada mostra onde as respostas se concentram. Sem ela, duas
   * perguntas com a mesma média parecem iguais — e uma pode ser "todo mundo
   * neutro" e a outra "metade adora, metade detesta", que pedem reações
   * opostas do RH.
   */
  _renderPerguntas(pesquisa) {
    const tb = this.$('#tb-clima-perguntas');
    if (!tb) return;

    if (!pesquisa) {
      tb.innerHTML = '<tr><td colspan="5" class="empty">Nenhuma pesquisa cadastrada</td></tr>';
      return;
    }

    const perguntas = perguntasDe(pesquisa);
    const badge = this.$('#cl-perguntas-badge');
    if (badge) {
      badge.textContent = `${perguntas.length} perguntas · ${pesquisa.responderam || 0} respostas`;
    }

    tb.innerHTML = perguntas.map(p => {
      const total = totalRespostas(p);
      const nota  = notaPergunta(p);
      const fav   = favorabilidade(p);
      const barras = ESCALA.map((e, i) => {
        const n = Number(p.respostas?.[i]) || 0;
        if (!n || !total) return '';
        const pct = (n / total) * 100;
        return `<span style="width:${pct}%; background:${e.cor}" title="${e.rotulo}: ${n}"></span>`;
      }).join('');
      const corNota = nota == null ? 'var(--text-soft)'
        : nota >= 7.5 ? 'var(--success)' : nota >= 6 ? 'var(--warning)' : 'var(--danger)';
      return `
        <tr>
          <td>${this.h(p.texto)}</td>
          <td><span class="badge neutral">${this.h(DIM_LABEL[p.dimensao] || p.dimensao || '—')}</span></td>
          <td><div class="cl-barra">${barras}</div></td>
          <td class="cell-mono" style="text-align:right">${fav == null ? '—' : fav.toFixed(0) + '%'}</td>
          <td class="cell-mono" style="text-align:right; font-weight:700; color:${corNota}">
            ${nota == null ? '—' : nota.toFixed(1).replace('.', ',')}
          </td>
        </tr>`;
    }).join('');
  }

  /** Campos de distribuição no modal: cinco números por pergunta. */
  _renderFormPerguntas(pesquisa) {
    const legenda = this.$('#cl-escala-legenda');
    if (legenda) {
      legenda.innerHTML = ESCALA.map(e =>
        `<span><i style="background:${e.cor}"></i>${this.h(e.curto)}</span>`).join('');
    }

    const alvoForm = this.$('#cl-form-perguntas');
    if (!alvoForm) return;

    const gravadas = perguntasDe(pesquisa);
    // O questionário padrão manda na ordem; uma pesquisa antiga com outras
    // perguntas continua editável porque casamos pela chave.
    const base = gravadas.length ? gravadas : PERGUNTAS;
    alvoForm.innerHTML = base.map((p, i) => {
      const resp = p.respostas || [0, 0, 0, 0, 0];
      return `
        <div class="cl-pergunta">
          <div class="cl-pergunta-texto">${i + 1}. ${this.h(p.texto)}</div>
          <div class="cl-pergunta-campos">
            ${ESCALA.map((e, j) => `
              <input type="number" min="0" step="1" name="resp_${i}_${j}"
                     value="${Number(resp[j]) || 0}" title="${this.h(e.rotulo)}"
                     aria-label="${this.h(p.texto)} — ${this.h(e.rotulo)}">`).join('')}
            <span class="cl-pergunta-total" id="cl-total-${i}"></span>
          </div>
        </div>`;
    }).join('');
    this._perguntasDoModal = base;
    this.atualizarPreviaClima();
  }

  /** Lê o formulário e devolve as perguntas no formato que vai para o banco. */
  _perguntasDoForm() {
    const form = this.$('#form-clima');
    const base = this._perguntasDoModal || PERGUNTAS;
    if (!form) return [];
    return base.map((p, i) => ({
      chave: p.chave,
      texto: p.texto,
      dimensao: p.dimensao,
      respostas: ESCALA.map((_, j) =>
        Math.max(0, parseInt(form.elements[`resp_${i}_${j}`]?.value, 10) || 0)),
    }));
  }

  /**
   * Confere o preenchimento enquanto o RH digita.
   *
   * O erro clássico ao transcrever uma pesquisa é a linha que não fecha com o
   * total de respondentes — some ou sobra gente numa pergunta e ninguém nota.
   * Aqui cada linha mostra o seu total e destaca quem destoa.
   */
  atualizarPreviaClima() {
    const form = this.$('#form-clima');
    const alvoPrevia = this.$('#cl-form-previa');
    if (!form || !alvoPrevia) return;

    const perguntas = this._perguntasDoForm();
    const esperado = parseInt(form.elements['responderam']?.value, 10) || 0;
    let divergentes = 0;

    perguntas.forEach((p, i) => {
      const total = totalRespostas(p);
      const el = this.$(`#cl-total-${i}`);
      const fora = esperado > 0 && total !== esperado;
      if (fora) divergentes++;
      if (el) {
        el.textContent = String(total);
        el.classList.toggle('fora', fora);
      }
    });

    const pesquisa = { perguntas, responderam: esperado };
    const score = scoreGeral(pesquisa);
    alvoPrevia.innerHTML = `Score geral: <strong>${score.toFixed(2).replace('.', ',')}</strong>/10`
      + (esperado
        ? divergentes
          ? ` · <span style="color:var(--danger)">${divergentes} pergunta${divergentes === 1 ? '' : 's'} não fecha${divergentes === 1 ? '' : 'm'} com ${esperado} respostas</span>`
          : ` · todas as perguntas fecham com ${esperado} respostas`
        : '');
  }

  abrirModalClima(id = null) {
    const form = this.$('#form-clima');
    limparFormulario(form);
    if (id != null) {
      const p = this.CLIMA.find(x => x.id === id);
      if (p) {
        this.$('#cl-modal-title').textContent = 'Editar pesquisa';
        for (const [k, v] of Object.entries(p)) {
          // `perguntas` é um array e vira os campos de distribuição logo
          // abaixo; jogá-lo num input viraria "[object Object]".
          if (k === 'perguntas') continue;
          const f = form.elements[k];
          if (f) f.value = v ?? '';
        }
        this._renderFormPerguntas(p);
      }
    } else {
      this.$('#cl-modal-title').textContent = 'Nova pesquisa de clima';
      this._renderFormPerguntas(null);
    }
    this.$('#modal-clima').classList.add('active');
  }

  fecharModalClima() {
    this.$('#modal-clima').classList.remove('active');
  }

  async salvarClima(ev) {
    ev.preventDefault();
    const form = this.$('#form-clima');
    const data = Object.fromEntries(new FormData(form));
    const id   = data.id ? parseInt(data.id, 10) : null;

    const payload = {
      titulo:               data.titulo,
      inicio:               data.inicio,
      fim:                  data.fim,
      convidados:           parseInt(data.convidados, 10)  || 0,
      responderam:          parseInt(data.responderam, 10) || 0,
      // A distribuição por pergunta é o dado; as notas por dimensão são
      // calculadas na leitura, não gravadas.
      perguntas:            this._perguntasDoForm(),
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        if (id != null) {
          const saved = await this.FeedbackClima.atualizarPesquisa(id, payload);
          const i = this.CLIMA.findIndex(x => x.id === id);
          if (i >= 0) this.CLIMA[i] = saved;
        } else {
          const saved = await this.FeedbackClima.criarPesquisa(payload);
          this.CLIMA.unshift(saved);
        }
      } catch (err) { this.showToast('Erro ao salvar: ' + err.message, 'err'); return; }
    } else {
      if (id != null) {
        const i = this.CLIMA.findIndex(x => x.id === id);
        if (i >= 0) this.CLIMA[i] = { ...this.CLIMA[i], ...payload };
      } else {
        const nextId = Math.max(0, ...this.CLIMA.map(x => x.id)) + 1;
        this.CLIMA.unshift({ id: nextId, ...payload });
      }
    }
    this.showToast(id != null ? 'Pesquisa atualizada' : 'Pesquisa cadastrada', 'ok');
    this.fecharModalClima();
    this.renderClima();
  }

  async excluirClima(id) {
    if (!confirm('Excluir esta pesquisa?')) return;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try { await this.FeedbackClima.excluirPesquisa(id); } catch (err) { this.showToast('Erro: ' + err.message, 'err'); return; }
    }
    const idx = this.CLIMA.findIndex(x => x.id === id);
    if (idx >= 0) this.CLIMA.splice(idx, 1);
    this.renderClima();
    this.showToast('Pesquisa excluída');
  }

  async abrirModalRespostasPesquisa(pesquisaId) {
    const modal = this.$('#modal-respostas-pesquisa');
    if (!modal) return;
    const pesquisa = this.CLIMA.find(x => x.id === pesquisaId);
    this.$('#modal-resp-title').textContent = pesquisa?.titulo || 'Respostas da pesquisa';
    this.$('#modal-resp-body').innerHTML = `<p class="empty">Carregando...</p>`;
    modal.classList.add('active');

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (!temSessao) {
      this.$('#modal-resp-body').innerHTML = `<p class="empty">Disponível apenas com sessão ativa</p>`;
      return;
    }
    try {
      const respostas = await this.RespostasPesquisa.listarPorPesquisa(pesquisaId);
      if (!respostas.length) {
        this.$('#modal-resp-body').innerHTML = `<p class="empty">Nenhuma resposta registrada</p>`;
        return;
      }
      const por_colaborador = {};
      respostas.forEach(r => {
        const nome = r.colaboradores?.nome || `#${r.colaborador_id}`;
        if (!por_colaborador[nome]) por_colaborador[nome] = [];
        por_colaborador[nome].push(r);
      });
      this.$('#modal-resp-body').innerHTML = Object.entries(por_colaborador).map(([nome, regs]) => `
        <div style="margin-bottom:16px">
          <div style="font-weight:600;margin-bottom:6px">${this.h(nome)}</div>
          <table class="data" style="margin:0">
            <thead><tr><th>Pergunta</th><th>Resposta</th><th style="text-align:right">Rating</th></tr></thead>
            <tbody>
              ${regs.map(r => `<tr><td>${this.h(r.pergunta || '—')}</td><td>${this.h(r.resposta || '—')}</td><td class="cell-mono" style="text-align:right">${r.rating ?? '—'}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      `).join('');
    } catch (err) {
      this.$('#modal-resp-body').innerHTML = `<p class="empty" style="color:var(--danger)">Erro: ${this.h(err.message)}</p>`;
    }
  }

  fecharModalRespostasPesquisa() {
    this.$('#modal-respostas-pesquisa')?.classList.remove('active');
  }

  // ─── Anexos (compartilhado entre Políticas e Procedimentos) ────────────────

  _anexoCell(item, verFn) {
    if (!item.arquivo_path) return `<span style="color:var(--text-soft)">—</span>`;
    const nome = item.arquivo_nome || 'documento.pdf';
    return `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); ${verFn}(${item.id})" title="${this.h(nome)}">📎 ${this.h(nome.length > 24 ? nome.slice(0, 24) + '…' : nome)}</button>`;
  }

  async _abrirAnexo(item) {
    if (!item?.arquivo_path) return;
    if (this.StorageDocs) {
      try {
        const url = await this.StorageDocs.urlAssinada(item.arquivo_path);
        window.open(url, '_blank');
      } catch (err) { this.showToast('Erro ao abrir anexo: ' + err.message, 'err'); }
    }
  }

  // Faz upload do arquivo do input (se houver) e devolve {arquivo_path, arquivo_nome}
  // a mesclar no payload. Retorna null se não houver arquivo novo.
  async _uploadSeHouver(form, prefixo) {
    const input = form.elements['arquivo'];
    const file = input && input.files && input.files[0];
    if (!file) return null;
    if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      throw new Error('Anexe um arquivo PDF');
    }
    if (file.size > 15 * 1024 * 1024) throw new Error('Arquivo muito grande (máx. 15MB)');
    if (!this.StorageDocs) throw new Error('Upload indisponível sem sessão');
    const { path, nome } = await this.StorageDocs.upload(file, prefixo);
    return { arquivo_path: path, arquivo_nome: nome };
  }

  verArquivoPolitica(id) { this._abrirAnexo(this.POLITICAS.find(x => x.id === id)); }
  verArquivoProcedimento(id) { this._abrirAnexo(this.PROCEDIMENTOS.find(x => x.id === id)); }

  // ─── Políticas ─────────────────────────────────────────────────────────────

  renderPoliticas() {
    const tb = this.$('#tb-politicas');
    if (!tb) return;

    const lista = [...this.POLITICAS].sort((a, b) =>
      (b.atualizado_em || '').localeCompare(a.atualizado_em || ''));

    tb.innerHTML = lista.length ? lista.map(p => {
      const data = p.atualizado_em || p.criado_em;
      const dataFmt = data ? this.fmtDate(data.slice(0, 10)) : '—';
      const desc = (p.descricao || '').trim();
      const descCurta = desc.length > 120 ? desc.slice(0, 120) + '…' : (desc || '—');
      return `
        <tr onclick="abrirModalPolitica(${p.id})" style="cursor:pointer">
          <td style="font-weight:600">${this.h(p.titulo)}</td>
          <td style="white-space:pre-line; color:var(--text-soft)">${this.h(descCurta)}</td>
          <td>${this._anexoCell(p, 'verArquivoPolitica')}</td>
          <td class="cell-mono">${dataFmt}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalPolitica(${p.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirPolitica(${p.id})">🗑</button>
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="5" class="empty">Nenhuma política cadastrada</td></tr>`;
  }

  abrirModalPolitica(id = null) {
    const form = this.$('#form-politica');
    if (!form) return;
    limparFormulario(form);
    let atual = null;
    if (id != null) {
      const p = this.POLITICAS.find(x => x.id === id);
      if (p) {
        atual = p;
        this.$('#pol-modal-title').textContent = 'Editar política';
        form.elements['id'].value        = p.id;
        form.elements['titulo'].value     = p.titulo ?? '';
        form.elements['descricao'].value  = p.descricao ?? '';
      }
    } else {
      this.$('#pol-modal-title').textContent = 'Nova política';
    }
    this._anexoAtualLabel('pol-anexo-atual', atual, 'verArquivoPolitica');
    this.$('#modal-politica').classList.add('active');
  }

  _anexoAtualLabel(elId, item, verFn) {
    const el = this.$('#' + elId);
    if (!el) return;
    if (item && item.arquivo_path) {
      el.innerHTML = `Anexo atual: <a href="#" onclick="event.preventDefault(); ${verFn}(${item.id})">📎 ${this.h(item.arquivo_nome || 'documento.pdf')}</a> <span style="color:var(--text-soft)">— envie outro para substituir</span>`;
    } else {
      el.innerHTML = '';
    }
  }

  fecharModalPolitica() {
    this.$('#modal-politica')?.classList.remove('active');
  }

  async salvarPolitica(ev) {
    if (ev) ev.preventDefault();
    const form = this.$('#form-politica');
    const data = Object.fromEntries(new FormData(form));
    const id   = data.id ? parseInt(data.id, 10) : null;

    const payload = {
      titulo:    (data.titulo || '').trim(),
      descricao: (data.descricao || '').trim(),
    };
    if (!payload.titulo) { this.showToast('Informe o título da política', 'err'); return; }

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);

    if (temSessao && this.PoliticasEmpresa) {
      try {
        const anexo = await this._uploadSeHouver(form, 'politicas');
        if (anexo) Object.assign(payload, anexo);
        if (id != null) {
          const saved = await this.PoliticasEmpresa.atualizar(id, payload);
          const i = this.POLITICAS.findIndex(x => x.id === id);
          if (i >= 0) this.POLITICAS[i] = saved;
        } else {
          const saved = await this.PoliticasEmpresa.criar(payload);
          this.POLITICAS.unshift(saved);
        }
      } catch (err) { this.showToast('Erro ao salvar: ' + err.message, 'err'); return; }
    } else {
      const agora = new Date().toISOString();
      if (id != null) {
        const i = this.POLITICAS.findIndex(x => x.id === id);
        if (i >= 0) this.POLITICAS[i] = { ...this.POLITICAS[i], ...payload, atualizado_em: agora };
      } else {
        const nextId = Math.max(0, ...this.POLITICAS.map(x => x.id)) + 1;
        this.POLITICAS.unshift({ id: nextId, ...payload, criado_em: agora, atualizado_em: agora });
      }
    }
    this.showToast(id != null ? 'Política atualizada' : 'Política cadastrada', 'ok');
    this.fecharModalPolitica();
    this.renderPoliticas();
  }

  async excluirPolitica(id) {
    if (!confirm('Excluir esta política?')) return;
    const p = this.POLITICAS.find(x => x.id === id);
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao && this.PoliticasEmpresa) {
      try { await this.PoliticasEmpresa.excluir(id); } catch (err) { this.showToast('Erro: ' + err.message, 'err'); return; }
      if (p?.arquivo_path && this.StorageDocs) this.StorageDocs.remover(p.arquivo_path);
    }
    const idx = this.POLITICAS.findIndex(x => x.id === id);
    if (idx >= 0) this.POLITICAS.splice(idx, 1);
    this.renderPoliticas();
    this.showToast('Política excluída');
  }

  // ─── Procedimentos ─────────────────────────────────────────────────────────

  renderProcedimentos() {
    const tb = this.$('#tb-procedimentos');
    if (!tb) return;

    const lista = [...this.PROCEDIMENTOS].sort((a, b) =>
      (b.atualizado_em || '').localeCompare(a.atualizado_em || ''));

    tb.innerHTML = lista.length ? lista.map(p => {
      const data = p.atualizado_em || p.criado_em;
      const dataFmt = data ? this.fmtDate(data.slice(0, 10)) : '—';
      const desc = (p.descricao || '').trim();
      const descCurta = desc.length > 120 ? desc.slice(0, 120) + '…' : (desc || '—');
      return `
        <tr onclick="abrirModalProcedimento(${p.id})" style="cursor:pointer">
          <td style="font-weight:600">${this.h(p.titulo)}</td>
          <td style="white-space:pre-line; color:var(--text-soft)">${this.h(descCurta)}</td>
          <td>${this._anexoCell(p, 'verArquivoProcedimento')}</td>
          <td class="cell-mono">${dataFmt}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="abrirModalProcedimento(${p.id})">✎</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirProcedimento(${p.id})">🗑</button>
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="5" class="empty">Nenhum procedimento cadastrado</td></tr>`;
  }

  abrirModalProcedimento(id = null) {
    const form = this.$('#form-procedimento');
    if (!form) return;
    limparFormulario(form);
    let atual = null;
    if (id != null) {
      const p = this.PROCEDIMENTOS.find(x => x.id === id);
      if (p) {
        atual = p;
        this.$('#proc-modal-title').textContent = 'Editar procedimento';
        form.elements['id'].value        = p.id;
        form.elements['titulo'].value     = p.titulo ?? '';
        form.elements['descricao'].value  = p.descricao ?? '';
      }
    } else {
      this.$('#proc-modal-title').textContent = 'Novo procedimento';
    }
    this._anexoAtualLabel('proc-anexo-atual', atual, 'verArquivoProcedimento');
    this.$('#modal-procedimento').classList.add('active');
  }

  fecharModalProcedimento() {
    this.$('#modal-procedimento')?.classList.remove('active');
  }

  async salvarProcedimento(ev) {
    if (ev) ev.preventDefault();
    const form = this.$('#form-procedimento');
    const data = Object.fromEntries(new FormData(form));
    const id   = data.id ? parseInt(data.id, 10) : null;

    const payload = {
      titulo:    (data.titulo || '').trim(),
      descricao: (data.descricao || '').trim(),
    };
    if (!payload.titulo) { this.showToast('Informe o título do procedimento', 'err'); return; }

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);

    if (temSessao && this.ProcedimentosEmpresa) {
      try {
        const anexo = await this._uploadSeHouver(form, 'procedimentos');
        if (anexo) Object.assign(payload, anexo);
        if (id != null) {
          const saved = await this.ProcedimentosEmpresa.atualizar(id, payload);
          const i = this.PROCEDIMENTOS.findIndex(x => x.id === id);
          if (i >= 0) this.PROCEDIMENTOS[i] = saved;
        } else {
          const saved = await this.ProcedimentosEmpresa.criar(payload);
          this.PROCEDIMENTOS.unshift(saved);
        }
      } catch (err) { this.showToast('Erro ao salvar: ' + err.message, 'err'); return; }
    } else {
      const agora = new Date().toISOString();
      if (id != null) {
        const i = this.PROCEDIMENTOS.findIndex(x => x.id === id);
        if (i >= 0) this.PROCEDIMENTOS[i] = { ...this.PROCEDIMENTOS[i], ...payload, atualizado_em: agora };
      } else {
        const nextId = Math.max(0, ...this.PROCEDIMENTOS.map(x => x.id)) + 1;
        this.PROCEDIMENTOS.unshift({ id: nextId, ...payload, criado_em: agora, atualizado_em: agora });
      }
    }
    this.showToast(id != null ? 'Procedimento atualizado' : 'Procedimento cadastrado', 'ok');
    this.fecharModalProcedimento();
    this.renderProcedimentos();
  }

  async excluirProcedimento(id) {
    if (!confirm('Excluir este procedimento?')) return;
    const p = this.PROCEDIMENTOS.find(x => x.id === id);
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao && this.ProcedimentosEmpresa) {
      try { await this.ProcedimentosEmpresa.excluir(id); } catch (err) { this.showToast('Erro: ' + err.message, 'err'); return; }
      if (p?.arquivo_path && this.StorageDocs) this.StorageDocs.remover(p.arquivo_path);
    }
    const idx = this.PROCEDIMENTOS.findIndex(x => x.id === id);
    if (idx >= 0) this.PROCEDIMENTOS.splice(idx, 1);
    this.renderProcedimentos();
    this.showToast('Procedimento excluído');
  }
}

export default FeedbackClimaModule;
