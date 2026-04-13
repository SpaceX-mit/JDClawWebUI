import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('jd-tool-card')
export class JdToolCard extends LitElement {
  @property({ type: String }) name = '';
  @property({ type: Object }) args: Record<string, unknown> | null = null;
  @property({ type: String }) output = '';
  @property({ type: String }) status: 'running' | 'completed' | 'error' = 'running';
  @property({ type: Number }) startedAt = 0;
  @property({ type: Number }) completedAt: number | null = null;
  @state() private expanded = false;

  createRenderRoot() {
    return this;
  }

  private formatDuration(): string {
    if (!this.startedAt || !this.completedAt) return '';
    const ms = this.completedAt - this.startedAt;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  render() {
    return html`
      <div class="chat-tool-card ${this.expanded ? 'expanded' : ''} ${this.status === 'error' ? 'error' : ''}"
           @click=${() => this.expanded = !this.expanded}
           style="cursor: pointer; ${this.expanded ? 'max-height: none;' : ''}">
        <div class="chat-tool-card__header">
          <div class="chat-tool-card__title">
            <span class="chat-tool-card__icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </span>
            ${this.name}
          </div>
          <div class="chat-tool-card__status">
            ${this.status === 'running' ? html`<span style="color: var(--accent)">⟳ 执行中...</span>` : null}
            ${this.status === 'completed' ? html`<span style="color: var(--success)">✓ ${this.formatDuration()}</span>` : null}
            ${this.status === 'error' ? html`<span style="color: var(--danger)">✗ 错误</span>` : null}
          </div>
        </div>
        ${this.args && Object.keys(this.args).length > 0 ? html`
          <div class="chat-tool-card__detail">
            <span style="font-family: var(--mono); font-size: 11px; opacity: 0.7;">
              ${JSON.stringify(this.args).slice(0, 100)}${JSON.stringify(this.args).length > 100 ? '...' : ''}
            </span>
          </div>
        ` : null}
        ${this.output ? html`
          <div class="chat-tool-card__preview">${this.output.slice(0, this.expanded ? undefined : 120)}${!this.expanded && this.output.length > 120 ? '...' : ''}</div>
        ` : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-tool-card': JdToolCard;
  }
}
