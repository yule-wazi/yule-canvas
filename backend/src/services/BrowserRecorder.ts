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
  action:
    | 'navigate'
    | 'click'
    | 'contextmenu'
    | 'middle-click'
    | 'type'
    | 'select'
    | 'scroll'
    | 'back'
    | 'forward'
    | 'field-mark';
  timestamp: number;
  pageId: string;
  url: string;
  title?: string;
  selector?: string;
  value?: string;
  fieldName?: string;
  fieldType?: 'text' | 'image' | 'video' | 'link' | 'custom';
  tableId?: string;
  tableName?: string;
  attribute?: string;
  elementMeta?: RecordingElementMeta;
  openerPageId?: string;
  openerUrl?: string;
  openerSelector?: string;
  openerAction?: 'contextmenu' | 'middle-click';
  openerElementMeta?: RecordingElementMeta;
}

export interface RecordingMarkRequest {
  pageId: string;
  url: string;
  title?: string;
  selector: string;
  elementMeta?: RecordingElementMeta;
}

export function createRecordingMarkRequest(
  pageId: string,
  request: Partial<RecordingMarkRequest> | undefined,
  fallback: { url: string; title?: string }
): RecordingMarkRequest {
  return {
    pageId,
    url: request?.url || fallback.url,
    title: request?.title || fallback.title || '',
    selector: request?.selector || '',
    elementMeta: request?.elementMeta || {}
  };
}

interface BrowserRecorderCallbacks {
  onStatus?: (status: { state: string; message: string; mode?: RecordingMode }) => void;
  onEventsUpdated?: (events: RecordingEvent[]) => void;
  onMarkRequest?: (request: RecordingMarkRequest) => void;
  onStop?: () => void;
}

interface PendingOpenIntent {
  timestamp: number;
  pageId: string;
  url: string;
  title?: string;
  selector?: string;
  action: 'contextmenu' | 'middle-click';
  elementMeta?: RecordingElementMeta;
}

export interface RecordingMarkFieldOption {
  name: string;
  type: 'text' | 'image' | 'video' | 'link' | 'custom';
}

export interface RecordingMarkTableOption {
  id: string;
  name: string;
  fields: RecordingMarkFieldOption[];
}

