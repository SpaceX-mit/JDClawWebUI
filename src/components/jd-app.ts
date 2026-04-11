import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { icons, agentLogoUrl, resolveAgentAvatarUrl } from '../icons.js';
import { marked } from 'marked';
import type {
  Attachment,
  Message,
  GatewayHelloOk,
  SessionsListResult,
  GatewaySessionRow,
  AppSettings,
  ChatQueueItem,
  ToolStreamEntry,
  PresenceEntry,
  Tab,
  ThemeName,
  ThemeMode,
  SlashCommand,
} from '../types/index.js';
import { GatewayBrowserClient, formatConnectError } from '../utils/gateway.js';

const GATEWAY_URL = 'ws://localhost:18789';
const RECONNECT_MAX = 5;
const SESSIONS_POLL_INTERVAL = 5000;

@customElement('jd-app')
export class JdApp extends LitElement {
  @state() private settings: AppSettings = this.loadSettings();
  @state() private connected = false;
  @state() private connecting = false;
  @state() private lastError: string | null = null;
  @state() private lastErrorCode: string | null = null;
  @state() private hello: GatewayHelloOk | null = null;
  
  @state() private sessionKey = this.settings.sessionKey || 'agent:main';
  @state() private sessionsResult: SessionsListResult | null = null;
  @state() private presenceEntries: PresenceEntry[] = [];
  
  @state() private chatLoading = false;
  @state() private chatSending = false;
  @state() private chatMessage = '';
  @state() private chatMessages: Message[] = [];
  @state() private chatToolMessages: unknown[] = [];
  @state() private chatStream: string | null = null;
  @state() private chatStreamStartedAt: number | null = null;
  @state() private chatRunId: string | null = null;
  @state() private chatQueue: ChatQueueItem[] = [];
  @state() private chatAttachments: Attachment[] = [];
  
  @state() private assistantName = 'JDClaw';
  @state() private assistantAvatar: string | null = null;
  @state() private chatAvatarUrl: string | null = null;
  
  @state() private navOpen = true;
  @state() private navCollapsed = this.settings.navCollapsed || false;
  @state() private focusMode = this.settings.chatFocusMode || false;
  @state() private commandPaletteOpen = false;
  @state() private commandPaletteQuery = '';
  @state() private commandPaletteIndex = 0;
  
  @state() private tab: Tab = 'chat';
  @state() private sidebarOpen = false;
  @state() private sidebarContent: string | null = null;
  @state() private sidebarError: string | null = null;
  
  @state() private theme: ThemeName = (this.settings.theme as ThemeName) || 'claw';
  @state() private themeMode: ThemeMode = (this.settings.themeMode as ThemeMode) || 'dark';
  @state() private themeResolved: 'light' | 'dark' = 'dark';
  
  @state() private chatNewMessagesBelow = false;
  @state() private splitRatio = this.settings.splitRatio || 0.6;
  
  @state() private showThinking = this.settings.chatShowThinking ?? true;
  @state() private showToolCalls = this.settings.chatShowToolCalls ?? true;
  
  private client: GatewayBrowserClient | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pollTimer: number | null = null;
  private toolStreamById = new Map<string, ToolStreamEntry>();
  private toolStreamOrder: string[] = [];
  private clientInstanceId = crypto.randomUUID();
  private chatScrollFrame: number | null = null;
  
