import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export interface ApprovalDialogOptions {
  toolName: string;
  toolArgs: Record<string, unknown>;
  command?: string;
  expiresAt: number;
}

@customElement('jd-approval-dialog')
export class JdApprovalDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 10001;
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      animation: fadeIn 0.15s ease-out;
    }

    .dialog-wrapper {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .dialog {
      position: relative;
      width: 100%;
      max-width: 520px;
      background: var(--bg-tertiary, #1a1a24);
      border: 1px solid var(--border, #27272a);
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      animation: scaleIn 0.15s ease-out;
    }
    .dialog-title {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary, #f4f4f5);
    }

    .tool-name {
      display: inline-block;
      padding: 4px 10px;
      background: rgba(138, 190, 36, 0.15);
      color: var(--accent, #8abe24);
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .command-block {
      background: #111118;
      border: 1px solid var(--border, #27272a);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      overflow-x: auto;
    }

    .command-block code {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 13px;
      color: #e2e8f0;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .args-block {
      background: #111118;
      border: 1px solid var(--border, #27272a);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      max-height: 200px;
      overflow-y: auto;
    }

    .args-block pre {
      margin: 0;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
      color: #a1a1aa;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .countdown {
      font-size: 13px;
      color: var(--text-secondary, #a1a1aa);
      margin-bottom: 16px;
    }

    .countdown .time {
      font-weight: 600;
      color: var(--text-primary, #f4f4f5);
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    button {
      padding: 8px 18px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--border, #27272a);
      transition: background 0.15s, opacity 0.15s;
    }

    .btn-reject {
      background: var(--danger, #ef4444);
      color: #fff;
      border: none;
    }
    .btn-reject:hover { opacity: 0.85; }

    .btn-approve {
      background: var(--accent, #8abe24);
      color: #1a1a2e;
      border: none;
    }
    .btn-approve:hover { opacity: 0.85; }

    :host(.closing) .backdrop { animation: fadeOut 0.12s ease-in forwards; }
    :host(.closing) .dialog   { animation: scaleOut 0.12s ease-in forwards; }

    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes scaleIn {
      from { transform: scale(0.92); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
    @keyframes scaleOut {
      from { transform: scale(1);    opacity: 1; }
      to   { transform: scale(0.92); opacity: 0; }
    }
  `;

  @property({ type: String }) toolName = '';
  @property({ type: Object }) toolArgs: Record<string, unknown> = {};
  @property({ type: String }) command = '';
  @property({ type: Number }) expiresAt = 0;

  @state() private _open = false;
  @state() private _remaining = 0;

  private _resolve: ((approved: boolean) => void) | null = null;
  private _timer: ReturnType<typeof setInterval> | null = null;

  open(): Promise<boolean> {
    this._open = true;
    this._startCountdown();
    return new Promise<boolean>((resolve) => {
      this._resolve = resolve;
    });
  }
  private _startCountdown() {
    this._updateRemaining();
    this._timer = setInterval(() => {
      this._updateRemaining();
      if (this._remaining <= 0) {
        this._close(false);
      }
    }, 1000);
  }

  private _updateRemaining() {
    this._remaining = Math.max(0, Math.ceil((this.expiresAt - Date.now()) / 1000));
  }

  private _close(approved: boolean) {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.dispatchEvent(new CustomEvent('approval-resolve', {
      detail: { approved },
      bubbles: true,
      composed: true,
    }));
    this.classList.add('closing');
    setTimeout(() => {
      this._open = false;
      this.classList.remove('closing');
      if (this._resolve) {
        this._resolve(approved);
        this._resolve = null;
      }
      this.remove();
    }, 120);
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this._close(false);
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  render() {
    if (!this._open) return nothing;

    const argsJson = JSON.stringify(this.toolArgs, null, 2);

    return html`
      <div class="backdrop" @click=${() => this._close(false)}></div>
      <div class="dialog-wrapper" @click=${(e: Event) => e.stopPropagation()}>
        <div class="dialog">
          <h2 class="dialog-title">工具执行审批</h2>
          <div class="tool-name">${this.toolName}</div>
          ${this.command ? html`
            <div class="command-block"><code>${this.command}</code></div>
          ` : nothing}
          <div class="args-block"><pre>${argsJson}</pre></div>
          <div class="countdown">
            剩余时间: <span class="time">${this._remaining}s</span>
          </div>
          <div class="dialog-actions">
            <button class="btn-reject" @click=${() => this._close(false)}>拒绝</button>
            <button class="btn-approve" @click=${() => this._close(true)}>允许</button>
          </div>
        </div>
      </div>
    `;
  }

  static show(options: ApprovalDialogOptions): Promise<boolean> {
    const el = document.createElement('jd-approval-dialog') as JdApprovalDialog;
    el.toolName = options.toolName;
    el.toolArgs = options.toolArgs;
    if (options.command) el.command = options.command;
    el.expiresAt = options.expiresAt;
    document.body.appendChild(el);
    return el.open();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-approval-dialog': JdApprovalDialog;
  }
}
