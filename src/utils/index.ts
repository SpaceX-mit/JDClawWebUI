// JDClawWebUI Utilities

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 格式化时间戳
 */
export function formatTime(timestamp: number, locale = 'zh-CN'): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 格式化日期
 */
export function formatDate(timestamp: number, locale = 'zh-CN'): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  if (diff < week) return `${Math.floor(diff / day)}天前`;
  
  return formatDate(timestamp);
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 深拷贝
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (obj instanceof Object) {
    const clonedObj: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * 简易 Markdown 解析
 */
export function parseMarkdown(text: string): string {
  let html = text;
  
  // 转义 HTML
  html = html.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');
  
  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  
  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // 粗体和斜体
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  // 列表
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // 换行
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

/**
 * 提取文本中的纯文本（去除 Markdown 格式）
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '') // 代码块
    .replace(/`[^`]+`/g, '') // 行内代码
    .replace(/\*\*([^*]+)\*\*/g, '$1') // 粗体
    .replace(/\*([^*]+)\*/g, '$1') // 斜体
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接
    .replace(/^#+\s*/gm, '') // 标题
    .replace(/^\s*[-*]\s*/gm, '') // 列表
    .trim();
}

/**
 * 本地存储工具
 */
export const storage = {
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue ?? null;
    } catch {
      return defaultValue ?? null;
    }
  },
  
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage set error:', e);
    }
  },
  
  remove(key: string): void {
    localStorage.removeItem(key);
  },
  
  clear(): void {
    localStorage.clear();
  }
};

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

/**
 * 下载文本为文件
 */
export function downloadTextFile(text: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 导出对话为 Markdown
 */
export function exportChatToMarkdown(messages: Array<{ role: string; content: string; timestamp: number }>): string {
  const lines = ['# 对话记录\n'];
  
  for (const msg of messages) {
    const time = formatTime(msg.timestamp);
    const role = msg.role === 'user' ? '用户' : '助手';
    lines.push(`\n## ${role} - ${time}\n`);
    lines.push(msg.content);
  }
  
  return lines.join('\n');
}
