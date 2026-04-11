# JDClawWebUI 完整功能开发规划

> 基于 OpenClaw API Spec 分析，面向 AI Coder 的开发任务单  
> 更新日期：2026-04-11
>
> 执行说明（2026-04-11）：
> 当前已开始按此计划推进开发，优先处理 P0 的 Chat 主链路修复。
> 与聊天协议直接相关的“已实现”项，需以运行验证结果为准。

## 项目概述

- **技术栈**: Lit Web Components + TypeScript + Vite
- **通信协议**: WebSocket Gateway (`ws://localhost:18789`)
- **认证方式**: Token-based + Device fingerprint
- **当前状态**: 基础框架已搭建，核心 Chat 流程可用

---

## 一、已实现功能（基线）

| 功能 | 组件 | 状态 |
|------|------|------|
| WebSocket 连接 + 认证握手 | `jd-app.ts` | 🟡 已按协议修正，待运行验证 |
| Session 列表展示 | `jd-sidebar.ts` | ✅ 完成 |
| Session 切换 + 历史加载 | `jd-app.ts` | 🟡 已切换到 `chat.history`，待运行验证 |
| 消息流式渲染 | `jd-app.ts` | 🟡 已切换到 `chat` 事件流，待运行验证 |
| Markdown 渲染 | `jd-chat-view.ts` | ✅ 完成 |
| 附件上传（图片/文件） | `jd-app.ts` | ✅ 完成 |
| Token 用量显示 | `jd-status-bar.ts` | ✅ 完成 |
| 主题切换（light/dark/auto） | `jd-topbar.ts` | ✅ 完成 |
| 专注模式（隐藏侧边栏） | `jd-app.ts` | ✅ 完成 |
| 命令面板（Ctrl+K） | `jd-command-palette.ts` | ✅ 完成 |
| Agent 选择器 | `jd-sidebar.ts` | ✅ 完成 |
| Model 选择器 | `jd-sidebar.ts` | ✅ 完成 |
| 断线重连（指数退避） | `jd-app.ts` | ✅ 完成 |

### 当前迭代进展（2026-04-11）

- 已开始修复 Chat 主链路协议对接，包括 `connect.challenge`、`chat.history`、`chat.send`、`chat.abort`。
- 已补齐用户消息本地回显与 `chat` 事件 `delta/final/aborted/error` 状态处理。
- 已补齐输入框自动扩展。
- 已完成 `npm ci`、`npm run typecheck`、`npm run build` 验证。

---

## 二、待开发功能清单

### F1 — Session 管理（完整 CRUD）

**对应 API**: `sessions.*` 系列方法

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F1.1 新建 Session（命名） | `sessions.create` | P0 |
| F1.2 重命名 Session | `sessions.patch` | P0 |
| F1.3 删除 Session | `sessions.delete` | P0 |
| F1.4 Session 右键菜单 | UI only | P0 |
| F1.5 Session 搜索/过滤 | UI only | P1 |
| F1.6 Session 分组（按日期/Agent） | `sessions.list` + UI | P1 |
| F1.7 Compact Session（压缩历史） | `sessions.compact` | P1 |
| F1.8 Reset Session（清空消息） | `sessions.reset` | P1 |
| F1.9 Session 用量详情弹窗 | `sessions.usage` | P2 |
| F1.10 Session 预览（hover 摘要） | `sessions.preview` | P2 |
| F1.11 Session 导出（JSON/Markdown） | UI only | P2 |

**验证点**:
- 新建 Session 后立即可发消息
- 删除 Session 后列表刷新，不残留
- Rename 后侧边栏实时更新
- Compact 后消息数量减少，内容摘要正确

---

### F2 — Chat 增强

**对应 API**: `chat.*` 系列方法

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F2.1 中止正在进行的回复 | `chat.abort` | P0 |
| F2.2 消息重试（重新生成） | `chat.send` | P0 |
| F2.3 消息编辑（修改后重发） | `chat.inject` + UI | P1 |
| F2.4 消息复制按钮 | UI only | P0 |
| F2.5 消息点赞/踩（反馈） | UI only | P2 |
| F2.6 Thinking 过程展开/折叠 | UI only | P1 |
| F2.7 Tool Call 展示（工具调用卡片） | UI only | P1 |
| F2.8 Tool Call 审批交互 | `exec-approvals.*` | P1 |
| F2.9 消息时间戳显示 | UI only | P1 |
| F2.10 代码块语法高亮 + 复制 | UI only | P0 |
| F2.11 图片消息内联预览 | UI only | P0 |
| F2.12 多行输入框自动扩展 | UI only | P0 |
| F2.13 输入框 @ 提及（Agent/Tool） | UI only | P2 |
| F2.14 Slash 命令补全（/model, /think 等） | UI only | P1 |

