// Cronograma Module
// Gerencia o calendário mensal de eventos com feriados nacionais brasileiros

export class CronogramaModule {
  constructor(deps) {
    this.$ = deps.$;
    this.h = deps.h;
    this.addDays = deps.addDays;
    this.EVENTOS = deps.EVENTOS;
    this.Auth = deps.Auth;
    this.Cronograma = deps.Cronograma;

    this.state = {
      calMes: (() => {
        const hoje = new Date();
        return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      })(),
      editandoEventoId: null,
    };

    this.MESES_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('input', (e) => {
      if (e.target.id === 'cron-search') this.render();
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'cron-filter-tipo') this.render();
    });

    document.querySelectorAll('.nav-item[data-page="cronograma"]').forEach(el => {
      el.addEventListener('click', () => setTimeout(() => this.render(), 60));
    });
  }

  navCalendar(delta) {
    if (delta === 0) {
      const hoje = new Date();
      this.state.calMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    } else {
      this.state.calMes = new Date(this.state.calMes.getFullYear(), this.state.calMes.getMonth() + delta, 1);
    }
    this.render();
  }

  render() {
    const grid = this.$('#cal-grid');
    const title = this.$('#cal-title');
    if (!grid || !title) return;

    const { calMes } = this.state;
    title.textContent = `${this.MESES_LONG[calMes.getMonth()]} ${calMes.getFullYear()}`;

    const q = (this.$('#cron-search')?.value || '').trim().toLowerCase();
    const fT = this.$('#cron-filter-tipo')?.value || '';

    const ano = calMes.getFullYear();
    const mes = calMes.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diaSemanaIni = primeiroDia.getDay();
    const totalDias = ultimoDia.getDate();

    const anosVisiveis = new Set([ano]);
    if (mes === 0) anosVisiveis.add(ano - 1);
    if (mes === 11) anosVisiveis.add(ano + 1);
    const feriados = [...anosVisiveis].flatMap(y => this._feriadosNacionais(y));

    const todosEventos = [...this.EVENTOS, ...feriados];

    const eventosVisiveis = todosEventos.filter(e => {
      if (fT && e.tipo !== fT) return false;
      if (q) {
        const hay = [e.titulo, e.local, e.participantes, e.descricao].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const cells = [];
    for (let i = diaSemanaIni - 1; i >= 0; i--) {
      cells.push({ date: new Date(ano, mes, -i), out: true });
    }
    for (let i = 1; i <= totalDias; i++) {
      cells.push({ date: new Date(ano, mes, i), out: false });
    }
    const total = cells.length <= 35 ? 35 : 42;
    let extra = 1;
    while (cells.length < total) {
      cells.push({ date: new Date(ano, mes + 1, extra++), out: true });
    }

    const hojeIso = new Date().toISOString().slice(0, 10);

    grid.innerHTML = cells.map(cell => {
      const iso = cell.date.toISOString().slice(0, 10);
      const dia = cell.date.getDate();
      const dow = cell.date.getDay();
      const eventosDia = eventosVisiveis
        .filter(e => {
          // Para feriados usa e.data, para eventos normais usa e.data_inicio
          const dataEvento = e._feriado ? e.data : (e.data_inicio ? e.data_inicio.slice(0, 10) : null);
          return dataEvento === iso;
        })
        .sort((a, b) => {
          if (a._feriado && !b._feriado) return -1;
          if (b._feriado && !a._feriado) return 1;
          // Extrai hora do TIMESTAMP para ordenar
          const horaA = a.data_inicio ? a.data_inicio.slice(11, 16) : '';
          const horaB = b.data_inicio ? b.data_inicio.slice(11, 16) : '';
          return (horaA || '').localeCompare(horaB || '');
        });

      const ehFeriado = eventosDia.some(e => e._feriado);
      const maxShow = 3;
      const visibles = eventosDia.slice(0, maxShow);
      const extraN = eventosDia.length - visibles.length;

      const eventosHtml = visibles.map(e => {
        let horaHtml = '';
        if (e.data_inicio) {
          const hora = e.data_inicio.slice(11, 16); // Extrai HH:MM de ISO 8601
          if (hora !== '00:00') {
            horaHtml = `<span class="cal-event-time">${this.h(hora)}</span>`;
          }
        }
        const onclick = e._feriado
          ? ''
          : `onclick="event.stopPropagation(); abrirModalEvento(${e.id})"`;
        return `
          <div class="cal-event ${this.h(e.tipo)}" ${onclick} title="${this.h(e.titulo)}">
            ${horaHtml}<span class="cal-event-title">${this.h(e.titulo)}</span>
          </div>
        `;
      }).join('');

      const maisHtml = extraN > 0 ? `<div class="cal-event-more">+${extraN} mais</div>` : '';

      const classes = ['cal-cell'];
      if (cell.out) classes.push('out-of-month');
      if (dow === 0 || dow === 6) classes.push('weekend');
      if (ehFeriado) classes.push('holiday');
      if (iso === hojeIso) classes.push('today');

      return `
        <div class="${classes.join(' ')}" onclick="abrirModalEvento(null, '${iso}')">
          <div class="cal-day">${dia}</div>
          ${eventosHtml}
          ${maisHtml}
        </div>
      `;
    }).join('');

    const mesChaveAtual = `${ano}-${String(mes + 1).padStart(2, '0')}`;
    const eventosDoMes = todosEventos.filter(e => {
      const dataEvento = e._feriado ? e.data : (e.data_inicio ? e.data_inicio.slice(0, 10) : null);
      return dataEvento && dataEvento.startsWith(mesChaveAtual);
    });
    this.$('#cron-stat-mes').textContent = eventosDoMes.length;

    this.$('#cron-stat-hoje').textContent = todosEventos.filter(e => {
      const dataEvento = e._feriado ? e.data : (e.data_inicio ? e.data_inicio.slice(0, 10) : null);
      return dataEvento === hojeIso;
    }).length;

    const fim7 = this.addDays(hojeIso, 7);
    this.$('#cron-stat-7d').textContent = todosEventos.filter(e => {
      const dataEvento = e._feriado ? e.data : (e.data_inicio ? e.data_inicio.slice(0, 10) : null);
      return dataEvento && dataEvento >= hojeIso && dataEvento <= fim7;
    }).length;
  }

  abrirModalEvento(id = null, dataPre = null) {
    if (id != null && id < 0) return;

    const form = this.$('#form-evento');
    form.reset();
    this.state.editandoEventoId = id;

    if (id != null) {
      const e = this.EVENTOS.find(x => x.id === id);
      if (e) {
        this.$('#ev-modal-title').textContent = 'Editar evento';
        form.elements['id'].value = e.id || '';
        form.elements['titulo'].value = e.titulo || '';
        form.elements['tipo'].value = e.tipo || '';

        // Extrai data e hora do data_inicio (TIMESTAMP ISO 8601)
        if (e.data_inicio) {
          const dt = new Date(e.data_inicio);
          const data = dt.toISOString().slice(0, 10);
          const hora = dt.toISOString().slice(11, 16);
          form.elements['data'].value = data;
          form.elements['hora_inicio'].value = hora;
        }

        // Extrai hora do data_termino
        if (e.data_termino) {
          const dt = new Date(e.data_termino);
          const hora = dt.toISOString().slice(11, 16);
          form.elements['hora_fim'].value = hora;
        }

        form.elements['local'].value = e.local || '';
        form.elements['descricao'].value = e.descricao || '';
        this.$('#btn-ev-excluir').style.display = '';
      }
    } else {
      this.$('#ev-modal-title').textContent = 'Novo evento';
      this.$('#btn-ev-excluir').style.display = 'none';
      form.elements['data'].value = dataPre || new Date().toISOString().slice(0, 10);
    }

    this.$('#modal-evento').classList.add('active');
  }

  fecharModalEvento() {
    this.$('#modal-evento').classList.remove('active');
    this.state.editandoEventoId = null;
  }

  async salvarEvento(ev) {
    ev.preventDefault();
    const form = this.$('#form-evento');
    const data = Object.fromEntries(new FormData(form));
    const id = data.id ? parseInt(data.id, 10) : null;

    if (!data.data) {
      window.showToast?.('Informe a data do evento', 'err');
      return;
    }

    // Combina data + hora em TIMESTAMP (formato ISO 8601)
    const dataStr = data.data;
    const dataInicio = data.hora_inicio
      ? `${dataStr}T${data.hora_inicio}:00`
      : `${dataStr}T00:00:00`;

    let dataTermino = null;
    if (data.hora_fim) {
      dataTermino = `${dataStr}T${data.hora_fim}:00`;
    }

    const payload = {
      titulo:       data.titulo,
      tipo:         data.tipo,
      data_inicio:  dataInicio,
      data_termino: dataTermino,
      local:        data.local || '',
      descricao:    data.descricao || '',
    };

    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        if (id != null) {
          await this.Cronograma.atualizar(id, payload);
          const i = this.EVENTOS.findIndex(x => x.id === id);
          if (i >= 0) this.EVENTOS[i] = { ...this.EVENTOS[i], ...payload };
        } else {
          const saved = await this.Cronograma.criar(payload);
          this.EVENTOS.unshift(saved);
        }
      } catch (err) {
        window.showToast?.('Erro ao salvar: ' + err.message, 'err');
        return;
      }
    } else {
      const newId = Math.max(0, ...this.EVENTOS.map(x => x.id)) + 1;
      if (id != null) {
        const i = this.EVENTOS.findIndex(x => x.id === id);
        if (i >= 0) this.EVENTOS[i] = { id, ...payload };
      } else {
        this.EVENTOS.unshift({ id: newId, ...payload, criado_em: new Date().toISOString() });
      }
    }

    window.showToast?.(id != null ? 'Evento atualizado' : 'Evento criado', 'ok');
    this.fecharModalEvento();
    this.render();
  }

  async excluirEventoAtual() {
    if (this.state.editandoEventoId == null) return;
    if (!confirm('Excluir este evento?')) return;
    const id = this.state.editandoEventoId;
    const temSessao = this.Auth && await this.Auth.sessaoAtual().catch(() => null);
    if (temSessao) {
      try {
        await this.Cronograma.excluir(id);
      } catch (err) {
        window.showToast?.('Erro ao excluir: ' + err.message, 'err');
        return;
      }
    } else {
      this.EVENTOS = this.EVENTOS.filter(x => x.id !== id);
    }
    this.fecharModalEvento();
    this.render();
  }

  _pascoaISO(ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  _feriadosNacionais(ano) {
    const pascoa = this._pascoaISO(ano);
    return [
      { data: `${ano}-01-01`, titulo: 'Confraternização Universal', oficial: true },
      { data: `${ano}-04-21`, titulo: 'Tiradentes', oficial: true },
      { data: `${ano}-05-01`, titulo: 'Dia do Trabalho', oficial: true },
      { data: `${ano}-09-07`, titulo: 'Independência do Brasil', oficial: true },
      { data: `${ano}-10-12`, titulo: 'N. Sra. Aparecida', oficial: true },
      { data: `${ano}-11-02`, titulo: 'Finados', oficial: true },
      { data: `${ano}-11-15`, titulo: 'Proclamação da República', oficial: true },
      { data: `${ano}-11-20`, titulo: 'Consciência Negra', oficial: true },
      { data: `${ano}-12-25`, titulo: 'Natal', oficial: true },
      { data: this.addDays(pascoa, -48), titulo: 'Carnaval (segunda)', oficial: false },
      { data: this.addDays(pascoa, -47), titulo: 'Carnaval (terça)', oficial: false },
      { data: this.addDays(pascoa, -46), titulo: 'Quarta-feira de Cinzas', oficial: false },
      { data: this.addDays(pascoa, -2), titulo: 'Sexta-feira Santa', oficial: true },
      { data: this.addDays(pascoa, 60), titulo: 'Corpus Christi', oficial: false },
    ].map((f, idx) => ({
      id: -1000 - idx,
      tipo: 'feriado',
      hora_inicio: '',
      hora_fim: '',
      local: '',
      participantes: '',
      descricao: f.oficial ? 'Feriado nacional' : 'Ponto facultativo nacional',
      status: 'agendado',
      _feriado: true,
      ...f,
    }));
  }
}

export default CronogramaModule;
