# JDClawWebUI 设计规范

## 设计愿景

JDClawWebUI 是一款融合了腾讯 QClaw 的专业商务感、飞书 Claw 的简洁高效、有道龙虾 AI 的年轻化风格的现代化 AI 助手界面。它追求：

1. **专业感**: 适合商务场景的企业级品质
2. **高效率**: 最小化操作步骤，最大化产出
3. **易用性**: 直观的交互，新用户零学习成本
4. **美观性**: 现代、优雅、令人愉悦的视觉体验

## 设计原则

### 1. 清晰优先
- 重要的信息一目了然
- 层级分明，重点突出
- 留白适度，呼吸感强

### 2. 效率导向
- 常用功能一键可达
- 快捷键覆盖高频操作
- 减少不必要的确认步骤

### 3. 渐进式披露
- 基础功能直接可见
- 高级功能按需展开
- 不让新用户感到压迫

### 4. 一致性
- 统一的视觉语言
- 统一的行为模式
- 统一的交互反馈

## 色彩系统

### 主色调
```
Primary:      #4F46E5 (靛蓝色)
Primary Hover: #4338CA (深靛蓝)
```

### 功能色
```
Success:     #10B981 (翠绿色)
Warning:     #F59E0B (琥珀色)
Danger:      #EF4444 (红色)
Info:        #3B82F6 (蓝色)
```

### 语义色
```
User Message:   #4F46E5 (主色背景)
Assistant:      #F9FAFB (浅灰背景)
System:         #FEF3C7 (浅黄背景)
Error:          #FEE2E2 (浅红背景)
```

### 中性色
```
Light Theme:
  - Primary BG:   #FFFFFF
  - Secondary BG: #F9FAFB
  - Tertiary BG:  #F3F4F6
  - Border:       #E5E7EB
  - Text Primary: #111827
  - Text Secondary: #6B7280
  - Text Muted:   #9CA3AF

Dark Theme:
  - Primary BG:   #1F2937
  - Secondary BG: #111827
  - Tertiary BG:  #374151
  - Border:       #4B5563
  - Text Primary: #F9FAFB
  - Text Secondary: #D1D5DB
  - Text Muted:   #9CA3AF
```

## 字体系统

### 字体栈
```css
font-family: 
  -apple-system,           /* macOS */
   BlinkMacSystemFont,      /* Chrome on macOS */
   'Segoe UI',             /* Windows */
   Roboto,                 /* Android */
   'Helvetica Neue',       /* Legacy */
   sans-serif;
```

### 字号规范
```
12px - 标签文字、辅助说明
13px - 次要内容、按钮文字
14px - 正文（默认）
15px - 消息内容
16px - 标题
18px - 大标题
20px - 页面标题
24px - Hero 标题
```

### 字重规范
```
400 - Regular: 正文、说明文字
500 - Medium:  按钮、次要标题
600 - Semibold: 主要标题、重要内容
700 - Bold:   Logo、强调文字
```

## 间距系统

### 基础单位
```
4px - 紧凑间距
8px - 默认小间距
12px - 中等间距
16px - 默认间距
24px - 大间距
32px - 区块间距
48px - 页面级间距
```

### 组件间距
```
按钮内边距:     8px 16px
卡片内边距:     16px
列表项间距:     4px / 8px
表单间距:       16px
模态框内边距:   24px
```

## 圆角系统

```
4px  - 小圆角（标签、徽章）
6px  - 默认圆角（小元素）
8px  - 中等圆角（按钮、输入框）
12px - 大圆角（卡片、面板）
16px - 超大圆角（模态框）
```

## 阴影系统

```
Shadow SM:  0 1px 2px 0 rgb(0 0 0 / 0.05)
Shadow MD:  0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)
Shadow LG:  0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)
Shadow XL:  0 25px 50px -12px rgb(0 0 0 / 0.25)
```

## 动效系统

### 时长规范
```
Fast:    150ms - 微交互（hover、active）
Normal:  200ms - 状态切换（展开、收起）
Slow:    300ms - 页面过渡
Slower:  500ms - 大型动画
```

