import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { icons } from '../icons.js';
import type { Attachment, Message, SessionsListResult } from '../types/index.js';
import {
  buildDeviceAuthPayload,
  loadOrCreateDeviceIdentity,
  signDevicePayload,
} from '../utils/crypto.js';

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

interface PendingRequestMeta {
  method: string;
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
const GATEWAY_TOKEN_STORAGE_KEY = 'jdclaw.gateway.token';
const RECONNECT_MAX = 5;
const SESSIONS_POLL_INTERVAL = 5000;
const DEFAULT_SESSION_KEY = 'main';
const CONTROL_UI_CLIENT = {
  id: 'openclaw-control-ui',
  displayName: 'JDClaw WebUI',
  version: '1.0.0',
  mode: 'ui',
} as const;
const OPERATOR_SCOPES = ['operator.read', 'operator.write'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeRole(value: unknown): Message['role'] {
  return value === 'user' || value === 'assistant' || value === 'system'
    ? value
    : 'assistant';
}

function normalizeTimestamp(value: unknown, fallback = Date.now()): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => extractTextContent(part))
      .filter((part) => part.trim().length > 0)
      .join('\n')
      .trim();
  }

  if (isRecord(content)) {
    if (typeof content.text === 'string') {
      return content.text;
    }
    if ('content' in content) {
      return extractTextContent(content.content);
    }
    if ('message' in content) {
      return extractTextContent(content.message);
    }
  }

  return '';
}

function normalizeMessage(
  raw: unknown,
  fallback: Partial<Pick<Message, 'id' | 'role' | 'timestamp' | 'optimistic'>> = {},
): Message | null {
  if (!isRecord(raw)) {
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return {
        id: fallback.id ?? crypto.randomUUID(),
        role: fallback.role ?? 'assistant',
        content: raw,
        timestamp: fallback.timestamp ?? Date.now(),
        optimistic: fallback.optimistic,
      };
    }
    return null;
  }

  const content = extractTextContent(raw.content ?? raw.text ?? raw.message);
  if (!content) {
    return null;
  }

  return {
    id: typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : fallback.id ?? crypto.randomUUID(),
    role: normalizeRole(raw.role ?? fallback.role),
    content,
    timestamp: normalizeTimestamp(raw.timestamp, fallback.timestamp),
    stopReason: typeof raw.stopReason === 'string' ? raw.stopReason : undefined,
    optimistic: fallback.optimistic,
  };
}

function buildMessageKey(message: Message): string {
  return `${message.role}:${message.timestamp}:${message.content}`;
}

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) {
    return existing;
  }

  const next = existing.filter(
    (existingMessage) =>
      !existingMessage.optimistic ||
      !incoming.some(
        (incomingMessage) =>
          incomingMessage.role === existingMessage.role &&
          incomingMessage.content === existingMessage.content,
      ),
  );

  const seen = new Set(next.map(buildMessageKey));
  for (const message of incoming) {
    const key = buildMessageKey(message);
    if (seen.has(key)) {
      continue;
    }
    next.push(message);
    seen.add(key);
  }

  return next.sort((left, right) => left.timestamp - right.timestamp);
}

function persistGatewayToken(token: string) {
  localStorage.setItem(GATEWAY_TOKEN_STORAGE_KEY, token);
}

