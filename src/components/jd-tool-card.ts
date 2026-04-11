import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

function formatDuration(startedAt: number, completedAt: number | null): string {
  const end = completedAt ?? Date.now();
  const ms = end - startedAt;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

@customElement('jd-tool-card')
export class JdToolCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin: 4px 0;
    }

    .tool-card {
      background: var(--bg-tertiary, #1a1a24);
      border: 1px solid var(--border, #27272a);
      border-radius: 8px;
      overflow: hidden;
      font-size: 13px;
    }

    .tool-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      user-select: none;
    }

    .tool-header:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .tool-icon {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      color: var(--text-secondary, #a1a1aa);
    }

    .tool-name {
      font-weight: 700;
      color: var(--text-primary, #f4f4f5);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tool-duration {
      font-size: 11px;
      color: var(--text-secondary, #a1a1aa);
      flex-shrink: 0;
    }

    /* Status indicators */
    .status-icon {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
    }

    .status-icon.running {
      color: var(--accent, #6366f1);
      animation: pulse-spin 1.2s linear infinite;
    }

    .status-icon.completed {
      color: var(--success, #22c55e);
    }

    .status-icon.error {
      color: var(--danger, #ef4444);
    }

    @keyframes pulse-spin {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }

    /* Args section */
    .tool-args {
      padding: 0 12px 8px;
    }

    .tool-args-label {
      font-size: 11px;
      color: var(--text-secondary, #a1a1aa);
      margin-bottom: 4px;
    }

    .tool-args-preview {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
      color: var(--text-secondary, #a1a1aa);
      background: rgba(0, 0, 0, 0.2);
      padding: 4px 8px;
      border-radius: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Output section */
    .tool-output {
      padding: 0 12px 8px;
    }

    .tool-output-inline {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
      color: var(--text-secondary, #a1a1aa);
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .tool-output-preview {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
      color: var(--text-secondary, #a1a1aa);
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      cursor: pointer;
    }

    .tool-output-preview:hover {
      color: var(--text-primary, #f4f4f5);
    }

    .tool-output-full {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
      color: var(--text-secondary, #a1a1aa);
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 400px;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.2);
      padding: 8px;
      border-radius: 4px;
    }

    .expand-toggle {
      display: inline-block;
      font-size: 11px;
      color: var(--accent, #6366f1);
      cursor: pointer;
      margin-top: 4px;
      user-select: none;
    }

    .expand-toggle:hover {
      text-decoration: underline;
    }
  `;

  @property({ type: String }) name = '';
  @property({ type: Object }) args: Record<string, unknown> | null = null;
  @property({ type: String }) output = '';
  @property({ type: String }) status: 'running' | 'completed' | 'error' = 'running';
  @property({ type: Number }) startedAt = 0;
  @property({ type: Number }) completedAt: number | null = null;
  @property({ type: Boolean }) expanded = false;

  private toggleExpand() {
    this.expanded = !this.expanded;
    this.dispatchEvent(new CustomEvent('toggle-expand', {
      bubbles: true,
      composed: true,
    }));
  }

  private renderStatusIcon() {
    if (this.status === 'running') {
      return html`
        <svg class="status-icon running" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
      `;
    }
    if (this.status === 'completed') {
      return html`
        <svg class="status-icon completed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
    }
    return html`
      <svg class="status-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
  }

  private renderArgs() {
    if (!this.args) return nothing;
    const json = JSON.stringify(this.args);
    const preview = json.length > 100 ? json.slice(0, 100) + '...' : json;
    return html`
      <div class="tool-args">
        <div class="tool-args-label">参数</div>
        <div class="tool-args-preview" title=${json}>${preview}</div>
      </div>
    `;
  }

  private renderOutput() {
    if (!this.output) return nothing;
    const isShort = this.output.length < 200;

    if (isShort) {
      return html`
        <div class="tool-output">
          <div class="tool-output-inline">${this.output}</div>
        </div>
      `;
    }

    if (this.expanded) {
      return html`
        <div class="tool-output">
          <div class="tool-output-full">${this.output}</div>
          <span class="expand-toggle" @click=${this.toggleExpand}>收起</span>
        </div>
      `;
    }

    return html`
      <div class="tool-output">
        <div class="tool-output-preview" @click=${this.toggleExpand}>${this.output}</div>
        <span class="expand-toggle" @click=${this.toggleExpand}>展开全部</span>
      </div>
    `;
  }

  render() {
    const duration = this.startedAt ? formatDuration(this.startedAt, this.completedAt) : '';

    return html`
      <div class="tool-card">
        <div class="tool-header" @click=${this.toggleExpand}>
          <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"></path>
          </svg>
          <span class="tool-name">${this.name || 'Tool'}</span>
          ${this.renderStatusIcon()}
          ${duration ? html`<span class="tool-duration">${duration}</span>` : nothing}
        </div>
        ${this.renderArgs()}
        ${this.renderOutput()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-tool-card': JdToolCard;
  }
}
