import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface SlashCommandDef {
  key: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  args?: string;
}

const SLASH_COMMANDS: SlashCommandDef[] = [
  { key: 'new', name: '/new', description: '新建会话', category: 'session', icon: 'plus' },
  { key: 'clear', name: '/clear', description: '清空当前聊天', category: 'session', icon: 'trash' },
  { key: 'compact', name: '/compact', description: '压缩历史', category: 'session', icon: 'compress' },
  { key: 'export', name: '/export', description: '导出对话', category: 'session', icon: 'download' },
  { key: 'model', name: '/model', description: '切换模型', category: 'model', args: '<model-name>' },
  { key: 'think', name: '/think', description: '设置思考级别', category: 'model', args: '<off|low|medium|high>' },
  { key: 'stop', name: '/stop', description: '停止生成', category: 'session', icon: 'stop' },
  { key: 'help', name: '/help', description: '查看帮助', category: 'session', icon: 'help' },
];

@customElement('jd-slash-menu')
export class JdSlashMenu extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: fixed;
      z-index: 9998;
    }

    .menu {
      background: var(--bg-tertiary, #1a1a24);
      border: 1px solid var(--border, #27272a);
      border-radius: 8px;
      max-height: 300px;
      overflow-y: auto;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      padding: 4px;
      min-width: 260px;
    }

    .category-label {
      padding: 6px 12px 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted, #71717a);
      letter-spacing: 0.05em;
    }
    .menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.1s;
    }

    .menu-item:hover,
    .menu-item.selected {
      background: var(--bg-hover, #22222e);
    }

    .item-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary, #f4f4f5);
      white-space: nowrap;
    }

    .item-args {
      font-size: 12px;
      color: var(--text-muted, #71717a);
      margin-left: 2px;
    }

    .item-desc {
      font-size: 13px;
      color: var(--text-secondary, #a1a1aa);
      margin-left: auto;
      white-space: nowrap;
    }

    .empty {
      padding: 12px;
      text-align: center;
      font-size: 13px;
      color: var(--text-secondary, #a1a1aa);
    }
  `;

  @property({ type: Boolean }) open = false;
  @property({ type: String }) query = '';
  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;

  @state() private selectedIndex = 0;

  private get filteredCommands(): SlashCommandDef[] {
    const q = this.query.toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      cmd => cmd.name.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q)
    );
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('query')) {
      this.selectedIndex = 0;
    }
  }

  handleKeyDown(e: KeyboardEvent): boolean {
    const cmds = this.filteredCommands;
    if (!cmds.length) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % cmds.length;
        return true;
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + cmds.length) % cmds.length;
        return true;
      case 'Enter': {
        e.preventDefault();
        const cmd = cmds[this.selectedIndex];
        if (cmd) this._select(cmd);
        return true;
      }
      case 'Escape':
        e.preventDefault();
        this._close();
        return true;
      default:
        return false;
    }
  }

  private _select(cmd: SlashCommandDef) {
    this.dispatchEvent(new CustomEvent('slash-select', {
      detail: { key: cmd.key, args: cmd.args },
      bubbles: true,
      composed: true,
    }));
  }

  private _close() {
    this.dispatchEvent(new CustomEvent('slash-close', {
      bubbles: true,
      composed: true,
    }));
  }

  private _groupByCategory(cmds: SlashCommandDef[]): Map<string, SlashCommandDef[]> {
    const map = new Map<string, SlashCommandDef[]>();
    for (const cmd of cmds) {
      const list = map.get(cmd.category) || [];
      list.push(cmd);
      map.set(cmd.category, list);
    }
    return map;
  }

  render() {
    if (!this.open) return nothing;

    const cmds = this.filteredCommands;
    const grouped = this._groupByCategory(cmds);
    let globalIdx = 0;

    return html`
      <div class="menu" style="bottom: ${this.y}px; left: ${this.x}px;">
        ${cmds.length === 0
          ? html`<div class="empty">无匹配命令</div>`
          : html`${[...grouped.entries()].map(([cat, items]) => html`
              <div class="category-label">${cat}</div>
              ${items.map(cmd => {
                const idx = globalIdx++;
                return html`
                  <div
                    class="menu-item ${idx === this.selectedIndex ? 'selected' : ''}"
                    @click=${() => this._select(cmd)}
                    @mouseenter=${() => { this.selectedIndex = idx; }}
                  >
                    <span class="item-name">${cmd.name}</span>
                    ${cmd.args ? html`<span class="item-args">${cmd.args}</span>` : nothing}
                    <span class="item-desc">${cmd.description}</span>
                  </div>
                `;
              })}
            `)}`
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-slash-menu': JdSlashMenu;
  }
}
