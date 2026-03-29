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

export function shouldStopRecorderPanelWheel(targetInsidePanel: boolean): boolean {
  return targetInsidePanel;
}

export function shouldArmRecordedScroll(
  source: 'wheel' | 'touchmove' | 'keydown',
  targetInsidePanel: boolean,
  key?: string
): boolean {
  if (targetInsidePanel) {
    return false;
  }

  if (source === 'wheel' || source === 'touchmove') {
    return true;
  }

  return ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', 'Space', ' '].includes(key || '');
}

export function shouldRecordWindowScroll(lastScrollIntentAt: number, now: number, windowMs = 450): boolean {
  return lastScrollIntentAt > 0 && now - lastScrollIntentAt <= windowMs;
}

export function shouldIgnoreNavigationResetScroll(
  suppressNextZeroScroll: boolean,
  x: number,
  y: number
): boolean {
  return suppressNextZeroScroll && x === 0 && y === 0;
}

const RECORDER_INIT_SCRIPT = `
(() => {
  if (window.__aibrowserRecorderInstalled) return;
  window.__aibrowserRecorderInstalled = true;

  const ROOT_ID = '__aibrowser-recorder-root';
  const state = {
    mode: 'action',
    status: '录制已启动，请开始操作',
    events: [],
    scrollTimer: null,
    lastScrollIntentAt: 0,
    lastRecordedScrollX: window.scrollX,
    lastRecordedScrollY: window.scrollY,
    suppressNextZeroScroll: false
  };
  const preferredAttributes = ['data-testid', 'data-test', 'data-qa', 'data-cy', 'aria-label', 'name'];

  function emit(payload) {
    if (typeof window.__aibrowserRecorderEmit === 'function') {
      window.__aibrowserRecorderEmit(payload);
    }
  }

  function shouldStopPanelWheel(targetInsidePanel) {
    return !!targetInsidePanel;
  }

  function shouldArmScroll(source, targetInsidePanel, key) {
    if (targetInsidePanel) {
      return false;
    }

    if (source === 'wheel' || source === 'touchmove') {
      return true;
    }

    return ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', 'Space', ' '].includes(key || '');
  }

  function shouldRecordScroll(lastScrollIntentAt, now, windowMs = 450) {
    return lastScrollIntentAt > 0 && now - lastScrollIntentAt <= windowMs;
  }

  function shouldIgnoreZeroReset(suppressNextZeroScroll, x, y) {
    return !!suppressNextZeroScroll && x === 0 && y === 0;
  }


  function sendControl(payload) {
    if (typeof window.__aibrowserRecorderControl === 'function') {
      window.__aibrowserRecorderControl(payload);
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

  function isInsidePanel(element) {
    return element instanceof Element && !!element.closest('#' + ROOT_ID);
  }

  function getActionTarget(element) {
    if (!(element instanceof Element) || isInsidePanel(element)) return null;
    return element.closest('a, button, input, textarea, select, option, [role="button"], [role="link"], [contenteditable="true"], [onclick]') || element;
  }

  function getMarkTarget(element) {
    if (!(element instanceof Element) || isInsidePanel(element)) return null;
    return element;
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

  function formatTime(timestamp) {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch (error) {
      return '';
    }
  }

  function summarizeEvent(event) {
    const labels = {
      navigate: '访问页面',
      click: '点击元素',
      type: '输入文本',
      select: '选择下拉项',
      scroll: '滚动页面',
      back: '返回',
      forward: '前进',
      'field-mark': '字段标注'
    };
    return labels[event.action] || event.action || '未知事件';
  }

  function ensurePanel() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = [
      '<div class="__aibrowser-recorder-shell">',
      '  <div class="__aibrowser-recorder-header">',
      '    <div class="__aibrowser-recorder-title-wrap">',
      '      <div class="__aibrowser-recorder-title">录制事件</div>',
      '      <div class="__aibrowser-recorder-status" data-role="status"></div>',
      '    </div>',
      '    <div class="__aibrowser-recorder-actions">',
      '      <span class="__aibrowser-recorder-mode" data-role="mode">动作模式</span>',
      '      <button type="button" data-action="toggle-mode">切换标注模式</button>',
      '      <button type="button" data-action="stop" class="danger">停止录制</button>',
      '    </div>',
      '  </div>',
      '  <div class="__aibrowser-recorder-events" data-role="events"></div>',
      '</div>'
    ].join('');

    const style = document.createElement('style');
    style.textContent = [
      '#' + ROOT_ID + ' {',
      '  position: fixed;',
      '  right: 24px;',
      '  bottom: 24px;',
      '  z-index: 2147483647;',
      '  width: 420px;',
      '  min-width: 320px;',
      '  min-height: 220px;',
      '  max-width: min(520px, calc(100vw - 32px));',
      '  max-height: calc(100vh - 32px);',
      '  resize: both;',
      '  overflow: hidden;',
      '  border-radius: 16px;',
      '  border: 1px solid rgba(88, 166, 255, 0.32);',
      '  background: rgba(13, 17, 23, 0.96);',
      '  color: #e6edf3;',
      '  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '}',
      '#' + ROOT_ID + ' * { box-sizing: border-box; }',
      '#' + ROOT_ID + ' .__aibrowser-recorder-shell {',
      '  display: flex;',
      '  flex-direction: column;',
      '  width: 100%;',
      '  height: 100%;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-header {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: flex-start;',
      '  gap: 12px;',
      '  padding: 12px 14px;',
      '  border-bottom: 1px solid rgba(48, 54, 61, 0.92);',
      '  cursor: move;',
      '  user-select: none;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-title {',
      '  font-size: 20px;',
      '  font-weight: 700;',
      '  color: #58a6ff;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-status {',
      '  margin-top: 6px;',
      '  color: #8b949e;',
      '  font-size: 13px;',
      '  line-height: 1.45;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-actions {',
      '  display: flex;',
      '  gap: 8px;',
      '  align-items: flex-start;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mode {',
      '  padding: 8px 12px;',
      '  border-radius: 999px;',
      '  border: 1px solid #58a6ff;',
      '  color: #58a6ff;',
      '  background: rgba(88, 166, 255, 0.12);',
      '  white-space: nowrap;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mode.is-mark {',
      '  border-color: #a855f7;',
      '  color: #f0abfc;',
      '  background: rgba(168, 85, 247, 0.16);',
      '}',
      '#' + ROOT_ID + ' button {',
      '  border: none;',
      '  border-radius: 10px;',
      '  padding: 10px 12px;',
      '  cursor: pointer;',
      '  font-size: 14px;',
      '  color: white;',
      '  background: #1f6feb;',
      '}',
      '#' + ROOT_ID + ' button.danger { background: #da3633; }',
      '#' + ROOT_ID + ' .__aibrowser-recorder-events {',
      '  flex: 1;',
      '  overflow: auto;',
      '  padding: 0 14px 14px;',
      '  overscroll-behavior: contain;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-empty {',
      '  padding: 16px 0;',
      '  color: #8b949e;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-item {',
      '  padding: 12px 0;',
      '  border-bottom: 1px solid rgba(48, 54, 61, 0.92);',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-item:last-child { border-bottom: none; }',
      '#' + ROOT_ID + ' .__aibrowser-recorder-line {',
      '  display: flex;',
      '  gap: 10px;',
      '  align-items: flex-start;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-time {',
      '  min-width: 68px;',
      '  color: #8b949e;',
      '  font-size: 12px;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-summary {',
      '  flex: 1;',
      '  line-height: 1.45;',
      '  font-size: 13px;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-meta {',
      '  margin-top: 6px;',
      '  padding-left: 78px;',
      '  color: #8b949e;',
      '  font-size: 12px;',
      '  word-break: break-word;',
      '}'
    ].join('');
    root.appendChild(style);
    document.body.appendChild(root);

    const header = root.querySelector('.__aibrowser-recorder-header');
    const toggleButton = root.querySelector('[data-action="toggle-mode"]');
    const stopButton = root.querySelector('[data-action="stop"]');
    let dragState = null;

    header.addEventListener('mousedown', (event) => {
      if (event.target instanceof HTMLElement && event.target.closest('button')) {
        return;
      }
      const rect = root.getBoundingClientRect();
      dragState = {
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      root.style.left = rect.left + 'px';
      root.style.top = rect.top + 'px';
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      event.preventDefault();
    });

    window.addEventListener('mousemove', (event) => {
      if (!dragState) return;
      root.style.left = dragState.left + (event.clientX - dragState.startX) + 'px';
      root.style.top = dragState.top + (event.clientY - dragState.startY) + 'px';
    });

    window.addEventListener('mouseup', () => {
      dragState = null;
    });

    toggleButton.addEventListener('click', () => {
      const nextMode = state.mode === 'mark' ? 'action' : 'mark';
      sendControl({ action: 'set-mode', mode: nextMode });
    });

    stopButton.addEventListener('click', () => {
      sendControl({ action: 'stop' });
    });

    root.addEventListener('wheel', (event) => {
      if (!shouldStopPanelWheel(isInsidePanel(event.target))) {
        return;
      }
      event.stopPropagation();
    }, { capture: true });

    return root;
  }

  function renderPanel() {
    const root = ensurePanel();
    const statusEl = root.querySelector('[data-role="status"]');
    const modeEl = root.querySelector('[data-role="mode"]');
    const toggleButton = root.querySelector('[data-action="toggle-mode"]');
    const eventsEl = root.querySelector('[data-role="events"]');

    statusEl.textContent = state.status || '';
    modeEl.textContent = state.mode === 'mark' ? '标注模式' : '动作模式';
    modeEl.classList.toggle('is-mark', state.mode === 'mark');
    toggleButton.textContent = state.mode === 'mark' ? '切换动作模式' : '切换标注模式';

    if (!state.events.length) {
      eventsEl.innerHTML = '<div class="__aibrowser-recorder-empty">录制开始后，这里显示关键操作。</div>';
      return;
    }

    eventsEl.innerHTML = state.events
      .map((event) => {
        const meta = [];
        if (event.selector) meta.push('<div><strong>selector:</strong> ' + event.selector + '</div>');
        if (event.fieldName) meta.push('<div><strong>字段:</strong> ' + event.fieldName + '</div>');
        if (event.value) meta.push('<div><strong>值:</strong> ' + event.value + '</div>');

        return [
          '<div class="__aibrowser-recorder-item">',
          '  <div class="__aibrowser-recorder-line">',
          '    <span class="__aibrowser-recorder-time">' + formatTime(event.timestamp) + '</span>',
          '    <span class="__aibrowser-recorder-summary">' + summarizeEvent(event) + ' · ' + (event.title || event.url || '') + '</span>',
          '  </div>',
          meta.length ? '  <div class="__aibrowser-recorder-meta">' + meta.join('') + '</div>' : '',
          '</div>'
        ].join('');
      })
      .join('');
  }

  function emitAction(action, element, extra) {
    const event = {
      kind: 'action',
      action,
      timestamp: Date.now(),
      selector: buildSelector(element),
      url: window.location.href,
      title: document.title,
      elementMeta: getElementMeta(element),
      ...extra
    };
    emit(event);
  }

  function scheduleScrollRecord() {
    if (state.scrollTimer) clearTimeout(state.scrollTimer);
    state.scrollTimer = setTimeout(() => {
      const nextX = window.scrollX;
      const nextY = window.scrollY;
      if (shouldIgnoreZeroReset(state.suppressNextZeroScroll, nextX, nextY)) {
        state.suppressNextZeroScroll = false;
        state.lastRecordedScrollX = nextX;
        state.lastRecordedScrollY = nextY;
        return;
      }
      if (nextX === state.lastRecordedScrollX && nextY === state.lastRecordedScrollY) {
        return;
      }
      state.suppressNextZeroScroll = false;
      state.lastRecordedScrollX = nextX;
      state.lastRecordedScrollY = nextY;
      emitAction('scroll', document.documentElement, {
        value: JSON.stringify({ x: nextX, y: nextY }),
        selector: ''
      });
    }, 160);
  }

  function armScrollIntent() {
    state.lastScrollIntentAt = Date.now();
    scheduleScrollRecord();
  }

  document.addEventListener('click', (event) => {
    const rawTarget = event.target;
    const target = state.mode === 'mark' ? getMarkTarget(rawTarget) : getActionTarget(rawTarget);
    if (!target) return;

    if (state.mode === 'mark') {
      state.status = '已选中元素，请回到主页面确认字段标注';
      renderPanel();
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
    if (isInsidePanel(target)) return;

    if (target instanceof HTMLSelectElement) {
      emitAction('select', target, { value: target.value });
      return;
    }

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      emitAction('type', target, { value: target.value });
    }
  }, true);

  document.addEventListener('wheel', (event) => {
    if (!shouldArmScroll('wheel', isInsidePanel(event.target))) {
      return;
    }
    armScrollIntent();
  }, { capture: true, passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!shouldArmScroll('touchmove', isInsidePanel(event.target))) {
      return;
    }
    armScrollIntent();
  }, { capture: true, passive: true });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const editableTarget =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof Element && target.getAttribute('contenteditable') === 'true');

    if (editableTarget || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (!shouldArmScroll('keydown', isInsidePanel(target), event.key)) {
      return;
    }

    armScrollIntent();
  }, true);

  window.addEventListener('scroll', () => {
    if (!shouldRecordScroll(state.lastScrollIntentAt, Date.now())) {
      return;
    }
    scheduleScrollRecord();
  }, true);

  window.__aibrowserRecorder = {
    setMode(mode) {
      state.mode = mode === 'mark' ? 'mark' : 'action';
      state.status = state.mode === 'mark' ? '标注模式：点击网页元素发起字段标注' : '动作模式：继续录制点击、滚动、输入';
      renderPanel();
    },
    setStatus(message) {
      state.status = message || '';
      renderPanel();
    },
    suppressNextZeroScroll() {
      state.suppressNextZeroScroll = true;
    },
    appendEvent(event) {
      state.events = [event, ...state.events].slice(0, 12);
      renderPanel();
    }
  };

  if (document.body) {
    ensurePanel();
    renderPanel();
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      ensurePanel();
      renderPanel();
    }, { once: true });
  }
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
    await this.broadcastStatus(this.currentStatusMessage);
  }

  async setMode(mode: RecordingMode): Promise<void> {
    this.mode = mode;
    this.currentStatusMessage =
      mode === 'mark'
        ? '已切换到标注模式，点击页面元素即可发起字段标注'
        : '已切换到动作录制模式';

    await this.broadcastMode();
    this.callbacks.onStatus?.({ state: 'mode-changed', message: this.currentStatusMessage, mode });
    await this.broadcastStatus(this.currentStatusMessage);
  }

  async confirmMark(
    request: RecordingMarkRequest,
    payload: { fieldName: string; fieldType: RecordingEvent['fieldType'] }
  ): Promise<void> {
    const event = createRecordedMarkEvent(request, payload);
    this.callbacks.onEvent?.(event);
    this.currentStatusMessage = `已标注字段：${payload.fieldName}`;
    this.callbacks.onStatus?.({ state: 'mark-saved', message: this.currentStatusMessage, mode: this.mode });
    await this.pushEventToPageById(request.pageId, event);
    await this.broadcastStatus(this.currentStatusMessage);
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
      await this.pushStatusToPage(page, '已选中元素，请回到主页面确认字段标注');
      return;
    }

    if (payload.kind !== 'action') {
      return;
    }

    const event: RecordingEvent = {
      id: this.nextEventId(),
      kind: 'action',
      action: payload.action,
      timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
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
    await this.pushEventToPage(page, event);
    await this.pushStatusToPage(page, this.currentStatusMessage);
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
      await this.suppressNextZeroScroll(page);
      await this.pushEventToPage(page, event);
      await this.pushStatusToPage(page, this.currentStatusMessage);
    });

    page.on('domcontentloaded', () => {
      this.installRecorderRuntime(page).catch(() => null);
    });

    await this.installRecorderRuntime(page);
  }

  private async installRecorderRuntime(page: Page): Promise<void> {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => null);
      await page.evaluate(RECORDER_INIT_SCRIPT as any);
    } catch {
      return;
    }

    await this.syncPageMode(page);
    await this.pushStatusToPage(page, this.currentStatusMessage);
  }

  private async syncPageMode(page: Page): Promise<void> {
    try {
      await page.evaluate((mode: RecordingMode) => {
        (globalThis as any).__aibrowserRecorder?.setMode?.(mode);
      }, this.mode);
    } catch {
      // ignore
    }
  }

  private async pushStatusToPage(page: Page, message: string): Promise<void> {
    try {
      await page.evaluate((status: string) => {
        (globalThis as any).__aibrowserRecorder?.setStatus?.(status);
      }, message);
    } catch {
      // ignore
    }
  }

  private async suppressNextZeroScroll(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        (globalThis as any).__aibrowserRecorder?.suppressNextZeroScroll?.();
      });
    } catch {
      // ignore
    }
  }

  private async pushEventToPage(page: Page, event: RecordingEvent): Promise<void> {
    try {
      await page.evaluate((payload: RecordingEvent) => {
        (globalThis as any).__aibrowserRecorder?.appendEvent?.(payload);
      }, event);
    } catch {
      // ignore
    }
  }

  private async pushEventToPageById(pageId: string, event: RecordingEvent): Promise<void> {
    if (!this.context) return;
    const page = this.context.pages().find(candidate => this.pageIds.get(candidate) === pageId);
    if (!page) return;
    await this.pushEventToPage(page, event);
  }

  private async broadcastMode(): Promise<void> {
    if (!this.context) return;
    await Promise.all(this.context.pages().map(page => this.syncPageMode(page)));
  }

  private async broadcastStatus(message: string): Promise<void> {
    if (!this.context) return;
    await Promise.all(this.context.pages().map(page => this.pushStatusToPage(page, message)));
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
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox']
    };

    if (chromePath) {
      launchOptions.executablePath = chromePath;
    } else {
      launchOptions.channel = 'chrome';
    }

    this.context = await chromium.launchPersistentContext(userDataDir, launchOptions);
    await this.context.exposeBinding('__aibrowserRecorderControl', async (_source, payload: any) => {
      if (!payload || typeof payload !== 'object') {
        return;
      }

      if (payload.action === 'stop') {
        await this.stop();
        return;
      }

      if (payload.action === 'set-mode') {
        await this.setMode(payload.mode === 'mark' ? 'mark' : 'action');
      }
    });
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
