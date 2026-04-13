import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'normal';
}

@customElement('jd-confirm-dialog')
export class JdConfirmDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 10001;
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      animation: fadeIn 0.15s ease-out;
    }

    .dialog-wrapper {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .dialog {
      position: relative;
      width: 100%;
      max-width: 420px;
      background: var(--bg-tertiary, #1a1a24);
      border: 1px solid var(--border, #27272a);
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      animation: scaleIn 0.15s ease-out;
    }

    .dialog-title {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary, #f4f4f5);
    }

    .dialog-message {
      margin: 0 0 24px;
      font-size: 14px;
      line-height: 1.5;
      color: var(--text-primary, #f4f4f5);
      opacity: 0.8;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    button {
      padding: 8px 18px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--border, #27272a);
      transition: background 0.15s, opacity 0.15s;
    }

    .btn-cancel {
      background: transparent;
      color: var(--text-primary, #f4f4f5);
    }
    .btn-cancel:hover { background: rgba(255,255,255,0.06); }

    .btn-confirm {
      border: none;
      color: #fff;
    }
    .btn-confirm.normal {
      background: var(--accent, #8abe24);
    }
    .btn-confirm.normal:hover { opacity: 0.85; }
    .btn-confirm.danger {
      background: var(--danger, #ef4444);
    }
    .btn-confirm.danger:hover { opacity: 0.85; }

    :host(.closing) .backdrop { animation: fadeOut 0.12s ease-in forwards; }
    :host(.closing) .dialog   { animation: scaleOut 0.12s ease-in forwards; }

    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes scaleIn {
      from { transform: scale(0.92); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
    @keyframes scaleOut {
      from { transform: scale(1);    opacity: 1; }
      to   { transform: scale(0.92); opacity: 0; }
    }
  `;

  @property() title = '';
  @property() message = '';
  @property({ attribute: 'confirm-text' }) confirmText = '确认';
  @property({ attribute: 'cancel-text' }) cancelText = '取消';
  @property() variant: 'danger' | 'normal' = 'normal';

  @state() private _open = false;

  private _resolve: ((value: boolean) => void) | null = null;

  open(): Promise<boolean> {
    this._open = true;
    return new Promise<boolean>((resolve) => {
      this._resolve = resolve;
    });
  }

  private _close(result: boolean) {
    this.classList.add('closing');
    setTimeout(() => {
      this._open = false;
      this.classList.remove('closing');
      if (this._resolve) {
        this._resolve(result);
        this._resolve = null;
      }
      this.remove();
    }, 120);
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this._close(false);
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
  }

  render() {
    if (!this._open) return html``;
    return html`
      <div class="backdrop" @click=${() => this._close(false)}></div>
      <div class="dialog-wrapper" @click=${(e: Event) => e.stopPropagation()}>
        <div class="dialog">
          <h2 class="dialog-title">${this.title}</h2>
          <p class="dialog-message">${this.message}</p>
          <div class="dialog-actions">
            <button class="btn-cancel" @click=${() => this._close(false)}>${this.cancelText}</button>
            <button class="btn-confirm ${this.variant}" @click=${() => this._close(true)}>${this.confirmText}</button>
          </div>
        </div>
      </div>
    `;
  }

  static confirm(options: ConfirmDialogOptions): Promise<boolean> {
    const el = document.createElement('jd-confirm-dialog') as JdConfirmDialog;
    el.title = options.title;
    el.message = options.message;
    if (options.confirmText) el.confirmText = options.confirmText;
    if (options.cancelText) el.cancelText = options.cancelText;
    if (options.variant) el.variant = options.variant;
    document.body.appendChild(el);
    return el.open();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-confirm-dialog': JdConfirmDialog;
  }
}
