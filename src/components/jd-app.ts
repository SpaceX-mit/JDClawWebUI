import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { icons } from '../icons.js';
import type {
  Agent,
  Attachment,
  ChatStreamSegment,
  ExecApprovalRequest,
  Message,
  Model,
  SessionsListResult,
  SidebarSessionItem,
  ToolStreamEntry,
} from '../types/index.js';
import {
  buildDeviceAuthPayload,
  loadOrCreateDeviceIdentity,
  signDevicePayload,
} from '../utils/crypto.js';
import { loadSettings, saveSettings } from '../utils/settings.js';
import { exportChatToMarkdown, downloadTextFile } from '../utils/index.js';
import { JdToast } from './jd-toast.js';
import { JdConfirmDialog } from './jd-confirm-dialog.js';
import { getCurrentRoute, onRouteChange, navigateTo, type Route } from '../utils/router.js';
import './jd-sidebar.js';
import './jd-chat-view.js';
import './jd-tool-card.js';
import './jd-settings-panel.js';
import './jd-sessions-view.js';
import './jd-approval-dialog.js';

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

const GATEWAY_URL = (() => {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.hostname}:18789`;
})();
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
  @state() private currentRoute: Route = 'chat';
  @state() private sessionsResult: SessionsListResult | null = null;
  @state() private toolStreamEntries: ToolStreamEntry[] = [];
  @state() private chatStreamSegments: ChatStreamSegment[] = [];
  @state() private execApprovalQueue: ExecApprovalRequest[] = [];
  @state() private models: Model[] = [];
  @state() private selectedModel = '';
  @state() private agents: Agent[] = [];
  @state() private selectedAgentId = '';

  // ── Private ────────────────────────────────────────────────────────────────

  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pollTimer: number | null = null;
  private pendingRequests = new Map<string, PendingRequestMeta>();
  private deviceIdentityPromise: ReturnType<typeof loadOrCreateDeviceIdentity> | null = null;
  private gatewayToken: string | null = null;
  private pendingDeleteKey: string | null = null;
  private unsubscribeRoute: (() => void) | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  createRenderRoot() {
    return this; // No Shadow DOM - OpenClaw style
  }

  connectedCallback() {
    super.connectedCallback();
    this.gatewayToken = resolveGatewayToken();

    // Restore settings & apply theme
    const settings = loadSettings();
    if (settings.lastSessionKey) {
      this.appState = { ...this.appState, sessionKey: settings.lastSessionKey };
    }
    this.applyTheme(settings.theme || 'dark');

    // Only auto-connect if we have a token; otherwise wait for user input
    if (this.gatewayToken) {
      this.connect();
      this.startSessionPoll();
    }

    // Initialize routing
    this.currentRoute = getCurrentRoute();
    this.unsubscribeRoute = onRouteChange((route) => {
      this.currentRoute = route;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnect();
    this.stopSessionPoll();
    this.unsubscribeRoute?.();
  }

  // ── Theme ──────────────────────────────────────────────────────────────────

  private applyTheme(theme: string) {
    let resolved = theme;
    if (theme === 'auto') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
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
      limit: 200,
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
        case 'agent':
          this.handleAgentEvent(payload);
          return;
        case 'exec.approval.requested':
          this.handleExecApprovalRequested(payload);
          return;
        case 'exec.approval.resolved':
          this.handleExecApprovalResolved(payload);
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
        this.sendRequest('sessions.subscribe', {});
        this.requestSessions();
        this.requestChatHistory();
        this.sendRequest('models.list', {});
        this.sendRequest('agents.list', {});
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
        console.log('[JdApp] sessions.list:', sessions.length, 'sessions, keys:', sessions.map(s => s.key));
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

      case 'models.list': {
        const rawModels = Array.isArray(payload.models) ? payload.models : [];
        this.models = rawModels.map((m: Record<string, unknown>) => ({
          id: typeof m.id === 'string' ? m.id : '',
          name: typeof m.name === 'string' ? m.name : (typeof m.id === 'string' ? m.id : ''),
          provider: typeof m.provider === 'string' ? m.provider : '',
          description: typeof m.description === 'string' ? m.description : undefined,
          maxTokens: typeof m.maxTokens === 'number' ? m.maxTokens : undefined,
          supportsImages: typeof m.supportsImages === 'boolean' ? m.supportsImages : undefined,
          supportsTools: typeof m.supportsTools === 'boolean' ? m.supportsTools : undefined,
        })) as Model[];
        if (!this.selectedModel && this.models.length > 0) {
          this.selectedModel = this.sessionsResult?.defaults?.model || this.models[0].id;
        }
        return;
      }

      case 'agents.list': {
        const rawAgents = Array.isArray(payload.agents) ? payload.agents : [];
        const defaultId = typeof payload.defaultId === 'string' ? payload.defaultId : '';
        this.agents = rawAgents.map((a: Record<string, unknown>) => {
          const identity = isRecord(a.identity) ? a.identity : {};
          const model = isRecord(a.model) ? a.model : {};
          return {
            id: typeof a.id === 'string' ? a.id : '',
            name: typeof a.name === 'string' ? a.name : undefined,
            identity: {
              name: typeof identity.name === 'string' ? identity.name : undefined,
              emoji: typeof identity.emoji === 'string' ? identity.emoji : undefined,
              avatar: typeof identity.avatar === 'string' ? identity.avatar : undefined,
              avatarUrl: typeof identity.avatarUrl === 'string' ? identity.avatarUrl : undefined,
            },
            workspace: typeof a.workspace === 'string' ? a.workspace : undefined,
            model: {
              primary: typeof model.primary === 'string' ? model.primary : undefined,
              fallbacks: Array.isArray(model.fallbacks) ? model.fallbacks as string[] : undefined,
            },
          } as Agent;
        });
        if (!this.selectedAgentId && this.agents.length > 0) {
          this.selectedAgentId = defaultId || this.agents[0].id;
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
          messages: normalized,
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
        saveSettings({ lastSessionKey: key });
        this.requestSessions();
        this.requestChatHistory();
        return;
      }

      case 'sessions.patch': {
        JdToast.show({ message: '会话已重命名', type: 'success', duration: 2000 });
        this.requestSessions();
        return;
      }

      case 'sessions.delete': {
        const deletedKey = this.pendingDeleteKey;
        this.pendingDeleteKey = null;
        JdToast.show({ message: '会话已删除', type: 'success', duration: 2000 });

        // If deleted the current session, switch to another
        if (deletedKey === this.appState.sessionKey || !this.appState.sessions.some(s => s.key === this.appState.sessionKey)) {
          const remaining = this.appState.sessions.filter(s => s.key !== deletedKey);
          const nextKey = remaining.length > 0
            ? (remaining.find(s => s.key === DEFAULT_SESSION_KEY)?.key ?? remaining[0].key)
            : DEFAULT_SESSION_KEY;
          this.handleSessionSelect(nextKey);
        }
        this.requestSessions();
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
        // If tool events were seen, reload history to get persisted tool results
        const hadToolEvents = this.toolStreamEntries.length > 0;
        this.toolStreamEntries = [];
        this.chatStreamSegments = [];
        if (hadToolEvents) {
          this.requestChatHistory();
        }
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

  // ── Agent Event Handling ───────────────────────────────────────────────────

  private handleAgentEvent(payload: Record<string, unknown>) {
    const stream = typeof payload.stream === 'string' ? payload.stream : '';
    const runId = typeof payload.runId === 'string' ? payload.runId : '';
    const sessionKey = typeof payload.sessionKey === 'string' ? payload.sessionKey : '';
    const data = isRecord(payload.data) ? payload.data : {};

    // Only process events for current session
    if (sessionKey && sessionKey !== this.appState.sessionKey) return;

    if (stream === 'tool') {
      this.handleToolStreamEvent(runId, sessionKey, data);
    } else if (stream === 'thinking') {
      this.handleThinkingStreamEvent(runId, data);
    } else if (stream === 'lifecycle') {
      this.handleLifecycleStreamEvent(data);
    }
  }

  private handleToolStreamEvent(runId: string, sessionKey: string, data: Record<string, unknown>) {
    const toolCallId = typeof data.toolCallId === 'string' ? data.toolCallId : '';
    const name = typeof data.name === 'string' ? data.name : '';
    const phase = typeof data.phase === 'string' ? data.phase : '';

    if (!toolCallId) return;

    if (phase === 'start') {
      // Commit any in-progress streaming text as a segment
      if (this.appState.stream) {
        this.chatStreamSegments = [...this.chatStreamSegments, {
          type: 'text',
          id: crypto.randomUUID(),
          content: this.appState.stream,
          timestamp: Date.now(),
        }];
        this.appState = { ...this.appState, stream: null, streamStartedAt: null };
      }

      const args = isRecord(data.args) ? data.args as Record<string, unknown> : null;
      const entry: ToolStreamEntry = {
        toolCallId,
        runId,
        sessionKey,
        name,
        args,
        output: '',
        startedAt: Date.now(),
        completedAt: null,
        status: 'running',
      };
      this.toolStreamEntries = [...this.toolStreamEntries, entry];

      this.chatStreamSegments = [...this.chatStreamSegments, {
        type: 'tool_call',
        id: toolCallId,
        content: '',
        toolCallId,
        toolName: name,
        toolArgs: args,
        timestamp: Date.now(),
        status: 'running',
      }];
    } else if (phase === 'update') {
      const partialResult = data.partialResult ?? data.output;
      const output = typeof partialResult === 'string' ? partialResult : '';
      this.toolStreamEntries = this.toolStreamEntries.map(e =>
        e.toolCallId === toolCallId ? { ...e, output: e.output + output } : e
      );
    } else if (phase === 'result') {
      const result = data.result ?? data.output;
      const output = typeof result === 'string'
        ? result
        : (isRecord(result) && typeof (result as Record<string, unknown>).text === 'string')
          ? (result as Record<string, unknown>).text as string
          : result ? JSON.stringify(result) : '';
      this.toolStreamEntries = this.toolStreamEntries.map(e =>
        e.toolCallId === toolCallId ? {
          ...e,
          output: output || e.output,
          completedAt: Date.now(),
          status: 'completed' as const,
        } : e
      );
      this.chatStreamSegments = this.chatStreamSegments.map(s =>
        s.toolCallId === toolCallId ? { ...s, status: 'completed' as const, content: output || '' } : s
      );
    }
  }

  private handleThinkingStreamEvent(runId: string, data: Record<string, unknown>) {
    const phase = typeof data.phase === 'string' ? data.phase : '';
    const text = typeof data.text === 'string' ? data.text : '';

    if (phase === 'start') {
      this.chatStreamSegments = [...this.chatStreamSegments, {
        type: 'thinking',
        id: `thinking:${runId}:${Date.now()}`,
        content: '',
        timestamp: Date.now(),
        status: 'running',
      }];
    } else if ((phase === 'delta' || phase === 'update') && text) {
      const segments = [...this.chatStreamSegments];
      let lastIdx = -1;
      for (let i = segments.length - 1; i >= 0; i--) {
        if (segments[i].type === 'thinking' && segments[i].status === 'running') {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx >= 0) {
        segments[lastIdx] = { ...segments[lastIdx], content: segments[lastIdx].content + text };
        this.chatStreamSegments = segments;
      }
    } else if (phase === 'end') {
      this.chatStreamSegments = this.chatStreamSegments.map(s =>
        s.type === 'thinking' && s.status === 'running'
          ? { ...s, status: 'completed' as const }
          : s
      );
    }
  }

  private handleLifecycleStreamEvent(data: Record<string, unknown>) {
    const phase = typeof data.phase === 'string' ? data.phase : '';
    const message = typeof data.message === 'string' ? data.message : '';
    if (phase === 'error' && message) {
      this.pushSystemMessage(message);
    }
  }

  private handleExecApprovalRequested(payload: Record<string, unknown>) {
    const id = typeof payload.id === 'string' ? payload.id : '';
    if (!id) return;

    const request = isRecord(payload.request) ? payload.request : {};
    const command = typeof request.command === 'string' ? request.command : '';
    if (!command) return;

    const createdAtMs = typeof payload.createdAtMs === 'number' ? payload.createdAtMs : 0;
    const expiresAtMs = typeof payload.expiresAtMs === 'number' ? payload.expiresAtMs : 0;
    if (!createdAtMs || !expiresAtMs) return;

    const sessionKey = typeof request.sessionKey === 'string' ? request.sessionKey : '';

    this.execApprovalQueue = [...this.execApprovalQueue, {
      id,
      sessionKey,
      runId: '',
      toolName: 'Bash',
      toolArgs: { command },
      command,
      expiresAt: expiresAtMs,
      timestamp: createdAtMs,
    }];
  }

  private handleExecApprovalResolved(payload: Record<string, unknown>) {
    const id = typeof payload.id === 'string' ? payload.id : '';
    this.execApprovalQueue = this.execApprovalQueue.filter(a => a.id !== id);
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
    this.toolStreamEntries = [];
    this.chatStreamSegments = [];
    this.resetChatInputHeight();
    saveSettings({ lastSessionKey: key });
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
      this.toolStreamEntries = [];
      this.chatStreamSegments = [];
      this.resetChatInputHeight();
      return;
    }

    const requestId = this.sendRequest('sessions.create', {
      ...(this.selectedAgentId ? { agentId: this.selectedAgentId } : {}),
    });
    if (!requestId) {
      this.pushSystemMessage('Gateway 未连接，无法创建新会话。');
    }
  }

  private handleRenameSession(key: string, label: string) {
    if (!this.appState.connected) return;
    this.sendRequest('sessions.patch', { key, label });
  }

  private handleModelChange(modelId: string) {
    if (!modelId || modelId === this.selectedModel) return;
    this.selectedModel = modelId;
    if (this.appState.connected) {
      this.sendRequest('sessions.patch', {
        key: this.appState.sessionKey,
        model: modelId,
      });
    }
  }

  private handleAgentChange(agentId: string) {
    if (!agentId || agentId === this.selectedAgentId) return;
    this.selectedAgentId = agentId;
  }

  private async handleDeleteSession(key: string) {
    const confirmed = await JdConfirmDialog.confirm({
      title: '删除会话',
      message: '确定要删除这个会话吗？此操作不可恢复。',
      confirmText: '删除',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!confirmed || !this.appState.connected) return;

    this.pendingDeleteKey = key;
    this.sendRequest('sessions.delete', { key });
  }

  private handleRetryMessage() {
    // Find the last user message and resend it
    const lastUserMsg = [...this.appState.messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg || !this.appState.connected) return;

    // Remove the last assistant message
    let lastAssistantIdx = -1;
    for (let i = this.appState.messages.length - 1; i >= 0; i--) {
      if (this.appState.messages[i].role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }
    const messages = lastAssistantIdx >= 0
      ? this.appState.messages.filter((_, i) => i !== lastAssistantIdx)
      : this.appState.messages;

    const runId = crypto.randomUUID();
    this.appState = {
      ...this.appState,
      messages,
      sending: true,
      runId,
      stream: null,
      streamStartedAt: Date.now(),
    };

    this.sendRequest('chat.send', {
      sessionKey: this.appState.sessionKey,
      message: lastUserMsg.content,
      deliver: true,
      idempotencyKey: runId,
    });
  }

  private handleCopySuccess() {
    JdToast.show({ message: '已复制到剪贴板', type: 'success', duration: 2000 });
  }

  private handleSlashCommand(e: CustomEvent<{ key: string }>) {
    const cmd = e.detail.key;
    switch (cmd) {
      case 'new':
        this.handleNewSession();
        break;
      case 'stop':
        this.handleAbort();
        break;
      case 'clear':
        this.appState = { ...this.appState, messages: [] };
        break;
      case 'compact':
        if (this.appState.connected) {
          this.sendRequest('sessions.compact', { key: this.appState.sessionKey });
          JdToast.show({ message: '正在压缩历史...', type: 'info' });
        }
        break;
      case 'export': {
        const md = exportChatToMarkdown(this.appState.messages);
        downloadTextFile(md, `chat-${this.appState.sessionKey}.md`);
        break;
      }
      default:
        // Send as slash command to gateway
        if (this.appState.connected) {
          this.appState = { ...this.appState, chatMessage: `/${cmd}` };
          this.handleSend();
        }
        break;
    }
  }

  private handleRouteChange(e: CustomEvent) {
    navigateTo(e.detail as Route);
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

  @state() private tokenInput = '';

  // ── Render Helpers ──────────────────────────────────────────────────────────

  private renderLoading() {
    const hasToken = !!this.gatewayToken;
    return html`
      <div class="loading-screen">
        ${hasToken ? html`
          <div class="loading-spinner"></div>
          <div class="loading-text">正在连接 Gateway...</div>
        ` : html`
          <div class="loading-icon">
            <img src="/logo.svg" alt="JDClaw" style="width:48px;height:60px;" />
          </div>
          <div class="loading-text" style="font-size:18px;font-weight:600;margin-bottom:4px;">JDClaw WebUI</div>
          <div class="loading-text">请输入 Gateway Token 以连接</div>
          <div class="token-form">
            <input
              type="text"
              class="token-input"
              placeholder="输入 Gateway Token"
              .value=${this.tokenInput}
              @input=${(e: Event) => this.tokenInput = (e.target as HTMLInputElement).value}
              @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.handleTokenSubmit(); }}
            />
            <button class="btn btn--primary" @click=${() => this.handleTokenSubmit()} ?disabled=${!this.tokenInput.trim()}>连接</button>
          </div>
        `}
      </div>
    `;
  }

  private renderError() {
    return html`
      <div class="error-screen">
        <div class="error-icon">⚠️</div>
        <div class="error-title">无法连接到 Gateway</div>
        <div class="error-message">${this.appState.error || '请确保 OpenClaw Gateway 正在运行'}</div>
        <div class="token-form">
          <input
            type="text"
            class="token-input"
            placeholder="输入或更新 Gateway Token"
            .value=${this.tokenInput}
            @input=${(e: Event) => this.tokenInput = (e.target as HTMLInputElement).value}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.handleTokenSubmit(); }}
          />
          <button class="btn btn--primary" @click=${() => this.handleTokenSubmit()}>
            ${this.tokenInput.trim() ? '保存并重连' : '重试'}
          </button>
        </div>
        ${this.gatewayToken ? html`
          <div class="token-hint">当前 Token: ${this.gatewayToken.slice(0, 8)}...${this.gatewayToken.slice(-4)}</div>
        ` : html`
          <div class="token-hint">未设置 Token</div>
        `}
      </div>
    `;
  }

  private handleTokenSubmit() {
    const token = this.tokenInput.trim();
    if (!token && !this.gatewayToken) return;
    if (token) {
      persistGatewayToken(token);
      this.gatewayToken = token;
      this.tokenInput = '';
    }
    this.appState = { ...this.appState, error: null, connecting: false };
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
    this.startSessionPoll();
  }

  // ── Main Render ─────────────────────────────────────────────────────────────

  private renderRouteContent() {
    switch (this.currentRoute) {
      case 'sessions':
        return html`
          <jd-sessions-view
            .sessions=${this.appState.sessions as SidebarSessionItem[]}
            @session-select=${(e: CustomEvent) => {
              this.handleSessionSelect(e.detail.key);
              navigateTo('chat');
            }}
            @delete-session=${(e: CustomEvent) => this.handleDeleteSession(e.detail.key)}
          ></jd-sessions-view>
        `;
      case 'settings':
        return html`<jd-settings-panel @settings-change=${(e: CustomEvent) => {
          if (e.detail.key === 'theme') this.applyTheme(e.detail.value);
        }}></jd-settings-panel>`;
      case 'agents':
        return html`
          <div class="jd-agents-page">
            <div class="jd-agents-page__header">
              <h2>助手管理</h2>
              <span class="jd-agents-page__count">${this.agents.length} 个助手</span>
            </div>
            ${this.agents.length === 0 ? html`
              <div class="jd-agents-page__empty">暂无助手，请检查 Gateway 连接</div>
            ` : html`
              <div class="jd-agents-page__list">
                ${this.agents.map(agent => html`
                  <div class="jd-agent-card ${agent.id === this.selectedAgentId ? 'active' : ''}"
                    @click=${() => this.handleAgentChange(agent.id)}>
                    <div class="jd-agent-card__avatar">
                      ${agent.identity?.emoji || '🤖'}
                    </div>
                    <div class="jd-agent-card__info">
                      <div class="jd-agent-card__name">${agent.name || agent.identity?.name || agent.id}</div>
                      <div class="jd-agent-card__meta">
                        ${agent.model?.primary ? html`<span>模型: ${agent.model.primary}</span>` : nothing}
                        ${agent.workspace ? html`<span>${agent.workspace}</span>` : nothing}
                      </div>
                    </div>
                    ${agent.id === this.selectedAgentId ? html`
                      <div class="jd-agent-card__badge">当前</div>
                    ` : nothing}
                  </div>
                `)}
              </div>
            `}
          </div>
        `;
      case 'chat':
      default:
        return html`
          <jd-chat-view
            .messages=${this.appState.messages}
            .streamingText=${this.appState.stream}
            .sending=${this.appState.sending}
            .attachments=${this.appState.chatAttachments}
            .draft=${this.appState.chatMessage}
            .focusMode=${this.focusMode}
            .toolStreamEntries=${this.toolStreamEntries}
            .chatStreamSegments=${this.chatStreamSegments}
            .agents=${this.agents}
            .selectedAgentId=${this.selectedAgentId}
            .models=${this.models}
            .selectedModel=${this.selectedModel}
            .sessions=${this.appState.sessions}
            .currentSessionKey=${this.appState.sessionKey}
            @send=${(e: CustomEvent) => {
              this.appState = { ...this.appState, chatMessage: e.detail };
              this.handleSend();
            }}
            @abort=${() => this.handleAbort()}
            @draft-change=${(e: CustomEvent) => this.handleInputChange(e.detail)}
            @retry-message=${() => this.handleRetryMessage()}
            @copy-success=${() => this.handleCopySuccess()}
            @slash-command=${(e: CustomEvent) => this.handleSlashCommand(e)}
            @agent-change=${(e: CustomEvent) => this.handleAgentChange(e.detail)}
            @model-change=${(e: CustomEvent) => this.handleModelChange(e.detail)}
            @session-select=${(e: CustomEvent) => this.handleSessionSelect(e.detail.key)}
          ></jd-chat-view>
        `;
    }
  }

  private renderApprovalQueue() {
    const approval = this.execApprovalQueue[0];
    if (!approval) return nothing;

    return html`
      <jd-approval-dialog
        .toolName=${approval.toolName}
        .toolArgs=${approval.toolArgs}
        .command=${approval.command || ''}
        .expiresAt=${approval.expiresAt}
        @approval-resolve=${(e: CustomEvent<{ approved: boolean }>) => {
          const { approved } = e.detail;
          if (this.appState.connected) {
            this.sendRequest('exec.approval.resolve', {
              id: approval.id,
              decision: approved ? 'approved' : 'denied',
            });
          }
          this.execApprovalQueue = this.execApprovalQueue.filter(a => a.id !== approval.id);
        }}
      ></jd-approval-dialog>
    `;
  }

  render() {
    console.log('[JdApp] Rendering, connected:', this.appState.connected, 'connecting:', this.appState.connecting);

    // Show loading when connecting or not yet connected (initial state)
    if (this.appState.connecting || (!this.appState.connected && !this.appState.error)) {
      return this.renderLoading();
    }

    if (this.appState.error) {
      return this.renderError();
    }

    return html`
      <div class="jd-shell">
        <!-- Sidebar -->
        <aside class="jd-sidebar ${this.navOpen ? '' : 'collapsed'}">
          <jd-sidebar
            .sessions=${this.appState.sessions as SidebarSessionItem[]}
            .currentSessionKey=${this.appState.sessionKey}
            .currentRoute=${this.currentRoute}
            .models=${this.models}
            .selectedModel=${this.selectedModel}
            .agents=${this.agents}
            .currentAgent=${this.agents.find(a => a.id === this.selectedAgentId) || null}
            @new-session=${() => this.handleNewSession()}
            @session-select=${(e: CustomEvent) => {
              this.handleSessionSelect(e.detail.key);
              if (this.currentRoute !== 'chat') navigateTo('chat');
            }}
            @delete-session=${(e: CustomEvent) => this.handleDeleteSession(e.detail.key)}
            @rename-session=${(e: CustomEvent) => this.handleRenameSession(e.detail.key, e.detail.label)}
            @route-change=${(e: CustomEvent) => this.handleRouteChange(e)}
            @model-change=${(e: CustomEvent) => this.handleModelChange(e.detail)}
            @agent-change=${(e: CustomEvent) => this.handleAgentChange(e.detail.id)}
          ></jd-sidebar>
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
                ${this.currentRoute === 'chat'
                  ? (this.appState.sessions.find(s => s.key === this.appState.sessionKey)?.displayName || '聊天')
                  : this.currentRoute === 'sessions' ? '会话管理'
                  : this.currentRoute === 'agents' ? '助手管理'
                  : this.currentRoute === 'settings' ? '设置'
                  : 'JDClaw'}
              </span>
            </div>
            <div class="jd-topbar__center">
              <div class="jd-topbar__status">
                <span class="jd-topbar__status-dot ${this.appState.connected ? 'connected' : ''}"></span>
                <span class="jd-topbar__status-text">${this.appState.connected ? '已连接' : '未连接'}</span>
              </div>
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

          <!-- Routed Content -->
          ${this.renderRouteContent()}
        </main>
      </div>

      <!-- Exec Approval Queue -->
      ${this.execApprovalQueue.length > 0 ? this.renderApprovalQueue() : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-app': JdApp;
  }
}
