// Desligamentos Module
// Gerencia renderização, drawer e modal de desligamentos.
//
// A entrevista de saída saiu da tela a pedido do RH: não era preenchida, e a
// coluna "Entrevista" marcava todo mundo como pendente, o que transformava o
// card em um contador permanente de dívida que ninguém ia pagar. A coluna
// jsonb `entrevista` continua no banco com o que já havia sido registrado —
// tirar a tela não apaga histórico.

import { limparFormulario } from '../utils/ui.js?v=dev';

export class DesligamentosModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.iniciais = deps.iniciais;
    this.fmtDate = deps.fmtDate;
    this.DESLIGAMENTOS = deps.DESLIGAMENTOS;
    this.COLABORADORES = deps.COLABORADORES;
    this.Auth = deps.Auth;
    this.Desligamentos = deps.Desligamentos;

    this.state = {
      drawerDeslId: null,
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'desl-search') { clearTimeout(this._searchT); this._searchT = setTimeout(() => this.render(), 250); }
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'desl-filter-motivo') this.render();
    });

    document.querySelectorAll('.nav-item[data-page="desligamentos"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  render() {
    const tb = this.$('#tb-desligamentos');
    if (!tb) return;

    const q = (this.$('#desl-search')?.value || '').trim().toLowerCase();
    const fMot = this.$('#desl-filter-motivo')?.value || '';

    const lista = this.DESLIGAMENTOS.filter(d => {
      if (fMot && d.motivo !== fMot) return false;
      if (q) {
        const hay = [d.nome, d.setor, d.area].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data));

    tb.innerHTML = lista.length
      ? this._renderLinhas(lista)
      : `<tr><td colspan="6" class="empty">Nenhum desligamento encontrado</td></tr>`;

    this._updateStats();
  }

  _renderLinhas(lista) {
    return lista.map(d => {
      const tipoChip = d.tipo === 'voluntario'
        ? `<span class="badge info">Voluntário</span>`
        : `<span class="badge neutral">Involuntário</span>`;
      return `
        <tr onclick="abrirDrawerDesl(${d.id})">
          <td>
            <div class="cell-person">
              <div class="cell-avatar" style="background:linear-gradient(135deg,#991B1B,#7F1D1D);">${this.h(this.iniciais(d.nome))}</div>
              <div>
                <div class="cell-person-name">${this.h(d.nome)}</div>
                <div class="cell-person-sub">${tipoChip.replace('<span class="badge', '<span class="badge" style="font-size:.62rem;padding:2px 7px;"')}</div>
              </div>
            </div>
          </td>
          <td>
            <div>${this.h(d.setor)}</div>
            ${d.area ? `<div class="cell-person-sub">${this.h(d.area)}</div>` : ''}
          </td>
          <td class="cell-mono">${this.fmtDate(d.data)}</td>
          <td>${this.h(d.motivo)}</td>
          <td class="cell-mono">${this._tempoEntre(d.admissao, d.data)}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm btn-icon" title="Excluir" onclick="excluirDesligamento(${d.id})">🗑</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  _updateStats() {
    const anoAtual = new Date().getFullYear();
    const doAno = this.DESLIGAMENTOS.filter(d => new Date(d.data + 'T00:00:00').getFullYear() === anoAtual);

    this.$('#desl-stat-total').textContent = doAno.length;

    const volunt = doAno.filter(d => d.tipo === 'voluntario').length;
    this.$('#desl-stat-volunt').textContent = doAno.length ? `${volunt}/${doAno.length}` : '0';

    if (doAno.length) {
      const totalDias = doAno.reduce((acc, d) => {
        const a = new Date(d.admissao + 'T00:00:00');
        const b = new Date(d.data + 'T00:00:00');
        return acc + (b - a) / (1000 * 60 * 60 * 24);
      }, 0);
      const mediaAnos = totalDias / doAno.length / 365.25;
      const anos = Math.floor(mediaAnos);
      const meses = Math.round((mediaAnos - anos) * 12);
      this.$('#desl-stat-tempo').textContent = anos > 0 ? `${anos}a ${meses}m` : `${meses} meses`;
    } else {
      this.$('#desl-stat-tempo').textContent = '—';
    }
  }

  abrirDrawer(id) {
    const d = this.DESLIGAMENTOS.find(x => x.id === id);
    if (!d) return;
    this.state.drawerDeslId = id;

    this.$('#ddesl-avatar').textContent = this.iniciais(d.nome);
    this.$('#ddesl-name').textContent = d.nome;
    this.$('#ddesl-role').textContent = `${d.setor}${d.area ? ` · ${d.area}` : ''}`;

    const tipoChip = d.tipo === 'voluntario'
      ? `<span class="badge info">Voluntário</span>`
      : `<span class="badge neutral">Involuntário</span>`;
    const avisoLabel = { trabalhado: 'Trabalhado', indenizado: 'Indenizado', dispensado: 'Dispensado' }[d.aviso] || '—';

    this.$('#ddesl-detalhes').innerHTML = `
      <div class="info-item"><div class="info-label">Data do desligamento</div><div class="info-value mono">${this.fmtDate(d.data)}</div></div>
      <div class="info-item"><div class="info-label">Último dia</div><div class="info-value mono">${this.fmtDate(d.ultimo_dia)}</div></div>
      <div class="info-item"><div class="info-label">Motivo</div><div class="info-value">${this.h(d.motivo)}</div></div>
      <div class="info-item"><div class="info-label">Tipo</div><div class="info-value">${tipoChip}</div></div>
      <div class="info-item"><div class="info-label">Aviso prévio</div><div class="info-value">${avisoLabel}</div></div>
      <div class="info-item"><div class="info-label">Tempo de casa</div><div class="info-value mono">${this._tempoEntre(d.admissao, d.data)}</div></div>
      <div class="info-sep"></div>
      <div class="info-item"><div class="info-label">Admissão</div><div class="info-value mono">${this.fmtDate(d.admissao)}</div></div>
      <div class="info-item" style="grid-column:1/-1"><div class="info-label">Observações</div><div class="info-value">${this.h(d.observacoes || '—')}</div></div>
    `;

    this.$('#drawer-backdrop-desl').classList.add('active');
    this.$('#drawer-desl').classList.add('active');
  }

  fecharDrawer() {
    this.$('#drawer-backdrop-desl').classList.remove('active');
    this.$('#drawer-desl').classList.remove('active');
    this.state.drawerDeslId = null;
  }

  abrirModalDesligamento() {
    const form = this.$('#form-desligamento');
    limparFormulario(form);
    const sel = this.$('#form-desl-colab');
    sel.innerHTML = this.COLABORADORES
      .filter(c => c.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => `<option value="${c.id}">${this.h(c.nome)} — ${this.h(c.setor)}${c.area ? ` · ${this.h(c.area)}` : ''}</option>`)
      .join('');
    this.$('#modal-desligamento').classList.add('active');
  }

  fecharModalDesligamento() {
    this.$('#modal-desligamento').classList.remove('active');
  }

  async salvarDesligamento(ev) {
    ev.preventDefault();
    const form = this.$('#form-desligamento');
    const data = Object.fromEntries(new FormData(form));
    const c = this.COLABORADORES.find(x => x.id === parseInt(data.colaborador_id, 10));
    if (!c) return;

    const payload = {
      colaborador_id:    c.id,
      data_desligamento: data.data,
      ultimo_dia:        data.ultimo_dia || data.data,
      motivo:            data.motivo,
      tipo:              data.tipo,
      aviso:             data.aviso,
      observacoes:       data.observacoes || '',
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        const saved = await this.Desligamentos.criar(payload);
        this.DESLIGAMENTOS.unshift({
          ...saved,
          nome: c.nome, cargo: c.cargo, setor: c.setor, area: c.area, admissao: c.admissao,
        });
        await window.Colaboradores?.atualizar(c.id, { status: 'inativo' }).catch(() => null);
      } catch (err) {
        window.showToast?.('Erro ao salvar: ' + err.message, 'err');
        return;
      }
    } else {
      const newId = Math.max(0, ...this.DESLIGAMENTOS.map(x => x.id)) + 1;
      this.DESLIGAMENTOS.unshift({
        id: newId, ...payload,
        nome: c.nome, cargo: c.cargo, setor: c.setor, area: c.area, admissao: c.admissao,
      });
      c.status = 'inativo';
    }

    this.fecharModalDesligamento();
    await this.render();
  }

  async excluirDesligamento(id) {
    if (!confirm('Excluir este registro de desligamento?')) return;
    const desl = this.DESLIGAMENTOS.find(x => x.id === id);
    if (!desl) return;

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Desligamentos.excluir(id);
        await window.Colaboradores?.atualizar(desl.colaborador_id, { status: 'ativo' }).catch(() => null);
      } catch (err) {
        window.showToast?.('Erro ao excluir: ' + err.message, 'err');
        return;
      }
    } else {
      this.DESLIGAMENTOS = this.DESLIGAMENTOS.filter(x => x.id !== id);
      const colab = this.COLABORADORES.find(c => c.id === desl.colaborador_id);
      if (colab) colab.status = 'ativo';
    }

    this.fecharDrawer();
    await this.render();
  }

  _tempoEntre(inicio, fim) {
    if (!inicio || !fim) return '—';
    const a = new Date(inicio + 'T00:00:00');
    const b = new Date(fim + 'T00:00:00');
    const anos = (b - a) / (1000 * 60 * 60 * 24 * 365.25);
    const y = Math.floor(anos);
    const m = Math.round((anos - y) * 12);
    if (y <= 0 && m <= 0) return '< 1 mês';
    if (y === 0) return `${m}m`;
    if (m === 0) return `${y}a`;
    return `${y}a ${m}m`;
  }
}

export default DesligamentosModule;