**验证点**:
- 中止后流式输出立即停止，按钮状态恢复
- 代码块复制后剪贴板内容正确
- Tool Call 卡片展示工具名、参数、结果
- Thinking 折叠后不影响消息布局

---

### F3 — Agent 管理

**对应 API**: `agents.*` 系列方法

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F3.1 Agent 列表页 | `agents.list` | P0 |
| F3.2 创建 Agent（名称/描述/模型/Skills） | `agents.create` | P1 |
| F3.3 编辑 Agent | `agents.update` | P1 |
| F3.4 删除 Agent | `agents.delete` | P1 |
| F3.5 Agent 详情页（Skills/配置） | `agents.get` | P1 |
| F3.6 Agent 文件管理（上传/删除） | `agents.files.*` | P2 |
| F3.7 Agent 头像/图标设置 | UI only | P2 |
| F3.8 Agent 等待状态指示 | `agent.wait` | P1 |

**验证点**:
- 创建 Agent 后在侧边栏选择器中出现
- 删除 Agent 后关联 Session 不崩溃
- Agent 切换后模型/Skills 配置正确加载

---

### F4 — Model 管理

**对应 API**: `models.list`

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F4.1 Model 列表（按 Provider 分组） | `models.list` | P0 |
| F4.2 Thinking Level 选择器 | UI only | P1 |
| F4.3 Model 参数配置（temperature 等） | `config.*` | P2 |
| F4.4 Model 能力标签（支持图片/工具等） | UI only | P1 |
| F4.5 当前 Session Model 覆盖 | `sessions.patch` | P1 |

**验证点**:
- 切换 Model 后新消息使用新模型
- Thinking Level 变更后 thinking 内容正确显示/隐藏
- 不支持图片的模型禁用附件上传按钮

---

### F5 — Tools 工具管理

**对应 API**: `tools-catalog`, `tools-effective.*`

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F5.1 工具目录浏览页 | `tools-catalog` | P1 |
| F5.2 当前 Session 有效工具列表 | `tools-effective` | P1 |
| F5.3 工具启用/禁用开关 | `tools-effective.runtime` | P1 |
| F5.4 工具详情（Schema/描述） | UI only | P2 |
| F5.5 工具执行审批弹窗 | `exec-approvals.*` | P1 |
| F5.6 Plugin 审批弹窗 | `plugin-approval.*` | P1 |

**验证点**:
- 禁用工具后 Agent 不再调用该工具
- 审批弹窗显示工具名、参数、风险提示
- 拒绝审批后 Agent 收到拒绝响应并继续

---

### F6 — Skills 管理

**对应 API**: `skills.*` 系列方法

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F6.1 Skills 列表（已安装） | `skills.status` | P1 |
| F6.2 Skills 搜索（ClawHub） | `skills.search` | P2 |
| F6.3 Skill 详情页 | `skills.detail` | P2 |
| F6.4 安装 Skill | `skills.install` | P2 |
| F6.5 更新 Skill | `skills.update` | P2 |
| F6.6 Skill Bins 管理 | `skills.bins` | P2 |

**验证点**:
- 安装 Skill 后在 Agent 配置中可选
- 搜索结果展示 Skill 名称、描述、版本

---

### F7 — Channels 渠道管理

**对应 API**: `channels.*` 系列方法

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F7.1 Channels 状态总览页 | `channels.status` | P1 |
| F7.2 Channel 连接/断开 | `channels.logout` | P1 |
| F7.3 Channel 配置表单 | `config.*` | P2 |
| F7.4 Channel 状态指示器（侧边栏） | UI only | P1 |

**验证点**:
- Channel 断开后状态指示器变为灰色
- 配置保存后 Channel 自动重连

---

### F8 — Config 配置管理

