import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CronJob, CronStatus, CronRunLogEntry, CronSchedule, CronPayload } from '../types/index.js';

type SendRequestFn = (method: string, params: Record<string, unknown>) => string | null;

@customElement('jd-cron-page')
export class JdCronPage extends LitElement {
  createRenderRoot() { return this; }

  @property({ attribute: false }) sendRequest: SendRequestFn = () => null;

  @state() private status: CronStatus | null = null;
  @state() private jobs: CronJob[] = [];
  @state() private loading = false;
  @state() private showForm = false;
  @state() private editingJob: CronJob | null = null;
  @state() private runs: CronRunLogEntry[] = [];
  @state() private runsJobId: string | null = null;
  @state() private runsLoading = false;

  // Form state
  @state() private formName = '';
  @state() private formDescription = '';
  @state() private formEnabled = true;
  @state() private formScheduleKind: 'at' | 'every' | 'cron' = 'cron';
  @state() private formScheduleAt = '';
  @state() private formEveryMs = 3600000;
  @state() private formCronExpr = '0 * * * *';
  @state() private formCronTz = '';
  @state() private formPayloadKind: 'systemEvent' | 'agentTurn' = 'agentTurn';
  @state() private formPayloadText = '';
  @state() private formSessionTarget = 'main';
  @state() private formWakeMode: 'now' | 'next-heartbeat' = 'now';

  // Pending request tracking
  private pendingMethods = new Map<string, string>();

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  // PLACEHOLDER_METHODS

  private async loadData() {
    this.loading = true;
    this.sendRequest('cron.status', {});
    this.sendRequest('cron.list', { includeDisabled: true });
    this.loading = false;
  }

  handleResponse(method: string, payload: Record<string, unknown>) {
    if (method === 'cron.status') {
      this.status = {
        enabled: payload.enabled === true,
        jobs: typeof payload.jobs === 'number' ? payload.jobs : 0,
        nextWakeAtMs: typeof payload.nextWakeAtMs === 'number' ? payload.nextWakeAtMs : null,
      };
    } else if (method === 'cron.list') {
      const raw = Array.isArray(payload.jobs) ? payload.jobs : [];
      this.jobs = raw as CronJob[];
      this.loading = false;
    } else if (method === 'cron.runs') {
      const raw = Array.isArray(payload.entries) ? payload.entries : [];
      this.runs = raw as CronRunLogEntry[];
      this.runsLoading = false;
    } else if (method === 'cron.add' || method === 'cron.update') {
      this.showForm = false;
      this.editingJob = null;
      this.resetForm();
      this.loadData();
    } else if (method === 'cron.remove') {
      this.loadData();
    } else if (method === 'cron.run') {
      this.loadData();
    }
  }

  private resetForm() {
    this.formName = '';
    this.formDescription = '';
    this.formEnabled = true;
    this.formScheduleKind = 'cron';
    this.formScheduleAt = '';
    this.formEveryMs = 3600000;
    this.formCronExpr = '0 * * * *';
    this.formCronTz = '';
    this.formPayloadKind = 'agentTurn';
    this.formPayloadText = '';
    this.formSessionTarget = 'main';
    this.formWakeMode = 'now';
  }

  private startCreate() {
    this.resetForm();
    this.editingJob = null;
    this.showForm = true;
  }

  private startEdit(job: CronJob) {
    this.editingJob = job;
    this.formName = job.name;
    this.formDescription = job.description || '';
    this.formEnabled = job.enabled;
    this.formSessionTarget = job.sessionTarget;
    this.formWakeMode = job.wakeMode;
    this.formPayloadKind = job.payload.kind;
    this.formPayloadText = job.payload.kind === 'agentTurn' ? job.payload.message : job.payload.text;

    if (job.schedule.kind === 'at') {
      this.formScheduleKind = 'at';
      this.formScheduleAt = job.schedule.at;
    } else if (job.schedule.kind === 'every') {
      this.formScheduleKind = 'every';
      this.formEveryMs = job.schedule.everyMs;
    } else {
      this.formScheduleKind = 'cron';
      this.formCronExpr = job.schedule.expr;
      this.formCronTz = job.schedule.tz || '';
    }
    this.showForm = true;
  }

  private handleSubmit() {
    if (!this.formName.trim()) return;

    const schedule: CronSchedule =
      this.formScheduleKind === 'at' ? { kind: 'at', at: this.formScheduleAt }
      : this.formScheduleKind === 'every' ? { kind: 'every', everyMs: this.formEveryMs }
      : { kind: 'cron', expr: this.formCronExpr, ...(this.formCronTz ? { tz: this.formCronTz } : {}) };

    const payload: CronPayload =
      this.formPayloadKind === 'agentTurn'
        ? { kind: 'agentTurn', message: this.formPayloadText }
        : { kind: 'systemEvent', text: this.formPayloadText };

    if (this.editingJob) {
      this.sendRequest('cron.update', {
        id: this.editingJob.id,
        patch: { name: this.formName, description: this.formDescription, enabled: this.formEnabled, schedule, payload, sessionTarget: this.formSessionTarget, wakeMode: this.formWakeMode },
      });
    } else {
      this.sendRequest('cron.add', {
        name: this.formName, description: this.formDescription, enabled: this.formEnabled,
        schedule, payload, sessionTarget: this.formSessionTarget, wakeMode: this.formWakeMode,
      });
    }
  }

