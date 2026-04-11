import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { marked } from 'marked';
import type { Message, Attachment } from '../types/index.js';
import { copyToClipboard } from '../utils/index.js';

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
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: var(--jd-bg-primary, #ffffff);
      color: var(--jd-text-primary, #111827);
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px;
      scroll-behavior: smooth;
    }

    .messages-wrapper {
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .message {
      display: flex;
      gap: 12px;
      animation: fadeIn 0.3s ease;
      position: relative;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message.user {
      flex-direction: row-reverse;
    }

    .message-avatar {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }

    .message.user .message-avatar {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white;
    }

    .message.assistant .message-avatar {
      background: var(--jd-bg-tertiary, #f3f4f6);
      color: var(--jd-text-secondary, #6b7280);
    }

    .message-content {
      flex: 1;
      min-width: 0;
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .message.user .message-header {
      flex-direction: row-reverse;
    }

    .message-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--jd-text-primary, #111827);
    }

    .message-time {
      font-size: 12px;
      color: var(--jd-text-muted, #9ca3af);
    }

    .message-body {
      background: var(--jd-bg-secondary, #f9fafb);
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 15px;
      line-height: 1.6;
      color: var(--jd-text-primary, #111827);
    }

    .message.user .message-body {
      background: var(--jd-primary, #4f46e5);
      color: white;
    }

    .message-body p {
      margin: 0 0 8px 0;
    }

    .message-body p:last-child {
      margin-bottom: 0;
    }

    .message-body code {
      background: rgba(0, 0, 0, 0.06);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
    }

    .message.user .message-body code {
      background: rgba(255, 255, 255, 0.2);
    }

    .message-body pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 12px 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 8px 0;
    }

    .message-body pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }

    /* Action bar */
    .message-action-bar {
      position: absolute;
      top: -4px;
      right: 48px;
      display: flex;
      gap: 4px;
      padding: 4px;
      background: var(--jd-bg-tertiary, #f3f4f6);
      border: 1px solid var(--jd-border, #e5e7eb);
      border-radius: 8px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
      z-index: 10;
    }

    .message:hover .message-action-bar {
      opacity: 1;
      pointer-events: auto;
    }

    .action-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--jd-text-secondary, #6b7280);
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      white-space: nowrap;
      transition: background 0.15s, color 0.15s;
    }

    .action-btn:hover {
      background: var(--jd-border, #e5e7eb);
      color: var(--jd-text-primary, #111827);
    }

    .action-btn.copied {
      color: #22c55e;
    }

    /* Code block styles */
    .code-block-wrapper {
      margin: 12px 0;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #333;
    }

    .code-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: #2d2d2d;
      font-size: 12px;
    }

    .code-block-lang {
      color: #999;
      text-transform: lowercase;
    }

    .code-copy-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #999;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      transition: background 0.15s, color 0.15s;
    }

    .code-copy-btn:hover {
      background: #444;
      color: #ddd;
    }

    .code-copy-btn.copied {
      color: #22c55e;
    }

    /* Markdown content styles */
    .message-markdown {
      line-height: 1.6;
    }

    .message-markdown p {
      margin: 0 0 8px 0;
    }

    .message-markdown p:last-child {
      margin-bottom: 0;
    }

    .message-markdown h1,
    .message-markdown h2,
    .message-markdown h3,
    .message-markdown h4,
    .message-markdown h5,
    .message-markdown h6 {
      margin: 16px 0 8px 0;
      font-weight: 600;
      line-height: 1.3;
    }

    .message-markdown h1 { font-size: 1.4em; }
    .message-markdown h2 { font-size: 1.25em; }
    .message-markdown h3 { font-size: 1.1em; }

    .message-markdown ul,
    .message-markdown ol {
      margin: 8px 0;
      padding-left: 24px;
    }

    .message-markdown li {
      margin: 4px 0;
    }

    .message-markdown blockquote {
      margin: 8px 0;
      padding: 4px 12px;
      border-left: 3px solid var(--jd-primary, #4f46e5);
      color: var(--jd-text-secondary, #6b7280);
    }

    .message-markdown table {
      border-collapse: collapse;
      margin: 8px 0;
      width: 100%;
      font-size: 14px;
    }

    .message-markdown th,
    .message-markdown td {
      border: 1px solid var(--jd-border, #e5e7eb);
      padding: 6px 12px;
      text-align: left;
    }

    .message-markdown th {
      background: var(--jd-bg-tertiary, #f3f4f6);
      font-weight: 600;
    }

    .message-markdown a {
      color: var(--jd-primary, #4f46e5);
      text-decoration: none;
    }

    .message-markdown a:hover {
      text-decoration: underline;
    }

    .message-markdown hr {
      border: none;
      border-top: 1px solid var(--jd-border, #e5e7eb);
      margin: 12px 0;
    }

    .message-markdown img {
      max-width: 100%;
      border-radius: 8px;
    }

    .message-markdown pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 12px 16px;
      border-radius: 0 0 8px 8px;
      overflow-x: auto;
      margin: 0;
    }

    .message-markdown pre code {
      background: transparent;
      padding: 0;
      color: inherit;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.5;
    }

    .message-markdown code {
      background: rgba(0, 0, 0, 0.06);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 0.9em;
    }

    .message.user .message-markdown code {
      background: rgba(255, 255, 255, 0.2);
    }

    /* Syntax highlighting (dark theme tokens) */
    .message-markdown pre .keyword { color: #569cd6; }
    .message-markdown pre .string { color: #ce9178; }
    .message-markdown pre .comment { color: #6a9955; }
    .message-markdown pre .number { color: #b5cea8; }
    .message-markdown pre .function { color: #dcdcaa; }
    .message-markdown pre .operator { color: #d4d4d4; }

    /* Attachment styles */
    .message-attachments {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .attachment-image {
      max-width: 300px;
      border-radius: 8px;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .attachment-image:hover {
      opacity: 0.9;
    }

    .attachment-file-card {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--jd-bg-tertiary, #f3f4f6);
      border: 1px solid var(--jd-border, #e5e7eb);
      border-radius: 8px;
      font-size: 13px;
      color: var(--jd-text-secondary, #6b7280);
    }

    .attachment-file-card svg {
      flex-shrink: 0;
    }

    .attachment-file-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 200px;
    }

    .streaming-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 8px;
    }

    .streaming-dot {
      width: 6px;
      height: 6px;
      background: var(--jd-primary, #4f46e5);
      border-radius: 50%;
      animation: pulse 1s ease-in-out infinite;
    }

    .streaming-dot:nth-child(2) { animation-delay: 0.2s; }
    .streaming-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes pulse {
      0%, 100% { opacity: 0.3; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1); }
    }

    .input-area {
      padding: 16px 24px 24px;
      border-top: 1px solid var(--jd-border, #e5e7eb);
      background: var(--jd-bg-primary, #ffffff);
    }

    .input-container {
      max-width: 800px;
      margin: 0 auto;
    }

    .attachments-preview {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }

    .attachment-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: var(--jd-bg-tertiary, #f3f4f6);
      border-radius: 6px;
      font-size: 13px;
      color: var(--jd-text-secondary, #6b7280);
    }

    .attachment-chip img {
      width: 24px;
      height: 24px;
      object-fit: cover;
      border-radius: 4px;
    }

    .attachment-chip button {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      color: var(--jd-text-muted, #9ca3af);
      display: flex;
      align-items: center;
    }

    .attachment-chip button:hover {
      color: var(--jd-danger, #ef4444);
    }

    .input-row {
      display: flex;
      gap: 12px;
      align-items: flex-end;
    }

    .input-wrapper {
      flex: 1;
      position: relative;
    }

    .input-field {
      width: 100%;
      min-height: 44px;
      max-height: 200px;
      padding: 10px 16px;
      border: 1px solid var(--jd-border, #e5e7eb);
      border-radius: 12px;
      font-family: inherit;
      font-size: 15px;
      line-height: 1.5;
      resize: none;
      outline: none;
      transition: border-color 0.2s;
      background: var(--jd-bg-secondary, #f9fafb);
      color: var(--jd-text-primary, #111827);
    }

    .input-field:focus {
      border-color: var(--jd-primary, #4f46e5);
      background: var(--jd-bg-primary, #ffffff);
    }

    .input-field::placeholder {
      color: var(--jd-text-muted, #9ca3af);
    }

    .input-actions {
      display: flex;
      gap: 8px;
    }

    .input-btn {
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 10px;
      background: var(--jd-bg-tertiary, #f3f4f6);
      color: var(--jd-text-secondary, #6b7280);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .input-btn:hover {
      background: var(--jd-border, #e5e7eb);
    }

    .input-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .send-btn {
      background: var(--jd-primary, #4f46e5);
      color: white;
    }

    .send-btn:hover:not(:disabled) {
      background: var(--jd-primary-hover, #4338ca);
    }

    .abort-btn {
      background: var(--jd-danger, #ef4444);
      color: white;
    }

    .abort-btn:hover {
      background: #dc2626;
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      text-align: center;
    }

    .empty-icon {
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      color: var(--jd-text-muted, #9ca3af);
    }

    .empty-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--jd-text-primary, #111827);
      margin-bottom: 8px;
    }

    .empty-description {
      font-size: 14px;
      color: var(--jd-text-secondary, #6b7280);
      max-width: 400px;
    }
  `;

  @property({ type: Array }) messages: Message[] = [];
  @property({ type: String }) streamingText: string | null = null;
  @property({ type: Boolean }) sending = false;
  @property({ type: Array }) attachments: Attachment[] = [];
  @property({ type: String }) draft = '';
  @property({ type: Boolean }) focusMode = false;

  @query('.input-field') private inputField!: HTMLTextAreaElement;

  @state() private inputValue = '';
  @state() private copiedMessageId: string | null = null;

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('draft')) {
      this.inputValue = this.draft;
    }
  }

  private handleInput(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    this.inputValue = textarea.value;
    
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    
    this.dispatchEvent(new CustomEvent('draft-change', {
      detail: this.inputValue,
      bubbles: true,
      composed: true
    }));
  }

  private handleKeyDown(e: KeyboardEvent) {
    console.log('[JDChatView] handleKeyDown:', e.key, 'shift:', e.shiftKey);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      this.handleSend();
    }
  }

  private handleSend() {
    console.log('[JDChatView] handleSend called, inputValue:', JSON.stringify(this.inputValue));
    if ((!this.inputValue || !this.inputValue.trim()) && this.attachments.length === 0) {
      console.log('[JDChatView] Empty input, not sending');
      return;
    }
    
    const message = this.inputValue;
    console.log('[JDChatView] Dispatching send event with:', message);
    this.dispatchEvent(new CustomEvent('send', {
      detail: message,
      bubbles: true,
      composed: true
    }));
    
    this.inputValue = '';
    if (this.inputField) {
      this.inputField.style.height = 'auto';
    }
  }

  private handleAbort() {
    this.dispatchEvent(new CustomEvent('abort', { bubbles: true, composed: true }));
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

  private formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private renderMarkdownContent(content: string) {
    const htmlStr = marked(content) as string;
    return unsafeHTML(htmlStr);
  }

  private async handleCopyMessage(message: Message) {
    const success = await copyToClipboard(message.content);
    if (success) {
      this.copiedMessageId = message.id;
      this.dispatchEvent(new CustomEvent('copy-success', {
        bubbles: true,
        composed: true
      }));
      setTimeout(() => {
        this.copiedMessageId = null;
      }, 2000);
    }
  }

  private handleRetryMessage(message: Message) {
    this.dispatchEvent(new CustomEvent('retry-message', {
      detail: { messageId: message.id },
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

  private renderAttachments(attachments: Attachment[]) {
    if (!attachments || attachments.length === 0) return null;
    return html`
      <div class="message-attachments">
        ${attachments.map(att => {
          if (att.type === 'image') {
            const src = att.url || att.data || '';
            return html`
              <img
                class="attachment-image"
                src=${src}
                alt=${att.name}
                @click=${() => this.handleImageClick(src)}
              >
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

  private renderMessage(message: Message, isLastAssistant: boolean) {
    const isCopied = this.copiedMessageId === message.id;
    return html`
      <div class="message ${message.role}">
        <div class="message-avatar">
          ${message.role === 'user' ? 'U' : 'A'}
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-name">${message.role === 'user' ? '你' : '助手'}</span>
            <span class="message-time">${this.formatTime(message.timestamp)}</span>
          </div>
          <div class="message-body" @click=${this.handleCodeBlockCopy}>
            <div class="message-markdown">${this.renderMarkdownContent(message.content)}</div>
            ${this.renderAttachments(message.attachments || [])}
          </div>
          <div class="message-action-bar">
            <button
              class="action-btn ${isCopied ? 'copied' : ''}"
              @click=${() => this.handleCopyMessage(message)}
              title="复制消息"
            >
              ${isCopied ? html`
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>已复制</span>
              ` : html`
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                </svg>
                <span>复制</span>
              `}
            </button>
            ${isLastAssistant && message.role === 'assistant' ? html`
              <button
                class="action-btn"
                @click=${() => this.handleRetryMessage(message)}
                title="重新生成"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"></path>
                </svg>
                <span>重试</span>
              </button>
            ` : null}
          </div>
        </div>
      </div>
    `;
  }

  private renderStreamingMessage() {
    if (!this.streamingText) return null;
    
    return html`
      <div class="message assistant">
        <div class="message-avatar">A</div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-name">助手</span>
            <div class="streaming-indicator">
              <div class="streaming-dot"></div>
              <div class="streaming-dot"></div>
              <div class="streaming-dot"></div>
            </div>
          </div>
          <div class="message-body">
            <div class="message-markdown">${this.renderMarkdownContent(this.streamingText)}</div>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const hasMessages = this.messages.length > 0 || this.streamingText;
    
    return html`
      <div class="messages-container">
        <div class="messages-wrapper">
          ${hasMessages ? html`
            ${this.messages.map((msg, idx) => {
              const isLastAssistant = msg.role === 'assistant' &&
                !this.messages.slice(idx + 1).some(m => m.role === 'assistant');
              return this.renderMessage(msg, isLastAssistant);
            })}
            ${this.renderStreamingMessage()}
          ` : html`
            <div class="empty-state">
              <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
              <div class="empty-title">开始新对话</div>
              <div class="empty-description">
                输入消息与 JDClaw 助手开始对话，支持文本、图片、文件上传
              </div>
            </div>
          `}
        </div>
      </div>

      <div class="input-area">
        <div class="input-container">
          ${this.attachments.length > 0 ? html`
            <div class="attachments-preview">
              ${this.attachments.map(att => html`
                <div class="attachment-chip">
                  ${att.type === 'image' ? html`<img src=${att.url || ''} alt=${att.name}>` : null}
                  <span>${att.name}</span>
                  <button @click=${() => this.handleAttachmentRemove(att)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              `)}
            </div>
          ` : null}

          <div class="input-row">
            <div class="input-wrapper">
              <textarea 
                class="input-field"
                placeholder="输入消息... (Shift + Enter 换行)"
                .value=${this.inputValue}
                @input=${this.handleInput}
                @keydown=${this.handleKeyDown}
                ?disabled=${this.sending && !this.streamingText}
              ></textarea>
            </div>
            
            <div class="input-actions">
              <button class="input-btn" @click=${this.handleFileSelect} title="添加附件">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>

              ${this.sending && this.streamingText ? html`
                <button class="input-btn abort-btn" @click=${this.handleAbort} title="停止生成">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                  </svg>
                </button>
              ` : html`
                <button 
                  class="input-btn send-btn" 
                  @click=${this.handleSend}
                  ?disabled=${!this.inputValue.trim() && this.attachments.length === 0}
                  title="发送"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              `}
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
