// JDClawWebUI Type Definitions

// ============================================
// Core Types
// ============================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  thinking?: string;
  usage?: TokenUsage;
  stopReason?: string;
  optimistic?: boolean;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  mimeType: string;
  url?: string;
  data?: string; // base64 for images
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheRead?: number;
  cacheWrite?: number;
}

// ============================================
// Session Types
// ============================================

export interface Session {
  id: string;
  key: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  model?: string;
  agentId?: string;
}

export interface SessionGroup {
  id: string;
  name: string;
  sessions: Session[];
  collapsed?: boolean;
}

// Gateway Session Row (simplified)
export interface GatewaySessionRow {
  key: string;
  displayName?: string;
  lastChannel?: string;
  status?: string;
  totalTokens?: number;
  updatedAt?: number;
  sessionId?: string;
  kind?: string;
  origin?: Record<string, unknown>;
}

export interface SessionsListResult {
  ts: number;
  path: string;
  count: number;
  defaults: {
    modelProvider: string;
    model: string;
    contextTokens: number;
  };
  sessions: GatewaySessionRow[];
}

// ============================================
// Model Types
// ============================================

export interface Model {
  id: string;
  name: string;
  provider: string;
  description?: string;
  maxTokens?: number;
  supportsImages?: boolean;
  supportsTools?: boolean;
  thinkingLevels?: ThinkingLevel[];
}

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'stream';

export interface ModelConfig {
  model: string;
  thinking: ThinkingLevel;
  temperature?: number;
  maxTokens?: number;
}

// ============================================
// Agent Types
// ============================================

export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  defaultModel?: string;
  skills?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon?: string;
}

// ============================================
// Tool Types
// ============================================

export interface Tool {
  id: string;
  name: string;
  description: string;
  inputSchema: ToolSchema;
  category?: string;
}

export interface ToolSchema {
  type: 'object';
  properties?: Record<string, ToolSchemaProperty>;
  required?: string[];
}

export interface ToolSchemaProperty {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
}

export interface ToolCall {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
  startedAt?: number;
  completedAt?: number;
}

// ============================================
// UI State Types
// ============================================

export interface ChatState {
  sessionKey: string;
  messages: Message[];
  streamingText: string | null;
  streamStartedAt: number | null;
  sending: boolean;
  runId: string | null;
  error: string | null;
  attachments: Attachment[];
  draft: string;
}

export interface UIState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  theme: Theme;
  sidebarOpen: boolean;
  sidebarContent: SidebarContent | null;
  activeTab: Tab;
  focusMode: boolean;
  commandPaletteOpen: boolean;
}

export type Theme = 'light' | 'dark' | 'auto';
export type Tab = 'chat' | 'agents' | 'sessions' | 'tools' | 'settings';
export type SidebarContent = 'sessions' | 'tools' | 'agents' | null;

// ============================================
// Gateway Connection Types
// ============================================

export interface GatewayConfig {
  url: string;
  token?: string;
}

export interface GatewayHello {
  type: 'hello-ok';
  protocol: number;
  server?: {
    version?: string;
    connId?: string;
  };
  features?: {
    methods?: string[];
    events?: string[];
  };
  snapshot?: unknown;
}

// ============================================
// Event Types
// ============================================

export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: Message;
  errorMessage?: string;
}

export interface AgentEventPayload {
  runId: string;
  sessionKey?: string;
  stream: 'assistant' | 'tool' | 'thinking' | 'lifecycle' | 'error';
  seq: number;
  ts: number;
  data?: Record<string, unknown>;
}

// ============================================
// Command Types
// ============================================

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  shortcut?: string;
  category: SlashCommandCategory;
  executeLocal?: boolean;
  params?: CommandParam[];
}

export type SlashCommandCategory = 
  | 'session' 
  | 'model' 
  | 'thinking' 
  | 'tool' 
  | 'navigation';

export interface CommandParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  description?: string;
  required?: boolean;
  default?: unknown;
  options?: string[];
}

// ============================================
// Settings Types
// ============================================

export interface AppSettings {
  gatewayUrl: string;
  theme: Theme;
  language: string;
  fontSize: 'small' | 'medium' | 'large';
  streamingEnabled: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  lastSessionKey?: string;
}

export interface ModelSettings {
  defaultModel: string;
  defaultThinking: ThinkingLevel;
  temperature: number;
  maxTokens: number;
}
