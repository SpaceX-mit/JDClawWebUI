import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { AppSettings, Theme } from '../types/index.js';
import { loadSettings, saveSettings } from '../utils/settings.js';

@customElement('jd-settings-panel')
export class JdSettingsPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 24px;
      color: var(--text-primary, #1a1a2e);
      max-width: 600px;
      margin: 0 auto;
    }

    h2 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 24px;
    }

    .settings-group {
      margin-bottom: 24px;
    }

    .settings-group-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted, #8c8c9a);
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid var(--border, #e8e8ec);
    }

    .setting-label {
      font-size: 14px;
      font-weight: 500;
    }

    .setting-description {
      font-size: 12px;
      color: var(--text-muted, #8c8c9a);
      margin-top: 2px;
    }

    .radio-group {
      display: flex;
      gap: 8px;
    }

    .radio-btn {
      padding: 6px 14px;
      border: 1px solid var(--border, #e8e8ec);
      border-radius: 8px;
      background: var(--bg-tertiary, #f0f0f2);
      color: var(--text-primary, #1a1a2e);
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s;
    }

    .radio-btn:hover {
      border-color: var(--accent, #8abe24);
    }

    .radio-btn.active {
      background: var(--accent, #8abe24);
      color: #1a1a2e;
      border-color: var(--accent, #8abe24);
    }

    select, input[type="text"] {
      padding: 8px 12px;
      border: 1px solid var(--border, #e8e8ec);
      border-radius: 8px;
      background: var(--bg-tertiary, #f0f0f2);
      color: var(--text-primary, #1a1a2e);
      font-size: 14px;
      font-family: inherit;
      min-width: 200px;
    }

    select:focus, input[type="text"]:focus {
      outline: none;
      border-color: var(--accent, #8abe24);
    }
  `;

  @state() private settings: AppSettings = loadSettings();

  private emitChange(key: keyof AppSettings, value: string) {
    this.settings = { ...this.settings, [key]: value };
    saveSettings({ [key]: value });
    this.dispatchEvent(new CustomEvent('settings-change', {
      detail: { key, value },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      <h2>设置</h2>

      <div class="settings-group">
        <div class="settings-group-title">外观</div>

        <div class="setting-row">
          <div>
            <div class="setting-label">主题</div>
            <div class="setting-description">选择界面主题</div>
          </div>
          <div class="radio-group">
            ${(['dark', 'light', 'auto'] as Theme[]).map(t => html`
              <button
                class="radio-btn ${this.settings.theme === t ? 'active' : ''}"
                @click=${() => this.emitChange('theme', t)}
              >${t === 'dark' ? '深色' : t === 'light' ? '浅色' : '自动'}</button>
            `)}
          </div>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">字体大小</div>
          </div>
          <div class="radio-group">
            ${(['small', 'medium', 'large'] as const).map(s => html`
              <button
                class="radio-btn ${this.settings.fontSize === s ? 'active' : ''}"
                @click=${() => this.emitChange('fontSize', s)}
              >${s === 'small' ? '小' : s === 'medium' ? '中' : '大'}</button>
            `)}
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">语言与连接</div>

        <div class="setting-row">
          <div>
            <div class="setting-label">语言</div>
          </div>
          <select
            .value=${this.settings.language}
            @change=${(e: Event) => this.emitChange('language', (e.target as HTMLSelectElement).value)}
          >
            <option value="zh-CN">中文</option>
            <option value="en">English</option>
          </select>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Gateway 地址</div>
            <div class="setting-description">WebSocket 网关连接地址</div>
          </div>
          <input
            type="text"
            .value=${this.settings.gatewayUrl}
            @change=${(e: Event) => this.emitChange('gatewayUrl', (e.target as HTMLInputElement).value)}
          />
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-settings-panel': JdSettingsPanel;
  }
}
