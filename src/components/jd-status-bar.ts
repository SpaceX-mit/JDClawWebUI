import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('jd-status-bar')
export class JDStatusBar extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 28px;
      padding: 0 12px;
      background: var(--bg-secondary, #f7f7f8);
      border-top: 1px solid var(--border, #e8e8ec);
      font-size: 12px;
      color: var(--text-muted, #8c8c9a);
    }

    .status-left,
    .status-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-muted, #8c8c9a);
    }

    .status-dot.connected {
      background: var(--success, #22c55e);
    }

    .status-dot.sending {
      background: var(--warning, #f59e0b);
      animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .kbd-hint {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      background: var(--bg-tertiary, #f0f0f2);
      border: 1px solid var(--border, #e8e8ec);
      border-radius: 3px;
      font-size: 10px;
      font-weight: 500;
    }
  `;

  @property({ type: Boolean }) connected = false;
  @property({ type: Boolean }) sending = false;
  @property({ type: Number }) messageCount = 0;

  render() {
    return html`
      <div class="status-bar">
        <div class="status-left">
          <div class="status-item">
            <div class="status-dot ${this.connected ? 'connected' : ''} ${this.sending ? 'sending' : ''}"></div>
            <span>${this.connected ? (this.sending ? '生成中...' : '就绪') : '未连接'}</span>
          </div>
          
          ${this.messageCount > 0 ? html`
            <div class="status-item">
              <span>${this.messageCount} 条消息</span>
            </div>
          ` : null}
        </div>

        <div class="status-right">
          <div class="kbd-hint">
            <span class="kbd">Ctrl</span>
            <span>+</span>
            <span class="kbd">K</span>
            <span>命令面板</span>
          </div>
          
          <div class="kbd-hint">
            <span class="kbd">Ctrl</span>
            <span>+</span>
            <span class="kbd">N</span>
            <span>新会话</span>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-status-bar': JDStatusBar;
  }
}