  private handleToggle(job: CronJob) {
    this.sendRequest('cron.update', { id: job.id, patch: { enabled: !job.enabled } });
  }

  private handleRun(job: CronJob) {
    this.sendRequest('cron.run', { id: job.id, mode: 'force' });
  }

  private handleRemove(job: CronJob) {
    if (confirm(`确定删除任务 "${job.name}"？`)) {
      this.sendRequest('cron.remove', { id: job.id });
    }
  }

  private handleShowRuns(jobId: string) {
    this.runsJobId = this.runsJobId === jobId ? null : jobId;
    if (this.runsJobId) {
      this.runsLoading = true;
      this.runs = [];
      this.sendRequest('cron.runs', { id: jobId, scope: 'job', limit: 20 });
    }
  }

  // PLACEHOLDER_FORMAT

  private fmtSchedule(s: CronSchedule): string {
    if (s.kind === 'at') return `一次性: ${new Date(s.at).toLocaleString('zh-CN')}`;
    if (s.kind === 'every') {
      const sec = s.everyMs / 1000;
      if (sec < 60) return `每 ${sec} 秒`;
      if (sec < 3600) return `每 ${Math.round(sec / 60)} 分钟`;
      return `每 ${Math.round(sec / 3600)} 小时`;
    }
    return `cron: ${s.expr}${s.tz ? ` (${s.tz})` : ''}`;
  }

