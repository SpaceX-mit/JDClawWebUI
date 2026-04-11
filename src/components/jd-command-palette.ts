import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import type { Model, Agent } from '../types/index.js';

@customElement('jd-command-palette')
export class JDCommandPalette extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 120px;
    }

    .overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      animation: fadeIn 0.15s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .palette {
      position: relative;
      width: 560px;
      max-height: 480px;
      background: var(--jd-bg-primary, #ffffff);
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      animation: slideDown 0.2s ease;
      color: var(--jd-text-primary, #111827);
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .search-box {
      display: flex;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--jd-border, #e5e7eb);
    }

    .search-icon {
      width: 20px;
      height: 20px;
      color: var(--jd-text-muted, #9ca3af);
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      margin-left: 12px;
      border: none;
      background: transparent;
      font-size: 16px;
      color: var(--jd-text-primary, #111827);
      outline: none;
    }

    .search-input::placeholder {
      color: var(--jd-text-muted, #9ca3af);
    }

    .categories {
      display: flex;
      padding: 8px 16px;
      gap: 8px;
      border-bottom: 1px solid var(--jd-border, #e5e7eb);
      overflow-x: auto;
    }

    .category {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      background: var(--jd-bg-secondary, #f9fafb);
      color: var(--jd-text-secondary, #6b7280);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }

    .category:hover {
      background: var(--jd-bg-tertiary, #f3f4f6);
    }

    .category.active {
      background: var(--jd-primary, #4f46e5);
      color: white;
    }

    .results {
      max-height: 320px;
      overflow-y: auto;
      padding: 8px;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.1s;
    }

    .result-item:hover,
    .result-item.selected {
      background: var(--jd-bg-secondary, #f9fafb);
    }

    .result-item.selected {
      background: var(--jd-primary, #4f46e5);
      color: white;
    }

    .result-icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: var(--jd-bg-tertiary, #f3f4f6);
      color: var(--jd-text-secondary, #6b7280);
      flex-shrink: 0;
    }

    .result-item.selected .result-icon {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .result-info {
      flex: 1;
      min-width: 0;
    }

    .result-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--jd-text-primary, #111827);
    }

    .result-item.selected .result-title {
      color: white;
    }

    .result-description {
      font-size: 12px;
      color: var(--jd-text-muted, #9ca3af);
      margin-top: 2px;
    }

    .result-item.selected .result-description {
      color: rgba(255, 255, 255, 0.7);
    }

    .result-shortcut {
      font-size: 12px;
      color: var(--jd-text-muted, #9ca3af);
      padding: 4px 8px;
      background: var(--jd-bg-tertiary, #f3f4f6);
      border-radius: 4px;
    }

    .result-item.selected .result-shortcut {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .empty-state {
      padding: 32px;
      text-align: center;
      color: var(--jd-text-muted, #9ca3af);
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-top: 1px solid var(--jd-border, #e5e7eb);
      font-size: 12px;
      color: var(--jd-text-muted, #9ca3af);
    }

    .footer-hint {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      background: var(--jd-bg-secondary, #f9fafb);
      border: 1px solid var(--jd-border, #e5e7eb);
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }
  `;

  @property({ type: Array }) models: Model[] = [];
  @property({ type: Array }) agents: Agent[] = [];

  @state() private searchQuery = '';
  @state() private selectedCategory = 'all';
  @state() private selectedIndex = 0;

  @query('.search-input') private searchInput!: HTMLInputElement;

  connectedCallback() {
    super.connectedCallback();
    requestAnimationFrame(() => this.searchInput?.focus());
    document.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.handleClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.handleSelect(this.results[this.selectedIndex]);
    }
  };

  private get results() {
    const commands = [
      { id: 'new-session', title: '新建会话', description: '创建一个新的对话会话', category: 'session', shortcut: 'Ctrl+N' },
      { id: 'clear-history', title: '清空历史', description: '清除当前会话的所有消息', category: 'session' },
      { id: 'model-claude', title: '切换到 Claude', description: '使用 Anthropic Claude 模型', category: 'model' },
      { id: 'model-gpt', title: '切换到 GPT-4', description: '使用 OpenAI GPT-4 模型', category: 'model' },
      { id: 'agent-main', title: '主助手', description: '切换到默认助手', category: 'agent' },
      { id: 'agent-coder', title: '代码助手', description: '切换到编程专用助手', category: 'agent' },
      { id: 'toggle-theme', title: '切换主题', description: '在亮色/暗色/自动主题间切换', category: 'ui' },
      { id: 'toggle-focus', title: '专注模式', description: '隐藏侧边栏，进入专注模式', category: 'ui', shortcut: 'Ctrl+.' },
      { id: 'export-chat', title: '导出对话', description: '将当前对话导出为 Markdown', category: 'session' },
    ];

    let filtered = commands;
    
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(cmd => cmd.category === this.selectedCategory);
    }
    
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(cmd => 
        cmd.title.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  private handleClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private handleSelect(result: typeof this.results[0]) {
    if (result) {
      this.dispatchEvent(new CustomEvent('select-command', {
        detail: result,
        bubbles: true,
        composed: true
      }));
    }
  }

  private handleSearch(e: Event) {
    const input = e.target as HTMLInputElement;
    this.searchQuery = input.value;
    this.selectedIndex = 0;
  }

  private handleCategoryClick(category: string) {
    this.selectedCategory = category;
    this.selectedIndex = 0;
  }

  private handleOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('overlay')) {
      this.handleClose();
    }
  }

  render() {
    const categories = [
      { id: 'all', label: '全部' },
      { id: 'session', label: '会话' },
      { id: 'model', label: '模型' },
      { id: 'agent', label: '助手' },
      { id: 'ui', label: '界面' },
    ];

    return html`
      <div class="overlay" @click=${this.handleOverlayClick}>
        <div class="palette">
          <div class="search-box">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              class="search-input"
              type="text"
              placeholder="输入命令或搜索..."
              .value=${this.searchQuery}
              @input=${this.handleSearch}
            />
          </div>

          <div class="categories">
            ${categories.map(cat => html`
              <button 
                class="category ${this.selectedCategory === cat.id ? 'active' : ''}"
                @click=${() => this.handleCategoryClick(cat.id)}
              >
                ${cat.label}
              </button>
            `)}
          </div>

          <div class="results">
            ${this.results.length > 0 ? html`
              ${this.results.map((result, index) => html`
                <div 
                  class="result-item ${index === this.selectedIndex ? 'selected' : ''}"
                  @click=${() => this.handleSelect(result)}
                  @mouseenter=${() => this.selectedIndex = index}
                >
                  <div class="result-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                  <div class="result-info">
                    <div class="result-title">${result.title}</div>
                    <div class="result-description">${result.description}</div>
                  </div>
                  ${result.shortcut ? html`
                    <span class="result-shortcut">${result.shortcut}</span>
                  ` : null}
                </div>
              `)}
            ` : html`
              <div class="empty-state">
                未找到匹配的命令
              </div>
            `}
          </div>

          <div class="footer">
            <div class="footer-hint">
              <span><span class="kbd">↑</span> <span class="kbd">↓</span> 导航</span>
              <span><span class="kbd">Enter</span> 选择</span>
              <span><span class="kbd">Esc</span> 关闭</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-command-palette': JDCommandPalette;
  }
}
