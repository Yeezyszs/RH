// Filters Component
// Gerencia estado unificado de filtros (search + selects) com debounce

export class Filters {
  constructor({ inputs = [], selects = [], onChange, debounceMs = 150 }) {
    this.inputs   = inputs;
    this.selects  = selects;
    this.onChange = onChange;
    this.debounceMs = debounceMs;
    this._timer = null;
    this._listeners = [];

    this._setup();
  }

  _setup() {
    const fire = () => {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.onChange(this.values()), this.debounceMs);
    };

    document.addEventListener('input', (e) => {
      if (this.inputs.includes(e.target.id)) fire();
    });

    document.addEventListener('change', (e) => {
      if (this.selects.includes(e.target.id)) fire();
    });
  }

  values() {
    const result = {};
    const $ = (id) => document.getElementById(id);

    this.inputs.forEach(id => {
      const el = $(id);
      result[id] = el ? el.value.trim().toLowerCase() : '';
    });

    this.selects.forEach(id => {
      const el = $(id);
      result[id] = el ? el.value : '';
    });

    return result;
  }

  reset(ids = null) {
    const $ = (id) => document.getElementById(id);
    const targets = ids ?? [...this.inputs, ...this.selects];
    targets.forEach(id => {
      const el = $(id);
      if (el) el.value = '';
    });
    this.onChange(this.values());
  }
}

export default Filters;
