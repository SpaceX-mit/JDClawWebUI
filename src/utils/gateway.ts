// JDClawWebUI Gateway Client

import type { GatewayHello, ChatEventPayload, AgentEventPayload } from '../types/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

// ─── Gateway Client ───────────────────────────────────────────────────────────

export class GatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private pending = new Map<string, PendingRequest>();
  private eventHandlers = new Map<string, Set<(payload: unknown) => void>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<GatewayHello> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve({} as GatewayHello);
        return;
      }

      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[Gateway] Connected');
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          this.handleFrame(frame, resolve);
        } catch (e) {
          console.error('[Gateway] Parse error:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Gateway] Error:', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log('[Gateway] Closed:', event.code, event.reason);
        this.pending.forEach(({ reject }) => {
          reject(new Error(`Gateway closed: ${event.code}`));
        });
        this.pending.clear();

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Gateway not connected'));
    }

    const id = crypto.randomUUID();
    const frame = { type: 'req', id, method, params };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.ws!.send(JSON.stringify(frame));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  on(event: string, handler: (payload: unknown) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  onChat(handler: (payload: unknown) => void): () => void {
    return this.on('chat', handler);
  }

  onAgent(handler: (payload: unknown) => void): () => void {
    return this.on('agent', handler);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private handleFrame(frame: Record<string, unknown>, onHello?: (hello: GatewayHello) => void): void {
    if (frame.type === 'hello-ok') {
      onHello?.(frame as unknown as GatewayHello);
      return;
    }

    if (frame.type === 'event') {
      const event = frame.event as string;
      const payload = frame.payload as unknown;
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(payload);
          } catch (e) {
            console.error(`[Gateway] Event handler error (${event}):`, e);
          }
        });
      }
      return;
    }

    if (frame.type === 'res') {
      const id = frame.id as string;
      const ok = frame.ok as boolean;
      const payload = frame.payload as unknown;
      const error = frame.error as { message?: string } | undefined;
      const pending = this.pending.get(id);
      if (pending) {
        this.pending.delete(id);
        if (ok) {
          pending.resolve(payload);
        } else {
          pending.reject(new Error(error?.message || 'Request failed'));
        }
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    console.log(`[Gateway] Reconnecting in ${this.reconnectDelay}ms...`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
        this.scheduleReconnect();
      });
    }, this.reconnectDelay);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createGatewayClient(url = 'ws://localhost:18789'): GatewayClient {
  return new GatewayClient(url);
}

// ─── API Methods ─────────────────────────────────────────────────────────────

export interface ChatSendParams {
  sessionKey: string;
  message: string;
  thinking?: string;
  deliver?: boolean;
  idempotencyKey: string;
  [key: string]: unknown;
}

export interface ChatHistoryParams {
  sessionKey: string;
  limit?: number;
  maxChars?: number;
  [key: string]: unknown;
}

export interface ChatAbortParams {
  sessionKey: string;
  runId?: string;
  [key: string]: unknown;
}

export async function chatSend(client: GatewayClient, params: ChatSendParams): Promise<{ runId: string; status: string }> {
  return client.request('chat.send', params) as Promise<{ runId: string; status: string }>;
}

export async function chatHistory(client: GatewayClient, params: ChatHistoryParams): Promise<{
  sessionKey: string;
  sessionId?: string;
  messages: unknown[];
  thinkingLevel?: string;
}> {
  return client.request('chat.history', params) as Promise<{
    sessionKey: string;
    sessionId?: string;
    messages: unknown[];
    thinkingLevel?: string;
  }>;
}

export async function chatAbort(client: GatewayClient, params: ChatAbortParams): Promise<{
  ok: boolean;
  aborted: boolean;
  runIds: string[];
}> {
  return client.request('chat.abort', params) as Promise<{
    ok: boolean;
    aborted: boolean;
    runIds: string[];
  }>;
}

export async function sessionsList(client: GatewayClient): Promise<{
  sessions: unknown[];
}> {
  return client.request('sessions.list') as Promise<{ sessions: unknown[] }>;
}

export async function sessionsCreate(client: GatewayClient, agentId?: string): Promise<{
  key: string;
  sessionId: string;
}> {
  return client.request('sessions.create', { agentId }) as Promise<{
    key: string;
    sessionId: string;
  }>;
}

export async function modelsList(client: GatewayClient): Promise<{
  models: unknown[];
}> {
  return client.request('models.list') as Promise<{ models: unknown[] }>;
}

export async function toolsCatalog(client: GatewayClient): Promise<{
  tools: unknown[];
}> {
  return client.request('tools.catalog') as Promise<{ tools: unknown[] }>;
}