function stripGatewayTokenFromUrl() {
  const url = new URL(window.location.href);
  let changed = false;

  for (const key of ['token', 'gatewayToken']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  for (const key of ['token', 'gatewayToken']) {
    if (hashParams.has(key)) {
      hashParams.delete(key);
      changed = true;
    }
  }

  if (!changed) {
    return;
  }

  const nextHash = hashParams.toString();
  url.hash = nextHash ? `#${nextHash}` : '';
  history.replaceState(null, '', url.toString());
}

function resolveGatewayToken(): string | null {
  const searchParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);

  const fromUrl =
    searchParams.get('token') ||
    searchParams.get('gatewayToken') ||
    hashParams.get('token') ||
    hashParams.get('gatewayToken');

  if (fromUrl && fromUrl.trim().length > 0) {
    const token = fromUrl.trim();
    persistGatewayToken(token);
    stripGatewayTokenFromUrl();
    return token;
  }

  const stored = localStorage.getItem(GATEWAY_TOKEN_STORAGE_KEY);
  return stored && stored.trim().length > 0 ? stored.trim() : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

@customElement('jd-app')
export class JdApp extends LitElement {
  // ── State ──────────────────────────────────────────────────────────────────

  @state() private appState: AppState = {
    connected: false,
    connecting: false,
    error: null,
    sessionKey: DEFAULT_SESSION_KEY,
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
  private pendingRequests = new Map<string, PendingRequestMeta>();
  private deviceIdentityPromise: ReturnType<typeof loadOrCreateDeviceIdentity> | null = null;
  private gatewayToken: string | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  createRenderRoot() {
    return this; // No Shadow DOM - OpenClaw style
  }

  connectedCallback() {
    super.connectedCallback();
    this.gatewayToken = resolveGatewayToken();
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
        this.pendingRequests.clear();
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
    this.pendingRequests.clear();
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

  private getDeviceIdentity() {
    if (!this.deviceIdentityPromise) {
      this.deviceIdentityPromise = loadOrCreateDeviceIdentity();
    }
    return this.deviceIdentityPromise;
  }

  private async buildConnectDevice(challengeNonce?: string) {
    if (!challengeNonce) {
      return undefined;
    }

    try {
      const identity = await this.getDeviceIdentity();
      if (!identity) {
        return undefined;
      }

      const signedAt = Date.now();
      const payload = buildDeviceAuthPayload({
        deviceId: identity.deviceId,
        clientId: CONTROL_UI_CLIENT.id,
        clientMode: CONTROL_UI_CLIENT.mode,
        role: 'operator',
        scopes: [...OPERATOR_SCOPES],
        signedAtMs: signedAt,
        token: this.gatewayToken,
        nonce: challengeNonce,
      });
      const signature = await signDevicePayload(identity.privateKey, payload);

      return {
        id: identity.deviceId,
        publicKey: identity.publicKey,
        signature,
        signedAt,
        nonce: challengeNonce,
      };
    } catch (error) {
      console.error('[JdApp] Failed to build device auth:', error);
      return undefined;
    }
  }

  private sendRequest(method: string, params: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const id = crypto.randomUUID();
    this.pendingRequests.set(id, { method });

    const request = {
      type: 'req',
      id,
      method,
      params,
    };

    this.ws.send(JSON.stringify(request));
    return id;
  }

  private async sendConnectRequest(challengeNonce?: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const device = await this.buildConnectDevice(challengeNonce);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: CONTROL_UI_CLIENT.id,
        displayName: CONTROL_UI_CLIENT.displayName,
        version: CONTROL_UI_CLIENT.version,
        platform: navigator.platform || 'web',
        mode: CONTROL_UI_CLIENT.mode,
      },
      role: 'operator',
      scopes: [...OPERATOR_SCOPES],
      locale: navigator.language || 'zh-CN',
      userAgent: navigator.userAgent,
    };

    if (this.gatewayToken) {
      params.auth = { token: this.gatewayToken };
    }

    if (device) {
      params.device = device;
    }

    console.log('[JdApp] Sending connect request...');
    this.sendRequest('connect', params);
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

    console.log('[JdApp] Sending sessions.list request');
    this.sendRequest('sessions.list', {
      activeMinutes: 120,
      limit: 50,
      includeGlobal: true,
      includeUnknown: true,
    });
  }

  private requestChatHistory() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.sendRequest('chat.history', {
      sessionKey: this.appState.sessionKey,
      limit: 50,
      maxChars: 20000,
    });
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

    const msgType = typeof msg.type === 'string' ? msg.type : undefined;

    if (msgType === 'event') {
      const eventName = typeof msg.event === 'string' ? msg.event : '';
      const payload = isRecord(msg.payload) ? msg.payload : {};
      console.log('[JdApp] Event received:', eventName, payload);

      switch (eventName) {
        case 'connect.challenge': {
          const nonce = typeof payload.nonce === 'string' ? payload.nonce : undefined;
          void this.sendConnectRequest(nonce);
          return;
        }
        case 'chat':
          this.handleChatEvent(payload);
          return;
        case 'chat.stream':
        case 'stream':
          this.handleChatEvent({ ...payload, state: 'delta' });
          return;
        case 'chat.done':
        case 'done':
        case 'final':
          this.handleChatEvent({ ...payload, state: 'final' });
          return;
        case 'chat.abort':
        case 'abort':
          this.handleChatEvent({ ...payload, state: 'aborted' });
          return;
        case 'chat.error':
          this.handleChatEvent({ ...payload, state: 'error' });
          return;
        case 'sessions.changed':
        case 'sessions.updated':
        case 'session.updated':
          this.requestSessions();
          return;
        case 'health':
        case 'tick':
          return;
        default:
          console.log('[JdApp] Unhandled event type:', eventName, payload);
          return;
      }
    }

    if (msgType === 'res') {
      const id = typeof msg.id === 'string' ? msg.id : '';
      const ok = msg.ok === true;
      const payload = isRecord(msg.payload) ? msg.payload : undefined;
      const error = isRecord(msg.error) ? msg.error : undefined;
      this.handleResponse(id, ok, payload, error);
      return;
    }

    if (msg.nonce || msg.ts) {
      return;
    }

    console.log('[JdApp] Unknown message:', msg);
  }

  private pushSystemMessage(content: string) {
    const message: Message = {
      id: `system:${crypto.randomUUID()}`,
      role: 'system',
      content,
      timestamp: Date.now(),
    };

    this.appState = {
      ...this.appState,
      messages: mergeMessages(this.appState.messages, [message]),
    };
  }

  private handleRequestError(method: string, error?: Record<string, unknown>) {
    const message =
      typeof error?.message === 'string' && error.message.trim().length > 0
        ? error.message
        : '请求失败';

    if (method === 'connect') {
      this.appState = {
        ...this.appState,
        connecting: false,
        connected: false,
        error: message,
      };
      return;
    }

    if (method === 'chat.send') {
      this.appState = {
        ...this.appState,
        sending: false,
        runId: null,
        stream: null,
        streamStartedAt: null,
      };
    }

    if (method === 'chat.abort') {
      this.appState = {
        ...this.appState,
        sending: false,
        runId: null,
      };
    }

    this.pushSystemMessage(`${method || '请求'}失败：${message}`);
  }

  private handleResponse(
    id: string,
    ok: boolean,
    payload?: Record<string, unknown>,
    error?: Record<string, unknown>,
  ) {
    const method = this.pendingRequests.get(id)?.method || '';
    if (id) {
      this.pendingRequests.delete(id);
    }

    console.log('[JdApp] Response for', method, ':', payload, error);

    if (!ok) {
      this.handleRequestError(method, error);
      return;
    }

    if (method === 'connect') {
      this.appState = {
        ...this.appState,
        connecting: false,
        connected: true,
        error: null,
      };
      this.reconnectAttempts = 0;
      setTimeout(() => {
        this.requestSessions();
        this.requestChatHistory();
      }, 100);
      return;
    }

    if (!payload) {
      return;
    }

    switch (method) {
      case 'sessions.list': {
        const sessions = Array.isArray(payload.sessions)
          ? (payload.sessions as GatewaySessionRow[])
          : [];
        this.appState = { ...this.appState, sessions };
        this.sessionsResult = payload as unknown as SessionsListResult;

        const hasCurrentSession = sessions.some((session) => session.key === this.appState.sessionKey);
        if (!hasCurrentSession && sessions.length > 0 && !this.appState.sending) {
          const preferredSession =
            sessions.find((session) => session.key === DEFAULT_SESSION_KEY) ?? sessions[0];
          this.handleSessionSelect(preferredSession.key);
        }
        return;
      }

      case 'chat.history': {
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        const normalized = messages
          .map((message) => normalizeMessage(message))
          .filter((message): message is Message => message !== null)
          .sort((left, right) => left.timestamp - right.timestamp);

        this.appState = {
          ...this.appState,
          messages: mergeMessages([], normalized),
        };
        return;
      }

      case 'chat.send': {
        const runId =
          typeof payload.runId === 'string' && payload.runId.trim().length > 0
            ? payload.runId
            : this.appState.runId;
        const status = typeof payload.status === 'string' ? payload.status : undefined;

        this.appState = {
          ...this.appState,
          runId,
          sending: status === 'started' || status === 'accepted' || status === 'in_flight',
        };
        return;
      }

      case 'chat.abort': {
        this.appState = {
          ...this.appState,
          sending: false,
          runId: null,
        };
        return;
      }

      case 'sessions.create': {
        const key = typeof payload.key === 'string' ? payload.key : undefined;
        if (!key) {
          return;
        }

        this.appState = {
          ...this.appState,
          sessionKey: key,
          messages: [],
          stream: null,
          streamStartedAt: null,
          sending: false,
          runId: null,
          chatMessage: '',
        };
        this.resetChatInputHeight();
        this.requestSessions();
        this.requestChatHistory();
        return;
      }

      default:
        return;
    }
  }

  private handleChatEvent(payload: Record<string, unknown>) {
    const state = typeof payload.state === 'string' ? payload.state : undefined;
    const runId =
      typeof payload.runId === 'string' && payload.runId.trim().length > 0
        ? payload.runId
        : this.appState.runId;
    const eventMessage = normalizeMessage(payload.message, {
      id: runId ? `chat:${runId}:${state ?? 'message'}` : undefined,
      role: 'assistant',
      timestamp: Date.now(),
    });

    switch (state) {
      case 'delta': {
        const streamText =
          eventMessage?.content ||
          extractTextContent(payload.delta ?? payload.text ?? payload.content);
        if (!streamText) {
          return;
        }

        this.appState = {
          ...this.appState,
          sending: true,
          runId,
          stream: streamText,
          streamStartedAt: this.appState.streamStartedAt ?? Date.now(),
        };
        return;
      }

      case 'final': {
        const finalMessage =
          eventMessage ||
          (this.appState.stream
            ? {
                id: `chat:${runId ?? crypto.randomUUID()}:final`,
                role: 'assistant' as const,
                content: this.appState.stream,
                timestamp: Date.now(),
                stopReason:
                  typeof payload.stopReason === 'string' ? payload.stopReason : undefined,
              }
            : null);

        this.appState = {
          ...this.appState,
          messages: finalMessage
            ? mergeMessages(this.appState.messages, [finalMessage])
            : this.appState.messages,
          sending: false,
          runId: null,
          stream: null,
          streamStartedAt: null,
        };
        return;
      }

      case 'aborted': {
        const partialMessage = this.appState.stream
          ? {
              id: `chat:${runId ?? crypto.randomUUID()}:aborted`,
              role: 'assistant' as const,
              content: this.appState.stream,
              timestamp: Date.now(),
              stopReason: 'abort',
            }
          : null;

        this.appState = {
          ...this.appState,
          messages: partialMessage
            ? mergeMessages(this.appState.messages, [partialMessage])
            : this.appState.messages,
          sending: false,
          runId: null,
          stream: null,
          streamStartedAt: null,
        };
        return;
      }

      case 'error': {
        this.appState = {
          ...this.appState,
          sending: false,
          runId: null,
          stream: null,
          streamStartedAt: null,
        };
        this.pushSystemMessage(
          `助手响应失败：${
            typeof payload.errorMessage === 'string' ? payload.errorMessage : '未知错误'
          }`,
        );
        return;
      }

      default: {
        if (!eventMessage) {
          return;
        }

        this.appState = {
          ...this.appState,
          messages: mergeMessages(this.appState.messages, [eventMessage]),
          sending: false,
          runId: null,
          stream: null,
          streamStartedAt: null,
        };
      }
    }
  }

  // ── Chat Actions ────────────────────────────────────────────────────────────

  private handleSend() {
    const message = this.appState.chatMessage.trim();
    if (!message || !this.appState.connected) return;

    const runId = crypto.randomUUID();
    const optimisticUserMessage: Message = {
      id: `local:${runId}:user`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
      optimistic: true,
    };

    this.appState = {
      ...this.appState,
      messages: mergeMessages(this.appState.messages, [optimisticUserMessage]),
      chatMessage: '',
      sending: true,
      runId,
      stream: null,
      streamStartedAt: Date.now(),
    };
    this.resetChatInputHeight();

    const requestId = this.sendRequest('chat.send', {
      sessionKey: this.appState.sessionKey,
      message,
      deliver: true,
      idempotencyKey: runId,
    });
    if (!requestId) {
      this.appState = {
        ...this.appState,
        sending: false,
        runId: null,
      };
      this.pushSystemMessage('Gateway 未连接，消息未发送。');
    }
  }

  private handleAbort() {
    if (!this.appState.connected) return;

    const requestId = this.sendRequest('chat.abort', {
      sessionKey: this.appState.sessionKey,
      ...(this.appState.runId ? { runId: this.appState.runId } : {}),
    });
    if (!requestId) {
      this.pushSystemMessage('Gateway 未连接，无法停止当前回复。');
      return;
    }
    this.appState = { ...this.appState, sending: false, runId: null };
  }

  private handleSessionSelect(key: string) {
    this.appState = {
      ...this.appState,
      sessionKey: key,
      messages: [],
      stream: null,
      streamStartedAt: null,
      sending: false,
      runId: null,
    };
    this.resetChatInputHeight();
    if (this.appState.connected) {
      this.requestChatHistory();
    }
  }

  private handleNewSession() {
    if (!this.appState.connected) {
      this.appState = {
        ...this.appState,
        sessionKey: DEFAULT_SESSION_KEY,
        messages: [],
        stream: null,
        streamStartedAt: null,
        sending: false,
        runId: null,
        chatMessage: '',
      };
      this.resetChatInputHeight();
      return;
    }

    const requestId = this.sendRequest('sessions.create', {});
    if (!requestId) {
      this.pushSystemMessage('Gateway 未连接，无法创建新会话。');
    }
  }

  private resizeChatInput(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }

  private resetChatInputHeight() {
    requestAnimationFrame(() => {
      const textarea = this.querySelector('.chat-input__textarea') as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.style.height = 'auto';
      }
    });
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
    const activeSessionLabel =
      this.appState.sessions.find((session) => session.key === this.appState.sessionKey)?.displayName ||
      this.appState.sessionKey;
    const placeholder = this.appState.connected
      ? `消息 ${activeSessionLabel} (Enter 发送)`
      : '连接后可开始聊天...';

    return html`
      <div class="chat-input">
        <textarea
          class="chat-input__textarea"
          placeholder=${placeholder}
          ?disabled=${!canSend}
          .value=${this.appState.chatMessage}
          @input=${(e: InputEvent) => {
            const textarea = e.target as HTMLTextAreaElement;
            this.handleInputChange(textarea.value);
            this.resizeChatInput(textarea);
          }}
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
