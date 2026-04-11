import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Agent, Model, SidebarSessionItem, ContextMenuItem } from '../types/index.js';
import './jd-context-menu.js';

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

    .session-title-input {
      width: 100%;
      padding: 2px 4px;
      border: 1px solid var(--jd-primary, #4f46e5);
      border-radius: 4px;
      background: var(--jd-bg-secondary, #f9fafb);
      color: var(--jd-text-primary, #111827);
      font-size: 14px;
      font-weight: 500;
      font-family: inherit;
      outline: none;
      box-sizing: border-box;
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

  @property({ type: Array }) sessions: SidebarSessionItem[] = [];
  @property({ type: String }) currentSessionKey = '';
  @property({ type: Array }) agents: Agent[] = [];
  @property({ type: Object }) currentAgent: Agent | null = null;
  @property({ type: Array }) models: Model[] = [];
  @property({ type: String }) selectedModel = '';

  @state() private sessionsExpanded = true;
  @state() private editingSessionKey: string | null = null;
  @state() private contextMenu: { open: boolean; x: number; y: number; sessionKey: string } | null = null;

  private readonly _contextMenuItems: ContextMenuItem[] = [
    { id: 'rename', label: '重命名' },
    { id: 'delete', label: '删除', danger: true },
  ];

  private handleNewChat() {
    this.dispatchEvent(new CustomEvent('new-session', { bubbles: true, composed: true }));
  }

  private handleSessionClick(session: SidebarSessionItem) {
    if (this.editingSessionKey) return;
    this.dispatchEvent(new CustomEvent('session-select', {
      detail: session,
      bubbles: true,
      composed: true
    }));
  }

  private handleDeleteSession(e: Event, session: SidebarSessionItem) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('delete-session', {
      detail: session,
      bubbles: true,
      composed: true
    }));
  }

  // ── Inline rename ──

  private _startRename(key: string) {
    this.editingSessionKey = key;
  }

  private _commitRename(key: string, label: string) {
    this.editingSessionKey = null;
    const trimmed = label.trim();
    if (!trimmed) return;
    this.dispatchEvent(new CustomEvent('rename-session', {
      detail: { key, label: trimmed },
      bubbles: true,
      composed: true,
    }));
  }

  private _cancelRename() {
    this.editingSessionKey = null;
  }

  private _handleRenameKeyDown(e: KeyboardEvent, key: string) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this._commitRename(key, (e.target as HTMLInputElement).value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._cancelRename();
    }
  }

  private _handleRenameBlur(e: FocusEvent, key: string) {
    this._commitRename(key, (e.target as HTMLInputElement).value);
  }

  private _handleDblClick(e: Event, key: string) {
    e.preventDefault();
    e.stopPropagation();
    this._startRename(key);
  }

  // ── Context menu ──

  private _handleContextMenu(e: MouseEvent, session: SidebarSessionItem) {
    e.preventDefault();
    e.stopPropagation();
    this.contextMenu = { open: true, x: e.clientX, y: e.clientY, sessionKey: session.key };
  }

  private _handleMenuSelect(e: CustomEvent<{ id: string }>) {
    const action = e.detail.id;
    const key = this.contextMenu?.sessionKey;
    this.contextMenu = null;
    if (!key) return;

    const session = this.sessions.find(s => s.key === key);
    if (!session) return;

    if (action === 'rename') {
      this._startRename(key);
    } else if (action === 'delete') {
      this.dispatchEvent(new CustomEvent('delete-session', {
        detail: session,
        bubbles: true,
        composed: true,
      }));
    }
  }

  private _handleMenuClose() {
    this.contextMenu = null;
  }

  private _sessionLabel(session: SidebarSessionItem): string {
    return session.displayName || session.title || session.key;
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
            ${this.sessions.map(session => this._renderSessionItem(session))}
          </div>
        ` : nothing}
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

      ${this.contextMenu?.open ? html`
        <jd-context-menu
          .items=${this._contextMenuItems}
          .open=${true}
          .x=${this.contextMenu.x}
          .y=${this.contextMenu.y}
          @menu-select=${this._handleMenuSelect}
          @menu-close=${this._handleMenuClose}
        ></jd-context-menu>
      ` : nothing}
    `;
  }

  private _renderSessionItem(session: SidebarSessionItem) {
    const isEditing = this.editingSessionKey === session.key;
    const label = this._sessionLabel(session);

    return html`
      <div
        class="session-item ${session.key === this.currentSessionKey ? 'active' : ''}"
        @click=${() => this.handleSessionClick(session)}
        @dblclick=${(e: Event) => this._handleDblClick(e, session.key)}
        @contextmenu=${(e: MouseEvent) => this._handleContextMenu(e, session)}
      >
        <svg class="session-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <div class="session-info">
          ${isEditing ? html`
            <input
              class="session-title-input"
              .value=${label}
              @keydown=${(e: KeyboardEvent) => this._handleRenameKeyDown(e, session.key)}
              @blur=${(e: FocusEvent) => this._handleRenameBlur(e, session.key)}
              @click=${(e: Event) => e.stopPropagation()}
            />
          ` : html`
            <div class="session-title">${label}</div>
          `}
          <div class="session-meta">
            ${session.updatedAt ? html`
              <span class="session-time">${this.formatTime(session.updatedAt)}</span>
            ` : nothing}
            ${session.messageCount != null ? html`
              <span class="session-count">${session.messageCount} 条消息</span>
            ` : nothing}
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
    `;
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('editingSessionKey') && this.editingSessionKey) {
      // Auto-focus the rename input after render
      requestAnimationFrame(() => {
        const input = this.shadowRoot?.querySelector('.session-title-input') as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.select();
        }
      });
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-sidebar': JDSidebar;
  }
}