### 缓动函数
```css
/* 默认 */
ease: cubic-bezier(0.4, 0, 0.2, 1);

/* 进入 */
ease-in: cubic-bezier(0.4, 0, 1, 1);

/* 退出 */
ease-out: cubic-bezier(0, 0, 0.2, 1);

/* 弹性 */
spring: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### 动画场景

1. **页面加载**
   - Logo 呼吸动画: scale 1 → 1.05 → 1, 2s infinite

2. **列表项出现**
   - 淡入 + 上移: opacity 0→1, translateY 10px→0, 300ms ease-out

3. **按钮交互**
   - Hover: scale 1.02, 150ms
   - Active: scale 0.98, 100ms

4. **侧边栏切换**
   - 宽度变化: 280px ↔ 64px, 300ms ease

5. **命令面板**
   - 遮罩淡入: opacity 0→1, 150ms
   - 面板滑入: translateY -20px→0, scale 0.95→1, 200ms

6. **消息出现**
   - 淡入 + 上移: opacity 0→1, translateY 10px→0, 300ms ease

7. **流式文本**
   - 光标闪烁: opacity 1→0.3→1, 1s infinite
   - 流式点动画: scale 0.8→1, opacity 0.3→1, 1s ease-in-out infinite

## 图标系统

### 图标库
使用 Lucide Icons（开源、一致性好）

### 常用图标
```
对话相关:
  - message-circle: 对话
  - send: 发送
  - plus: 新建
  - trash-2: 删除
  - edit-2: 编辑

导航相关:
  - menu: 菜单
  - search: 搜索
  - settings: 设置
  - maximize: 全屏
  - minimize: 退出全屏

状态相关:
  - check-circle: 成功
  - alert-circle: 警告
  - x-circle: 错误
  - loader: 加载中
```

### 图标尺寸
```
16px - 内联图标（小按钮）
20px - 默认图标（工具栏、输入区）
24px - 大图标（空状态）
```

## 组件规范

### 按钮

**主按钮**
```
背景: var(--jd-primary)
文字: #FFFFFF
圆角: 8px
内边距: 8px 16px
Hover: background var(--jd-primary-hover)
Active: scale(0.98)
```

**次按钮**
```
背景: var(--jd-bg-tertiary)
文字: var(--jd-text-secondary)
边框: 1px solid var(--jd-border)
圆角: 8px
内边距: 8px 16px
Hover: background var(--jd-border)
```

**图标按钮**
```
尺寸: 36px × 36px (默认) / 44px × 44px (大)
圆角: 8px
Hover: background var(--jd-bg-tertiary)
```

### 输入框

```
背景: var(--jd-bg-secondary)
边框: 1px solid var(--jd-border)
圆角: 12px
内边距: 10px 16px
Focus: border-color var(--jd-primary)
```

### 卡片

```
背景: var(--jd-bg-primary)
边框: 1px solid var(--jd-border)
圆角: 12px
内边距: 16px
阴影: var(--jd-shadow)
```

### 列表项

```
高度: 44px (默认)
内边距: 10px 12px
圆角: 8px
Hover: background var(--jd-bg-tertiary)
Active: background var(--jd-primary), color white
```

## 布局规范

### 侧边栏
```
宽度: 280px (展开) / 64px (收起)
最小高度: 100vh
背景: var(--jd-bg-primary)
边框: 1px solid var(--jd-border) (右侧)
```

### 主内容区
```
最大宽度: 800px (聊天消息)
居中对齐
内边距: 16px 24px
```

### 顶部栏
```
高度: 56px (默认) / 48px (专注模式)
背景: var(--jd-bg-primary)
边框: 1px solid var(--jd-border) (底部)
```

### 状态栏
```
高度: 28px
背景: var(--jd-bg-secondary)
边框: 1px solid var(--jd-border) (顶部)
字号: 12px
```

## 响应式断点

```
Mobile:  < 640px   - 单列布局，侧边栏可收起
Tablet:  640-1024px - 紧凑布局
Desktop: > 1024px  - 完整布局
```

## 无障碍规范

### 颜色对比度
- 文本与背景: 至少 4.5:1
- 大文本: 至少 3:1
- 交互元素: 至少 3:1

### 焦点可见
- 使用 `outline: 2px solid var(--jd-primary)`
- 偏移 2px: `outline-offset: 2px`

### ARIA 标签
- 所有图标按钮添加 `title` 属性
- 表单元素添加关联标签
- 状态变化使用 ARIA live regions

### 键盘导航
- 所有交互元素可 Tab 访问
- 合理的 Tab 顺序
- Escape 关闭模态/面板
