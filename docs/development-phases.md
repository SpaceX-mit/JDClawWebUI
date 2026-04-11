# JDClawWebUI 开发阶段计划文档

> 本文档记录 JDClawWebUI 项目的两个主要开发阶段（P0 / P1），均采用多 Agent 并行开发模式推进。

---

## P0 阶段 — 核心体验

**目标**: 完成基础 UI 组件和核心交互，建立可用的聊天体验闭环。

**并行工作流（4 个 Stream + 1 集成阶段）:**

### Stream A — 基础设施组件

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 Toast 通知组件 | `jd-toast.ts` | success/error/warning/info 四种类型，自动消失，堆叠显示，提供静态 API 调用 |
| 创建确认对话框组件 | `jd-confirm-dialog.ts` | Promise-based API，支持 danger/normal 两种变体 |

### Stream B — Chat 增强

| 任务 | 文件 | 说明 |
|------|------|------|
| 消息操作按钮 | `jd-chat-view.ts` | 添加消息复制、重试按钮 |
| Markdown 渲染增强 | `jd-chat-view.ts` | 集成 marked 库渲染 Markdown 内容 |
| 代码块高亮 + 复制 | `jd-chat-view.ts` | 代码块语法高亮，一键复制代码 |
| 图片内联预览 | `jd-chat-view.ts` | 图片消息直接在聊天中预览 |

### Stream C — Session CRUD

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建右键菜单组件 | `jd-context-menu.ts` | 通用右键上下文菜单 |
| 侧边栏 Session 管理 | `jd-sidebar.ts` | 双击 inline edit 重命名、右键菜单（重命名/删除）、兼容 GatewaySessionRow 类型 |
| Gateway API 扩展 | `gateway.ts` | 新增 `sessions.patch`（重命名）、`sessions.delete`（删除）方法 |

### Stream D — 本地设置

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建设置管理模块 | `settings.ts` | localStorage 持久化存储，跨 tab 同步（StorageEvent 监听） |

### 集成阶段

| 任务 | 文件 | 说明 |
|------|------|------|
| 主应用集成 | `jd-app.ts` | 替换内联渲染为子组件引用，绑定事件处理，集成 settings 模块 |

**文件冲突矩阵（P0）:**

| 文件 | Stream A | Stream B | Stream C | Stream D | 集成 |
|------|----------|----------|----------|----------|------|
| `jd-toast.ts` | 创建 | - | - | - | - |
| `jd-confirm-dialog.ts` | 创建 | - | - | - | - |
| `jd-chat-view.ts` | - | 修改 | - | - | - |
| `jd-context-menu.ts` | - | - | 创建 | - | - |
| `jd-sidebar.ts` | - | - | 修改 | - | - |
| `gateway.ts` | - | - | 追加 | - | - |
| `settings.ts` | - | - | - | 创建 | - |
| `jd-app.ts` | - | - | - | - | 修改 |

---

## P1 阶段 — 功能完善

**目标**: 补齐与 OpenClaw 参考实现的差距，完善 Agent 交互、路由导航、命令系统等核心功能。

**并行工作流（5 个 Stream + 1 集成阶段）:**

### Stream A — Agent 事件流 + Tool Call 卡片

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建工具调用卡片组件 | `jd-tool-card.ts` | 工具调用状态指示（pending/running/done/error）、参数预览、可展开输出结果 |
| Agent 事件处理 | `jd-app.ts` | 实现 `handleAgentEvent`、`handleToolStreamEvent`、exec approval 队列管理 |
| 类型定义扩展 | `types/index.ts` | 新增 `ToolStreamEntry`、`ChatStreamSegment`、`ExecApprovalRequest` 等类型 |

### Stream B — 消息分组 + Thinking

| 任务 | 文件 | 说明 |
|------|------|------|
| 消息分组渲染 | `jd-chat-view.ts` | 连续同角色消息自动分组，减少视觉重复 |
| Thinking 折叠展示 | `jd-chat-view.ts` | AI 思考过程可折叠/展开，默认折叠 |

### Stream C — 路由 + 导航

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建路由模块 | `router.ts` | hash 路由实现，支持 `chat`/`sessions`/`agents`/`settings` 四个页面 |
| 创建设置面板 | `jd-settings-panel.ts` | WebUI 本地设置界面（主题、语言等） |
| 创建 Session 列表视图 | `jd-sessions-view.ts` | 独立的 Session 管理页面 |
| 侧边栏导航菜单 | `jd-sidebar.ts` | 添加页面导航入口 |

### Stream D — Slash 命令 + 审批

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 Slash 命令菜单 | `jd-slash-menu.ts` | 输入 `/` 触发命令菜单，支持键盘导航（上下选择、Enter 确认、Esc 关闭） |
| 创建审批对话框 | `jd-approval-dialog.ts` | 工具执行审批弹窗，显示工具名称、参数、风险等级，支持批准/拒绝 |

### Stream E — 设计系统 + 安全

| 任务 | 文件 | 说明 |
|------|------|------|
| CSS 变量对齐 | `styles.css` | 更新 CSS 变量体系，对齐 OpenClaw 设计规范 |
| 安全渲染 | 依赖集成 | 集成 DOMPurify，对所有用户输入和 Markdown 输出进行 XSS 防护 |

### 集成阶段

| 任务 | 文件 | 说明 |
|------|------|------|
| 主应用集成 | `jd-app.ts` | 导入所有新组件，绑定 Agent 事件流，连接路由系统，集成审批队列 |
| 最终验证 | - | typecheck + build 通过，确保所有组件正确注册和渲染 |

**文件冲突矩阵（P1）:**

| 文件 | Stream A | Stream B | Stream C | Stream D | Stream E | 集成 |
|------|----------|----------|----------|----------|----------|------|
| `jd-tool-card.ts` | 创建 | - | - | - | - | - |
| `types/index.ts` | 追加 | - | - | - | - | - |
| `jd-chat-view.ts` | - | 修改 | - | - | - | - |
| `router.ts` | - | - | 创建 | - | - | - |
| `jd-settings-panel.ts` | - | - | 创建 | - | - | - |
| `jd-sessions-view.ts` | - | - | 创建 | - | - | - |
| `jd-sidebar.ts` | - | - | 修改 | - | - | - |
| `jd-slash-menu.ts` | - | - | - | 创建 | - | - |
| `jd-approval-dialog.ts` | - | - | - | 创建 | - | - |
| `styles.css` | - | - | - | - | 修改 | - |
| `jd-app.ts` | - | - | - | - | - | 修改 |

---

## 阶段间依赖关系

```
P0（核心体验）
  ├── Stream A（基础设施）──┐
  ├── Stream B（Chat 增强）──┤
  ├── Stream C（Session CRUD）┤──→ P0 集成 ──→ P1（功能完善）
  ├── Stream D（本地设置）──┘       ├── Stream A（Agent 事件流）──┐
                                    ├── Stream B（消息分组）────┤
                                    ├── Stream C（路由导航）────┤──→ P1 集成
                                    ├── Stream D（Slash 命令）──┤
                                    └── Stream E（设计系统）────┘
```

P1 依赖 P0 的产出（Toast、确认对话框、Session CRUD、settings 模块等），因此必须在 P0 集成完成后启动。
