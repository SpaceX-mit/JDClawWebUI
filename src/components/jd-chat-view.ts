import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Message, Attachment, ToolStreamEntry, ChatStreamSegment, Agent, Model } from '../types/index.js';
import { copyToClipboard } from '../utils/index.js';
import './jd-tool-card.js';
import './jd-slash-menu.js';

interface MessageGroup {
  role: string;
  messages: Message[];
  timestamp: number;
}

// Configure marked: GFM enabled, no raw HTML passthrough
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    code(code: string, infostring: string | undefined) {
      const lang = (infostring || '').trim();
      const langLabel = lang || 'code';
      const escapedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-block-lang">${langLabel}</span>
          <button class="code-copy-btn" data-code="${code.replace(/"/g, '&quot;')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
            </svg>
            <span>复制</span>
          </button>
        </div>
        <pre><code class="language-${lang}">${escapedCode}</code></pre>
      </div>`;
    },
    html() {
      return '';
    }
  }
});

@customElement('jd-chat-view')
export class JDChatView extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: Array }) messages: Message[] = [];
  @property({ type: String }) streamingText: string | null = null;
  @property({ type: Boolean }) sending = false;
  @property({ type: Array }) attachments: Attachment[] = [];
  @property({ type: String }) draft = '';
  @property({ type: Boolean }) focusMode = false;
  @property({ type: Array }) toolStreamEntries: ToolStreamEntry[] = [];
  @property({ type: Array }) chatStreamSegments: ChatStreamSegment[] = [];
  @property({ type: Array }) agents: Agent[] = [];
  @property({ type: String }) selectedAgentId = '';
  @property({ type: Array }) models: Model[] = [];
  @property({ type: String }) selectedModel = '';

  @state() private inputValue = '';
  @state() private copiedMessageId: string | null = null;
  @state() private expandedThinking: Set<string> = new Set();
  @state() private slashMenuOpen = false;
  @state() private slashQuery = '';
  @state() private userScrolledUp = false;

  private scrollObserver: ResizeObserver | null = null;

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.scrollObserver?.disconnect();
  }

  firstUpdated() {
    // Scroll to bottom on initial load (page refresh with history)
    requestAnimationFrame(() => this.scrollToBottom());

    // Watch for content size changes (images loading, etc.)
    const thread = this.querySelector('.chat-thread');
    if (thread) {
      thread.addEventListener('scroll', this.handleThreadScroll);
      this.scrollObserver = new ResizeObserver(() => {
        if (!this.userScrolledUp) this.scrollToBottom();
      });
      // Observe the thread's scroll content
      for (const child of thread.children) {
        this.scrollObserver.observe(child);
      }
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('draft')) {
      this.inputValue = this.draft;
    }

    const shouldScroll =
      changedProperties.has('messages') ||
      changedProperties.has('streamingText') ||
      changedProperties.has('sending') ||
      changedProperties.has('toolStreamEntries') ||
      changedProperties.has('chatStreamSegments');

    if (shouldScroll && !this.userScrolledUp) {
      requestAnimationFrame(() => this.scrollToBottom());
    }

    // Re-observe new children after messages update
    if (changedProperties.has('messages') && this.scrollObserver) {
      const thread = this.querySelector('.chat-thread');
      if (thread) {
        this.scrollObserver.disconnect();
        for (const child of thread.children) {
          this.scrollObserver.observe(child);
        }
      }
    }
  }

  private handleThreadScroll = () => {
    const thread = this.querySelector('.chat-thread');
    if (!thread) return;
    const distanceFromBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    this.userScrolledUp = distanceFromBottom > 80;
  };

  private scrollToBottom() {
    const thread = this.querySelector('.chat-thread');
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }

  private groupMessages(messages: Message[]): MessageGroup[] {
    const groups: MessageGroup[] = [];
    for (const msg of messages) {
      const last = groups[groups.length - 1];
      if (last && last.role === msg.role) {
        last.messages.push(msg);
      } else {
        groups.push({ role: msg.role, messages: [msg], timestamp: msg.timestamp });
      }
    }
    return groups;
  }

  private formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private toggleThinking(messageId: string) {
    const next = new Set(this.expandedThinking);
    if (next.has(messageId)) {
      next.delete(messageId);
    } else {
      next.add(messageId);
    }
    this.expandedThinking = next;
  }

  private quickSend(text: string) {
    this.inputValue = text;
    this.handleSend();
  }

  private handleInput(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    this.inputValue = textarea.value;

    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';

    if (this.inputValue.startsWith('/')) {
      this.slashMenuOpen = true;
      this.slashQuery = this.inputValue.slice(1);
    } else {
      this.slashMenuOpen = false;
      this.slashQuery = '';
    }

    this.dispatchEvent(new CustomEvent('draft-change', {
      detail: this.inputValue,
      bubbles: true,
      composed: true
    }));
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.slashMenuOpen) {
      const menu = this.querySelector('jd-slash-menu') as any;
      if (menu?.handleKeyDown(e)) return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      this.handleSend();
    }
  }

  private handleSend() {
    if ((!this.inputValue || !this.inputValue.trim()) && this.attachments.length === 0) {
      return;
    }
    const message = this.inputValue;
    this.dispatchEvent(new CustomEvent('send', {
      detail: message,
      bubbles: true,
      composed: true
    }));
    this.inputValue = '';
    const textarea = this.querySelector('textarea');
    if (textarea) {
      textarea.style.height = 'auto';
    }
  }

  private handleAbort() {
    this.dispatchEvent(new CustomEvent('abort', { bubbles: true, composed: true }));
  }

  private handleSlashSelect(e: CustomEvent<{ key: string }>) {
    this.slashMenuOpen = false;
    this.slashQuery = '';
    this.inputValue = '';
    this.dispatchEvent(new CustomEvent('slash-command', {
      detail: e.detail,
      bubbles: true,
      composed: true,
    }));
  }

  private handleAttachmentRemove(attachment: Attachment) {
    const newAttachments = this.attachments.filter(a => a.id !== attachment.id);
    this.dispatchEvent(new CustomEvent('attachments-change', {
      detail: newAttachments,
      bubbles: true,
      composed: true
    }));
  }

  private handleFileSelect() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.doc,.docx,.txt';
    input.multiple = true;
    input.onchange = () => {
      if (input.files) {
        const newAttachments: Attachment[] = Array.from(input.files).map(file => ({
          id: crypto.randomUUID(),
          type: file.type.startsWith('image/') ? 'image' as const : 'file' as const,
          name: file.name,
          mimeType: file.type,
          url: URL.createObjectURL(file)
        }));
        this.dispatchEvent(new CustomEvent('attachments-change', {
          detail: [...this.attachments, ...newAttachments],
          bubbles: true,
          composed: true
        }));
      }
    };
    input.click();
  }

  private async handleCopyMessage(msg: Message) {
    const success = await copyToClipboard(msg.content);
    if (success) {
      this.copiedMessageId = msg.id;
      this.dispatchEvent(new CustomEvent('copy-success', {
        bubbles: true,
        composed: true
      }));
      setTimeout(() => {
        this.copiedMessageId = null;
      }, 2000);
    }
  }

  private handleRetryMessage(msg: Message) {
    this.dispatchEvent(new CustomEvent('retry-message', {
      detail: { messageId: msg.id },
      bubbles: true,
      composed: true
    }));
  }

  private async handleCodeBlockCopy(e: Event) {
    const target = (e.target as HTMLElement).closest('.code-copy-btn') as HTMLElement | null;
    if (!target) return;
    const code = target.dataset.code || '';
    const success = await copyToClipboard(code);
    if (success) {
      target.classList.add('copied');
      const span = target.querySelector('span');
      if (span) {
        const original = span.textContent;
        span.textContent = '已复制';
        setTimeout(() => {
          target.classList.remove('copied');
          if (span) span.textContent = original;
        }, 2000);
      }
    }
  }

  private handleImageClick(url: string) {
    this.dispatchEvent(new CustomEvent('image-preview', {
      detail: { url },
      bubbles: true,
      composed: true
    }));
  }

  private renderMessageAttachments(attachments: Attachment[]) {
    if (!attachments || attachments.length === 0) return nothing;
    return html`
      <div class="message-attachments">
        ${attachments.map(att => {
          if (att.type === 'image') {
            const src = att.url || att.data || '';
            return html`
              <img class="attachment-image" src=${src} alt=${att.name}
                @click=${() => this.handleImageClick(src)}>
            `;
          }
          return html`
            <div class="attachment-file-card">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span class="attachment-file-name">${att.name}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderThinking(msg: Message) {
    const isExpanded = this.expandedThinking.has(msg.id);
    return html`
      <button class="thinking-toggle ${isExpanded ? 'expanded' : ''}"
        @click=${() => this.toggleThinking(msg.id)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 6l6 6-6 6z"/>
        </svg>
        <span>思考过程</span>
      </button>
      ${isExpanded ? html`<div class="thinking-content">${msg.thinking}</div>` : nothing}
    `;
  }

  private renderBubble(msg: Message, isLastAssistant: boolean) {
    return html`
      <div class="chat-bubble" @click=${this.handleCodeBlockCopy}>
        <div class="chat-bubble-actions">
          <button @click=${(e: Event) => { e.stopPropagation(); this.handleCopyMessage(msg); }}
                  ?data-copied=${this.copiedMessageId === msg.id} title="复制">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
            </svg>
          </button>
        </div>
        ${msg.thinking ? this.renderThinking(msg) : nothing}
        ${unsafeHTML(DOMPurify.sanitize(marked(msg.content) as string))}
        ${msg.attachments?.length ? this.renderMessageAttachments(msg.attachments) : nothing}
      </div>
    `;
  }

  private renderGroup(group: MessageGroup, isLastAssistantGroup: boolean, isLastAssistantInAll: boolean) {
    return html`
      <div class="chat-group ${group.role}">
        <div class="chat-avatar ${group.role}">${group.role === 'user' ? 'U' : 'A'}</div>
        <div class="chat-group-messages">
          ${group.messages.map((msg, i) => this.renderBubble(msg, isLastAssistantInAll && i === group.messages.length - 1))}
          <div class="chat-group-footer">
            <span class="chat-sender-name">${group.role === 'user' ? '你' : '助手'}</span>
            <span class="chat-group-timestamp">${this.formatTime(group.timestamp)}</span>
            ${isLastAssistantGroup ? html`
              <button @click=${() => this.handleRetryMessage(group.messages[group.messages.length - 1])} title="重试">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"></path>
                </svg>
              </button>
            ` : nothing}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const hasMessages = this.messages.length > 0 || this.streamingText;
    const groups = this.groupMessages(this.messages);
    const lastAssistantGroupIdx = groups.map(g => g.role).lastIndexOf('assistant');

    return html`
      <div class="chat">
        <div class="chat-split-container">
          <div class="chat-main">
            <div class="chat-thread">
              <div class="chat-selectors">
                <div class="chat-selector">
                  <select
                    class="chat-selector__select"
                    .value=${this.selectedAgentId}
                    @change=${(e: Event) => this.dispatchEvent(new CustomEvent('agent-change', {
                      detail: (e.target as HTMLSelectElement).value,
                      bubbles: true, composed: true,
                    }))}
                  >
                    ${this.agents.length === 0 ? html`<option>JDClaw 助手</option>` : nothing}
                    ${this.agents.map(a => html`
                      <option value=${a.id} ?selected=${a.id === this.selectedAgentId}>
                        ${a.identity?.emoji ? a.identity.emoji + ' ' : ''}${a.name || a.identity?.name || a.id}
                      </option>
                    `)}
                  </select>
                </div>
                <div class="chat-selector">
                  <select
                    class="chat-selector__select"
                    .value=${this.selectedModel}
                    @change=${(e: Event) => this.dispatchEvent(new CustomEvent('model-change', {
                      detail: (e.target as HTMLSelectElement).value,
                      bubbles: true, composed: true,
                    }))}
                  >
                    ${this.models.length === 0 ? html`<option>默认模型</option>` : nothing}
                    ${this.models.map(m => html`
                      <option value=${m.id} ?selected=${m.id === this.selectedModel}>
                        ${m.name}${m.provider ? '  ·  ' + m.provider : ''}
                      </option>
                    `)}
                  </select>
                </div>
              </div>
              ${hasMessages ? html`
                ${groups.map((group, idx) => {
                  const isLastAssistantGroup = idx === lastAssistantGroupIdx;
                  return this.renderGroup(group, isLastAssistantGroup, isLastAssistantGroup);
                })}
                ${this.streamingText ? html`
                  <div class="chat-group assistant">
                    <div class="chat-avatar assistant">A</div>
                    <div class="chat-group-messages">
                      <div class="chat-bubble streaming">
                        ${unsafeHTML(DOMPurify.sanitize(marked(this.streamingText!) as string))}
                      </div>
                    </div>
                  </div>
                ` : nothing}
                ${this.chatStreamSegments.filter(s => s.type === 'thinking' && s.content).length > 0 ? html`
                  <div class="chat-group assistant">
                    <div class="chat-avatar assistant">A</div>
                    <div class="chat-group-messages">
                      ${this.chatStreamSegments
                        .filter(s => s.type === 'thinking' && s.content)
                        .map(seg => html`
                          <div class="chat-thinking-segment ${seg.status === 'running' ? 'streaming' : ''}">
                            <div class="thinking-label">${seg.status === 'running' ? '思考中...' : '思考过程'}</div>
                            <div class="thinking-content">${seg.content}</div>
                          </div>
                        `)}
                    </div>
                  </div>
                ` : nothing}
                ${this.toolStreamEntries.length > 0 ? html`
                  <div class="chat-group assistant">
                    <div class="chat-avatar assistant" style="font-size:16px">🔧</div>
                    <div class="chat-group-messages">
                      ${this.toolStreamEntries.map(entry => html`
                        <jd-tool-card .name=${entry.name} .args=${entry.args} .output=${entry.output}
                          .status=${entry.status} .startedAt=${entry.startedAt} .completedAt=${entry.completedAt}>
                        </jd-tool-card>
                      `)}
                    </div>
                  </div>
                ` : nothing}
                ${this.sending && !this.streamingText && this.toolStreamEntries.length === 0 ? html`
                  <div class="chat-group assistant">
                    <div class="chat-avatar assistant">A</div>
                    <div class="chat-group-messages">
                      <div class="chat-reading-indicator">
                        <div class="chat-reading-indicator__dots">
                          <span></span><span></span><span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                ` : nothing}
              ` : html`
                <div class="agent-chat-welcome">
                  <div class="agent-chat-welcome__glow"></div>
                  <div class="agent-chat-welcome__avatar"><img src="/logo.svg" alt="JDClaw" /></div>
                  <h2>JDClaw 助手</h2>
                  <p class="agent-chat-welcome__hint">在下方输入消息开始对话 · <kbd>/</kbd> 查看命令</p>
                  <div class="agent-chat-welcome__suggestions">
                    <button class="agent-chat-welcome__suggestion" @click=${() => this.quickSend('你好，请介绍一下自己')}>你好，请介绍一下自己</button>
                    <button class="agent-chat-welcome__suggestion" @click=${() => this.quickSend('帮我写一段代码')}>帮我写一段代码</button>
                  </div>
                </div>
              `}
            </div>
            <div class="chat-compose">
              ${this.slashMenuOpen ? html`
                <jd-slash-menu .open=${true} .query=${this.slashQuery}
                  @slash-select=${this.handleSlashSelect}
                  @slash-close=${() => { this.slashMenuOpen = false; this.slashQuery = ''; }}>
                </jd-slash-menu>
              ` : nothing}
              <div class="agent-chat__input">
                ${this.attachments.length > 0 ? html`
                  <div class="chat-attachments-preview">
                    ${this.attachments.map(att => att.type === 'image' ? html`
                      <div class="chat-attachment-thumb">
                        <img src=${att.url || ''} alt=${att.name}>
                        <button class="chat-attachment-thumb__remove" @click=${() => this.handleAttachmentRemove(att)}>×</button>
                      </div>
                    ` : html`
                      <div class="chat-attachment-file">
                        <span>${att.name}</span>
                        <button @click=${() => this.handleAttachmentRemove(att)}>×</button>
                      </div>
                    `)}
                  </div>
                ` : nothing}
                <textarea
                  placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                  .value=${this.inputValue}
                  @input=${this.handleInput}
                  @keydown=${this.handleKeyDown}
                  ?disabled=${this.sending && !this.streamingText}
                  rows="1"
                ></textarea>
                <div class="agent-chat__toolbar">
                  <div class="agent-chat__toolbar-left">
                    <button class="agent-chat__input-btn" @click=${this.handleFileSelect} title="附件">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"></path>
                      </svg>
                    </button>
                  </div>
                  <div class="agent-chat__toolbar-right">
                    ${this.sending && this.streamingText ? html`
                      <button class="agent-chat__input-btn stop" @click=${this.handleAbort} title="停止">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
                      </button>
                    ` : html`
                      <button class="agent-chat__input-btn send" @click=${this.handleSend}
                        ?disabled=${!this.inputValue.trim() && this.attachments.length === 0} title="发送">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="22" y1="2" x2="11" y2="13"></line>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                      </button>
                    `}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-chat-view': JDChatView;
  }
}