**对应 API**: `config.*` 系列方法

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F8.1 设置面板（通用配置） | `config.get/set` | P1 |
| F8.2 配置 Schema 驱动表单 | `config.schema` | P2 |
| F8.3 配置导入/导出 | `config.apply` | P2 |
| F8.4 Provider API Key 配置 | `config.patch` | P1 |
| F8.5 WebUI 本地设置（主题/语言等） | localStorage | P0 |

**验证点**:
- API Key 保存后立即生效（无需重启）
- 配置表单字段类型与 Schema 一致（string/bool/select）

---

### F9 — Cron 自动化任务

**对应 API**: `cron.*` 系列方法

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F9.1 Cron 任务列表 | `cron.list` | P2 |
| F9.2 创建定时任务 | `cron.add` | P2 |
| F9.3 编辑/删除任务 | `cron.update/remove` | P2 |
| F9.4 手动触发任务 | `cron.run` | P2 |
| F9.5 任务执行历史 | `cron.runs` | P2 |
| F9.6 任务状态指示 | `cron.status` | P2 |

**验证点**:
- Cron 表达式验证（非法表达式提示错误）
- 手动触发后执行历史立即更新

---

### F10 — TTS 语音合成

**对应 API**: `tts.*` 系列方法

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F10.1 TTS 状态显示 | `tts.status` | P2 |
| F10.2 消息朗读按钮 | `tts.convert` | P2 |
| F10.3 TTS Provider 选择 | `tts.setProvider` | P2 |
| F10.4 TTS 启用/禁用 | `tts.enable/disable` | P2 |

**验证点**:
- 点击朗读后音频自动播放
- 切换 Provider 后朗读使用新 Provider

---

### F11 — Node 节点管理

**对应 API**: `nodes.*` 系列方法

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F11.1 节点列表页 | `nodes.list` | P2 |
| F11.2 节点详情 | `nodes.describe` | P2 |
| F11.3 节点重命名 | `nodes.rename` | P2 |
| F11.4 节点调用（远程执行） | `nodes.invoke` | P2 |
| F11.5 待配对节点队列 | `nodes-pending` | P2 |
| F11.6 节点配对流程 | `nodes.pair.*` | P2 |

**验证点**:
- 节点列表显示在线/离线状态
- 配对流程完成后节点出现在列表

---

### F12 — 用量统计 & 诊断

**对应 API**: `usage`, `doctor`, `logs`, `health`

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F12.1 用量统计仪表盘 | `usage` | P1 |
| F12.2 按 Session/Model/Provider 分组 | `usage.sessions-usage` | P1 |
| F12.3 Token 用量图表 | UI only | P2 |
| F12.4 系统诊断页（Doctor） | `doctor` | P1 |
| F12.5 日志查看器 | `logs` | P2 |
| F12.6 健康检查状态 | `health` | P1 |

**验证点**:
- 用量数据与实际发送消息的 Token 数一致
- Doctor 页面显示各组件健康状态（绿/黄/红）
- 日志支持过滤（level/时间范围）

---

### F13 — Secrets 密钥管理

**对应 API**: `secrets.*`

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F13.1 Secrets 列表（脱敏显示） | `secrets.list` | P2 |
| F13.2 添加/删除 Secret | `secrets.set/delete` | P2 |
| F13.3 Secret 引用提示 | UI only | P2 |

**验证点**:
- Secret 值不在 UI 中明文显示
- 删除 Secret 后引用该 Secret 的配置提示警告

---

### F14 — 设备配对

**对应 API**: `device.*`

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F14.1 设备配对二维码/链接 | `device.pair.*` | P2 |
| F14.2 已配对设备列表 | `device.list` | P2 |
| F14.3 撤销设备 Token | `device.token.revoke` | P2 |

**验证点**:
- 配对链接有效期内可完成配对
- 撤销后该设备 Token 立即失效

---

### F15 — 系统更新

**对应 API**: `update.*`

| 开发点 | API 方法 | 优先级 |
|--------|----------|--------|
| F15.1 检查更新 | `update.check` | P2 |
| F15.2 执行更新 | `update.run` | P2 |
| F15.3 更新进度显示 | UI only | P2 |

---

### F16 — UI/UX 基础设施

纯前端，无 API 依赖

