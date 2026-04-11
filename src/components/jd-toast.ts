import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
  dismissing: boolean;
}

let toastIdCounter = 0;

@customElement('jd-toast')
export class JdToast extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 10000;
      pointer-events: none;
    }

    .toast-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-end;
    }

    .toast-item {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 280px;
      max-width: 420px;
      padding: 12px 14px;
      background: var(--bg-tertiary, #1a1a24);
      color: var(--text-primary, #f4f4f5);
      border: 1px solid var(--border, #27272a);
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.4;
      pointer-events: auto;
      animation: slideIn 0.25s ease-out forwards;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    }

    .toast-item.dismissing {
      animation: fadeOut 0.2s ease-in forwards;
    }

    .toast-item.success { border-left: 4px solid var(--success, #22c55e); }
    .toast-item.error   { border-left: 4px solid var(--danger, #ef4444); }
    .toast-item.warning { border-left: 4px solid var(--warning, #f59e0b); }
    .toast-item.info    { border-left: 4px solid var(--accent, #6366f1); }

    .toast-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
    }
    .toast-icon.success { color: var(--success, #22c55e); }
    .toast-icon.error   { color: var(--danger, #ef4444); }
    .toast-icon.warning { color: var(--warning, #f59e0b); }
    .toast-icon.info    { color: var(--accent, #6366f1); }

    .toast-message {
      flex: 1;
      word-break: break-word;
    }

    .toast-close {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      color: var(--text-primary, #f4f4f5);
      opacity: 0.5;
      cursor: pointer;
      border-radius: 4px;
      padding: 0;
    }
    .toast-close:hover { opacity: 1; background: rgba(255,255,255,0.08); }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes fadeOut {
      from { transform: translateX(0);    opacity: 1; }
      to   { transform: translateX(40px); opacity: 0; }
    }
  `;

  @state() private _toasts: ToastItem[] = [];

  private _dismiss(id: number) {
    this._toasts = this._toasts.map(t =>
      t.id === id ? { ...t, dismissing: true } : t
    );
    setTimeout(() => {
      this._toasts = this._toasts.filter(t => t.id !== id);
    }, 200);
  }

  addToast(options: ToastOptions) {
    const id = ++toastIdCounter;
    const type = options.type ?? 'info';
    const duration = options.duration ?? 3000;
    const item: ToastItem = { id, message: options.message, type, duration, dismissing: false };
    this._toasts = [item, ...this._toasts];
    if (duration > 0) {
      setTimeout(() => this._dismiss(id), duration);
    }
  }

  private _iconFor(type: string) {
    switch (type) {
      case 'success':
        return html`<svg class="toast-icon success" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`;
      case 'error':
        return html`<svg class="toast-icon error" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`;
      case 'warning':
        return html`<svg class="toast-icon warning" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;
      default:
        return html`<svg class="toast-icon info" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`;
    }
  }

  render() {
    if (this._toasts.length === 0) return nothing;
    return html`
      <div class="toast-container">
        ${this._toasts.map(t => html`
          <div class="toast-item ${t.type} ${t.dismissing ? 'dismissing' : ''}">
            ${this._iconFor(t.type)}
            <span class="toast-message">${t.message}</span>
            <button class="toast-close" @click=${() => this._dismiss(t.id)} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/></svg>
            </button>
          </div>
        `)}
      </div>
    `;
  }

  static show(options: ToastOptions) {
    let el = document.querySelector<JdToast>('jd-toast');
    if (!el) {
      el = document.createElement('jd-toast') as JdToast;
      document.body.appendChild(el);
    }
    el.addToast(options);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-toast': JdToast;
  }
}
