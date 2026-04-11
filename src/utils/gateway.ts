// JDClawWebUI Gateway Client

import type { GatewayHelloOk, PresenceEntry } from '../types/index.js';

export interface GatewayEventFrame {
  event: string;
  payload?: Record<string, unknown>;
}

export type GatewayEventHandler = (frame: GatewayEventFrame) => void;

export interface GatewayBrowserClientOptions {
  url: string;
  token?: string;
  password?: string;
  clientName: string;
  clientVersion?: string;
  mode?: string;
  instanceId?: string;
  onHello?: (hello: GatewayHelloOk) => void;
  onClose?: (event: { code: number; reason: string; error?: { message?: string; code?: string; details?: unknown } }) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onGap?: (info: { expected: number; received: number }) => void;
}

export class GatewayBrowserClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token?: string;
  private password?: string;
  private clientName: string;
  private clientVersion?: string;
  private mode?: string;
  private instanceId?: string;
  private onHello?: (hello: GatewayHelloOk) => void;
  private onClose?: GatewayBrowserClientOptions['onClose'];
  private onEvent?: GatewayEventHandler;
  private onGap?: (info: { expected: number; received: number }) => void;
  
  private connected = false;
  private connecting = false;
  private requestId = 0;
  private pendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private eventHandlers = new Map<string, GatewayEventHandler[]>();
  private expectedSeq = 0;
  private running = false;
  
  constructor(options: GatewayBrowserClientOptions) {
    this.url = options.url;
    this.token = options.token;
    this.password = options.password;
    this.clientName = options.clientName;
    this.clientVersion = options.clientVersion;
    this.mode = options.mode || 'webchat';
    this.instanceId = options.instanceId;
    this.onHello = options.onHello;
    this.onClose = options.onClose;
    this.onEvent = options.onEvent;
    this.onGap = options.onGap;
  }
  
  start() {
    if (this.running) return;
    this.running = true;
    this.connect();
  }
  
  stop() {
    this.running = false;
    if (this.ws) {
      this.ws.close(1000, 'Client stop');
      this.ws = null;
    }
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('Connection closed'));
    });
    this.pendingRequests.clear();
  }
  
  on(event: string, handler: GatewayEventHandler) {
    let handlers = this.eventHandlers.get(event);
    if (!handlers) {
      handlers = [];
      this.eventHandlers.set(event, handlers);
    }
    handlers.push(handler);
  }
  
  off(event: string, handler: GatewayEventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }
  
  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }
    
    const id = this.nextId();
    const request = {
      type: 'req',
      id,
      method,
      params: params || {},
    };
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(request));
      
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }
  
  private nextId(): string {
    return `${Date.now()}-${++this.requestId}`;
  }
  
  private connect() {
    if (!this.running) return;
    if (this.connecting || this.connected) return;
    
    this.connecting = true;
    console.log('[GatewayClient] Connecting to:', this.url);
    
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('[GatewayClient] WebSocket opened');
        this.connecting = false;
        this.connected = true;
        this.expectedSeq = 0;
        this.sendConnectRequest();
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.ws.onerror = (error) => {
        console.error('[GatewayClient] WebSocket error:', error);
      };
      
      this.ws.onclose = (event) => {
        console.log('[GatewayClient] WebSocket closed:', event.code, event.reason);
        this.connecting = false;
        this.connected = false;
        
        const error = event.reason ? { message: event.reason } : undefined;
        this.onClose?.({ code: event.code, reason: event.reason || '', error });
        
        this.pendingRequests.forEach(({ reject }) => {
          reject(new Error(`Connection closed: ${event.code}`));
        });
        this.pendingRequests.clear();
        
        if (this.running && event.code !== 1000) {
          setTimeout(() => this.connect(), 2000);
        }
      };
    } catch (err) {
      console.error('[GatewayClient] Connection failed:', err);
      this.connecting = false;
      
      if (this.running) {
        setTimeout(() => this.connect(), 2000);
      }
    }
  }
  
  private sendConnectRequest() {
    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.clientName,
        displayName: 'JDClaw WebUI',
        version: this.clientVersion || '1.0.0',
        platform: navigator.platform || 'web',
        mode: this.mode,
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
    };
    
    if (this.token) {
      params.auth = { token: this.token };
    } else if (this.password) {
      params.auth = { password: this.password };
    }
    
    if (this.instanceId) {
      params.instanceId = this.instanceId;
    }
    
    const request = {
      type: 'req',
      id: this.nextId(),
      method: 'connect',
      params,
    };
    
    console.log('[GatewayClient] Sending connect request...');
    this.ws?.send(JSON.stringify(request));
  }
  
  private handleMessage(data: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data);
    } catch {
      console.error('[GatewayClient] Failed to parse message:', data);
      return;
    }
    
    const msgType = msg.type as string | undefined;
    const method = msg.method as string | undefined;
    const id = msg.id as string | undefined;
    const eventName = msg.event as string | undefined;
    const ok = msg.ok as boolean | undefined;
    const payload = msg.payload as Record<string, unknown> | undefined;
    
    if (msgType === 'event' || eventName) {
      const actualEvent = eventName || 'unknown';
      const eventPayload = payload || msg;
      
      const frame: GatewayEventFrame = {
        event: actualEvent,
        payload: eventPayload as Record<string, unknown>,
      };
      
      if (this.expectedSeq > 0) {
        const seq = (eventPayload.seq ?? eventPayload.ts ?? 0) as number;
        if (seq > 0 && seq !== this.expectedSeq) {
          console.warn('[GatewayClient] Sequence gap:', { expected: this.expectedSeq, received: seq });
          this.onGap?.({ expected: this.expectedSeq, received: seq });
        }
        this.expectedSeq = seq + 1;
      }
      
      const handlers = this.eventHandlers.get(actualEvent) || [];
      handlers.forEach(handler => handler(frame));
      this.onEvent?.(frame);
      
      if (actualEvent === 'connect.challenge') {
        this.sendConnectRequest();
      }
      
      return;
    }
    
    if (msgType === 'res') {
      if (id && this.pendingRequests.has(id)) {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          
          if (ok === false) {
            const error = msg.error as { message?: string } | undefined;
            pending.reject(new Error(error?.message || 'Request failed'));
            return;
          }
          
          pending.resolve(payload || msg);
          return;
        }
      }
      
      const payloadType = payload?.type as string | undefined;
      
      if (ok === true && payloadType === 'hello-ok') {
        const hello = payload as unknown as GatewayHelloOk;
        this.onHello?.(hello);
        return;
      }
      
      if (method === 'connect' && ok === true) {
        const hello = payload as unknown as GatewayHelloOk;
        this.onHello?.(hello);
        return;
      }
      
      return;
    }
    
    if (msg.nonce || msg.ts) {
      return;
    }
    
    console.log('[GatewayClient] Unknown message:', msg);
  }
}

export function resolveGatewayErrorDetailCode(error?: { code?: string }): string | null {
  if (!error?.code) return null;
  return error.code;
}

export function formatConnectError(params: { message: string; details?: unknown; code?: string }): string {
  if (params.code === 'AUTH_FAILED') {
    return 'Authentication failed. Please check your token or password.';
  }
  if (params.code === 'ACCESS_DENIED') {
    return 'Access denied. You do not have permission to connect.';
  }
  if (params.message.toLowerCase().includes('fetch failed') || params.message.toLowerCase().includes('failed to fetch')) {
    return 'Cannot connect to Gateway. Please ensure it is running and the URL is correct.';
  }
  return params.message;
}
