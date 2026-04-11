import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Session, Agent, Model } from '../types/index.js';

@customElement('jd-sidebar')
export class JDSidebar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--jd-bg-primary, #ffffff);
      color: var(--jd-text-primary, #111827);
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid var(--jd-border, #e5e7eb);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 600;
      color: var(--jd-primary, #4f46e5);
    }

    .logo-icon {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 12px;
    }

    .new-chat-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 8px;
      background: var(--jd-primary, #4f46e5);
      color: white;
      cursor: pointer;
      transition: all 0.2s;
    }

    .new-chat-btn:hover {
      background: var(--jd-primary-hover, #4338ca);
      transform: scale(1.05);
    }

    .section {
      flex: 1;
      overflow: auto;
      padding: 8px;
    }

    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--jd-text-muted, #9ca3af);
      cursor: pointer;
    }

    .section-title:hover {
      color: var(--jd-text-secondary, #6b7280);
    }

    .session-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .session-item {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
      gap: 10px;
    }

    .session-item:hover {
      background: var(--jd-bg-tertiary, #f3f4f6);
    }

    .session-item.active {
      background: var(--jd-primary, #4f46e5);
      color: white;
    }

    .session-item.active .session-time,
    .session-item.active .session-count {
      color: rgba(255, 255, 255, 0.7);
    }

    .session-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      opacity: 0.7;
    }

    .session-info {
      flex: 1;
      min-width: 0;
    }

    .session-title {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .session-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--jd-text-muted, #9ca3af);
      margin-top: 2px;
    }

    .session-delete {
      opacity: 0;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--jd-text-muted, #9ca3af);
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .session-item:hover .session-delete {
      opacity: 1;
    }

    .session-delete:hover {
      background: var(--jd-danger, #ef4444);
      color: white;
    }

    .agent-selector {
      padding: 12px;
      border-top: 1px solid var(--jd-border, #e5e7eb);
    }

    .agent-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--jd-text-muted, #9ca3af);
      margin-bottom: 8px;
    }

    .agent-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--jd-border, #e5e7eb);
      border-radius: 6px;
      background: var(--jd-bg-secondary, #f9fafb);
      font-size: 14px;
      cursor: pointer;
      color: var(--jd-text-primary, #111827);
    }

    .agent-select:focus {
      outline: none;
      border-color: var(--jd-primary, #4f46e5);
    }

    .model-selector {
      padding: 12px;
      border-top: 1px solid var(--jd-border, #e5e7eb);
    }
  `;

  @property({ type: Array }) sessions: Session[] = [];
  @property({ type: String }) currentSessionKey = '';
  @property({ type: Array }) agents: Agent[] = [];
  @property({ type: Object }) currentAgent: Agent | null = null;
  @property({ type: Array }) models: Model[] = [];
  @property({ type: String }) selectedModel = '';

  @state() private sessionsExpanded = true;

  private handleNewChat() {
    this.dispatchEvent(new CustomEvent('new-session', { bubbles: true, composed: true }));
  }

  private handleSessionClick(session: Session) {
    this.dispatchEvent(new CustomEvent('session-select', {
      detail: session,
      bubbles: true,
      composed: true
    }));
  }

  private handleDeleteSession(e: Event, session: Session) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('delete-session', {
      detail: session,
      bubbles: true,
      composed: true
    }));
  }

  private handleAgentChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const agent = this.agents.find(a => a.id === select.value);
    if (agent) {
      this.dispatchEvent(new CustomEvent('agent-change', {
        detail: agent,
        bubbles: true,
        composed: true
      }));
    }
  }

  private formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minute = 60000;
    const hour = 3600000;
    const day = 86400000;
    
    if (diff < minute) return '刚刚';
    if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
    if (diff < day) return `${Math.floor(diff / hour)}小时前`;
    if (diff < 7 * day) return `${Math.floor(diff / day)}天前`;
    
    return new Date(timestamp).toLocaleDateString('zh-CN');
  }

  render() {
    return html`
      <div class="sidebar-header">
        <div class="logo">
          <div class="logo-icon">JD</div>
          <span>JDClaw</span>
        </div>
        <button class="new-chat-btn" @click=${this.handleNewChat} title="新建会话">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <div class="section">
        <div class="section-title" @click=${() => this.sessionsExpanded = !this.sessionsExpanded}>
          <span>会话</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${this.sessionsExpanded 
              ? html`<polyline points="18 15 12 9 6 15"></polyline>`
              : html`<polyline points="6 9 12 15 18 9"></polyline>`
            }
          </svg>
        </div>
        
        ${this.sessionsExpanded ? html`
          <div class="session-list">
            ${this.sessions.map(session => html`
              <div 
                class="session-item ${session.key === this.currentSessionKey ? 'active' : ''}"
                @click=${() => this.handleSessionClick(session)}
              >
                <svg class="session-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <div class="session-info">
                  <div class="session-title">${session.title}</div>
                  <div class="session-meta">
                    <span class="session-time">${this.formatTime(session.updatedAt)}</span>
                    <span class="session-count">${session.messageCount} 条消息</span>
                  </div>
                </div>
                <button 
                  class="session-delete" 
                  @click=${(e: Event) => this.handleDeleteSession(e, session)}
                  title="删除会话"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            `)}
          </div>
        ` : null}
      </div>

      <div class="agent-selector">
        <div class="agent-label">助手</div>
        <select class="agent-select" @change=${this.handleAgentChange}>
          ${this.agents.map(agent => html`
            <option value=${agent.id} ?selected=${agent.id === this.currentAgent?.id}>
              ${agent.name}
            </option>
          `)}
        </select>
      </div>

      <div class="model-selector">
        <div class="agent-label">模型</div>
        <select class="agent-select">
          ${this.models.map(model => html`
            <option value=${model.id}>${model.name}</option>
          `)}
        </select>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-sidebar': JDSidebar;
  }
}
