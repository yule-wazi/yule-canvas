import { BrowserContext, Page, chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export type RecordingMode = 'action' | 'mark';

export interface RecordingElementMeta {
  tagName?: string;
  text?: string;
  id?: string;
  className?: string;
  href?: string;
  src?: string;
  value?: string;
}

export interface RecordingEvent {
  id: string;
  kind: 'action' | 'mark';
  action: 'navigate' | 'click' | 'type' | 'select' | 'scroll' | 'back' | 'forward' | 'field-mark';
  timestamp: number;
  pageId: string;
  url: string;
  title?: string;
  selector?: string;
  value?: string;
  fieldName?: string;
  fieldType?: 'text' | 'image' | 'video' | 'link' | 'custom';
  elementMeta?: RecordingElementMeta;
}

export interface RecordingMarkRequest {
  pageId: string;
  url: string;
  title?: string;
  selector: string;
  elementMeta?: RecordingElementMeta;
}

interface BrowserRecorderCallbacks {
  onStatus?: (status: { state: string; message: string; mode?: RecordingMode }) => void;
  onEvent?: (event: RecordingEvent) => void;
  onMarkRequest?: (request: RecordingMarkRequest) => void;
}

export interface RecordingPageHistoryState {
  entries: string[];
  index: number;
}

const RECORDER_INIT_SCRIPT = `
(() => {
  if (window.__aibrowserRecorderInstalled) return;
  window.__aibrowserRecorderInstalled = true;

  const state = {
    mode: 'action',
    scrollTimer: null
  };

  const preferredAttributes = ['data-testid', 'data-test', 'data-qa', 'data-cy', 'aria-label', 'name'];

  function emit(payload) {
    if (typeof window.__aibrowserRecorderEmit === 'function') {
      window.__aibrowserRecorderEmit(payload);
    }
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => '\\\\' + char);
  }

  function truncate(text, maxLength) {
    if (!text) return '';
    const compact = String(text).replace(/\\s+/g, ' ').trim();
    return compact.length > maxLength ? compact.slice(0, maxLength) : compact;
  }

  function escapeAttributeValue(value) {
    return String(value).replace(/"/g, '\\\\\"');
  }

  function isUnique(selector) {
    if (!selector) return false;
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (error) {
      return false;
    }
  }

  function getActionTarget(element) {
    if (!(element instanceof Element)) return null;
    return element.closest('a, button, input, textarea, select, option, [role="button"], [role="link"], [contenteditable="true"], [onclick]') || element;
  }

  function getMarkTarget(element) {
    return element instanceof Element ? element : null;
  }

  function buildClassSelector(element) {
    if (!element.classList || !element.classList.length) return '';
    const classNames = Array.from(element.classList)
      .filter((className) => className && !className.startsWith('vue-'))
      .slice(0, 3)
      .map((className) => '.' + cssEscape(className));
    if (!classNames.length) return '';
    const selector = element.tagName.toLowerCase() + classNames.join('');
    return isUnique(selector) ? selector : '';
  }

  function buildPathSelector(element) {
    const parts = [];
    let current = element;
    let depth = 0;

    while (current && current.nodeType === Node.ELEMENT_NODE && depth < 6) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part += '#' + cssEscape(current.id);
        parts.unshift(part);
        return parts.join(' > ');
      }

      const stableClasses = current.classList
        ? Array.from(current.classList).filter(Boolean).slice(0, 2).map((className) => '.' + cssEscape(className))
        : [];

      if (stableClasses.length) {
        part += stableClasses.join('');
      }

      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children).filter((sibling) => sibling.tagName === current.tagName);
        if (siblings.length > 1) {
          part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
        }
      }

      parts.unshift(part);
      const selector = parts.join(' > ');
      if (isUnique(selector)) return selector;
      current = current.parentElement;
      depth += 1;
    }

    return parts.join(' > ');
  }

  function buildSelector(element) {
    if (!(element instanceof Element)) return '';

    if (element.id) {
      const idSelector = '#' + cssEscape(element.id);
      if (isUnique(idSelector)) return idSelector;
    }

    for (const attributeName of preferredAttributes) {
      const attributeValue = element.getAttribute(attributeName);
      if (!attributeValue) continue;
      const selector = '[' + attributeName + '="' + escapeAttributeValue(attributeValue) + '"]';
      if (isUnique(selector)) return selector;
    }

    const classSelector = buildClassSelector(element);
    if (classSelector) return classSelector;
    return buildPathSelector(element);
  }

  function getElementMeta(element) {
    if (!(element instanceof Element)) return {};
    return {
      tagName: element.tagName.toLowerCase(),
      text: truncate(element.textContent || '', 160),
      id: element.id || '',
      className: typeof element.className === 'string' ? truncate(element.className, 120) : '',
      href: element.getAttribute('href') || '',
      src: element.getAttribute('src') || '',
      value: 'value' in element ? truncate(element.value || '', 160) : ''
    };
  }

  function emitAction(action, element, extra) {
    emit({
      kind: 'action',
      action,
      selector: buildSelector(element),
      url: window.location.href,
      title: document.title,
      elementMeta: getElementMeta(element),
      ...extra
    });
  }

  document.addEventListener('click', (event) => {
    const rawTarget = event.target;
    const target = state.mode === 'mark' ? getMarkTarget(rawTarget) : getActionTarget(rawTarget);
    if (!target) return;

    if (state.mode === 'mark') {
      emit({
        kind: 'mark-request',
        request: {
          pageId: '',
          url: window.location.href,
          title: document.title,
          selector: buildSelector(target),
          elementMeta: getElementMeta(target)
        }
      });
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    emitAction('click', target);
  }, true);

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target instanceof HTMLSelectElement) {
      emitAction('select', target, { value: target.value });
      return;
    }

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      emitAction('type', target, { value: target.value });
    }
  }, true);

  window.addEventListener('scroll', () => {
    if (state.scrollTimer) clearTimeout(state.scrollTimer);
    state.scrollTimer = setTimeout(() => {
      emitAction('scroll', document.documentElement, {
        value: JSON.stringify({ x: window.scrollX, y: window.scrollY }),
        selector: ''
      });
    }, 200);
  }, true);

  window.__aibrowserRecorder = {
    setMode(mode) {
      state.mode = mode === 'mark' ? 'mark' : 'action';
    }
  };
})();
`;

export function createRecordedMarkEvent(
  request: RecordingMarkRequest,
  payload: {
    fieldName: string;
    fieldType: RecordingEvent['fieldType'];
  }
): RecordingEvent {
  return {
    id: `record-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'mark',
    action: 'field-mark',
    timestamp: Date.now(),
    pageId: request.pageId,
    url: request.url,
    title: request.title,
    selector: request.selector,
    fieldName: payload.fieldName,
    fieldType: payload.fieldType,
    elementMeta: request.elementMeta
  };
}

export function classifyRecordedNavigation(
  previousState: RecordingPageHistoryState | undefined,
  url: string
): { action: RecordingEvent['action']; nextState: RecordingPageHistoryState } {
  const historyState: RecordingPageHistoryState = previousState
    ? { entries: [...previousState.entries], index: previousState.index }
    : { entries: [], index: -1 };

  if (historyState.index > 0 && historyState.entries[historyState.index - 1] === url) {
    historyState.index -= 1;
    return { action: 'back', nextState: historyState };
  }

  if (
    historyState.index >= 0 &&
    historyState.index < historyState.entries.length - 1 &&
    historyState.entries[historyState.index + 1] === url
  ) {
    historyState.index += 1;
    return { action: 'forward', nextState: historyState };
  }

  if (historyState.index === -1 || historyState.entries[historyState.index] !== url) {
    historyState.entries = historyState.entries.slice(0, historyState.index + 1);
    historyState.entries.push(url);
    historyState.index = historyState.entries.length - 1;
  }

  return { action: 'navigate', nextState: historyState };
}

export class BrowserRecorder {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private callbacks: BrowserRecorderCallbacks;
  private mode: RecordingMode = 'action';
  private stopRequested = false;
  private pageIds = new WeakMap<Page, string>();
  private lastUrls = new WeakMap<Page, string>();
  private pageHistory = new WeakMap<Page, RecordingPageHistoryState>();
  private currentStatusMessage = '录制已启动，请开始操作';
  private eventSequence = 0;

  constructor(callbacks: BrowserRecorderCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async start(options: { startUrl?: string } = {}): Promise<void> {
    this.stopRequested = false;
    this.currentStatusMessage = '正在启动录制浏览器...';
    this.callbacks.onStatus?.({ state: 'starting', message: this.currentStatusMessage, mode: this.mode });

    await this.launchBrowser();
    if (!this.context) {
      throw new Error('录制浏览器上下文初始化失败');
    }

    await this.context.exposeBinding('__aibrowserRecorderEmit', async (source, payload: any) => {
      const page = source.page as Page | undefined;
      await this.handleBrowserPayload(page, payload);
    });
    await this.context.addInitScript({ content: RECORDER_INIT_SCRIPT });

    this.context.on('page', page => {
      this.attachPage(page).catch(error => {
        console.error('附加录制页面失败:', error);
      });
    });

    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
    await this.attachPage(this.page);

    if (options.startUrl?.trim()) {
      await this.page.goto(options.startUrl.trim(), { waitUntil: 'domcontentloaded' });
    }

    this.currentStatusMessage = '录制已开始，请在新浏览器中操作目标网站';
    this.callbacks.onStatus?.({ state: 'started', message: this.currentStatusMessage, mode: this.mode });
  }

  async setMode(mode: RecordingMode): Promise<void> {
    this.mode = mode;
    this.currentStatusMessage =
      mode === 'mark'
        ? '已切换到标注模式，点击页面元素即可标注字段'
        : '已切换到动作录制模式';

    if (this.context) {
      await Promise.all(this.context.pages().map(page => this.syncPageMode(page)));
    }

    this.callbacks.onStatus?.({ state: 'mode-changed', message: this.currentStatusMessage, mode });
  }

  async confirmMark(
    request: RecordingMarkRequest,
    payload: { fieldName: string; fieldType: RecordingEvent['fieldType'] }
  ): Promise<void> {
    const event = createRecordedMarkEvent(request, payload);
    this.callbacks.onEvent?.(event);
    this.currentStatusMessage = `已标注字段 ${payload.fieldName}`;
    this.callbacks.onStatus?.({ state: 'mark-saved', message: this.currentStatusMessage, mode: this.mode });
  }

  async stop(): Promise<void> {
    if (this.stopRequested) return;
    this.stopRequested = true;
    await this.cleanup();
    this.currentStatusMessage = '录制已停止';
    this.callbacks.onStatus?.({ state: 'stopped', message: this.currentStatusMessage, mode: this.mode });
  }

  private async handleBrowserPayload(page: Page | undefined, payload: any): Promise<void> {
    if (this.stopRequested || !page || !payload || typeof payload !== 'object') {
      return;
    }

    const pageId = this.ensurePageId(page);

    if (payload.kind === 'mark-request') {
      this.callbacks.onMarkRequest?.({
        pageId,
        url: payload.request?.url || page.url(),
        title: payload.request?.title || '',
        selector: payload.request?.selector || '',
        elementMeta: payload.request?.elementMeta || {}
      });
      return;
    }

    if (payload.kind !== 'action') {
      return;
    }

    const event: RecordingEvent = {
      id: this.nextEventId(),
      kind: 'action',
      action: payload.action,
      timestamp: Date.now(),
      pageId,
      url: typeof payload.url === 'string' ? payload.url : page.url(),
      title: typeof payload.title === 'string' ? payload.title : '',
      selector: typeof payload.selector === 'string' ? payload.selector : '',
      value: typeof payload.value === 'string' ? payload.value : '',
      elementMeta: payload.elementMeta || {}
    };

    this.callbacks.onEvent?.(event);
    this.currentStatusMessage = `已记录：${this.describeAction(event.action)}`;
    this.callbacks.onStatus?.({ state: 'event-recorded', message: this.currentStatusMessage, mode: this.mode });
  }

  private async attachPage(page: Page): Promise<void> {
    const pageId = this.ensurePageId(page);

    page.on('framenavigated', async frame => {
      if (this.stopRequested || frame !== page.mainFrame()) {
        return;
      }

      const url = page.url();
      if (!url || this.lastUrls.get(page) === url) {
        return;
      }
      this.lastUrls.set(page, url);

      let title = '';
      try {
        title = await page.title();
      } catch {
        title = '';
      }

      const action = this.resolveNavigationAction(page, url);
      const event: RecordingEvent = {
        id: this.nextEventId(),
        kind: 'action',
        action,
        timestamp: Date.now(),
        pageId,
        url,
        title
      };

      this.callbacks.onEvent?.(event);
      this.currentStatusMessage = `已记录：${this.describeAction(action)}`;
      this.callbacks.onStatus?.({ state: 'event-recorded', message: this.currentStatusMessage, mode: this.mode });
    });

    page.on('domcontentloaded', () => {
      this.syncPageMode(page).catch(() => null);
    });

    await this.syncPageMode(page);
  }

  private async syncPageMode(page: Page): Promise<void> {
    try {
      await page.evaluate((mode: RecordingMode) => {
        (globalThis as any).__aibrowserRecorder?.setMode(mode);
      }, this.mode);
    } catch {
      // Ignore pages that are not ready yet.
    }
  }

  private ensurePageId(page: Page): string {
    const existing = this.pageIds.get(page);
    if (existing) return existing;
    const pageId = `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.pageIds.set(page, pageId);
    return pageId;
  }

  private resolveNavigationAction(page: Page, url: string): RecordingEvent['action'] {
    const { action, nextState } = classifyRecordedNavigation(this.pageHistory.get(page), url);
    this.pageHistory.set(page, nextState);
    return action;
  }

  private nextEventId(): string {
    this.eventSequence += 1;
    return `record-${Date.now()}-${this.eventSequence}`;
  }

  private describeAction(action: RecordingEvent['action']): string {
    const labels: Record<RecordingEvent['action'], string> = {
      navigate: '访问页面',
      click: '点击元素',
      type: '输入文本',
      select: '选择下拉项',
      scroll: '滚动页面',
      back: '返回',
      forward: '前进',
      'field-mark': '标注字段'
    };
    return labels[action] || action;
  }

  private async launchBrowser(): Promise<void> {
    const chromePath = this.detectChromePath();
    const userDataDir = process.env.CHROME_USER_DATA || path.join(process.cwd(), 'chrome-data');
    const launchOptions: any = {
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    };

    if (chromePath) {
      launchOptions.executablePath = chromePath;
    } else {
      launchOptions.channel = 'chrome';
    }

    this.context = await chromium.launchPersistentContext(userDataDir, launchOptions);
  }

  private detectChromePath(): string | null {
    const possiblePaths = [
      process.env.CHROME_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
    ];

    for (const chromePath of possiblePaths) {
      if (chromePath && fs.existsSync(chromePath)) {
        return chromePath;
      }
    }

    return null;
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close().catch(() => null);
        this.page = null;
      }

      if (this.context) {
        await this.context.close().catch(() => null);
        this.context = null;
      }
    } catch (error) {
      console.error('清理录制资源失败:', error);
    }
  }
}
