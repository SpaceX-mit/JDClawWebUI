import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ContextMenuItem } from '../types/index.js';

@customElement('jd-context-menu')
export class JDContextMenu extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: fixed;
      z-index: 9999;
    }

    .menu {
      background: var(--bg-tertiary, #1a1a24);
      border: 1px solid var(--border, #27272a);
      border-radius: 8px;
      padding: 4px;
      min-width: 160px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--text-primary, #f4f4f5);
      font-size: 13px;
      cursor: pointer;
      width: 100%;
      text-align: left;
      transition: background 0.12s;
    }

    .menu-item:hover:not(.disabled) {
      background: var(--bg-hover, #22222e);
    }

    .menu-item.danger {
      color: var(--danger, #ef4444);
    }

    .menu-item.disabled {
      opacity: 0.4;
      cursor: default;
    }
  `;

  @property({ type: Array }) items: ContextMenuItem[] = [];
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this._close();
  };

  private _onClickOutside = (e: MouseEvent) => {
    if (!this.shadowRoot?.querySelector('.menu')?.contains(e.composedPath()[0] as Node)) {
      this._close();
    }
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('mousedown', this._onClickOutside, true);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('mousedown', this._onClickOutside, true);
  }

  private _close() {
    this.dispatchEvent(new CustomEvent('menu-close', { bubbles: true, composed: true }));
  }

  private _select(item: ContextMenuItem) {
    if (item.disabled) return;
    this.dispatchEvent(new CustomEvent('menu-select', {
      detail: { id: item.id },
      bubbles: true,
      composed: true,
    }));
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('open') || changed.has('x') || changed.has('y')) {
      this._adjustPosition();
    }
  }

  private _adjustPosition() {
    if (!this.open) return;
    const menu = this.shadowRoot?.querySelector('.menu') as HTMLElement | null;
    if (!menu) return;

    let adjustedX = this.x;
    let adjustedY = this.y;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (adjustedX + rect.width > vw) adjustedX = vw - rect.width - 4;
    if (adjustedY + rect.height > vh) adjustedY = vh - rect.height - 4;
    if (adjustedX < 0) adjustedX = 4;
    if (adjustedY < 0) adjustedY = 4;

    this.style.left = `${adjustedX}px`;
    this.style.top = `${adjustedY}px`;
  }

  render() {
    if (!this.open) return nothing;

    this.style.left = `${this.x}px`;
    this.style.top = `${this.y}px`;

    return html`
      <div class="menu" role="menu">
        ${this.items.map(item => html`
          <button
            class="menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}"
            role="menuitem"
            ?disabled=${item.disabled}
            @click=${() => this._select(item)}
          >
            ${item.icon ? html`<span>${item.icon}</span>` : nothing}
            ${item.label}
          </button>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-context-menu': JDContextMenu;
  }
}