export interface RecordingMarkConfig {
  selectedTableId: string;
  tables: RecordingMarkTableOption[];
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

export function shouldRecordScrollableElementCandidate(candidate: {
  targetInsidePanel: boolean;
  isDialogLike: boolean;
  isFixedOverlay: boolean;
  areaRatio: number;
}): boolean {
  if (candidate.targetInsidePanel || candidate.isDialogLike) {
    return false;
  }

  if (candidate.isFixedOverlay && candidate.areaRatio < 0.45) {
    return false;
  }

  return candidate.areaRatio >= 0.18;
}

const RECORDER_INIT_SCRIPT = `
(() => {
  if (window.__aibrowserRecorderInstalled) return;
  window.__aibrowserRecorderInstalled = true;

  const ROOT_ID = '__aibrowser-recorder-root';
  const HIGHLIGHT_ID = '__aibrowser-recorder-highlight';
  const state = {
    mode: 'action',
    status: '录制已启动，请开始操作',
    events: [],
    markConfig: {
      selectedTableId: '',
      tables: []
    },
    pendingMarkRequest: null,
    scrollTimer: null,
    lastScrollIntentAt: 0,
    lastRecordedScrollX: window.scrollX,
      lastRecordedScrollY: window.scrollY,
      suppressNextZeroScroll: false,
      pendingScrollTarget: null,
      lastRecordedElementScrolls: {},
      hoverTarget: null
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

  function shouldRecordScrollableCandidate(targetInsidePanel, isDialogLike, isFixedOverlay, areaRatio) {
    if (targetInsidePanel || isDialogLike) {
      return false;
    }

    if (isFixedOverlay && areaRatio < 0.45) {
      return false;
    }

    return areaRatio >= 0.18;
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

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttributeValue(value) {
    return String(value).replace(/"/g, '\\\\\"');
  }

  function getCurrentMarkTable() {
    const tables = Array.isArray(state.markConfig?.tables) ? state.markConfig.tables : [];
    const selectedTableId = state.markConfig?.selectedTableId || '';
    return tables.find((table) => table.id === selectedTableId) || tables[0] || null;
  }

  function getDefaultAttribute(tagName, fieldType) {
    const normalizedTag = String(tagName || '').toLowerCase();
    const normalizedFieldType = String(fieldType || '').toLowerCase();

    if (normalizedTag === 'img' || normalizedFieldType === 'image') {
      return 'src';
    }

    if (normalizedTag === 'a' || normalizedFieldType === 'link') {
      return 'href';
    }

    if (normalizedTag === 'video' || normalizedFieldType === 'video') {
      return 'src';
    }

    if (normalizedTag === 'input' || normalizedTag === 'textarea' || normalizedTag === 'select') {
      return 'value';
    }

    return 'innerText';
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

  function getHoverTarget(element) {
    return state.mode === 'mark' ? getMarkTarget(element) : getActionTarget(element);
  }

  function isScrollableElement(element) {
    if (!(element instanceof Element)) return false;
    const style = window.getComputedStyle(element);
    const overflowY = style.overflowY || style.overflow;
    const overflowX = style.overflowX || style.overflow;
    const canScrollY =
      ['auto', 'scroll', 'overlay'].includes(overflowY) && element.scrollHeight > element.clientHeight + 4;
    const canScrollX =
      ['auto', 'scroll', 'overlay'].includes(overflowX) && element.scrollWidth > element.clientWidth + 4;
    return canScrollY || canScrollX;
  }

  function isDialogLikeElement(element) {
    if (!(element instanceof Element)) return false;
    const role = (element.getAttribute('role') || '').toLowerCase();
    const ariaModal = (element.getAttribute('aria-modal') || '').toLowerCase();
    const className = typeof element.className === 'string' ? element.className.toLowerCase() : '';
    return (
      role === 'dialog' ||
      ariaModal === 'true' ||
      className.includes('modal') ||
      className.includes('dialog') ||
      className.includes('drawer') ||
      className.includes('popover')
    );
  }

  function getElementAreaRatio(element) {
    if (!(element instanceof Element)) return 0;
    const rect = element.getBoundingClientRect();
    const viewportArea = Math.max(window.innerWidth * window.innerHeight, 1);
    const elementArea = Math.max(rect.width * rect.height, 0);
    return elementArea / viewportArea;
  }

  function getNearestScrollableTarget(element) {
    let current = element instanceof Element ? element : null;

    while (current && current !== document.body && current !== document.documentElement) {
      if (isInsidePanel(current)) {
        return null;
      }

      if (isScrollableElement(current)) {
        const style = window.getComputedStyle(current);
        const areaRatio = getElementAreaRatio(current);
        const isFixedOverlay = style.position === 'fixed' || style.position === 'sticky';
        const isDialogLike = isDialogLikeElement(current);

        if (shouldRecordScrollableCandidate(false, isDialogLike, isFixedOverlay, areaRatio)) {
          const selector = buildSelector(current);
          if (selector) {
            return { kind: 'element', selector };
          }
        }
      }

      current = current.parentElement;
    }

    return null;
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

  function summarizeEvent(event) {
    if (event.kind === 'mark') {
      return event.fieldName || '标注字段';
    }

    const labels = {
      navigate: '访问页面',
      click: '点击元素',
      contextmenu: '右键元素',
      'middle-click': '中键打开',
      type: '输入文本',
      select: '选择下拉项',
      scroll: '滚动页面',
      back: '后退',
      forward: '前进',
      'field-mark': '字段标注'
    };

    return labels[event.action] || '未命名事件';
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
      '  <div class="__aibrowser-recorder-mark" data-role="mark-box"></div>',
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
      '#' + ROOT_ID + ' button.secondary { background: #30363d; }',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark {',
      '  display: none;',
      '  margin: 12px 14px 0;',
      '  padding: 12px;',
      '  border: 1px solid rgba(88, 166, 255, 0.22);',
      '  border-radius: 12px;',
      '  background: rgba(56, 139, 253, 0.08);',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark.is-visible {',
      '  display: block;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-title {',
      '  margin-bottom: 8px;',
      '  font-size: 14px;',
      '  font-weight: 700;',
      '  color: #79c0ff;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-preview {',
      '  margin-bottom: 10px;',
      '  color: #8b949e;',
      '  font-size: 12px;',
      '  line-height: 1.5;',
      '  word-break: break-word;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-field {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 6px;',
      '  margin-bottom: 10px;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-field label {',
      '  font-size: 12px;',
      '  color: #8b949e;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-field input,',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-field select {',
      '  width: 100%;',
      '  padding: 9px 10px;',
      '  border: 1px solid #30363d;',
      '  border-radius: 8px;',
      '  background: #0d1117;',
      '  color: #e6edf3;',
      '  font-size: 13px;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-table {',
      '  padding: 9px 10px;',
      '  border: 1px solid #30363d;',
      '  border-radius: 8px;',
      '  background: #0d1117;',
      '  color: #e6edf3;',
      '  font-size: 13px;',
      '  word-break: break-word;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-hint {',
      '  margin-bottom: 10px;',
      '  color: #8b949e;',
      '  font-size: 12px;',
      '  line-height: 1.5;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-actions {',
      '  display: flex;',
      '  gap: 8px;',
      '}',
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
      '  gap: 12px;',
      '  align-items: flex-start;',
      '  justify-content: space-between;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-summary {',
      '  flex: 1;',
      '  line-height: 1.45;',
      '  font-size: 13px;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-delete {',
      '  flex-shrink: 0;',
      '  padding: 4px 8px;',
      '  border-radius: 8px;',
      '  background: transparent;',
      '  color: #8b949e;',
      '  border: 1px solid #30363d;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-meta {',
      '  margin-top: 6px;',
      '  color: #8b949e;',
      '  font-size: 12px;',
      '  word-break: break-word;',
      '}',
      '#' + HIGHLIGHT_ID + ' {',
      '  position: fixed;',
      '  left: 0;',
      '  top: 0;',
      '  width: 0;',
      '  height: 0;',
      '  z-index: 2147483646;',
      '  pointer-events: none;',
      '  border: 2px solid rgba(88, 166, 255, 0.95);',
      '  border-radius: 10px;',
      '  background: rgba(88, 166, 255, 0.12);',
      '  box-shadow: 0 0 0 1px rgba(13, 17, 23, 0.58), 0 0 0 9999px rgba(13, 17, 23, 0.06);',
      '  opacity: 0;',
      '  transition: opacity 120ms ease, width 120ms ease, height 120ms ease, transform 120ms ease;',
      '}',
      '#' + HIGHLIGHT_ID + '.is-visible {',
      '  opacity: 1;',
      '}',
      '#' + HIGHLIGHT_ID + '::after {',
      '  content: attr(data-label);',
      '  position: absolute;',
      '  left: 0;',
      '  top: -28px;',
      '  max-width: min(280px, 60vw);',
      '  padding: 4px 8px;',
      '  border-radius: 999px;',
      '  background: rgba(13, 17, 23, 0.94);',
      '  color: #c9d1d9;',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  border: 1px solid rgba(88, 166, 255, 0.35);',
      '}'
    ].join('');
    root.appendChild(style);
    document.body.appendChild(root);

    let highlight = document.getElementById(HIGHLIGHT_ID);
    if (!highlight) {
      highlight = document.createElement('div');
      highlight.id = HIGHLIGHT_ID;
      document.body.appendChild(highlight);
    }

    const header = root.querySelector('.__aibrowser-recorder-header');
    const toggleButton = root.querySelector('[data-action="toggle-mode"]');
    const stopButton = root.querySelector('[data-action="stop"]');
    const markBox = root.querySelector('[data-role="mark-box"]');
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

    root.addEventListener('click', (event) => {
      const actionTarget = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
      if (!actionTarget) return;

      const action = actionTarget.getAttribute('data-action');
      if (action === 'cancel-mark') {
        state.pendingMarkRequest = null;
        state.status = '已取消字段标注';
        renderPanel();
        return;
      }

      if (action === 'delete-event') {
        const eventId = actionTarget.getAttribute('data-event-id');
        if (eventId) {
          sendControl({ action: 'delete-event', eventId });
        }
        return;
      }

      if (action === 'save-mark') {
        if (!state.pendingMarkRequest) {
          return;
        }

        const tableSelect = root.querySelector('[data-role="mark-table-id"]');
        const fieldNameSelect = root.querySelector('[data-role="mark-field-name"]');
        const attributeSelect = root.querySelector('[data-role="mark-attribute"]');
        const tableId = tableSelect instanceof HTMLSelectElement ? tableSelect.value.trim() : '';
        const selectedTableOption = tableSelect instanceof HTMLSelectElement ? tableSelect.selectedOptions?.[0] : null;
        const tableName = selectedTableOption?.getAttribute('data-table-name') || '';
        const fieldName = fieldNameSelect instanceof HTMLSelectElement ? fieldNameSelect.value.trim() : '';
        const selectedFieldOption = fieldNameSelect instanceof HTMLSelectElement ? fieldNameSelect.selectedOptions?.[0] : null;
        const fieldType = selectedFieldOption?.getAttribute('data-field-type') || 'text';
        const attribute = attributeSelect instanceof HTMLSelectElement ? attributeSelect.value : 'innerText';

        if (!tableId) {
          state.status = '请先选择数据表';
          renderPanel();
          return;
        }

        if (!fieldName) {
          state.status = '请先选择字段';
          renderPanel();
          return;
        }

        sendControl({
          action: 'confirm-mark',
          request: state.pendingMarkRequest,
          fieldName,
          fieldType,
          tableId,
          tableName,
          attribute
        });
        state.pendingMarkRequest = null;
        state.status = '正在保存字段标注...';
        renderPanel();
      }
    });

    root.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }

      if (target.getAttribute('data-role') === 'mark-table-id') {
        state.markConfig.selectedTableId = target.value || '';
        renderPanel();
        return;
      }

      if (target.getAttribute('data-role') === 'mark-field-name') {
        const attributeSelect = root.querySelector('[data-role="mark-attribute"]');
        const selectedFieldOption = target.selectedOptions?.[0] || null;
        const fieldType = selectedFieldOption?.getAttribute('data-field-type') || 'text';
        const nextAttribute = getDefaultAttribute(state.pendingMarkRequest?.elementMeta?.tagName, fieldType);
        if (attributeSelect instanceof HTMLSelectElement) {
          attributeSelect.value = nextAttribute;
        }
      }
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
    const markBox = root.querySelector('[data-role="mark-box"]');
    const eventsEl = root.querySelector('[data-role="events"]');

    statusEl.textContent = state.status || '';
    modeEl.textContent = state.mode === 'mark' ? '标注模式' : '动作模式';
    modeEl.classList.toggle('is-mark', state.mode === 'mark');
    toggleButton.textContent = state.mode === 'mark' ? '切换动作模式' : '切换标注模式';

    if (state.pendingMarkRequest) {
      const markTables = Array.isArray(state.markConfig?.tables) ? state.markConfig.tables : [];
      const selectedTableId = state.markConfig?.selectedTableId || markTables[0]?.id || '';
      const selectedTable = markTables.find((table) => table.id === selectedTableId) || markTables[0] || null;
      const markFields = Array.isArray(selectedTable?.fields) ? selectedTable.fields : [];
      const hasMarkTables = markTables.length > 0;
      const hasMarkFields = markFields.length > 0;
      const defaultAttribute = getDefaultAttribute(
        state.pendingMarkRequest?.elementMeta?.tagName,
        markFields[0]?.type || 'text'
      );
      const tableOptions = hasMarkTables
        ? markTables
            .map((table) => {
              const optionId = escapeAttributeValue(table.id || '');
              const optionName = escapeAttributeValue(table.name || '');
              const label = escapeHtml(table.name || '');
              const selected = table.id === selectedTableId ? ' selected' : '';
              return '    <option value="' + optionId + '" data-table-name="' + optionName + '"' + selected + '>' + label + '</option>';
            })
            .join('')
        : '    <option value="">暂无数据表</option>';
      const markFieldOptions = hasMarkFields
        ? markFields
            .map((field, index) => {
              const fieldName = escapeAttributeValue(field.name || '');
              const fieldType = escapeAttributeValue(field.type || 'text');
              const label = escapeHtml(field.name || '') + ' (' + escapeHtml(field.type || 'text') + ')';
              const selected = index === 0 ? ' selected' : '';
              return '    <option value="' + fieldName + '" data-field-type="' + fieldType + '"' + selected + '>' + label + '</option>';
            })
            .join('')
        : '    <option value="">当前数据表没有可选字段</option>';
      markBox.classList.add('is-visible');
      markBox.innerHTML = [
        '<div class="__aibrowser-recorder-mark-title">确认字段标注</div>',
        '<div class="__aibrowser-recorder-mark-preview">',
        '  <div><strong>selector:</strong> ' + (state.pendingMarkRequest.selector || '') + '</div>',
        state.pendingMarkRequest.elementMeta?.text
          ? '  <div><strong>文本:</strong> ' + state.pendingMarkRequest.elementMeta.text + '</div>'
          : '',
        state.pendingMarkRequest.elementMeta?.tagName
          ? '  <div><strong>标签:</strong> ' + state.pendingMarkRequest.elementMeta.tagName + '</div>'
          : '',
        '</div>',
        '<div class="__aibrowser-recorder-mark-field">',
        '  <label>数据表</label>',
        '  <select data-role="mark-table-id"' + (hasMarkTables ? '' : ' disabled') + '>',
             tableOptions,
        '  </select>',
        '</div>',
        '<div class="__aibrowser-recorder-mark-field">',
        '  <label>字段名</label>',
        '  <select data-role="mark-field-name"' + (hasMarkFields ? '' : ' disabled') + '>',
             markFieldOptions,
        '  </select>',
        '</div>',
        '<div class="__aibrowser-recorder-mark-field">',
        '  <label>提取属性</label>',
        '  <select data-role="mark-attribute">',
        '    <option value="innerText"' + (defaultAttribute === 'innerText' ? ' selected' : '') + '>显示文本 (innerText)</option>',
        '    <option value="text"' + (defaultAttribute === 'text' ? ' selected' : '') + '>文本内容 (textContent)</option>',
        '    <option value="innerHTML"' + (defaultAttribute === 'innerHTML' ? ' selected' : '') + '>HTML 内容</option>',
        '    <option value="href"' + (defaultAttribute === 'href' ? ' selected' : '') + '>链接地址 (href)</option>',
        '    <option value="src"' + (defaultAttribute === 'src' ? ' selected' : '') + '>图片/资源地址 (src)</option>',
        '    <option value="backgroundImage"' + (defaultAttribute === 'backgroundImage' ? ' selected' : '') + '>背景图 (background-image)</option>',
        '    <option value="poster"' + (defaultAttribute === 'poster' ? ' selected' : '') + '>视频封面 (poster)</option>',
        '    <option value="value"' + (defaultAttribute === 'value' ? ' selected' : '') + '>表单值 (value)</option>',
        '    <option value="alt"' + (defaultAttribute === 'alt' ? ' selected' : '') + '>替代文本 (alt)</option>',
        '    <option value="title"' + (defaultAttribute === 'title' ? ' selected' : '') + '>标题 (title)</option>',
        '  </select>',
        '</div>',
        hasMarkFields
          ? ''
          : '<div class="__aibrowser-recorder-mark-hint">' + (hasMarkTables ? '当前数据表没有字段，请先在工作台的数据表中创建字段。' : '当前还没有数据表，请先在工作台创建数据表。') + '</div>',
        '<div class="__aibrowser-recorder-mark-actions">',
        '  <button type="button" data-action="save-mark"' + (hasMarkFields ? '' : ' disabled') + '>保存标注</button>',
        '  <button type="button" data-action="cancel-mark" class="secondary">取消</button>',
        '</div>'
      ].join('');
    } else {
      markBox.classList.remove('is-visible');
      markBox.innerHTML = '';
    }

    if (!state.events.length) {
      eventsEl.innerHTML = '<div class="__aibrowser-recorder-empty">录制开始后，这里显示关键操作。</div>';
      return;
    }

    eventsEl.innerHTML = state.events
      .map((event) => {
        const meta = [];
        if (event.title) meta.push('<div><strong>页面:</strong> ' + event.title + '</div>');
        if (event.selector) meta.push('<div><strong>selector:</strong> ' + event.selector + '</div>');
        if (event.fieldName) meta.push('<div><strong>字段:</strong> ' + event.fieldName + '</div>');
        if (event.tableName) meta.push('<div><strong>数据表:</strong> ' + event.tableName + '</div>');
        if (event.value) meta.push('<div><strong>值:</strong> ' + event.value + '</div>');

        return [
          '<div class="__aibrowser-recorder-item">',
          '  <div class="__aibrowser-recorder-line">',
          '    <span class="__aibrowser-recorder-summary">' + summarizeEvent(event) + '</span>',
          '    <button type="button" class="__aibrowser-recorder-delete" data-action="delete-event" data-event-id="' + event.id + '">删除</button>',
          '  </div>',
          meta.length ? '  <div class="__aibrowser-recorder-meta">' + meta.join('') + '</div>' : '',
          '</div>'
        ].join('');
      })
      .join('');
  }

  function getHighlightLabel(element) {
    if (!(element instanceof Element)) {
      return '';
    }

    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const text = truncate(element.textContent || '', 36);

    if (text) {
      return role ? tagName + '[' + role + '] ' + text : tagName + ' ' + text;
    }

    if (role) {
      return tagName + '[' + role + ']';
    }

    return tagName;
  }

  function hideHighlight() {
    const highlight = document.getElementById(HIGHLIGHT_ID);
    if (!(highlight instanceof HTMLElement)) {
      return;
    }

    highlight.classList.remove('is-visible');
    highlight.style.width = '0px';
    highlight.style.height = '0px';
    highlight.removeAttribute('data-label');
  }

  function updateHighlight() {
    const highlight = document.getElementById(HIGHLIGHT_ID);
    const target = state.hoverTarget;

    if (!(highlight instanceof HTMLElement) || !(target instanceof Element) || !target.isConnected) {
      hideHighlight();
      return;
    }

    const rect = target.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) {
      hideHighlight();
      return;
    }

    highlight.style.left = rect.left + 'px';
    highlight.style.top = rect.top + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    highlight.setAttribute('data-label', getHighlightLabel(target));
    highlight.classList.add('is-visible');
  }

  function setHoverTarget(element) {
    if (element === state.hoverTarget) {
      return;
    }

    state.hoverTarget = element;
    updateHighlight();
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
      const pendingTarget = state.pendingScrollTarget;

      if (pendingTarget && pendingTarget.kind === 'element' && pendingTarget.selector) {
        const element = document.querySelector(pendingTarget.selector);
        if (element instanceof Element) {
          const nextLeft = element.scrollLeft || 0;
          const nextTop = element.scrollTop || 0;
          const lastElementScroll = state.lastRecordedElementScrolls[pendingTarget.selector] || { x: 0, y: 0 };

          if (nextLeft !== lastElementScroll.x || nextTop !== lastElementScroll.y) {
            state.lastRecordedElementScrolls[pendingTarget.selector] = { x: nextLeft, y: nextTop };
            emitAction('scroll', element, {
              value: JSON.stringify({ target: 'element', x: nextLeft, y: nextTop }),
              selector: pendingTarget.selector
            });
            state.pendingScrollTarget = null;
            return;
          }
        }
      }

      const nextX = window.scrollX;
      const nextY = window.scrollY;
      if (shouldIgnoreZeroReset(state.suppressNextZeroScroll, nextX, nextY)) {
        state.suppressNextZeroScroll = false;
        state.lastRecordedScrollX = nextX;
        state.lastRecordedScrollY = nextY;
        state.pendingScrollTarget = null;
        return;
      }
      if (nextX === state.lastRecordedScrollX && nextY === state.lastRecordedScrollY) {
        state.pendingScrollTarget = null;
        return;
      }
      state.suppressNextZeroScroll = false;
      state.lastRecordedScrollX = nextX;
      state.lastRecordedScrollY = nextY;
      emitAction('scroll', document.documentElement, {
        value: JSON.stringify({ target: 'page', x: nextX, y: nextY }),
        selector: ''
      });
      state.pendingScrollTarget = null;
    }, 160);
  }

  function armScrollIntent(target) {
    state.lastScrollIntentAt = Date.now();
    state.pendingScrollTarget = getNearestScrollableTarget(target) || { kind: 'page', selector: '' };
    scheduleScrollRecord();
  }

  document.addEventListener('click', (event) => {
    const rawTarget = event.target;
    const target = state.mode === 'mark' ? getMarkTarget(rawTarget) : getActionTarget(rawTarget);
    if (!target) return;

    if (state.mode === 'mark') {
      state.status = '已选中元素，正在准备字段标注...';
      renderPanel();
      emit({
        kind: 'mark-request',
        request: {
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

  document.addEventListener('contextmenu', (event) => {
    if (state.mode !== 'action') {
      return;
    }

    const target = getActionTarget(event.target);
    if (!target) {
      return;
    }

    emitAction('contextmenu', target);
  }, true);

  document.addEventListener('auxclick', (event) => {
    if (state.mode !== 'action' || event.button !== 1) {
      return;
    }

    const target = getActionTarget(event.target);
    if (!target) {
      return;
    }

    emitAction('middle-click', target);
  }, true);

  document.addEventListener('mousemove', (event) => {
    const target = getHoverTarget(event.target);
    setHoverTarget(target);
  }, true);

  document.addEventListener('mouseout', (event) => {
    if (!(event.relatedTarget instanceof Element)) {
      setHoverTarget(null);
    }
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
    armScrollIntent(event.target);
  }, { capture: true, passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!shouldArmScroll('touchmove', isInsidePanel(event.target))) {
      return;
    }
    armScrollIntent(event.target);
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

    armScrollIntent(target);
  }, true);

  window.addEventListener('scroll', () => {
    if (!shouldRecordScroll(state.lastScrollIntentAt, Date.now())) {
      updateHighlight();
      return;
    }
    scheduleScrollRecord();
    updateHighlight();
  }, true);

  window.addEventListener('resize', () => {
    updateHighlight();
  });

  window.__aibrowserRecorder = {
    setMode(mode) {
      state.mode = mode === 'mark' ? 'mark' : 'action';
      state.status = state.mode === 'mark' ? '标注模式：点击网页元素发起字段标注' : '动作模式：继续录制点击、滚动、输入';
      setHoverTarget(null);
      renderPanel();
    },
    setStatus(message) {
      state.status = message || '';
      renderPanel();
    },
    setEvents(events) {
      state.events = Array.isArray(events) ? events.slice(0, 200) : [];
      renderPanel();
    },
    setMarkConfig(config) {
      state.markConfig = config && typeof config === 'object'
        ? {
            selectedTableId: config.selectedTableId || '',
            tables: Array.isArray(config.tables) ? config.tables : []
          }
        : { selectedTableId: '', tables: [] };
      renderPanel();
    },
    setPendingMark(request) {
      state.pendingMarkRequest = request || null;
      renderPanel();
    },
    suppressNextZeroScroll() {
      state.suppressNextZeroScroll = true;
    },
    clearPendingMark() {
      state.pendingMarkRequest = null;
      renderPanel();
    },
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
    tableId?: string;
    tableName?: string;
    attribute?: string;
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
    tableId: payload.tableId,
    tableName: payload.tableName,
    attribute: payload.attribute || 'innerText',
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
  private recordedEvents: RecordingEvent[] = [];
  private pendingMarkRequests = new Map<string, RecordingMarkRequest>();
  private pendingOpenIntents: PendingOpenIntent[] = [];
  private markConfig: RecordingMarkConfig = {
    selectedTableId: '',
    tables: []
  };

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

  async setMarkConfig(config: RecordingMarkConfig): Promise<void> {
    this.markConfig = {
      selectedTableId: config.selectedTableId || '',
      tables: Array.isArray(config.tables) ? config.tables : []
    };
    await this.broadcastMarkConfig();
  }

  async confirmMark(
    request: RecordingMarkRequest,
    payload: {
      fieldName: string;
      fieldType: RecordingEvent['fieldType'];
      tableId?: string;
      tableName?: string;
      attribute?: string;
    }
  ): Promise<void> {
    const event = createRecordedMarkEvent(request, payload);
    this.addRecordedEvent(event);
    this.currentStatusMessage = `已标注字段：${payload.fieldName}`;
    this.callbacks.onStatus?.({ state: 'mark-saved', message: this.currentStatusMessage, mode: this.mode });
    this.pendingMarkRequests.delete(request.pageId);
    await this.broadcastEvents();
    await this.clearPendingMarkById(request.pageId);
    await this.broadcastStatus(this.currentStatusMessage);
  }

  async stop(): Promise<void> {
    if (this.stopRequested) return;
    this.stopRequested = true;
    await this.cleanup();
    this.currentStatusMessage = '录制已停止';
    this.callbacks.onStatus?.({ state: 'stopped', message: this.currentStatusMessage, mode: this.mode });
    this.callbacks.onStop?.();
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (!eventId) return;
    this.recordedEvents = this.recordedEvents.filter(event => event.id !== eventId);
    await this.broadcastEvents();
  }

  async clearEvents(): Promise<void> {
    this.recordedEvents = [];
    await this.broadcastEvents();
  }

  private async handleBrowserPayload(page: Page | undefined, payload: any): Promise<void> {
    if (this.stopRequested || !page || !payload || typeof payload !== 'object') {
      return;
    }

    const pageId = this.ensurePageId(page);

    if (payload.kind === 'mark-request' && payload.request) {
      const request = createRecordingMarkRequest(pageId, payload.request, {
        url: page.url(),
        title: payload.request?.title || ''
      });
      this.pendingMarkRequests.set(pageId, request);
      this.currentStatusMessage = '已选中元素，请确认字段标注';
      this.callbacks.onStatus?.({ state: 'mark-requested', message: this.currentStatusMessage, mode: this.mode });
      await this.pushPendingMarkToPage(page, request);
      await this.pushStatusToPage(page, this.currentStatusMessage);
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

    this.addRecordedEvent(event);
    this.capturePendingOpenIntent(event);
    this.currentStatusMessage = `已记录：${this.describeAction(event.action)}`;
    this.callbacks.onStatus?.({ state: 'event-recorded', message: this.currentStatusMessage, mode: this.mode });
    await this.broadcastEvents();
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
      const opener = action === 'navigate' ? this.consumePendingOpenIntent(url) : undefined;
      const event: RecordingEvent = {
        id: this.nextEventId(),
        kind: 'action',
        action,
        timestamp: Date.now(),
        pageId,
        url,
        title,
        openerPageId: opener?.pageId,
        openerUrl: opener?.url,
        openerSelector: opener?.selector,
        openerAction: opener?.action,
        openerElementMeta: opener?.elementMeta
      };

      this.addRecordedEvent(event);
      this.currentStatusMessage = `已记录：${this.describeAction(action)}`;
      this.callbacks.onStatus?.({ state: 'event-recorded', message: this.currentStatusMessage, mode: this.mode });
      await this.suppressNextZeroScroll(page);
      await this.broadcastEvents();
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
    await this.pushMarkConfigToPage(page);
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

  private async pushEventToPage(page: Page, _event: RecordingEvent): Promise<void> {
    try {
      await page.evaluate((payload: RecordingEvent[]) => {
        (globalThis as any).__aibrowserRecorder?.setEvents?.(payload);
      }, this.recordedEvents);
    } catch {
      // ignore
    }
  }

  private async pushMarkConfigToPage(page: Page): Promise<void> {
    try {
      await page.evaluate((config: RecordingMarkConfig) => {
        (globalThis as any).__aibrowserRecorder?.setMarkConfig?.(config);
      }, this.markConfig);
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

  private async clearPendingMarkById(pageId: string): Promise<void> {
    if (!this.context) return;
    const page = this.context.pages().find(candidate => this.pageIds.get(candidate) === pageId);
    if (!page) return;

    try {
      await page.evaluate(() => {
        (globalThis as any).__aibrowserRecorder?.clearPendingMark?.();
      });
    } catch {
      // ignore
    }
  }

  private async pushPendingMarkToPage(page: Page, request: RecordingMarkRequest): Promise<void> {
    try {
      await page.evaluate((payload: RecordingMarkRequest) => {
        (globalThis as any).__aibrowserRecorder?.setPendingMark?.(payload);
      }, request);
    } catch {
      // ignore
    }
  }

  private async broadcastMode(): Promise<void> {
    if (!this.context) return;
    await Promise.all(this.context.pages().map(page => this.syncPageMode(page)));
  }

  private async broadcastMarkConfig(): Promise<void> {
    if (!this.context) return;
    await Promise.all(this.context.pages().map(page => this.pushMarkConfigToPage(page)));
  }

  private async broadcastStatus(message: string): Promise<void> {
    if (!this.context) return;
    await Promise.all(this.context.pages().map(page => this.pushStatusToPage(page, message)));
  }

  private async broadcastEvents(): Promise<void> {
    this.callbacks.onEventsUpdated?.([...this.recordedEvents]);
    if (!this.context) return;
    await Promise.all(this.context.pages().map(page => this.pushEventToPage(page, this.recordedEvents[0] as RecordingEvent)));
  }

  private addRecordedEvent(event: RecordingEvent): void {
    this.recordedEvents = [event, ...this.recordedEvents].slice(0, 200);
    this.callbacks.onEventsUpdated?.([...this.recordedEvents]);
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
      contextmenu: '右键元素',
      'middle-click': '中键打开',
      type: '输入文本',
      select: '选择下拉项',
      scroll: '滚动页面',
      back: '返回',
      forward: '前进',
      'field-mark': '标注字段'
    };
    return labels[action] || action;
  }

  private capturePendingOpenIntent(event: RecordingEvent): void {
    if (
      (event.action !== 'contextmenu' && event.action !== 'middle-click') ||
      !event.selector ||
      !event.elementMeta?.href
    ) {
      return;
    }

    this.pendingOpenIntents.push({
      timestamp: event.timestamp,
      pageId: event.pageId,
      url: event.url,
      title: event.title,
      selector: event.selector,
      action: event.action,
      elementMeta: event.elementMeta
    });

    this.pendingOpenIntents = this.pendingOpenIntents
      .filter(intent => event.timestamp - intent.timestamp <= 15000)
      .slice(-8);
  }

  private consumePendingOpenIntent(navigatedUrl: string): PendingOpenIntent | undefined {
    const now = Date.now();
    this.pendingOpenIntents = this.pendingOpenIntents.filter(intent => now - intent.timestamp <= 15000);

    if (this.pendingOpenIntents.length === 0) {
      return undefined;
    }

    const exactIndex = this.pendingOpenIntents.findIndex(intent => intent.elementMeta?.href === navigatedUrl);
    if (exactIndex >= 0) {
      return this.pendingOpenIntents.splice(exactIndex, 1)[0];
    }

    return this.pendingOpenIntents.pop();
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
      return;
    }

      if (payload.action === 'confirm-mark' && payload.request && payload.fieldName && payload.fieldType) {
        await this.confirmMark(payload.request, {
          fieldName: payload.fieldName,
          fieldType: payload.fieldType,
          tableId: typeof payload.tableId === 'string' ? payload.tableId : '',
          tableName: typeof payload.tableName === 'string' ? payload.tableName : '',
          attribute: typeof payload.attribute === 'string' ? payload.attribute : 'innerText'
        });
        return;
      }

      if (payload.action === 'delete-event' && payload.eventId) {
        await this.deleteEvent(payload.eventId);
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
