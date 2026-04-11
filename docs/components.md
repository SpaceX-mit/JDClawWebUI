# JDClawWebUI 组件文档

## 组件概览

| 组件 | 文件 | 说明 |
|------|------|------|
| JDClawApp | `jd-app.ts` | 主应用组件，所有状态管理中枢 |
| JDSidebar | `jd-sidebar.ts` | 侧边栏，包含会话、助手、模型选择 |
| JDChatView | `jd-chat-view.ts` | 聊天主视图，消息展示和输入 |
| JDTopBar | `jd-topbar.ts` | 顶部工具栏 |
| JDCommandPalette | `jd-command-palette.ts` | 命令面板/搜索 |
| JDStatusBar | `jd-status-bar.ts` | 底部状态栏 |

---

## JDClawApp

主应用组件，负责整体状态管理和 Gateway 连接。

### 属性 (Properties)

```typescript
@property({ type: Object }) chatState: ChatState
@property({ type: Object }) uiState: UIState
@property({ type: Array }) sessions: Session[]
@property({ type: Array }) models: Model[]
@property({ type: Array }) agents: Agent[]
@property({ type: Object }) currentAgent: Agent | null
@property({ type: Array }) tools: Tool[]
```

### 事件 (Events)

| 事件名 | 说明 | 详情 |
|--------|------|------|
| `toggle-sidebar` | 切换侧边栏显示 | - |
| `toggle-theme` | 切换主题 | - |
| `toggle-focus` | 切换专注模式 | - |
| `open-command-palette` | 打开命令面板 | - |

### 方法 (Methods)

```typescript
private initApp(): void
private loadSettings(): void
private saveSettings(): void
private initDefaultData(): void
private connectGateway(): Promise<void>
private disconnectGateway(): void
private handleGatewayMessage(data: string): void
private handleGatewayEvent(frame: any): void
private handleChatEvent(payload: any): void
private handleAgentEvent(payload: any): void
private handleGatewayResponse(frame: any): void
private handleSendMessage(content: string): void
private handleAbort(): void
private handleNewSession(): void
private handleSelectSession(session: Session): void
private handleDeleteSession(session: Session): void
```

### 状态类型

```typescript
interface ChatState {
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

interface UIState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  theme: 'light' | 'dark' | 'auto';
  sidebarOpen: boolean;
  sidebarContent: SidebarContent | null;
  activeTab: Tab;
  focusMode: boolean;
  commandPaletteOpen: boolean;
}
```

---

## JDSidebar

侧边栏组件，提供会话列表、助手选择和模型选择功能。

### 属性 (Properties)

```typescript
@property({ type: Array }) sessions: Session[]
@property({ type: String }) currentSessionKey: string
@property({ type: Array }) agents: Agent[]
@property({ type: Object }) currentAgent: Agent | null
@property({ type: Array }) models: Model[]
@property({ type: String }) selectedModel: string
```

### 事件 (Events)

| 事件名 | 说明 | Detail |
|--------|------|--------|
| `session-select` | 选择会话 | `Session` |
| `new-session` | 新建会话 | - |
| `delete-session` | 删除会话 | `Session` |
| `agent-change` | 切换助手 | `Agent` |

### 内部状态

```typescript
@state() private sessionsExpanded = true
@state() private agentsExpanded = true
```

### 样式变量

```css
--jd-sidebar-width: 280px
--jd-sidebar-collapsed: 64px
```

---

## JDChatView

聊天主视图组件，处理消息展示和用户输入。

### 属性 (Properties)

```typescript
@property({ type: Array }) messages: Message[]
@property({ type: String }) streamingText: string | null
@property({ type: Boolean }) sending: boolean
@property({ type: Array }) attachments: Attachment[]
@property({ type: String }) draft: string
@property({ type: Boolean }) focusMode: boolean
```

### 事件 (Events)

| 事件名 | 说明 | Detail |
|--------|------|--------|
| `send` | 发送消息 | `string` (消息内容) |
| `abort` | 停止生成 | - |
| `draft-change` | 草稿变化 | `string` |
| `attachments-change` | 附件变化 | `Attachment[]` |

### 渲染内容

1. **消息列表**
   - 用户消息（右侧，蓝色背景）
   - 助手消息（左侧，灰色背景）
   - 流式消息（带动画指示器）

2. **输入区域**
   - 文本输入框（支持多行）
   - 附件预览
   - 发送/停止按钮
   - 文件上传按钮

