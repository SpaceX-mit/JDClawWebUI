export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  thinking?: string;
  usage?: TokenUsage;
  stopReason?: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  senderLabel?: string;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  mimeType: string;
  url?: string;
  data?: string;
  dataUrl?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheRead?: number;
  cacheWrite?: number;
}

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
  contextTokens?: number;
  reasoningLevel?: ThinkingLevel;
  totalTokensFresh?: boolean;
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

export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  avatarUrl?: string;
  defaultModel?: string;
  skills?: string[];
  createdAt: number;
  updatedAt: number;
  identity?: {
    name?: string;
    avatarUrl?: string;
  };
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon?: string;
}

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

export type Theme = 'light' | 'dark' | 'auto' | 'claw';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeName = 'claw' | 'light' | 'dark' | 'midnight' | 'ocean' | 'forest' | 'sunset';

export type Tab = 'chat' | 'agents' | 'sessions' | 'tools' | 'settings' | 'overview';
export type SidebarContent = 'sessions' | 'tools' | 'agents' | 'history' | null;

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

export interface GatewayHelloOk {
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
  snapshot?: {
    presence?: PresenceEntry[];
    sessionDefaults?: {
      defaultAgentId?: string;
      mainKey?: string;
      mainSessionKey?: string;
    };
  };
}

export interface PresenceEntry {
  instanceId: string;
  name: string;
  platform?: string;
  lastSeen?: number;
}

export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: Message;
  errorMessage?: string;
  text?: string;
  content?: string;
  delta?: string;
}

export interface AgentEventPayload {
  runId: string;
  sessionKey?: string;
  stream: 'assistant' | 'tool' | 'thinking' | 'lifecycle' | 'error';
  seq: number;
  ts: number;
  data?: Record<string, unknown>;
}

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  shortcut?: string;
  category: SlashCommandCategory;
  executeLocal?: boolean;
  params?: CommandParam[];
  icon?: string;
  args?: string;
  argOptions?: string[];
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

export interface AppSettings {
  gatewayUrl: string;
  token: string;
  theme: ThemeName;
  themeMode: ThemeMode;
  language: string;
  fontSize: 'small' | 'medium' | 'large';
  streamingEnabled: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  lastSessionKey?: string;
  sessionKey: string;
  chatFocusMode: boolean;
  chatShowThinking: boolean;
  chatShowToolCalls: boolean;
  navCollapsed: boolean;
  borderRadius: number;
  splitRatio: number;
}

export interface ModelSettings {
  defaultModel: string;
  defaultThinking: ThinkingLevel;
  temperature: number;
  maxTokens: number;
}

export interface ChatQueueItem {
  id: string;
  text: string;
  createdAt: number;
  attachments?: Attachment[];
  pendingRunId?: string;
  refreshSessions?: boolean;
  localCommandName?: string;
  localCommandArgs?: string;
}

export interface ToolStreamEntry {
  id: string;
  toolId: string;
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  input?: Record<string, unknown>;
  output?: string;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export interface GatewayEventFrame {
  event: string;
  payload?: Record<string, unknown>;
}