  private fmtTime(ms: number | undefined): string {
    if (!ms) return '-';
    return new Date(ms).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private fmtDuration(ms: number | undefined): string {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  private statusBadge(s?: string) {
    if (s === 'ok') return html`<span class="cron-badge cron-badge--ok">成功</span>`;
    if (s === 'error') return html`<span class="cron-badge cron-badge--error">错误</span>`;
    if (s === 'skipped') return html`<span class="cron-badge cron-badge--skip">跳过</span>`;
    return html`<span class="cron-badge">-</span>`;
  }

  // PLACEHOLDER_RENDER

  private renderForm() {
    return html`
      <div class="cron-form-overlay" @click=${(e: Event) => { if ((e.target as HTMLElement).classList.contains('cron-form-overlay')) this.showForm = false; }}>
        <div class="cron-form">
          <h3>${this.editingJob ? '编辑任务' : '新建任务'}</h3>
          <label>名称 <input type="text" .value=${this.formName} @input=${(e: Event) => this.formName = (e.target as HTMLInputElement).value} /></label>
          <label>描述 <input type="text" .value=${this.formDescription} @input=${(e: Event) => this.formDescription = (e.target as HTMLInputElement).value} /></label>
          <label>启用 <input type="checkbox" .checked=${this.formEnabled} @change=${(e: Event) => this.formEnabled = (e.target as HTMLInputElement).checked} /></label>
          <fieldset>
            <legend>调度方式</legend>
            <div class="cron-form__radio-row">
              ${(['cron', 'every', 'at'] as const).map(k => html`
                <label><input type="radio" name="schedKind" .checked=${this.formScheduleKind === k} @change=${() => this.formScheduleKind = k} /> ${k === 'cron' ? 'Cron 表达式' : k === 'every' ? '固定间隔' : '一次性'}</label>
              `)}
            </div>
            ${this.formScheduleKind === 'cron' ? html`
              <label>表达式 <input type="text" .value=${this.formCronExpr} @input=${(e: Event) => this.formCronExpr = (e.target as HTMLInputElement).value} placeholder="0 * * * *" /></label>
              <label>时区 <input type="text" .value=${this.formCronTz} @input=${(e: Event) => this.formCronTz = (e.target as HTMLInputElement).value} placeholder="Asia/Shanghai (可选)" /></label>
            ` : this.formScheduleKind === 'every' ? html`
              <label>间隔 (毫秒) <input type="number" .value=${String(this.formEveryMs)} @input=${(e: Event) => this.formEveryMs = Number((e.target as HTMLInputElement).value)} /></label>
            ` : html`
              <label>执行时间 <input type="datetime-local" .value=${this.formScheduleAt} @input=${(e: Event) => this.formScheduleAt = (e.target as HTMLInputElement).value} /></label>
            `}
          </fieldset>
          <fieldset>
            <legend>任务内容</legend>
            <div class="cron-form__radio-row">
              <label><input type="radio" name="payloadKind" .checked=${this.formPayloadKind === 'agentTurn'} @change=${() => this.formPayloadKind = 'agentTurn'} /> Agent 消息</label>
              <label><input type="radio" name="payloadKind" .checked=${this.formPayloadKind === 'systemEvent'} @change=${() => this.formPayloadKind = 'systemEvent'} /> 系统事件</label>
            </div>
            <label>${this.formPayloadKind === 'agentTurn' ? '消息' : '事件文本'}
              <textarea rows="3" .value=${this.formPayloadText} @input=${(e: Event) => this.formPayloadText = (e.target as HTMLTextAreaElement).value}></textarea>
            </label>
          </fieldset>
          <label>会话目标
            <select .value=${this.formSessionTarget} @change=${(e: Event) => this.formSessionTarget = (e.target as HTMLSelectElement).value}>
              <option value="main">主会话</option>
              <option value="isolated">隔离会话</option>
              <option value="current">当前会话</option>
            </select>
          </label>
          <div class="cron-form__actions">
            <button class="btn btn--secondary" @click=${() => this.showForm = false}>取消</button>
            <button class="btn btn--primary" @click=${() => this.handleSubmit()} ?disabled=${!this.formName.trim()}>
              ${this.editingJob ? '保存' : '创建'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderRuns() {
    if (!this.runsJobId) return nothing;
    return html`
      <div class="cron-runs">
        <div class="cron-runs__header">
          <h4>执行记录</h4>
          <button class="btn btn--ghost btn--sm" @click=${() => this.runsJobId = null}>关闭</button>
        </div>
        ${this.runsLoading ? html`<div class="cron-runs__loading">加载中...</div>` : nothing}
        ${this.runs.length === 0 && !this.runsLoading ? html`<div class="cron-runs__empty">暂无执行记录</div>` : nothing}
        ${this.runs.map(r => html`
          <div class="cron-run-item">
            <span class="cron-run-item__time">${this.fmtTime(r.ts)}</span>
            ${this.statusBadge(r.status)}
            <span class="cron-run-item__duration">${this.fmtDuration(r.durationMs)}</span>
            ${r.error ? html`<span class="cron-run-item__error">${r.error}</span>` : nothing}
            ${r.summary ? html`<span class="cron-run-item__summary">${r.summary}</span>` : nothing}
          </div>
        `)}
      </div>
    `;
  }

  render() {
    return html`
      <div class="jd-cron-page">
        <div class="cron-header">
          <h2>定时任务</h2>
          <div class="cron-header__actions">
            <button class="btn btn--secondary btn--sm" @click=${() => this.loadData()}>刷新</button>
            <button class="btn btn--primary btn--sm" @click=${() => this.startCreate()}>新建任务</button>
          </div>
        </div>

        ${this.status ? html`
          <div class="cron-status-bar">
            <span class="cron-badge ${this.status.enabled ? 'cron-badge--ok' : 'cron-badge--error'}">
              ${this.status.enabled ? '已启用' : '已禁用'}
            </span>
            <span>${this.status.jobs} 个任务</span>
            ${this.status.nextWakeAtMs ? html`<span>下次唤醒: ${this.fmtTime(this.status.nextWakeAtMs)}</span>` : nothing}
          </div>
        ` : nothing}

        ${this.loading ? html`<div class="cron-loading">加载中...</div>` : nothing}

        ${this.jobs.length === 0 && !this.loading ? html`
          <div class="cron-empty">暂无定时任务</div>
        ` : nothing}

        <div class="cron-job-list">
          ${this.jobs.map(job => html`
            <div class="cron-job-card ${job.enabled ? '' : 'disabled'}">
              <div class="cron-job-card__main">
                <div class="cron-job-card__info">
                  <div class="cron-job-card__name">${job.name}</div>
                  ${job.description ? html`<div class="cron-job-card__desc">${job.description}</div>` : nothing}
                  <div class="cron-job-card__meta">
                    <span>${this.fmtSchedule(job.schedule)}</span>
                    ${job.state?.nextRunAtMs ? html`<span>下次: ${this.fmtTime(job.state.nextRunAtMs)}</span>` : nothing}
                    ${job.state?.lastRunStatus ? html`<span>上次: ${this.statusBadge(job.state.lastRunStatus)} ${this.fmtDuration(job.state.lastDurationMs)}</span>` : nothing}
                  </div>
                </div>
                <div class="cron-job-card__actions">
                  <button class="btn btn--ghost btn--sm" @click=${() => this.handleToggle(job)} title="${job.enabled ? '禁用' : '启用'}">
                    ${job.enabled ? '禁用' : '启用'}
                  </button>
                  <button class="btn btn--ghost btn--sm" @click=${() => this.handleRun(job)} title="立即执行">运行</button>
                  <button class="btn btn--ghost btn--sm" @click=${() => this.handleShowRuns(job.id)} title="执行记录">记录</button>
                  <button class="btn btn--ghost btn--sm" @click=${() => this.startEdit(job)} title="编辑">编辑</button>
                  <button class="btn btn--ghost btn--sm" @click=${() => this.handleRemove(job)} title="删除" style="color:var(--danger)">删除</button>
                </div>
              </div>
              ${job.state?.lastError ? html`<div class="cron-job-card__error">${job.state.lastError}</div>` : nothing}
            </div>
          `)}
        </div>

        ${this.renderRuns()}
        ${this.showForm ? this.renderForm() : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jd-cron-page': JdCronPage;
  }
}


