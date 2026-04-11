import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SidebarSessionItem } from '../types/index.js';

@customElement('jd-sessions-view')
export class JdSessionsView extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 24px;
      color: var(--jd-text-primary, #111827);
      max-width: 800px;
      margin: 0 auto;
    }

    h2 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 16px;
    }

    .sessions-table {
      width: 100%;
      border-collapse: collapse;
    }

    .sessions-table th {
      text-align: left;
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--jd-text-muted, #9ca3af);
      border-bottom: 2px solid var(--jd-border, #e5e7eb);
    }

    .sessions-table td {
      padding: 12px;
      font-size: 14px;
      border-bottom: 1px solid var(--jd-border, #e5e7eb);
    }

    .sessions-table tr.clickable {
      cursor: pointer;
      transition: background 0.15s;
    }

    .sessions-table tr.clickable:hover {
      background: var(--jd-bg-tertiary, #f3f4f6);
    }

    .session-name {
      font-weight: 500;
    }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      background: var(--jd-bg-tertiary, #f3f4f6);
      color: var(--jd-text-secondary, #6b7280);
    }

    .delete-btn {
      padding: 4px 10px;
      border: 1px solid var(--jd-border, #e5e7eb);
      border-radius: 6px;
      background: transparent;
      color: var(--jd-text-secondary, #6b7280);
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s;
    }

    .delete-btn:hover {
      background: var(--jd-danger, #ef4444);
      color: white;
      border-color: var(--jd-danger, #ef4444);
    }

    .empty {
      text-align: center;
      padding: 48px 0;
      color: var(--jd-text-muted, #9ca3af);
      font-size: 14px;
    }
  `;

  @property({ type: Array }) sessions: SidebarSessionItem[] = [];

  private handleSelect(session: SidebarSessionItem) {
    this.dispatchEvent(new CustomEvent('session-select', {
      detail: session,
      bubbles: true,
      composed: true,
    }));
  }

  private handleDelete(e: Event, session: SidebarSessionItem) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('delete-session', {
      detail: session,
      bubbles: true,
      composed: true,
    }));
  }

  private formatTime(timestamp?: number): string {
    if (!timestamp) return '-';
    const now = Date.now();
    const diff = now - timestamp;
    const minute = 60000;
    const hour = 3600000;
    const day = 86400000;

    if (diff < minute) return '刚刚';
    if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
    if (diff < day) return `${Math.floor(diff / hour)}小时前`;
    return new Date(timestamp).toLocaleDateString('zh-CN');
  }

  render() {
    return html`
      <h2>会话管理</h2>

      ${this.sessions.length === 0 ? html`
        <div class="empty">暂无会话</div>
      ` : html`
        <table class="sessions-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>状态</th>
              <th>频道</th>
              <th>更新时间</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${this.sessions.map(s => html`
              <tr class="clickable" @click=${() => this.handleSelect(s)}>
                <td class="session-name">${s.displayName || s.title || s.key}</td>
                <td>${s.status ? html`<span class="status-badge">${s.status}</span>` : nothing}</td>
                <td>${s.lastChannel || '-'}</td>
                <td>${this.formatTime(s.updatedAt)}</td>
                <td>
                  <button class="delete-btn" @click=${(e: Event) => this.handleDelete(e, s)}>删除</button>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-sessions-view': JdSessionsView;
  }
}
