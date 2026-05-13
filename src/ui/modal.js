// Modal Component
// Gerencia ciclo de vida de modais: open/close/ESC/backdrop

export class Modal {
  constructor({ modalId, $ }) {
    this.$ = $;
    this.modalId = modalId;
    this._onEsc = null;
    this._onBackdrop = null;
  }

  open() {
    const el = this.$(`#${this.modalId}`);
    if (!el) return;
    el.classList.add('active');

    this._onEsc = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this._onEsc);

    this._onBackdrop = (e) => {
      if (e.target === el) this.close();
    };
    el.addEventListener('click', this._onBackdrop);
  }

  close() {
    const el = this.$(`#${this.modalId}`);
    if (!el) return;
    el.classList.remove('active');

    if (this._onEsc) {
      document.removeEventListener('keydown', this._onEsc);
      this._onEsc = null;
    }
    if (this._onBackdrop) {
      el.removeEventListener('click', this._onBackdrop);
      this._onBackdrop = null;
    }
  }

  isOpen() {
    return this.$(`#${this.modalId}`)?.classList.contains('active') ?? false;
  }
}

export default Modal;
