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
      background: var(--jd-bg-secondary, #f9fafb);
      border-top: 1px solid var(--jd-border, #e5e7eb);
      font-size: 12px;
      color: var(--jd-text-muted, #9ca3af);
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
      background: var(--jd-text-muted, #9ca3af);
    }

    .status-dot.connected {
      background: var(--jd-secondary, #10b981);
    }

    .status-dot.sending {
      background: var(--jd-warning, #f59e0b);
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
      background: var(--jd-bg-tertiary, #f3f4f6);
      border: 1px solid var(--jd-border, #e5e7eb);
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