### 空状态

当没有消息时显示：
- 对话图标
- 标题：「开始新对话」
- 说明：「输入消息与 JDClaw 助手开始对话，支持文本、图片、文件上传」

---

## JDTopBar

顶部工具栏组件。

### 属性 (Properties)

```typescript
@property({ type: Boolean }) connected = false
@property({ type: Boolean }) focusMode = false
@property({ type: String }) agentName = '助手'
```

### 事件 (Events)

| 事件名 | 说明 |
|--------|------|
| `toggle-sidebar` | 切换侧边栏 |
| `toggle-theme` | 切换主题 |
| `toggle-focus` | 切换专注模式 |
| `open-command-palette` | 打开命令面板 |

### 布局

```
┌─────────────────────────────────────────────────────────────┐
│ [☰]  助手名称              ● 已连接    [🔍] [⛶] [☀️]       │
└─────────────────────────────────────────────────────────────┘
```

### 专注模式

专注模式下：
- 高度从 56px 变为 48px
- 底部边框隐藏
- 左右区域拉宽

---

## JDCommandPalette

命令面板组件，提供快速搜索和执行命令的功能。

### 属性 (Properties)

```typescript
@property({ type: Array }) models: Model[]
@property({ type: Array }) agents: Agent[]
```

### 事件 (Events)

| 事件名 | 说明 | Detail |
|--------|------|--------|
| `close` | 关闭面板 | - |
| `select-command` | 选择命令 | 命令对象 |

### 分类

- **全部**: 所有命令
- **会话**: 新建、清空、导出
- **模型**: 切换模型
- **助手**: 切换助手
- **界面**: 主题、专注模式

### 内置命令

```typescript
[
  { id: 'new-session', title: '新建会话', shortcut: 'Ctrl+N' },
  { id: 'clear-history', title: '清空历史' },
  { id: 'toggle-theme', title: '切换主题' },
  { id: 'toggle-focus', title: '专注模式', shortcut: 'Ctrl+.' },
  { id: 'export-chat', title: '导出对话' },
]
```

### 键盘导航

| 按键 | 功能 |
|------|------|
| `↑` | 上一个选项 |
| `↓` | 下一个选项 |
| `Enter` | 执行选中命令 |
| `Esc` | 关闭面板 |

---

## JDStatusBar

底部状态栏组件，显示连接状态和快捷键提示。

### 属性 (Properties)

```typescript
@property({ type: Boolean }) connected = false
@property({ type: Boolean }) sending = false
@property({ type: Number }) messageCount = 0
```

### 布局

```
┌─────────────────────────────────────────────────────────────┐
│  ● 就绪                              Ctrl+K    Ctrl+N       │
└─────────────────────────────────────────────────────────────┘
```

### 状态显示

- **未连接**: 灰色圆点 + "未连接"
- **已连接**: 绿色圆点 + "就绪"
- **生成中**: 橙色脉冲圆点 + "生成中..."

---

## 类型定义

### Message

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  thinking?: string;
  usage?: TokenUsage;
  stopReason?: string;
}
```

### Session

```typescript
interface Session {
  id: string;
  key: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  model?: string;
  agentId?: string;
}
```

### Model

```typescript
interface Model {
  id: string;
  name: string;
  provider: string;
  description?: string;
  maxTokens?: number;
  supportsImages?: boolean;
  supportsTools?: boolean;
}
```

### Agent

```typescript
interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  defaultModel?: string;
  skills?: string[];
  createdAt: number;
  updatedAt: number;
}
```

---

## 使用示例

### 基本使用

```html
<jd-claw-app></jd-claw-app>
```

### 自定义主题

```html
<style>
  jd-claw-app {
    --jd-primary: #6366f1;
    --jd-secondary: #22c55e;
    --jd-radius: 12px;
  }
</style>
<jd-claw-app></jd-claw-app>
```

### 监听事件

```javascript
const app = document.querySelector('jd-claw-app');

app.addEventListener('toggle-sidebar', () => {
  console.log('Sidebar toggled');
});

app.addEventListener('toggle-focus', () => {
  console.log('Focus mode toggled');
});
```

### 编程控制

```javascript
const app = document.querySelector('jd-claw-app');

// 发送消息
app.handleSendMessage?.('Hello, world!');

// 新建会话
app.handleNewSession?.();

// 切换主题
app.handleToggleTheme?.();
```
