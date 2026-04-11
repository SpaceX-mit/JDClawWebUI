import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { icons } from '../icons.js';
import type { Attachment, Message, GatewayHello, SessionsListResult } from '../types/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GatewaySessionRow {
  key: string;
  displayName?: string;
  lastChannel?: string;
  status?: string;
  totalTokens?: number;
  updatedAt?: number;
}

interface ChatQueueItem {
  id: string;
  text: string;
  createdAt: number;
  attachments?: Attachment[];
}

interface AppState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  sessionKey: string;
  sessions: GatewaySessionRow[];
  messages: Message[];
  stream: string | null;
  streamStartedAt: number | null;
  sending: boolean;
  runId: string | null;
  chatMessage: string;
  chatAttachments: Attachment[];
  queue: ChatQueueItem[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GATEWAY_URL = 'ws://localhost:18789';
const RECONNECT_MAX = 5;
const SESSIONS_POLL_INTERVAL = 5000;

// ─── Component ────────────────────────────────────────────────────────────────

@customElement('jd-app')
export class JdApp extends LitElement {
  // ── State ──────────────────────────────────────────────────────────────────

  @state() private appState: AppState = {
    connected: false,
    connecting: false,
    error: null,
    sessionKey: 'agent:main',
    sessions: [],
    messages: [],
    stream: null,
    streamStartedAt: null,
    sending: false,
    runId: null,
    chatMessage: '',
    chatAttachments: [],
    queue: [],
  };

  @state() private navOpen = true;
  @state() private focusMode = false;
  @state() private sessionsResult: SessionsListResult | null = null;

  // ── Private ────────────────────────────────────────────────────────────────

  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pollTimer: number | null = null;
  private gatewayToken = 'clawx-090aa26d325a9540474a773077beec10';

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  createRenderRoot() {
    return this; // No Shadow DOM - OpenClaw style
  }

  connectedCallback() {
    super.connectedCallback();
    this.connect();
    this.startSessionPoll();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnect();
    this.stopSessionPoll();
  }

  // ── Gateway Connection ──────────────────────────────────────────────────────

  private connect() {
    if (this.appState.connecting) return;

    this.appState = { ...this.appState, connecting: true, error: null };
    console.log('[JdApp] Connecting to:', GATEWAY_URL);

    try {
      this.ws = new WebSocket(GATEWAY_URL);

      this.ws.onopen = () => {
        console.log('[JdApp] WebSocket opened, waiting for challenge...');
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[JdApp] WebSocket error:', error);
        this.appState = { ...this.appState, connecting: false, error: '连接错误' };
      };

      this.ws.onclose = (event) => {
        console.log('[JdApp] WebSocket closed:', event.code, event.reason);
        this.appState = { ...this.appState, connected: false, connecting: false };

        if (event.code !== 1000) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[JdApp] Connection failed:', err);
      this.appState = { ...this.appState, connecting: false, error: '无法连接' };
      this.scheduleReconnect();
    }
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= RECONNECT_MAX) {
      this.appState = { ...this.appState, error: '无法连接到 Gateway' };
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    console.log(`[JdApp] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private sendConnectRequest(challengeNonce?: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'openclaw-control-ui',
        displayName: 'JDClaw WebUI',
        version: '1.0.0',
        platform: navigator.platform || 'web',
        mode: 'ui',
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      auth: { token: this.gatewayToken },
    };

    // Device auth is optional when using token auth - we skip it
    // If gateway requires device auth, it will send a different challenge

    const request = {
      type: 'req',
      id: crypto.randomUUID(),
      method: 'connect',
      params,
    };

    console.log('[JdApp] Sending connect request...');
    this.ws.send(JSON.stringify(request));
  }

  private startSessionPoll() {
    this.pollTimer = window.setInterval(() => {
      if (this.appState.connected && this.ws?.readyState === WebSocket.OPEN) {
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

  private requestSessions() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[JdApp] requestSessions: WebSocket not ready');
      return;
    }

    const requestId = crypto.randomUUID();
    const request = {
      type: 'req',
      id: requestId,
      method: 'sessions.list',
      params: {
        activeMinutes: 120,
        limit: 50,
        includeGlobal: true,
        includeUnknown: true,
      },
    };

    console.log('[JdApp] Sending sessions.list request, id:', requestId);
    this.ws.send(JSON.stringify(request));
  }

  private requestChatHistory() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const request = {
      type: 'req',
      id: crypto.randomUUID(),
      method: 'sessions.history',
      params: {
        key: this.appState.sessionKey,
        limit: 50,
      },
    };

    this.ws.send(JSON.stringify(request));
  }

  // ── Message Handling ────────────────────────────────────────────────────────

  private handleMessage(data: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data);
    } catch {
      console.error('[JdApp] Failed to parse message:', data);
      return;
    }

    const msgType = msg.type as string | undefined;
    const method = msg.method as string | undefined;
    const id = msg.id as string | undefined;
    const event = msg.event as string | undefined;

    // Check if this is an event message
    console.log('[JdApp] Checking event handler: msgType=', msgType, 'event=', event);
    if (msgType === 'event' || event) {
      // Event type is in 'event' field at message level
      const eventName = event as string;
      const payload = msg.payload as Record<string, unknown> | undefined;
      
      console.log('[JdApp] Event received:', eventName, payload);
      
      if (eventName === 'connect.challenge') {
        // Gateway sent a challenge, respond with connect request
        // Nonce is inside the payload object
        const nonce = payload?.nonce as string | undefined;
        console.log('[JdApp] Received challenge, nonce:', nonce);
        this.sendConnectRequest(nonce);
      } else if (payload) {
        // Pass the event name so handleEvent knows the event type
        this.handleEvent(eventName, payload);
      } else {
        // Some events don't have a payload - use the event name as type
        this.handleEvent(eventName, msg);
      }
      return;
    }

    // Handle hello-ok style connect responses
    // These have type 'res', ok=true, and payload.type='hello-ok'
    const ok = msg.ok as boolean | undefined;
    const payload = msg.payload as Record<string, unknown> | undefined;
    const payloadType = payload?.type as string | undefined;
    
    console.log('[JdApp] Checking connect: msgType=', msgType, 'id=', id, 'method=', method, 'ok=', ok, 'payloadType=', payloadType);
    
    // hello-ok: type='res', ok=true, payload.type='hello-ok'
    // Note: id may or may not be present, we check payload.type
    if (msgType === 'res' && ok === true && payloadType === 'hello-ok') {
      console.log('[JdApp] Connected successfully (hello-ok)!');
      this.appState = { ...this.appState, connecting: false, connected: true, error: null };
      this.reconnectAttempts = 0;
      setTimeout(() => this.requestSessions(), 100);
      return;
    }
    
    // Handle explicit connect response
    if (msgType === 'res' && method === 'connect' && ok === true) {
      console.log('[JdApp] Connected successfully (explicit connect)!');
      this.appState = { ...this.appState, connecting: false, connected: true, error: null };
      this.reconnectAttempts = 0;
      setTimeout(() => this.requestSessions(), 100);
      return;
    }
    
    // Handle connect error
    if (msgType === 'res' && method === 'connect' && ok === false) {
      const error = msg.error as { message?: string } | undefined;
      console.error('[JdApp] Connect failed:', error);
      this.appState = { ...this.appState, connecting: false, error: error?.message || '认证失败' };
      return;
    }

    // Handle response to a request (non-connect responses)
    console.log('[JdApp] Checking res handler: msgType=', msgType);
    if (msgType === 'res') {
      const respPayload = msg.payload as Record<string, unknown> | undefined;
      const respOk = msg.ok as boolean | undefined;
      const path = msg.path as string | undefined;
      
      if (id && respPayload && respOk) {
        // Try to get method from msg.method, msg.path, or infer from payload
        const actualMethod = method || path || '';
        console.log('[JdApp] Handling response, method/path:', actualMethod);
        this.handleResponse(id, actualMethod, respPayload);
      }
      return;
    }

    // Handle pong/acknowledgment messages
    if (msg.nonce || msg.ts) {
      // This is a pong or heartbeat acknowledgment
      // No action needed, connection is alive
      return;
    }

    console.log('[JdApp] Unknown message:', msg);
  }

  private handleConnectResponse(payload: Record<string, unknown>) {
    console.log('[JdApp] Connected! Payload:', payload);
    const hello = payload;
    if (hello) {
      console.log('[JdApp] Gateway info:', hello);
    }
  }

  private handleResponse(id: string, methodOrPath: string, payload: Record<string, unknown>) {
    console.log('[JdApp] Response for', methodOrPath, ':', payload);

    // Check payload for clues about what this response is
    const path = payload.path as string | undefined;
    const hasSessions = Array.isArray(payload.sessions);
    const hasMessages = Array.isArray(payload.messages);

    // Handle sessions.list response (check both method and path)
    if (methodOrPath === 'sessions.list' || path?.includes('sessions')) {
      const sessions = payload.sessions as GatewaySessionRow[] | undefined;
      if (sessions) {
        console.log('[JdApp] Received', sessions.length, 'sessions');
        this.appState = { ...this.appState, sessions };
        this.sessionsResult = payload as unknown as SessionsListResult;
      }
      return;
    }

    // Handle sessions.history response
    if (methodOrPath === 'sessions.history' || methodOrPath === 'chat.history' || path?.includes('history')) {
      const messages = payload.messages as Message[] | undefined;
      if (messages) {
        console.log('[JdApp] Received', messages.length, 'messages');
        // Prepend messages to existing messages, avoiding duplicates
        const existingIds = new Set(this.appState.messages.map(m => m.id));
        const newMessages = messages.filter(m => !existingIds.has(m.id));
        if (newMessages.length > 0) {
          this.appState = { 
            ...this.appState, 
            messages: [...this.appState.messages, ...newMessages] 
          };
        }
      }
      return;
    }

    // Generic fallback - try to extract useful data
    if (hasSessions) {
      const sessions = payload.sessions as GatewaySessionRow[];
      console.log('[JdApp] Received', sessions.length, 'sessions (via fallback)');
      this.appState = { ...this.appState, sessions };
      this.sessionsResult = payload as unknown as SessionsListResult;
      return;
    }

    if (hasMessages) {
      const messages = payload.messages as Message[];
      console.log('[JdApp] Received', messages.length, 'messages (via fallback)');
      const existingIds = new Set(this.appState.messages.map(m => m.id));
      const newMessages = messages.filter(m => !existingIds.has(m.id));
      if (newMessages.length > 0) {
        this.appState = { 
          ...this.appState, 
          messages: [...this.appState.messages, ...newMessages] 
        };
      }
    }
  }

  private handleEvent(eventType: string, payload: Record<string, unknown>) {
    console.log('[JdApp] Handling event:', eventType, payload);

    if (!eventType) {
      // Unknown event structure, log and return
      console.log('[JdApp] Unknown event structure:', payload);
      return;
    }

    switch (eventType) {
      case 'chat.stream':
      case 'stream': {
        const text = (payload.text || payload.content || payload.delta) as string | undefined;
        if (text !== undefined) {
          this.appState = {
            ...this.appState,
            stream: (this.appState.stream || '') + text,
            streamStartedAt: this.appState.streamStartedAt ?? Date.now(),
          };
        }
        break;
      }

      case 'chat.done':
      case 'done':
      case 'final': {
        const message = payload.message as Message | undefined;
        if (message) {
          this.appState = {
            ...this.appState,
            messages: [...this.appState.messages, message],
            sending: false,
            runId: null,
            stream: null,
            streamStartedAt: null,
          };
        } else {
          // If no message, just mark as done
          this.appState = {
            ...this.appState,
            sending: false,
            runId: null,
            stream: null,
            streamStartedAt: null,
          };
        }
        this.requestChatHistory(); // Refresh history
        break;
      }

      case 'chat.abort':
      case 'abort':
      case 'chat.error':
      case 'error': {
        this.appState = {
          ...this.appState,
          sending: false,
          runId: null,
          stream: null,
          streamStartedAt: null,
        };
        break;
      }

      case 'chat.start':
      case 'start': {
        const runObj = payload.run as Record<string, unknown> | undefined;
        console.log('[JdApp] Chat started, runId:', payload.runId || runObj?.id);
        break;
      }

      case 'chat':
      case 'chat.done': {
        // Chat message received
        const message = payload.message as Message | undefined;
        const state = payload.state as string | undefined;
        console.log('[JdApp] Chat event, state:', state, 'message:', message);
        
        if (message) {
          this.appState = {
            ...this.appState,
            messages: [...this.appState.messages, message],
            sending: false,
            runId: null,
            stream: null,
            streamStartedAt: null,
          };
        } else if (state === 'started') {
          this.appState = { ...this.appState, sending: true };
        }
        break;
      }

      case 'health':
      case 'tick': {
        // Heartbeat/health events - just acknowledge
        console.log('[JdApp] Heartbeat:', eventType);
        break;
      }

      case 'sessions.updated':
      case 'session.updated': {
        // Session was updated, refresh the list
        console.log('[JdApp] Session updated, refreshing...');
        this.requestSessions();
        break;
      }

      default: {
        console.log('[JdApp] Unhandled event type:', eventType);
      }
    }
  }

  // ── Chat Actions ────────────────────────────────────────────────────────────

  private handleSend() {
    const message = this.appState.chatMessage.trim();
    if (!message || !this.appState.connected || !this.ws) return;

    this.appState = {
      ...this.appState,
      chatMessage: '',
      sending: true,
      runId: crypto.randomUUID(),
      stream: '',
      streamStartedAt: Date.now(),
    };

    const request = {
      type: 'req',
      id: crypto.randomUUID(),
      method: 'chat.send',
      params: {
        sessionKey: this.appState.sessionKey,
        message,
        deliver: true,
        idempotencyKey: this.appState.runId,
      },
    };

    this.ws.send(JSON.stringify(request));
  }

  private handleAbort() {
    if (!this.ws || !this.appState.runId) return;

    const request = {
      type: 'req',
      id: crypto.randomUUID(),
      method: 'chat.abort',
      params: { runId: this.appState.runId },
    };

    this.ws.send(JSON.stringify(request));
    this.appState = { ...this.appState, sending: false, stream: null };
  }

  private handleSessionSelect(key: string) {
    this.appState = {
      ...this.appState,
      sessionKey: key,
      messages: [],
      stream: null,
    };
    this.requestChatHistory();
  }

  private handleNewSession() {
    const key = `agent:main:${Date.now()}`;
    this.handleSessionSelect(key);
  }

  private handleInputChange(value: string) {
    this.appState = { ...this.appState, chatMessage: value };
  }

  // ── Render Helpers ──────────────────────────────────────────────────────────

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
        <div class="error-icon">⚠️</div>
        <div class="error-title">无法连接到 Gateway</div>
        <div class="error-message">${this.appState.error || '请确保 OpenClaw Gateway 正在运行'}</div>
        <button class="btn btn--primary" @click=${() => this.connect()}>重试</button>
      </div>
    `;
  }

  private renderWelcome() {
    return html`
      <div class="chat-welcome">
        <div class="chat-welcome__glow"></div>
        <div class="chat-welcome__avatar">
          <img src="/logo.svg" alt="JDClaw" />
        </div>
        <h2>JDClaw 助手</h2>
        <div class="chat-welcome__badges">
          <span class="chat-welcome__badge">✨ Ready to chat</span>
        </div>
        <p class="chat-welcome__hint">在下方输入消息开始对话 · <kbd>/</kbd> 查看命令</p>
      </div>
    `;
  }

  private renderMessages() {
    return html`
      <div class="chat-messages">
        ${this.appState.messages.map((msg) => this.renderMessage(msg))}
        ${this.appState.stream ? this.renderStreaming() : nothing}
      </div>
    `;
  }

  private renderMessage(msg: Message) {
    const isUser = msg.role === 'user';
    const time = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      : '';

    return html`
      <div class="chat-line ${isUser ? 'user' : 'assistant'}">
        <div class="chat-bubble">
          <div class="chat-bubble__content">${msg.content}</div>
          ${time ? html`<div class="chat-bubble__time">${time}</div>` : nothing}
        </div>
      </div>
    `;
  }

  private renderStreaming() {
    return html`
      <div class="chat-line assistant streaming">
        <div class="chat-bubble">
          <div class="chat-bubble__content">${this.appState.stream}<span class="cursor">▊</span></div>
        </div>
      </div>
    `;
  }

  private renderInput() {
    const canSend = this.appState.connected && !this.appState.sending;
    const placeholder = this.appState.connected
      ? `消息 ${this.appState.sessionKey.split(':')[1] || '助手'} (Enter 发送)`
      : '连接后可开始聊天...';

    return html`
      <div class="chat-input">
        <textarea
          class="chat-input__textarea"
          placeholder=${placeholder}
          ?disabled=${!canSend}
          .value=${this.appState.chatMessage}
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
          ${this.appState.sending
            ? html`
                <button class="btn btn--danger" @click=${this.handleAbort} title="停止">
                  ${icons.stop}
                </button>
              `
            : html`
                <button
                  class="btn btn--primary"
                  ?disabled=${!canSend || !this.appState.chatMessage.trim()}
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
    const sessions = this.appState.sessions.slice(0, 20);

    return html`
      <div class="sessions-list">
        <div class="sessions-list__header">
          <span>会话列表</span>
          <button class="btn btn--ghost btn--sm" @click=${this.handleNewSession}>
            ${icons.plus} 新建
          </button>
        </div>
        <div class="sessions-list__items">
          ${sessions.map(
            (session) => html`
              <div
                class="sessions-list__item ${session.key === this.appState.sessionKey
                  ? 'active'
                  : ''}"
                @click=${() => this.handleSessionSelect(session.key)}
              >
                <div class="sessions-list__name">${session.displayName || session.key}</div>
                <div class="sessions-list__meta">
                  ${session.lastChannel || 'webchat'}
                  ${session.status ? html` · ${session.status}` : nothing}
                </div>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  // ── Main Render ─────────────────────────────────────────────────────────────

  render() {
    console.log('[JdApp] Rendering, connected:', this.appState.connected, 'connecting:', this.appState.connecting);

    // Show loading when connecting or not yet connected (initial state)
    if (this.appState.connecting || (!this.appState.connected && !this.appState.error)) {
      return this.renderLoading();
    }

    if (this.appState.error) {
      return this.renderError();
    }

    const hasMessages = this.appState.messages.length > 0 || this.appState.stream;

    return html`
      <div class="jd-shell">
        <!-- Sidebar -->
        <aside class="jd-sidebar ${this.navOpen ? '' : 'collapsed'}">
          <div class="jd-sidebar__header">
            <div class="jd-brand">
              <img class="jd-brand__logo" src="/logo.svg" alt="JDClaw" />
              <span class="jd-brand__name">JDClaw</span>
            </div>
            <button class="btn btn--ghost btn--icon" @click=${() => this.navOpen = !this.navOpen}>
              ${icons.panelLeft}
            </button>
          </div>
          <div class="jd-sidebar__body">
            ${this.renderSessionsList()}
          </div>
          <div class="jd-sidebar__footer">
            <div class="jd-status ${this.appState.connected ? 'connected' : 'disconnected'}">
              <span class="jd-status__dot"></span>
              <span>${this.appState.connected ? '已连接' : '未连接'}</span>
            </div>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="jd-main">
          <!-- Topbar -->
          <header class="jd-topbar">
            <div class="jd-topbar__left">
              <button
                class="btn btn--ghost btn--icon jd-topbar__menu"
                @click=${() => this.navOpen = !this.navOpen}
              >
                ${icons.menu}
              </button>
              <span class="jd-topbar__title">
                ${this.appState.sessions.find(s => s.key === this.appState.sessionKey)?.displayName ||
                'JDClaw 助手'}
              </span>
            </div>
            <div class="jd-topbar__right">
              <button
                class="btn btn--ghost btn--icon"
                @click=${() => this.focusMode = !this.focusMode}
                title="专注模式"
              >
                ${icons.maximize}
              </button>
            </div>
          </header>

          <!-- Chat Area -->
          <div class="jd-chat">
            <div class="jd-chat__messages">
              ${hasMessages ? this.renderMessages() : this.renderWelcome()}
            </div>
            ${this.renderInput()}
          </div>
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