  private globalKeydownHandler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'k') {
      e.preventDefault();
      this.commandPaletteOpen = !this.commandPaletteOpen;
      if (this.commandPaletteOpen) {
        this.commandPaletteQuery = '';
        this.commandPaletteIndex = 0;
      }
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') {
      e.preventDefault();
      this.handleNewSession();
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === '.') {
      e.preventDefault();
      this.toggleFocusMode();
    }
  };

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.globalKeydownHandler);
    this.connect();
    this.startSessionPoll();
    this.applyTheme();
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.globalKeydownHandler);
    this.disconnect();
    this.stopSessionPoll();
    super.disconnectedCallback();
  }

  private loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem('jdclaw-settings');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return {
      gatewayUrl: GATEWAY_URL,
      token: '',
      theme: 'claw',
      themeMode: 'dark',
      language: 'zh-CN',
      fontSize: 'medium',
      streamingEnabled: true,
      soundEnabled: false,
      notificationsEnabled: false,
      sessionKey: 'agent:main',
      chatFocusMode: false,
      chatShowThinking: true,
      chatShowToolCalls: true,
      navCollapsed: false,
      borderRadius: 8,
      splitRatio: 0.6,
    };
  }

  private saveSettings(settings: AppSettings) {
    this.settings = settings;
    try {
      localStorage.setItem('jdclaw-settings', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }

  private applyTheme() {
    const root = document.documentElement;
    if (this.themeMode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.themeResolved = prefersDark ? 'dark' : 'light';
    } else {
      this.themeResolved = this.themeMode;
    }
    root.setAttribute('data-theme', this.themeResolved);
  }

  private toggleFocusMode() {
    this.focusMode = !this.focusMode;
    this.saveSettings({ ...this.settings, chatFocusMode: this.focusMode });
  }

  private connect() {
    if (this.connecting || this.connected) return;

    this.connecting = true;
    this.lastError = null;
    this.lastErrorCode = null;
    console.log('[JdApp] Connecting to:', this.settings.gatewayUrl);

    this.client = new GatewayBrowserClient({
      url: this.settings.gatewayUrl,
      token: this.settings.token,
      clientName: 'jdclaw-webui',
      clientVersion: '1.0.0',
      mode: 'webchat',
      instanceId: this.clientInstanceId,
      onHello: (hello: GatewayHelloOk) => {
        console.log('[JdApp] Connected!', hello);
        this.connecting = false;
        this.connected = true;
        this.lastError = null;
        this.lastErrorCode = null;
        this.hello = hello;
        this.reconnectAttempts = 0;
        this.applySnapshot(hello);
        this.loadChatHistory();
        setTimeout(() => this.requestSessions(), 100);
      },
      onClose: ({ code, reason, error }: { code: number; reason: string; error?: { message?: string; code?: string } }) => {
        console.log('[JdApp] Disconnected:', code, reason);
        this.connected = false;
        
        if (error?.message) {
          const errorCode = error.code || undefined;
          this.lastError = formatConnectError({ message: error.message, code: errorCode });
          this.lastErrorCode = errorCode || null;
        } else if (code !== 1012) {
          this.lastError = `Disconnected (${code}): ${reason || 'no reason'}`;
        }
        
        if (code !== 1000) {
          this.scheduleReconnect();
        }
      },
      onEvent: (evt: { event: string; payload?: Record<string, unknown> }) => {
        this.handleEvent(evt);
      },
    });

    this.client.start();
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      this.client.stop();
      this.client = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= RECONNECT_MAX) {
      this.lastError = this.lastError || '无法连接到 Gateway';
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    console.log(`[JdApp] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private applySnapshot(hello: GatewayHelloOk) {
    const snapshot = hello.snapshot as {
      presence?: PresenceEntry[];
      sessionDefaults?: {
        defaultAgentId?: string;
        mainKey?: string;
        mainSessionKey?: string;
      };
    } | undefined;

    if (snapshot?.presence && Array.isArray(snapshot.presence)) {
      this.presenceEntries = snapshot.presence;
    }

    if (snapshot?.sessionDefaults?.mainSessionKey) {
      const mainSessionKey = snapshot.sessionDefaults.mainSessionKey;
      if (!this.sessionKey || this.sessionKey === 'agent:main') {
        this.sessionKey = mainSessionKey;
      }
    }
  }

  private startSessionPoll() {
    this.pollTimer = window.setInterval(() => {
      if (this.connected && this.client) {
        this.requestSessions();
      }
    }, SESSIONS_POLL_INTERVAL);
  }

  private stopSessionPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async requestSessions() {
    if (!this.client) return;

    try {
      const result = await this.client.request('sessions.list', {
        activeMinutes: 120,
        limit: 50,
        includeGlobal: true,
        includeUnknown: true,
      }) as SessionsListResult;
      
      this.sessionsResult = result;
    } catch (err) {
      console.error('[JdApp] Failed to load sessions:', err);
    }
  }

  private async loadChatHistory() {
    if (!this.client || !this.sessionKey) return;

    this.chatLoading = true;
    try {
      const result = await this.client.request('chat.history', {
        key: this.sessionKey,
        limit: 100,
      }) as { messages?: Message[] };

      if (result?.messages) {
        const existingIds = new Set(this.chatMessages.map(m => m.id));
        const newMessages = result.messages.filter(m => !existingIds.has(m.id));
        if (newMessages.length > 0) {
          this.chatMessages = [...this.chatMessages, ...newMessages];
        } else {
          this.chatMessages = result.messages;
        }
      }
    } catch (err) {
      console.error('[JdApp] Failed to load chat history:', err);
    } finally {
      this.chatLoading = false;
    }
  }

  private handleEvent(evt: { event: string; payload?: Record<string, unknown> }) {
    console.log('[JdApp] Event:', evt.event, evt.payload);

    switch (evt.event) {
      case 'chat': {
        this.handleChatEvent(evt.payload);
        break;
      }
      case 'agent': {
        this.handleAgentEvent(evt.payload);
        break;
      }
      case 'presence': {
        const presence = evt.payload?.presence as PresenceEntry[] | undefined;
        if (presence) {
          this.presenceEntries = presence;
        }
        break;
      }
      case 'sessions.changed': {
        this.requestSessions();
        break;
      }
      case 'shutdown': {
        const reason = (evt.payload?.reason as string) || 'Gateway stopping';
        this.lastError = `Disconnected: ${reason}`;
        break;
      }
    }
  }

  private handleChatEvent(payload?: Record<string, unknown>) {
    const state = payload?.state as string | undefined;
    const runId = payload?.runId as string | undefined;
    const sessionKey = payload?.sessionKey as string | undefined;

    if (sessionKey && sessionKey !== this.sessionKey) {
      return;
    }

    if (state === 'delta' || state === 'start') {
      const text = (payload?.text || payload?.content || payload?.delta) as string | undefined;
      if (text !== undefined) {
        this.chatStream = (this.chatStream || '') + text;
        this.chatStreamStartedAt = this.chatStreamStartedAt ?? Date.now();
      }
      if (runId) {
        this.chatRunId = runId;
        this.chatSending = true;
      }
      return;
    }

    if (state === 'final' || state === 'done') {
      const message = payload?.message as Message | undefined;
      if (message) {
        this.chatMessages = [...this.chatMessages, message];
      }
      this.chatStream = null;
      this.chatStreamStartedAt = null;
      this.chatSending = false;
      this.chatRunId = null;
      this.resetToolStream();
      this.requestSessions();
      this.loadChatHistory();
      return;
    }

    if (state === 'aborted' || state === 'error') {
      const errorMessage = payload?.errorMessage as string | undefined;
      if (errorMessage) {
        this.lastError = errorMessage;
      }
      this.chatStream = null;
      this.chatStreamStartedAt = null;
      this.chatSending = false;
      this.chatRunId = null;
      this.resetToolStream();
      return;
    }
  }

  private handleAgentEvent(payload?: Record<string, unknown>) {
    const stream = payload?.stream as string | undefined;
    const data = payload?.data as Record<string, unknown> | undefined;

    if (stream === 'tool') {
      const toolCallId = data?.id as string | undefined;
      const toolName = data?.name as string | undefined;
      const toolInput = data?.input as Record<string, unknown> | undefined;
      const status = data?.status as string | undefined;

      if (toolCallId) {
        if (status === 'running') {
          const entry: ToolStreamEntry = {
            id: toolCallId,
            toolId: toolCallId,
            toolName: toolName || 'tool',
            status: 'running',
            input: toolInput,
            startedAt: Date.now(),
          };
          this.toolStreamById.set(toolCallId, entry);
          this.toolStreamOrder.push(toolCallId);
        } else if (status === 'completed') {
          const entry = this.toolStreamById.get(toolCallId);
          if (entry) {
            entry.status = 'completed';
            entry.output = data?.result as string;
            entry.completedAt = Date.now();
          }
        } else if (status === 'error') {
          const entry = this.toolStreamById.get(toolCallId);
          if (entry) {
            entry.status = 'error';
            entry.error = data?.error as string;
            entry.completedAt = Date.now();
          }
        }
      }
    }
  }

  private resetToolStream() {
    this.toolStreamById.clear();
    this.toolStreamOrder = [];
  }

  private async handleSend() {
    const message = this.chatMessage.trim();
    if (!message || !this.connected || !this.client) return;

    this.chatMessage = '';
    this.chatSending = true;
    this.chatStream = '';
    this.chatStreamStartedAt = Date.now();
    const runId = crypto.randomUUID();
    this.chatRunId = runId;

    try {
      await this.client.request('chat.send', {
        sessionKey: this.sessionKey,
        message,
        deliver: true,
        idempotencyKey: runId,
      });
    } catch (err) {
      console.error('[JdApp] Send error:', err);
      this.lastError = String(err);
      this.chatSending = false;
      this.chatStream = null;
      this.chatRunId = null;
    }
  }

  private async handleAbort() {
    if (!this.client || !this.chatRunId) return;

    try {
      await this.client.request('chat.abort', {
        runId: this.chatRunId,
      });
    } catch (err) {
      console.error('[JdApp] Abort error:', err);
    }

    this.chatStream = null;
    this.chatStreamStartedAt = null;
    this.chatSending = false;
    this.chatRunId = null;
  }

  private handleSessionSelect(key: string) {
    this.sessionKey = key;
    this.chatMessages = [];
    this.chatStream = null;
    this.loadChatHistory();
    this.saveSettings({ ...this.settings, sessionKey: key });
  }

  private handleNewSession() {
    const key = `agent:main:${Date.now()}`;
    this.handleSessionSelect(key);
  }

  private handleInputChange(value: string) {
    this.chatMessage = value;
  }

  private handleTabChange(tab: Tab) {
    this.tab = tab;
    if (tab === 'chat') {
      this.loadChatHistory();
    } else if (tab === 'sessions') {
      this.requestSessions();
    }
  }

  private handleOpenSidebar(content: string) {
    this.sidebarContent = content;
    this.sidebarError = null;
    this.sidebarOpen = true;
  }

  private handleCloseSidebar() {
    this.sidebarOpen = false;
    setTimeout(() => {
      if (!this.sidebarOpen) {
        this.sidebarContent = null;
        this.sidebarError = null;
      }
    }, 200);
  }

  private handleSplitRatioChange(ratio: number) {
    this.splitRatio = Math.max(0.4, Math.min(0.7, ratio));
    this.saveSettings({ ...this.settings, splitRatio: this.splitRatio });
  }

  private removeQueueItem(id: string) {
    this.chatQueue = this.chatQueue.filter(item => item.id !== id);
  }

  private handleCommandPaletteSelect(command: SlashCommand) {
    this.commandPaletteOpen = false;
    
    switch (command.name) {
      case 'new':
        this.handleNewSession();
        break;
      case 'clear':
        this.chatMessages = [];
        break;
      case 'focus':
        this.toggleFocusMode();
        break;
      case 'sessions':
        this.handleTabChange('sessions');
        break;
      case 'settings':
        this.handleTabChange('settings');
        break;
      case 'overview':
        this.handleTabChange('overview');
        break;
    }
  }

  private getCommandPaletteItems(): SlashCommand[] {
    const commands: SlashCommand[] = [
      { id: 'new', name: 'new', description: 'Create new session', category: 'session', icon: 'plus', executeLocal: true },
      { id: 'clear', name: 'clear', description: 'Clear chat history', category: 'session', icon: 'trash', executeLocal: true },
      { id: 'focus', name: 'focus', description: 'Toggle focus mode', category: 'navigation', icon: 'maximize', executeLocal: true },
      { id: 'sessions', name: 'sessions', description: 'View sessions', category: 'navigation', icon: 'list' },
      { id: 'settings', name: 'settings', description: 'Open settings', category: 'navigation', icon: 'settings' },
      { id: 'overview', name: 'overview', description: 'View overview', category: 'navigation', icon: 'grid' },
    ];

    if (this.commandPaletteQuery) {
      const query = this.commandPaletteQuery.toLowerCase();
      return commands.filter(cmd => 
        cmd.name.toLowerCase().includes(query) || 
        cmd.description.toLowerCase().includes(query)
      );
    }

    return commands;
  }

  private renderLoading() {
    return html`
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <div class="loading-text">正在连接 Gateway...</div>
      </div>
    `;
  }

  private renderError() {
    return html`
      <div class="error-screen">
        <div class="error-icon">${icons.alertCircle}</div>
        <div class="error-title">无法连接到 Gateway</div>
        <div class="error-message">${this.lastError || '请确保 OpenClaw Gateway 正在运行'}</div>
        <button class="btn btn--primary" @click=${() => this.connect()}>重试</button>
      </div>
    `;
  }

  private renderWelcome() {
    const avatar = resolveAgentAvatarUrl({ identity: { avatar: this.assistantAvatar, avatarUrl: this.chatAvatarUrl || undefined } });
    return html`
      <div class="chat-welcome">
        <div class="chat-welcome__glow"></div>
        <div class="chat-welcome__avatar">
          ${avatar 
            ? html`<img src=${avatar} alt=${this.assistantName} />`
            : html`<img src="/logo.svg" alt="JDClaw" />`
          }
        </div>
        <h2>${this.assistantName} 助手</h2>
        <div class="chat-welcome__badges">
          <span class="chat-welcome__badge">
            <img src="/logo.svg" alt="" /> Ready to chat
          </span>
        </div>
        <p class="chat-welcome__hint">在下方输入消息开始对话 · <kbd>/</kbd> 查看命令</p>
        <div class="chat-welcome__suggestions">
          <button class="chat-welcome__suggestion" @click=${() => { this.chatMessage = '你好，能帮我做什么？'; this.handleSend(); }}>你好，能帮我做什么？</button>
          <button class="chat-welcome__suggestion" @click=${() => { this.chatMessage = '解释一下量子计算'; this.handleSend(); }}>解释一下量子计算</button>
        </div>
      </div>
    `;
  }

  private renderMessages() {
    return html`
      <div class="chat-messages">
        ${this.chatMessages.map((msg) => this.renderMessage(msg))}
        ${this.chatStream ? this.renderStreaming() : nothing}
      </div>
    `;
  }

  private renderMessage(msg: Message) {
    const isUser = msg.role === 'user';
    const isTool = msg.role === 'tool';
    const time = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      : '';

    if (isTool) {
      return html`
        <div class="chat-line tool">
          <div class="chat-bubble chat-bubble--tool">
            <div class="chat-tool-call">
              <span class="chat-tool-call__icon">${icons.tool}</span>
              <span class="chat-tool-call__name">${msg.toolName || 'Tool'}</span>
            </div>
            <div class="chat-bubble__content">${msg.content}</div>
            ${time ? html`<div class="chat-bubble__time">${time}</div>` : nothing}
          </div>
        </div>
      `;
    }

    return html`
      <div class="chat-line ${isUser ? 'user' : 'assistant'}">
        <div class="chat-bubble">
          <div class="chat-bubble__content">${this.renderMarkdown(msg.content)}</div>
          ${time ? html`<div class="chat-bubble__time">${time}</div>` : nothing}
        </div>
      </div>
    `;
  }

  private renderStreaming() {
    return html`
      <div class="chat-line assistant streaming">
        <div class="chat-bubble">
          <div class="chat-bubble__content">${this.renderMarkdown(this.chatStream || '')}<span class="cursor">▊</span></div>
        </div>
      </div>
    `;
  }

  private renderMarkdown(text: string): TemplateResult {
    try {
      const htmlContent = marked.parse(text) as string;
      return html`<div class="markdown-content" .innerHTML=${htmlContent}></div>`;
    } catch {
      return html`<pre class="plain-text">${text}</pre>`;
    }
  }

  private renderInput() {
    const canSend = this.connected && !this.chatSending;
    const placeholder = this.connected
      ? `消息 ${this.assistantName} (Enter 发送)`
      : '连接后可开始聊天...';

    return html`
      <div class="chat-input">
        <textarea
          class="chat-input__textarea"
          placeholder=${placeholder}
          ?disabled=${!canSend}
          .value=${this.chatMessage}
          @input=${(e: InputEvent) => this.handleInputChange((e.target as HTMLTextAreaElement).value)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              this.handleSend();
            }
          }}
          rows="1"
        ></textarea>
        <div class="chat-input__actions">
          ${this.chatSending
            ? html`
                <button class="btn btn--danger" @click=${this.handleAbort} title="停止">
                  ${icons.stop}
                </button>
              `
            : html`
                <button
                  class="btn btn--primary"
                  ?disabled=${!canSend || !this.chatMessage.trim()}
                  @click=${this.handleSend}
                  title="发送"
                >
                  ${icons.send}
                </button>
              `}
        </div>
      </div>
    `;
  }

  private renderSessionsList() {
    const sessions = this.sessionsResult?.sessions?.slice(0, 20) || [];

    return html`
      <div class="sessions-list">
        <div class="sessions-list__header">
          <span>会话列表</span>
          <button class="btn btn--ghost btn--sm" @click=${this.handleNewSession}>
            ${icons.plus} 新建
          </button>
        </div>
        <div class="sessions-list__items">
          ${sessions.length === 0
            ? html`<div class="sessions-list__empty">暂无会话</div>`
            : sessions.map((session) => html`
                <div
                  class="sessions-list__item ${session.key === this.sessionKey ? 'active' : ''}"
                  @click=${() => this.handleSessionSelect(session.key)}
                >
                  <div class="sessions-list__name">${session.displayName || session.key}</div>
                  <div class="sessions-list__meta">
                    ${session.lastChannel || 'webchat'}
                    ${session.status ? html` · ${session.status}` : nothing}
                  </div>
                </div>
              `)
          }
        </div>
      </div>
    `;
  }

  private renderCommandPalette() {
    if (!this.commandPaletteOpen) return nothing;

    const items = this.getCommandPaletteItems();

    return html`
      <div class="command-palette-overlay" @click=${() => this.commandPaletteOpen = false}>
        <div class="command-palette" @click=${(e: Event) => e.stopPropagation()}>
          <div class="command-palette__input-wrapper">
            ${icons.search}
            <input
              type="text"
              class="command-palette__input"
              placeholder="Type a command..."
              .value=${this.commandPaletteQuery}
              @input=${(e: InputEvent) => {
                this.commandPaletteQuery = (e.target as HTMLInputElement).value;
                this.commandPaletteIndex = 0;
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                  this.commandPaletteOpen = false;
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  this.commandPaletteIndex = Math.min(this.commandPaletteIndex + 1, items.length - 1);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  this.commandPaletteIndex = Math.max(this.commandPaletteIndex - 1, 0);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (items[this.commandPaletteIndex]) {
                    this.handleCommandPaletteSelect(items[this.commandPaletteIndex]);
                  }
                }
              }}
              autofocus
            />
          </div>
          <div class="command-palette__results">
            ${items.map((item, index) => html`
              <div
                class="command-palette__item ${index === this.commandPaletteIndex ? 'active' : ''}"
                @click=${() => this.handleCommandPaletteSelect(item)}
                @mouseenter=${() => this.commandPaletteIndex = index}
              >
                <span class="command-palette__item-icon">${icons[item.icon || 'command'] || icons.command}</span>
                <div class="command-palette__item-content">
                  <span class="command-palette__item-name">/${item.name}</span>
                  <span class="command-palette__item-desc">${item.description}</span>
                </div>
              </div>
            `)}
          </div>
          <div class="command-palette__footer">
            <kbd>↑↓</kbd> navigate <kbd>Enter</kbd> select <kbd>Esc</kbd> close
          </div>
        </div>
      </div>
    `;
  }

  private renderSidebar() {
    if (!this.sidebarOpen) return nothing;

    return html`
      <div class="sidebar-panel">
        <div class="sidebar-panel__header">
          <span>Tool Output</span>
          <button class="btn btn--ghost btn--icon" @click=${this.handleCloseSidebar}>
            ${icons.x}
          </button>
        </div>
        <div class="sidebar-panel__content">
          ${this.sidebarError
            ? html`<div class="error-message">${this.sidebarError}</div>`
            : this.sidebarContent
              ? html`<pre class="tool-output">${this.sidebarContent}</pre>`
              : html`<div class="loading">Loading...</div>`
          }
        </div>
      </div>
    `;
  }

  private renderChatView() {
    const hasMessages = this.chatMessages.length > 0 || this.chatStream;

    return html`
      <section class="card chat">
        ${this.focusMode
          ? html`
              <button
                class="chat-focus-exit"
                type="button"
                @click=${this.toggleFocusMode}
                title="Exit focus mode"
              >
                ${icons.x}
              </button>
            `
          : nothing}
        
        <div class="chat-split-container ${this.sidebarOpen ? 'chat-split-container--open' : ''}">
          <div class="chat-main" style="flex: ${this.sidebarOpen ? `0 0 ${this.splitRatio * 100}%` : '1 1 100%'}">
            <div class="chat-thread" role="log" aria-live="polite">
              <div class="chat-thread-inner">
                ${this.chatLoading
                  ? html`<div class="chat-loading-skeleton">
                      <div class="chat-line assistant">
                        <div class="chat-bubble">
                          <div class="skeleton skeleton-line skeleton-line--long"></div>
                          <div class="skeleton skeleton-line skeleton-line--medium"></div>
                        </div>
                      </div>
                    </div>`
                  : hasMessages ? this.renderMessages() : this.renderWelcome()
                }
              </div>
            </div>
          </div>
          ${this.renderSidebar()}
        </div>
        
        ${this.chatQueue.length > 0
          ? html`
              <div class="chat-queue">
                <div class="chat-queue__title">Queued (${this.chatQueue.length})</div>
                ${this.chatQueue.map(item => html`
                  <div class="chat-queue__item">
                    <div class="chat-queue__text">${item.text}</div>
                    <button class="btn btn--ghost btn--icon" @click=${() => this.removeQueueItem(item.id)}>
                      ${icons.x}
                    </button>
                  </div>
                `)}
              </div>
            `
          : nothing
        }
        
        ${this.renderInput()}
      </section>
    `;
  }

  private renderSessionsView() {
    return html`
      <div class="page">
        <div class="page-header">
          <h1>会话管理</h1>
        </div>
        ${this.renderSessionsList()}
      </div>
    `;
  }

  private renderSettingsView() {
    return html`
      <div class="page">
        <div class="page-header">
          <h1>设置</h1>
        </div>
        <div class="settings-form">
          <div class="form-group">
            <label>主题</label>
            <select 
              .value=${this.theme} 
              @change=${(e: Event) => {
                this.theme = (e.target as HTMLSelectElement).value as ThemeName;
                this.saveSettings({ ...this.settings, theme: this.theme });
              }}
            >
              <option value="claw">Claw</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div class="form-group">
            <label>显示 Thinking</label>
            <button 
              class="btn btn--toggle ${this.showThinking ? 'active' : ''}"
              @click=${() => {
                this.showThinking = !this.showThinking;
                this.saveSettings({ ...this.settings, chatShowThinking: this.showThinking });
              }}
            >
              ${this.showThinking ? icons.check : ''}
            </button>
          </div>
          <div class="form-group">
            <label>显示工具调用</label>
            <button 
              class="btn btn--toggle ${this.showToolCalls ? 'active' : ''}"
              @click=${() => {
                this.showToolCalls = !this.showToolCalls;
                this.saveSettings({ ...this.settings, chatShowToolCalls: this.showToolCalls });
              }}
            >
              ${this.showToolCalls ? icons.check : ''}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderOverviewView() {
    const sessionsCount = this.sessionsResult?.count ?? 0;
    const version = this.hello?.server?.version;

    return html`
      <div class="page">
        <div class="page-header">
          <h1>概览</h1>
        </div>
        <div class="overview-cards">
          <div class="card overview-card">
            <div class="overview-card__icon">${icons.messageSquare}</div>
            <div class="overview-card__content">
              <div class="overview-card__value">${sessionsCount}</div>
              <div class="overview-card__label">会话数</div>
            </div>
          </div>
          <div class="card overview-card">
            <div class="overview-card__icon">${icons.users}</div>
            <div class="overview-card__content">
              <div class="overview-card__value">${this.presenceEntries.length}</div>
              <div class="overview-card__label">在线用户</div>
            </div>
          </div>
          ${version
            ? html`
                <div class="card overview-card">
                  <div class="overview-card__icon">${icons.info}</div>
                  <div class="overview-card__content">
                    <div class="overview-card__value">v${version}</div>
                    <div class="overview-card__label">版本</div>
                  </div>
                </div>
              `
            : nothing
          }
        </div>
      </div>
    `;
  }

  private renderTopbar() {
    return html`
      <header class="topbar">
        <div class="topnav-shell">
          <button
            class="topbar-nav-toggle"
            @click=${() => this.navCollapsed = !this.navCollapsed}
            title="${this.navCollapsed ? '展开' : '收起'}"
          >
            <span class="nav-collapse-toggle__icon">${this.navCollapsed ? icons.panelLeftOpen : icons.panelLeftClose}</span>
          </button>
          <div class="topnav-shell__content">
            <div class="topbar-brand">
              <img class="topbar-brand__logo" src="/logo.svg" alt="JDClaw" />
              <span class="topbar-brand__title">JDClaw</span>
            </div>
          </div>
          <div class="topnav-shell__actions">
            <button
              class="topbar-search"
              @click=${() => this.commandPaletteOpen = !this.commandPaletteOpen}
              title="Search (⌘K)"
            >
              <span class="topbar-search__label">Search</span>
              <kbd class="topbar-search__kbd">⌘K</kbd>
            </button>
            <button
              class="btn btn--ghost btn--icon"
              @click=${this.toggleFocusMode}
              title="专注模式"
            >
              ${this.focusMode ? icons.minimize : icons.maximize}
            </button>
            <div class="topbar-status">
              <span class="status-dot ${this.connected ? 'connected' : 'disconnected'}"></span>
            </div>
          </div>
        </div>
      </header>
    `;
  }

  private renderSidebar2() {
    const tabs: { id: Tab; icon: string; label: string }[] = [
      { id: 'chat', icon: 'messageSquare', label: '聊天' },
      { id: 'overview', icon: 'grid', label: '概览' },
      { id: 'sessions', icon: 'list', label: '会话' },
      { id: 'settings', icon: 'settings', label: '设置' },
    ];

    return html`
      <aside class="sidebar ${this.navCollapsed ? 'sidebar--collapsed' : ''}">
        <div class="sidebar-shell">
          <div class="sidebar-shell__header">
            <div class="sidebar-brand">
              ${!this.navCollapsed
                ? html`
                    <img class="sidebar-brand__logo" src="/logo.svg" alt="JDClaw" />
                    <span class="sidebar-brand__copy">
                      <span class="sidebar-brand__title">JDClaw</span>
                    </span>
                  `
                : nothing
              }
            </div>
          </div>
          <nav class="sidebar-nav">
            ${tabs.map(tab => html`
              <button
                class="nav-item ${this.tab === tab.id ? 'nav-item--active' : ''}"
                @click=${() => this.handleTabChange(tab.id)}
                title=${tab.label}
              >
                <span class="nav-item__icon">${icons[tab.icon]}</span>
                ${!this.navCollapsed ? html`<span class="nav-item__text">${tab.label}</span>` : nothing}
              </button>
            `)}
          </nav>
          <div class="sidebar-shell__footer">
            ${!this.navCollapsed
              ? html`
                  <div class="sidebar-utility-group">
                    <div class="sidebar-version">
                      <span class="sidebar-version__label">状态</span>
                      <span class="sidebar-version__text">
                        ${this.connected ? html`<span class="connected">已连接</span>` : html`<span class="disconnected">未连接</span>`}
                      </span>
                    </div>
                  </div>
                `
              : nothing
            }
          </div>
        </div>
      </aside>
    `;
  }

  private renderContent() {
    switch (this.tab) {
      case 'chat':
        return this.renderChatView();
      case 'sessions':
        return this.renderSessionsView();
      case 'settings':
        return this.renderSettingsView();
      case 'overview':
        return this.renderOverviewView();
      default:
        return this.renderChatView();
    }
  }

  render() {
    if (this.connecting || (!this.connected && !this.lastError)) {
      return this.renderLoading();
    }

    if (this.lastError && !this.connected) {
      return this.renderError();
    }

    const isChat = this.tab === 'chat';
    const chatFocus = isChat && this.focusMode;

    return html`
      ${this.renderCommandPalette()}
      <div class="shell ${isChat ? 'shell--chat' : ''} ${chatFocus ? 'shell--chat-focus' : ''} ${this.navCollapsed ? 'shell--nav-collapsed' : ''}">
        ${!chatFocus ? this.renderTopbar() : nothing}
        ${!chatFocus ? this.renderSidebar2() : nothing}
        <main class="content ${isChat ? 'content--chat' : ''}">
          ${!chatFocus && isChat
            ? html`
                <section class="content-header">
                  <div>
                    <div class="page-title">
                      ${this.sessionsResult?.sessions?.find(s => s.key === this.sessionKey)?.displayName || this.assistantName}
                    </div>
                  </div>
                </section>
              `
            : nothing
          }
          ${this.renderContent()}
        </main>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-app': JdApp;
  }
}
