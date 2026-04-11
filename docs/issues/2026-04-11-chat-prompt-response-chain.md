# 问题单：Chat 输入提示词与响应渲染链路未打通

- 编号：`ISSUE-2026-04-11-CHAT-CHAIN`
- 日期：`2026-04-11`
- 状态：`Open`
- 优先级：`P0`
- 范围：`WebUI Chat 主链路`

## 问题概述

当前 WebUI 中，聊天输入框可以正常录入提示词，但从“发送提示词”到“用户消息显示在页面上”再到“收到助手响应并正确渲染”的整条链路没有完全打通。

按当前代码静态分析结果，这不是单点问题，而是由握手、历史接口、事件处理和消息内容结构不一致共同造成的。

## 现象

1. 输入框中的提示词可以正常显示和编辑。
2. 点击发送后，输入框会被清空，但用户消息不会立即出现在消息列表中。
3. 页面是否能收到响应取决于 Gateway 当前安全配置；在现代默认协议下，现有握手实现存在较大失败风险。
4. 即使收到 `chat` 事件，当前前端也未按协议正确处理流式 `delta/final` 状态。
5. 即使拿到最终消息，消息内容结构也可能因为类型不匹配而渲染异常。

## 预期结果

1. 输入提示词后，发送动作成功触发。
2. 用户消息应立即回显到消息区，或至少能被后续历史刷新稳定补回。
3. 助手响应应通过 Gateway 协议成功接收，并支持流式显示。
4. 最终响应应以可读文本形式正常渲染到页面。

## 实际结果

1. 输入框受控绑定正常。
2. 发送后仅清空输入框并进入 `sending` 状态，没有本地追加用户消息。
3. 用于补回消息的历史接口调用与当前协议不一致。
4. `chat` 事件没有被按 `delta/final` 语义正确消费。
5. 当前 `Message.content` 类型定义为字符串，但 Gateway 返回的是内容块数组。

## 影响范围

- 用户无法确认自己刚发送的提示词是否真正进入会话。
- 聊天主链路不稳定，页面可能表现为“能输入，但不出消息”。
- 即使 Gateway 有返回，UI 也可能无法正确流式展示或最终渲染。
- 停止生成功能也存在协议参数不完整的问题，影响聊天可控性。

## 已定位问题

### 1. 连接握手未按当前协议携带 `device` 与 challenge nonce

- 代码在收到 `connect.challenge` 后调用 `sendConnectRequest()`，但没有在 `connect` 请求中带上 `device` 身份，也没有把 challenge nonce 写回 `connect.params.device.nonce`。
- 当前 Gateway 协议要求 WebSocket 客户端等待 `connect.challenge`，并在 `connect` 时提交带 nonce 的 `device` 信息。

证据：

- `src/components/jd-app.ts:161`
- `src/components/jd-app.ts:272`
- `../openclaw-api-spec/docs/gateway/protocol.md:24`
- `../openclaw-api-spec/docs/gateway/protocol.md:545`

### 2. 历史消息接口调用与当前 WebChat 协议不一致

- 当前代码请求的是 `sessions.history`，参数是 `{ key }`。
- 当前 WebChat / Control UI 协议文档与 schema 使用的是 `chat.history`，参数为 `{ sessionKey }`。
- 这会导致发送后依赖历史刷新补回用户消息的方案失效或不稳定。

证据：

- `src/components/jd-app.ts:231`
- `../openclaw-api-spec/src/gateway/protocol/schema/logs-chat.ts:26`
- `../openclaw-api-spec/docs/gateway/protocol.md:348`

### 3. 发送后没有本地回显用户消息

- `handleSend()` 在发送前只做了清空输入框、设置 `sending` 和初始化 `stream`。
- 没有把用户消息追加到 `appState.messages`。
- 因此只要历史刷新失败，页面就不会显示刚发送的提示词。

证据：

- `src/components/jd-app.ts:533`
- `src/components/jd-app.ts:537`

### 4. `chat` 事件未按 `delta/final` 状态机正确处理

- 协议中 `chat.send` 的响应通过 `chat` 事件流返回，状态为 `delta`、`final`、`aborted`、`error`。
- 当前前端流式逻辑主要监听 `chat.stream` / `stream`，而不是协议主路径 `chat`。
- 对 `event === "chat"` 的处理只在存在 `payload.message` 时直接落消息，没有把 `state === "delta"` 的内容累积到 `stream`。

证据：

- `src/components/jd-app.ts:426`
- `src/components/jd-app.ts:488`
- `../openclaw-api-spec/docs/zh-CN/web/control-ui.md:85`
- `../openclaw-api-spec/src/gateway/protocol/schema/logs-chat.ts:71`
- `../openclaw-api-spec/src/gateway/server-chat.ts:571`
- `../openclaw-api-spec/src/gateway/server-chat.ts:664`

### 5. 消息内容结构与前端类型定义不一致

- 当前前端将 `Message.content` 定义为 `string`，并直接在模板中输出。
- Gateway `chat` 事件中的 `message.content` 为内容块数组，例如 `[{ type: "text", text: "..." }]`。
- 这会导致即使收到消息，也可能无法正确显示最终文本。

证据：

- `src/types/index.ts:7`
- `src/components/jd-app.ts:641`
- `../openclaw-api-spec/src/gateway/server-chat.ts:576`
- `../openclaw-api-spec/src/gateway/server-chat.ts:674`

### 6. `chat.abort` 请求参数不完整

- 当前代码只发送 `{ runId }`。
- 协议 schema 要求 `chat.abort` 至少包含 `sessionKey`，`runId` 是可选字段。

证据：

- `src/components/jd-app.ts:561`
- `../openclaw-api-spec/src/gateway/protocol/schema/logs-chat.ts:54`

## 直接结论

当前系统状态不能定义为“提示词正常显示、能收到 response、并稳定显示到页面上”。

更准确的结论是：

1. 输入框里的草稿显示正常。
2. 发送后的用户消息回显不完整。
3. Gateway 协议对接存在不匹配。
4. 响应流和最终消息渲染链路未完全打通。

## 建议修复顺序

1. 修正 `connect` 握手，补齐 `device` 与 challenge nonce。
2. 将历史接口统一为 `chat.history({ sessionKey })`。
3. 发送后立即本地追加一条用户消息。
4. 按 `chat` 事件的 `delta/final/aborted/error` 状态机重写消息流处理。
5. 将消息内容结构从单一 `string` 扩展为兼容 Gateway 内容块，统一做文本提取与渲染。
6. 修正 `chat.abort` 参数，至少包含 `sessionKey`。

## 验证建议

修复后至少验证以下场景：

1. 输入文本后发送，用户消息立即出现在消息区。
2. 助手回复以流式方式逐步显示。
3. 回复完成后最终消息正确落库并再次刷新可见。
4. 切换会话后可通过 `chat.history` 正常加载历史消息。
5. 点击停止后当前运行被正确中止。

## 备注

本问题单基于代码静态分析整理，尚未完成运行态验证。当前工作区缺少本地构建依赖，`npm run typecheck` 与 `npm run build` 无法执行，报错为 `tsc: not found`。