| 开发点 | 优先级 |
|--------|--------|
| F16.1 响应式布局（移动端适配） | P1 |
| F16.2 键盘导航完整支持 | P1 |
| F16.3 加载骨架屏（Skeleton） | P1 |
| F16.4 Toast 通知系统 | P0 |
| F16.5 确认对话框组件 | P0 |
| F16.6 错误边界 + 友好错误页 | P1 |
| F16.7 国际化框架（i18n，中/英） | P2 |
| F16.8 无障碍（ARIA 标签） | P2 |
| F16.9 虚拟滚动（长消息列表） | P2 |
| F16.10 页面路由（Settings/Agents 等子页） | P1 |

---

## 三、开发优先级汇总

### P0 — 核心体验（立即开发）

- F1.1~F1.4 Session CRUD + 右键菜单
- F2.1 中止回复
- F2.2 消息重试
- F2.4 消息复制
- F2.10 代码块高亮 + 复制
- F2.11 图片内联预览
- F2.12 输入框自动扩展
- F8.5 本地设置持久化
- F16.4 Toast 通知
- F16.5 确认对话框

### P1 — 完整功能（第二阶段）

- F1.5~F1.8 Session 搜索/分组/Compact/Reset
- F2.3 消息编辑
- F2.6 Thinking 折叠
- F2.7~F2.8 Tool Call 展示 + 审批
- F2.14 Slash 命令补全
- F3.1~F3.5 Agent 管理
- F4.1~F4.5 Model 管理
- F5.1~F5.6 Tools 管理
- F7.1~F7.4 Channels 管理
- F8.1~F8.4 Config 设置面板
- F12.1~F12.4 用量统计 + 诊断
- F16.1~F16.3 响应式 + 骨架屏 + 路由

### P2 — 扩展功能（第三阶段）

- F6 Skills 管理
- F9 Cron 自动化
- F10 TTS 语音
- F11 Node 节点
- F13 Secrets 管理
- F14 设备配对
- F15 系统更新
- F16.7~F16.10 i18n / 无障碍 / 虚拟滚动

---

## 四、关键验证矩阵

### 连接层

- [ ] Gateway 连接成功（Challenge → Hello-OK 握手）
- [ ] Token 失效时提示重新配置，不崩溃
- [ ] 断线后自动重连，重连成功后恢复 Session 状态
- [ ] 并发请求不互相干扰（request ID 隔离）

### 消息层

- [ ] 流式输出逐字渲染，无闪烁
- [ ] 长消息（>10000 字）渲染不卡顿
- [ ] 含代码块的消息语法高亮正确
- [ ] 含图片的消息正确内联显示
- [ ] Thinking 内容与正文内容分离显示
- [ ] Tool Call 卡片展示完整（名称/参数/结果/耗时）

### Session 层

- [ ] 切换 Session 后历史消息正确加载
- [ ] 新建 Session 后 ID 唯一，不与现有冲突
- [ ] 删除 Session 后需二次确认，不可恢复
- [ ] Session 列表 5 秒轮询不造成性能问题

### 状态一致性

- [ ] 发送中状态（sending=true）期间禁止重复发送
- [ ] 中止后 sending 状态正确重置
- [ ] 页面刷新后 Session 状态从 Gateway 恢复（不依赖 localStorage）

---

## 五、组件拆分建议

基于现有架构，建议新增以下组件：

```
src/components/
├── jd-app.ts              ✅ 已有
├── jd-sidebar.ts          ✅ 已有
├── jd-chat-view.ts        ✅ 已有
├── jd-topbar.ts           ✅ 已有
├── jd-command-palette.ts  ✅ 已有
├── jd-status-bar.ts       ✅ 已有
├── jd-message.ts          🆕 单条消息（含 Tool Call/Thinking）
├── jd-tool-call.ts        🆕 工具调用卡片
├── jd-approval-dialog.ts  🆕 审批弹窗
├── jd-settings-panel.ts   🆕 设置面板
├── jd-agent-editor.ts     🆕 Agent 创建/编辑表单
├── jd-model-picker.ts     🆕 Model 选择器（增强版）
├── jd-usage-dashboard.ts  🆕 用量统计
├── jd-toast.ts            🆕 Toast 通知
├── jd-confirm-dialog.ts   🆕 确认对话框
└── jd-router.ts           🆕 页面路由（Settings/Agents 子页）
```
