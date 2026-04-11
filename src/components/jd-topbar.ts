import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('jd-topbar')
export class JDTopBar extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 16px;
      background: var(--jd-bg-primary, #ffffff);
      border-bottom: 1px solid var(--jd-border, #e5e7eb);
      color: var(--jd-text-primary, #111827);
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .topbar-center {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--jd-text-secondary, #6b7280);
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn:hover {
      background: var(--jd-bg-tertiary, #f3f4f6);
      color: var(--jd-text-primary, #111827);
    }

    .btn.active {
      background: var(--jd-primary, #4f46e5);
      color: white;
    }

    .agent-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--jd-text-primary, #111827);
      padding: 6px 12px;
      background: var(--jd-bg-secondary, #f9fafb);
      border-radius: 6px;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--jd-text-secondary, #6b7280);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--jd-text-muted, #9ca3af);
    }

    .status-dot.connected {
      background: var(--jd-secondary, #10b981);
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
    }

    .status-dot.disconnected {
      background: var(--jd-danger, #ef4444);
    }
  `;

  @property({ type: Boolean }) connected = false;
  @property({ type: Boolean }) focusMode = false;
  @property({ type: String }) agentName = '助手';

  private handleToggleSidebar() {
    this.dispatchEvent(new CustomEvent('toggle-sidebar', { bubbles: true, composed: true }));
  }

  private handleToggleTheme() {
    this.dispatchEvent(new CustomEvent('toggle-theme', { bubbles: true, composed: true }));
  }

  private handleToggleFocus() {
    this.dispatchEvent(new CustomEvent('toggle-focus', { bubbles: true, composed: true }));
  }

  private handleOpenCommandPalette() {
    this.dispatchEvent(new CustomEvent('open-command-palette', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="topbar">
        <div class="topbar-left">
          <button class="btn" @click=${this.handleToggleSidebar} title="切换侧边栏">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          
          <span class="agent-name">${this.agentName}</span>
        </div>

        <div class="topbar-center">
          <div class="connection-status">
            <div class="status-dot ${this.connected ? 'connected' : 'disconnected'}"></div>
            <span>${this.connected ? '已连接' : '未连接'}</span>
          </div>
        </div>

        <div class="topbar-right">
          <button class="btn" @click=${this.handleOpenCommandPalette} title="命令面板 (Ctrl+K)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>

          <button 
            class="btn ${this.focusMode ? 'active' : ''}" 
            @click=${this.handleToggleFocus}
            title="专注模式"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"></path>
            </svg>
          </button>

          <button class="btn" @click=${this.handleToggleTheme} title="切换主题">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-topbar': JDTopBar;
  }
}
