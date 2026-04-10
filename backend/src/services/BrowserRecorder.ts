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
  kind: 'action' | 'mark' | 'meta';
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
    | 'field-mark'
    | 'loop-capture';
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
  recordAction?: 'new' | 'append';
  elementMeta?: RecordingElementMeta;
  openerPageId?: string;
  openerUrl?: string;
  openerSelector?: string;
  openerAction?: 'contextmenu' | 'middle-click';
  openerElementMeta?: RecordingElementMeta;
  navigationKind?: 'explicit' | 'derived';
  navigationSource?: 'direct' | 'click' | 'contextmenu' | 'middle-click' | 'back' | 'forward';
  summary?: string;
  loopCapture?: {
    variableName: string;
    startValue: number;
    endValue: number;
    count: number;
    templateEvents: any[];
    firstSample: any[];
    lastSample: any[];
    fieldNames: string[];
  };
}

export interface RecordingMarkRequest {
  pageId: string;
  url: string;
  title?: string;
  selector: string;
  elementMeta?: RecordingElementMeta;
  candidateTargets?: RecordingMarkCandidate[];
  selectedCandidateIndex?: number;
  selectedFieldName?: string;
  selectedAttribute?: string;
}

export interface RecordingMarkCandidate {
  selector: string;
  elementMeta?: RecordingElementMeta;
  label?: string;
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
    elementMeta: request?.elementMeta || {},
    candidateTargets: Array.isArray(request?.candidateTargets)
      ? request!.candidateTargets!
          .map(candidate => ({
            selector: candidate?.selector || '',
            elementMeta: candidate?.elementMeta || {},
            label: candidate?.label || ''
          }))
          .filter(candidate => candidate.selector)
      : [],
    selectedCandidateIndex:
      typeof request?.selectedCandidateIndex === 'number' && request.selectedCandidateIndex >= 0
        ? request.selectedCandidateIndex
        : 0,
    selectedFieldName: typeof request?.selectedFieldName === 'string' ? request.selectedFieldName : '',
    selectedAttribute: typeof request?.selectedAttribute === 'string' ? request.selectedAttribute : ''
  };
}

interface BrowserRecorderCallbacks {
  onStatus?: (status: { state: string; message: string; mode?: RecordingMode }) => void;
  onEventsUpdated?: (events: RecordingEvent[]) => void;
  onMarkRequest?: (request: RecordingMarkRequest) => void;
  onLoopControl?: (payload: { action: 'start' | 'finish-first' | 'start-last' | 'finish' | 'cancel' }) => void;
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
  disableRecordAction?: boolean;
}

interface RecordingLoopUiState {
  active: boolean;
  phase: 'idle' | 'recording-first' | 'transition' | 'recording-last';
  title?: string;
  hint?: string;
  visibleEventIds?: string[];
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
      tables: [],
      disableRecordAction: false
    },
    loopControl: {
      active: false,
      phase: 'idle',
      title: '',
      hint: '',
      visibleEventIds: []
    },
    nextRecordAction: 'append',
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

  function getCurrentMarkFieldType(fieldName) {
    const currentTable = getCurrentMarkTable();
    const fields = Array.isArray(currentTable?.fields) ? currentTable.fields : [];
    const resolvedFieldName = fieldName || state.pendingMarkRequest?.selectedFieldName || fields[0]?.name || '';
    return fields.find((field) => field.name === resolvedFieldName)?.type || 'text';
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

  function getAttributePreview(element) {
    if (!(element instanceof Element)) {
      return '';
    }

    const backgroundImage = window.getComputedStyle(element).backgroundImage || '';
    return (
      element.getAttribute('src') ||
      element.getAttribute('href') ||
      element.getAttribute('poster') ||
      (backgroundImage && backgroundImage !== 'none' ? backgroundImage : '')
    );
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

  function isUsefulMarkCandidate(element) {
    if (!(element instanceof Element) || isInsidePanel(element)) {
      return false;
    }

    const tagName = element.tagName.toLowerCase();
    if (['img', 'video', 'source', 'a', 'input', 'textarea', 'select'].includes(tagName)) {
      return true;
    }

    if (element.hasAttribute('src') || element.hasAttribute('href') || element.hasAttribute('poster')) {
      return true;
    }

    const backgroundImage = window.getComputedStyle(element).backgroundImage || '';
    return backgroundImage && backgroundImage !== 'none';
  }

  function getCandidateLabel(element, selector) {
    if (!(element instanceof Element)) {
      return truncate(selector || '候选元素', 42);
    }

    const tagName = element.tagName.toLowerCase();
    const preview = truncate(getAttributePreview(element) || element.textContent || '', 36);
    if (preview) {
      return tagName + ' | ' + preview;
    }

    const compactSelector = truncate(
      String(selector || '')
        .split(' > ')
        .slice(-2)
        .join(' > '),
      36
    );

    return compactSelector ? tagName + ' | ' + compactSelector : tagName;
  }

  function buildDropdownTrigger(label, value, menuRole) {
    return '<div class="__aibrowser-recorder-mark-candidate"><button type="button" class="__aibrowser-recorder-mark-candidate-trigger" data-action="toggle-dropdown" data-menu-role="' + menuRole + '" title="' + escapeHtml(value || '') + '"><span class="__aibrowser-recorder-mark-candidate-label">' + escapeHtml(value || '') + '</span></button>';
  }

  function getMarkCandidatePriority(candidate) {
    const tagName = String(candidate?.elementMeta?.tagName || '').toLowerCase();

    if (['video', 'source'].includes(tagName)) return 5;
    if (tagName === 'img') return 4;
    if (tagName === 'a') return 3;
    if (candidate?.elementMeta?.src) return 2;
    if (candidate?.elementMeta?.href) return 1;
    return 0;
  }

  function collectVisualStackCandidates(clientX, clientY) {
    const sampleOffsets = [
      [0, 0],
      [-8, -8],
      [8, -8],
      [-8, 8],
      [8, 8]
    ];
    const stack = [];
    const seen = new Set();

    sampleOffsets.forEach(([offsetX, offsetY]) => {
      const sampleX = Math.max(0, Math.min(window.innerWidth - 1, clientX + offsetX));
      const sampleY = Math.max(0, Math.min(window.innerHeight - 1, clientY + offsetY));
      const elements = document.elementsFromPoint(sampleX, sampleY);

      elements.forEach((element) => {
        if (!(element instanceof Element) || isInsidePanel(element)) {
          return;
        }

        const selector = buildSelector(element);
        if (!selector || seen.has(selector)) {
          return;
        }

        seen.add(selector);
        stack.push(element);
      });
    });

    return stack;
  }

  function hasRectIntersection(leftRect, rightRect) {
    if (!leftRect || !rightRect) {
      return false;
    }

    return !(
      leftRect.right < rightRect.left ||
      leftRect.left > rightRect.right ||
      leftRect.bottom < rightRect.top ||
      leftRect.top > rightRect.bottom
    );
  }

  function collectMarkCandidates(element, clientX, clientY) {
    if (!(element instanceof Element)) {
      return [];
    }

    const visited = new Set();
    const candidates = [];
    let directCandidate = null;

    function pushCandidate(candidateElement) {
      if (!(candidateElement instanceof Element) || isInsidePanel(candidateElement)) {
        return;
      }

      const selector = buildSelector(candidateElement);
      if (!selector || visited.has(selector)) {
        return;
      }

      visited.add(selector);
      const candidate = {
        selector,
        elementMeta: getElementMeta(candidateElement),
        label: getCandidateLabel(candidateElement, selector)
      };
      candidates.push(candidate);

      if (candidateElement === element) {
        directCandidate = candidate;
      }
    }

    if (typeof clientX === 'number' && typeof clientY === 'number') {
      collectVisualStackCandidates(clientX, clientY).forEach(pushCandidate);
    }

    pushCandidate(element);

    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 4) {
      pushCandidate(parent);
      parent = parent.parentElement;
      depth += 1;
    }

    const descendantCandidates = Array.from(
      element.querySelectorAll('img, video, source, a, [src], [href], [poster], [style*="background-image"]')
    ).slice(0, 12);
    descendantCandidates.forEach(pushCandidate);

    if (element.parentElement) {
      const elementRect = element.getBoundingClientRect();
      const siblingCandidates = Array.from(
        element.parentElement.querySelectorAll('img, video, source, a, [src], [href], [poster], [style*="background-image"]')
      )
        .filter(candidate => {
          if (!(candidate instanceof Element)) {
            return false;
          }

          if (candidate === element || element.contains(candidate) || candidate.contains(element)) {
            return true;
          }

          return hasRectIntersection(elementRect, candidate.getBoundingClientRect());
        })
        .slice(0, 16);
      siblingCandidates.forEach(pushCandidate);
    }

    return candidates
      .sort((left, right) => {
        if (directCandidate && left.selector === directCandidate.selector) return -1;
        if (directCandidate && right.selector === directCandidate.selector) return 1;

        const priorityDiff = getMarkCandidatePriority(right) - getMarkCandidatePriority(left);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return 0;
      })
      .slice(0, 12);
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
      'field-mark': '字段标注',
      'loop-capture': '循环录制'
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
      '      <button type="button" data-action="toggle-mode" class="secondary">切到标注</button>',
      '      <button type="button" data-action="stop" class="danger">停止录制</button>',
      '    </div>',
      '  </div>',
      '  <div class="__aibrowser-recorder-loop-controls" data-role="loop-controls"></div>',
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
      '  border-radius: 2px;',
      '  border: 1px solid #5e5e5e;',
      '  background: radial-gradient(circle at top right, rgba(118, 185, 0, 0.08), transparent 28%), linear-gradient(180deg, rgba(0, 0, 0, 0.98), rgba(5, 5, 5, 0.98));',
      '  color: #ffffff;',
      '  box-shadow: rgba(0, 0, 0, 0.3) 0px 0px 5px 0px;',
      '  font-family: Arial, Helvetica, sans-serif;',
      '}',
      '#' + ROOT_ID + '::before {',
      '  content: "";',
      '  position: absolute;',
      '  inset: 0 0 auto 0;',
      '  height: 2px;',
      '  background: #3860be;',
      '  pointer-events: none;',
      '}',
      '#' + ROOT_ID + '.__aibrowser-recorder-mode-mark::before {',
      '  background: #76b900;',
      '}',
      '#' + ROOT_ID + ' * { box-sizing: border-box; }',
      '#' + ROOT_ID + ' .__aibrowser-recorder-shell {',
      '  display: flex;',
      '  flex-direction: column;',
      '  width: 100%;',
      '  height: 100%;',
      '  min-height: 0;',
      '}',
      '#' + ROOT_ID + '.__aibrowser-recorder-is-marking .__aibrowser-recorder-events {',
      '  display: none;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-header {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: flex-start;',
      '  gap: 16px;',
      '  padding: 18px 18px 14px;',
      '  border-bottom: 1px solid #5e5e5e;',
      '  cursor: move;',
      '  user-select: none;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-title-wrap {',
      '  flex: 1;',
      '  min-width: 0;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-title {',
      '  font-size: 24px;',
      '  font-weight: 700;',
      '  color: #ffffff;',
      '  line-height: 1.25;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-status {',
      '  margin-top: 6px;',
      '  color: #a7a7a7;',
      '  font-size: 15px;',
      '  line-height: 1.5;',
      '  max-width: 260px;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-actions {',
      '  flex: 0 0 252px;',
      '  display: grid;',
      '  grid-template-columns: repeat(2, minmax(0, 1fr));',
      '  gap: 10px;',
      '  align-items: stretch;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mode {',
      '  grid-column: 1 / 2;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 100%;',
      '  min-width: 0;',
      '  min-height: 48px;',
      '  padding: 0 12px;',
      '  border-radius: 2px;',
      '  border: 1px solid #3860be;',
      '  color: #ffffff;',
      '  background: rgba(0, 70, 164, 0.14);',
      '  font-size: 14px;',
      '  font-weight: 700;',
      '  line-height: 1.25;',
      '  letter-spacing: 0;',
      '  text-transform: uppercase;',
      '  text-align: center;',
      '}',
      '#' + ROOT_ID + '.__aibrowser-recorder-mode-mark .__aibrowser-recorder-mode {',
      '  border-color: #76b900;',
      '  background: rgba(118, 185, 0, 0.12);',
      '}',
      '#' + ROOT_ID + ' button {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 100%;',
      '  min-width: 0;',
      '  min-height: 48px;',
      '  padding: 0 12px;',
      '  border-radius: 2px;',
      '  border: 1px solid #76b900;',
      '  background: transparent;',
      '  color: #ffffff;',
      '  font-size: 14px;',
      '  font-weight: 700;',
      '  line-height: 1.25;',
      '  cursor: pointer;',
      '  text-align: center;',
      '}',
      '#' + ROOT_ID + ' button:hover { background: rgba(30, 174, 219, 0.14); border-color: #76b900; }',
      '#' + ROOT_ID + ' button.danger { border-color: #e52020; }',
      '#' + ROOT_ID + ' button[data-action="stop"] { grid-column: 2 / 3; }',
      '#' + ROOT_ID + ' button.danger:hover { background: rgba(229, 32, 32, 0.16); border-color: #e52020; }',
      '#' + ROOT_ID + ' button.secondary { border-color: #5e5e5e; color: #a7a7a7; }',
      '#' + ROOT_ID + ' button.secondary:hover { color: #ffffff; border-color: #76b900; }',
      '#' + ROOT_ID + '.__aibrowser-recorder-mode-action button[data-action="toggle-mode"] { border-color: #3860be; color: #ffffff; }',
      '#' + ROOT_ID + '.__aibrowser-recorder-mode-action button[data-action="toggle-mode"]:hover { border-color: #3860be; background: rgba(0, 70, 164, 0.18); }',
      '#' + ROOT_ID + '.__aibrowser-recorder-mode-mark button[data-action="toggle-mode"] { border-color: #76b900; color: #ffffff; }',
      '#' + ROOT_ID + '.__aibrowser-recorder-mode-mark button[data-action="toggle-mode"]:hover { border-color: #76b900; background: rgba(118, 185, 0, 0.16); }',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark {',
      '  display: none;',
      '  flex: 1;',
      '  min-height: 0;',
      '  margin: 14px 18px 0;',
      '  padding: 14px 16px;',
      '  border: 1px solid #5e5e5e;',
      '  border-radius: 2px;',
      '  background: linear-gradient(180deg, rgba(17, 17, 17, 0.98) 0%, rgba(10, 10, 10, 0.98) 100%);',
      '  box-shadow: rgba(0, 0, 0, 0.3) 0px 0px 5px 0px;',
      '  overflow-y: auto;',
      '  overscroll-behavior: contain;',
      '}',
      '#' + ROOT_ID + '.__aibrowser-recorder-mode-mark .__aibrowser-recorder-mark {',
      '  border-color: #76b900;',
      '}',
      '#' + ROOT_ID + '.__aibrowser-recorder-mode-action .__aibrowser-recorder-mark {',
      '  border-color: #3860be;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark.is-visible {',
      '  display: block;',
      '}',
      '#' + ROOT_ID + '.__aibrowser-recorder-is-marking .__aibrowser-recorder-mark.is-visible {',
      '  margin-bottom: 14px;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-title {',
      '  margin-bottom: 10px;',
      '  font-size: 20px;',
      '  font-weight: 700;',
      '  color: #ffffff;',
      '  line-height: 1.25;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-preview {',
      '  margin-bottom: 14px;',
      '  color: #757575;',
      '  font-size: 14px;',
      '  line-height: 1.5;',
      '  word-break: break-word;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-field {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 8px;',
      '  margin-bottom: 14px;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-field label {',
      '  font-size: 14px;',
      '  font-weight: 700;',
      '  color: #a7a7a7;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-field input,',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-field select {',
      '  width: 100%;',
      '  padding: 12px 14px;',
      '  border: 1px solid #5e5e5e;',
      '  border-radius: 2px;',
      '  background: #0a0a0a;',
      '  color: #ffffff;',
      '  font-size: 15px;',
      '  line-height: 1.5;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-candidate {',
      '  position: relative;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-candidate-trigger {',
      '  width: 100%;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: flex-start;',
      '  gap: 10px;',
      '  min-height: 52px;',
      '  padding: 12px 14px;',
      '  border: 1px solid #5e5e5e;',
      '  border-radius: 2px;',
      '  background: #0a0a0a;',
      '  color: #ffffff;',
      '  font-size: 15px;',
      '  line-height: 1.5;',
      '  text-align: left;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-candidate-trigger:hover { border-color: #76b900; }',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-candidate-trigger::after {',
      '  content: "▾";',
      '  margin-left: auto;',
      '  flex-shrink: 0;',
      '  color: #a7a7a7;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-candidate-label {',
      '  flex: 1;',
      '  min-width: 0;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-candidate-menu {',
      '  position: absolute;',
      '  left: 0;',
      '  right: 0;',
      '  top: calc(100% + 6px);',
      '  z-index: 3;',
      '  display: none;',
      '  max-height: 240px;',
      '  overflow-y: auto;',
      '  padding: 6px;',
      '  border: 1px solid #5e5e5e;',
      '  border-radius: 2px;',
      '  background: #0a0a0a;',
      '  box-shadow: rgba(0, 0, 0, 0.3) 0px 0px 5px 0px;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-candidate-menu.is-open {',
      '  display: block;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-candidate-menu.is-open-up {',
      '  top: auto;',
      '  bottom: calc(100% + 6px);',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-candidate-option {',
      '  width: 100%;',
      '  display: block;',
      '  padding: 10px 12px;',
      '  border: none;',
      '  border-radius: 2px;',
      '  background: transparent;',
      '  color: #ffffff;',
      '  font-size: 14px;',
      '  line-height: 1.5;',
      '  text-align: left;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-candidate-option:hover {',
      '  background: rgba(30, 174, 219, 0.12);',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-candidate-option.is-selected {',
      '  background: rgba(118, 185, 0, 0.12);',
      '  color: #ffffff;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-table {',
      '  padding: 12px 14px;',
      '  border: 1px solid #5e5e5e;',
      '  border-radius: 2px;',
      '  background: #0a0a0a;',
      '  color: #ffffff;',
      '  font-size: 15px;',
      '  line-height: 1.5;',
      '  word-break: break-word;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-hint {',
      '  margin-bottom: 10px;',
      '  color: #757575;',
      '  font-size: 14px;',
      '  line-height: 1.5;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-write-mode {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  flex-wrap: wrap;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-write-mode button {',
      '  width: auto;',
      '  min-width: 140px;',
      '  min-height: 40px;',
      '  padding: 0 14px;',
      '  font-size: 14px;',
      '  border-radius: 2px;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-write-hint {',
      '  color: #757575;',
      '  font-size: 14px;',
      '  line-height: 1.5;',
      '}',
      '#' + ROOT_ID + ' button.is-active {',
      '  background: rgba(118, 185, 0, 0.1);',
      '  color: #ffffff;',
      '  border: 1px solid #76b900;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-mark-actions {',
      '  display: grid;',
      '  grid-template-columns: repeat(2, minmax(0, 1fr));',
      '  gap: 10px;',
      '  position: sticky;',
      '  bottom: -14px;',
      '  margin: 0 -16px -14px;',
      '  padding: 14px 16px;',
      '  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(10, 10, 10, 0.98) 28%);',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-loop-controls {',
      '  padding: 14px 18px 0;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-loop-panel {',
      '  border: 1px solid #76b900;',
      '  border-radius: 2px;',
      '  background: linear-gradient(180deg, rgba(118, 185, 0, 0.06) 0%, rgba(0, 0, 0, 0.92) 100%);',
      '  box-shadow: rgba(0, 0, 0, 0.3) 0px 0px 5px 0px;',
      '  padding: 14px 16px;',
      '}',
      '#' + ROOT_ID + '.__aibrowser-recorder-mode-action .__aibrowser-recorder-loop-panel {',
      '  border-color: #3860be;',
      '  background: linear-gradient(180deg, rgba(0, 70, 164, 0.1) 0%, rgba(0, 0, 0, 0.92) 100%);',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-loop-panel-title {',
      '  color: #76b900;',
      '  font-size: 14px;',
      '  font-weight: 700;',
      '  margin-bottom: 6px;',
      '  text-transform: uppercase;',
      '}',
      '#' + ROOT_ID + '.__aibrowser-recorder-mode-action .__aibrowser-recorder-loop-panel-title {',
      '  color: #58a6ff;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-loop-panel-hint {',
      '  color: #ffffff;',
      '  font-size: 15px;',
      '  line-height: 1.55;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-loop-panel-actions {',
      '  display: flex;',
      '  gap: 8px;',
      '  flex-wrap: nowrap;',
      '  margin-top: 10px;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-loop-panel-actions button {',
      '  flex: 1 1 0;',
      '  min-width: 0;',
      '  min-height: 40px;',
      '  padding: 0 12px;',
      '  border: 1px solid #76b900;',
      '  border-radius: 2px;',
      '  background: transparent;',
      '  color: #ffffff;',
      '  cursor: pointer;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-events {',
      '  flex: 1;',
      '  overflow: auto;',
      '  padding: 0 18px 16px;',
      '  overscroll-behavior: contain;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-empty {',
      '  padding: 18px 0;',
      '  color: #757575;',
      '  font-size: 15px;',
      '  line-height: 1.6;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-item {',
      '  padding: 16px 0;',
      '  border-bottom: 1px solid #5e5e5e;',
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
      '  line-height: 1.5;',
      '  font-size: 15px;',
      '  color: #ffffff;',
      '  font-weight: 700;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-delete {',
      '  flex-shrink: 0;',
      '  width: auto;',
      '  min-width: 64px;',
      '  max-width: none;',
      '  padding: 0 12px;',
      '  min-height: 32px;',
      '  border-radius: 2px;',
      '  background: transparent;',
      '  color: #a7a7a7;',
      '  border: 1px solid #5e5e5e;',
      '  font-size: 13px;',
      '  font-weight: 700;',
      '  line-height: 1;',
      '}',
      '#' + ROOT_ID + ' .__aibrowser-recorder-delete:hover { color: #ffffff; border-color: #76b900; background: rgba(30, 174, 219, 0.08); }',
      '#' + ROOT_ID + ' .__aibrowser-recorder-meta {',
      '  margin-top: 8px;',
      '  color: #757575;',
      '  font-size: 14px;',
      '  line-height: 1.55;',
      '  word-break: break-word;',
      '}',
      '@media (max-width: 640px) {',
      '  #' + ROOT_ID + ' {',
      '    right: 12px;',
      '    bottom: 12px;',
      '    width: min(520px, calc(100vw - 24px));',
      '    max-width: calc(100vw - 24px);',
      '  }',
      '  #' + ROOT_ID + ' .__aibrowser-recorder-header {',
      '    flex-direction: column;',
      '  }',
      '  #' + ROOT_ID + ' .__aibrowser-recorder-actions {',
      '    width: 100%;',
      '    flex: 0 0 auto;',
      '  }',
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

    function updateDropdownDirection(menu) {
      if (!(menu instanceof HTMLElement)) {
        return;
      }

      menu.classList.remove('is-open-up');
      const trigger = menu.parentElement?.querySelector('.__aibrowser-recorder-mark-candidate-trigger');
      if (!(trigger instanceof HTMLElement)) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const estimatedMenuHeight = Math.min(menu.scrollHeight || 240, 240);
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
        menu.classList.add('is-open-up');
      }
    }

    root.addEventListener('click', (event) => {
      const dropdownContainer = event.target instanceof HTMLElement
        ? event.target.closest('.__aibrowser-recorder-mark-candidate')
        : null;
      if (!dropdownContainer) {
        root.querySelectorAll('[data-role$="-menu"]').forEach((menu) => {
          if (menu instanceof HTMLElement) {
            menu.classList.remove('is-open');
          }
        });
      }

      const actionTarget = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
      if (!actionTarget) return;

      const action = actionTarget.getAttribute('data-action');
      if (action === 'cancel-mark') {
        state.nextRecordAction = 'append';
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

      if (action === 'start-loop-capture') {
        sendControl({ action: 'loop-control', loopAction: 'start' });
        return;
      }

      if (action === 'finish-first-loop-capture') {
        sendControl({ action: 'loop-control', loopAction: 'finish-first' });
        return;
      }

      if (action === 'start-last-loop-capture') {
        sendControl({ action: 'loop-control', loopAction: 'start-last' });
        return;
      }

      if (action === 'finish-loop-capture') {
        sendControl({ action: 'loop-control', loopAction: 'finish' });
        return;
      }

      if (action === 'cancel-loop-capture') {
        sendControl({ action: 'loop-control', loopAction: 'cancel' });
        return;
      }

      if (action === 'toggle-dropdown') {
        const menuRole = actionTarget.getAttribute('data-menu-role') || '';
        root.querySelectorAll('[data-role$="-menu"]').forEach((menu) => {
          if (!(menu instanceof HTMLElement)) {
            return;
          }
          if (menu.getAttribute('data-role') !== menuRole) {
            menu.classList.remove('is-open');
          }
        });
        const menu = root.querySelector('[data-role="' + menuRole + '"]');
        if (menu instanceof HTMLElement) {
          const willOpen = !menu.classList.contains('is-open');
          menu.classList.toggle('is-open');
          if (willOpen) {
            updateDropdownDirection(menu);
          } else {
            menu.classList.remove('is-open-up');
          }
        }
        return;
      }

      if (action === 'select-dropdown-option') {
        const dropdownType = actionTarget.getAttribute('data-dropdown-type') || '';
        const nextValue = actionTarget.getAttribute('data-value') || '';

        if (dropdownType === 'candidate') {
          const nextCandidateIndex = Number(nextValue || '0');
          const candidateTargets = Array.isArray(state.pendingMarkRequest?.candidateTargets)
            ? state.pendingMarkRequest.candidateTargets
            : [];
          const selectedCandidate = candidateTargets[nextCandidateIndex] || candidateTargets[0] || null;

          if (state.pendingMarkRequest) {
            state.pendingMarkRequest = {
              ...state.pendingMarkRequest,
              selector: selectedCandidate?.selector || state.pendingMarkRequest.selector || '',
              elementMeta: selectedCandidate?.elementMeta || state.pendingMarkRequest.elementMeta || {},
              selectedCandidateIndex: nextCandidateIndex
            };
          }

          const fieldType = getCurrentMarkFieldType();
          const nextAttribute = getDefaultAttribute(selectedCandidate?.elementMeta?.tagName, fieldType);
          if (state.pendingMarkRequest) {
            state.pendingMarkRequest.selectedAttribute = nextAttribute;
          }
          renderPanel();
          return;
        }

        if (dropdownType === 'table') {
          state.markConfig.selectedTableId = nextValue || '';
          if (state.pendingMarkRequest) {
            state.pendingMarkRequest.selectedFieldName = '';
          }
          renderPanel();
          return;
        }

        if (dropdownType === 'field') {
          if (state.pendingMarkRequest) {
            state.pendingMarkRequest.selectedFieldName = nextValue || '';
            state.pendingMarkRequest.selectedAttribute = getDefaultAttribute(
              state.pendingMarkRequest.elementMeta?.tagName,
              getCurrentMarkFieldType(nextValue)
            );
          }
          renderPanel();
          return;
        }

        if (dropdownType === 'attribute') {
          if (state.pendingMarkRequest) {
            state.pendingMarkRequest.selectedAttribute = nextValue || 'innerText';
          }
          renderPanel();
          return;
        }
      }

      if (action === 'start-new-record') {
        state.nextRecordAction = 'new';
        state.status = '当前标注将开始新记录';
        renderPanel();
        return;
      }

      if (action === 'save-mark') {
        if (!state.pendingMarkRequest) {
          return;
        }

        const tableId = state.markConfig.selectedTableId || '';
        const selectedTable = getCurrentMarkTable();
        const tableName = selectedTable?.name || '';
        const markFields = Array.isArray(selectedTable?.fields) ? selectedTable.fields : [];
        const selectedCandidateIndex = Number(state.pendingMarkRequest.selectedCandidateIndex || 0);
        const candidateTargets = Array.isArray(state.pendingMarkRequest?.candidateTargets)
          ? state.pendingMarkRequest.candidateTargets
          : [];
        const selectedCandidate = candidateTargets[selectedCandidateIndex] || candidateTargets[0] || null;
        const fieldName = String(state.pendingMarkRequest.selectedFieldName || markFields[0]?.name || '').trim();
        const fieldType = getCurrentMarkFieldType(fieldName);
        const attribute = state.pendingMarkRequest.selectedAttribute || getDefaultAttribute(selectedCandidate?.elementMeta?.tagName, fieldType);
        const recordAction = state.nextRecordAction === 'new' ? 'new' : 'append';

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
          request: {
            ...state.pendingMarkRequest,
            selector: selectedCandidate?.selector || state.pendingMarkRequest.selector || '',
            elementMeta: selectedCandidate?.elementMeta || state.pendingMarkRequest.elementMeta || {},
            selectedCandidateIndex,
            candidateTargets
          },
          fieldName,
          fieldType,
          tableId,
          tableName,
          attribute,
          recordAction
        });
        state.nextRecordAction = 'append';
        state.pendingMarkRequest = null;
        state.status = '正在保存字段标注...';
        renderPanel();
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
    const headerEl = root.querySelector('.__aibrowser-recorder-header');
    const loopControlsEl = root.querySelector('[data-role="loop-controls"]');

    statusEl.textContent = state.status || '';
    modeEl.textContent = state.mode === 'mark' ? '标注模式' : '动作模式';
    toggleButton.textContent = state.mode === 'mark' ? '切到动作' : '切到标注';
    root.classList.toggle('__aibrowser-recorder-mode-mark', state.mode === 'mark');
    root.classList.toggle('__aibrowser-recorder-mode-action', state.mode !== 'mark');
    root.classList.toggle('__aibrowser-recorder-is-marking', !!state.pendingMarkRequest);

    if (loopControlsEl instanceof HTMLElement) {
      const loopControl = state.loopControl || { active: false, phase: 'idle', title: '', hint: '', visibleEventIds: [] };
      if (!loopControl.active) {
        loopControlsEl.innerHTML = '<div class="__aibrowser-recorder-loop-panel"><div class="__aibrowser-recorder-loop-panel-title">循环录制</div><div class="__aibrowser-recorder-loop-panel-hint">开始录制首个循环子任务，后续可在这里继续控制尾部子任务录制。</div><div class="__aibrowser-recorder-loop-panel-actions"><button type="button" data-action="start-loop-capture">循环录制</button></div></div>';
      } else if (loopControl.phase === 'recording-first') {
        loopControlsEl.innerHTML = '<div class="__aibrowser-recorder-loop-panel"><div class="__aibrowser-recorder-loop-panel-title">首个循环子任务</div><div class="__aibrowser-recorder-loop-panel-hint">当前正在录制首个循环子任务，完成后会进入过渡期。</div><div class="__aibrowser-recorder-loop-panel-actions"><button type="button" data-action="finish-first-loop-capture">完成首个子任务</button><button type="button" data-action="cancel-loop-capture">取消循环录制</button></div></div>';
      } else if (loopControl.phase === 'transition') {
        loopControlsEl.innerHTML = '<div class="__aibrowser-recorder-loop-panel"><div class="__aibrowser-recorder-loop-panel-title">定位尾部样本</div><div class="__aibrowser-recorder-loop-panel-hint">当前处于过渡阶段，这段操作不会被记录。定位完成后再开始录制尾部子任务。</div><div class="__aibrowser-recorder-loop-panel-actions"><button type="button" data-action="start-last-loop-capture">开始录制尾部子任务</button><button type="button" data-action="cancel-loop-capture">取消循环录制</button></div></div>';
      } else {
        loopControlsEl.innerHTML = '<div class="__aibrowser-recorder-loop-panel"><div class="__aibrowser-recorder-loop-panel-title">尾部循环子任务</div><div class="__aibrowser-recorder-loop-panel-hint">当前正在录制尾部循环子任务，完成后系统会生成循环录制结果。</div><div class="__aibrowser-recorder-loop-panel-actions"><button type="button" data-action="finish-loop-capture">完成循环录制</button><button type="button" data-action="cancel-loop-capture">取消循环录制</button></div></div>';
      }
    }

    const loopControl = state.loopControl || { active: false, phase: 'idle', title: '', hint: '', visibleEventIds: [] };
    const visibleEvents = loopControl.active
      ? state.events.filter((event) => Array.isArray(loopControl.visibleEventIds) && loopControl.visibleEventIds.includes(event.id))
      : state.events;

    if (state.pendingMarkRequest) {
      const markTables = Array.isArray(state.markConfig?.tables) ? state.markConfig.tables : [];
      const selectedTableId = state.markConfig?.selectedTableId || markTables[0]?.id || '';
      const selectedTable = markTables.find((table) => table.id === selectedTableId) || markTables[0] || null;
      const markFields = Array.isArray(selectedTable?.fields) ? selectedTable.fields : [];
      const hasMarkTables = markTables.length > 0;
      const hasMarkFields = markFields.length > 0;
      const candidateTargets = Array.isArray(state.pendingMarkRequest?.candidateTargets) && state.pendingMarkRequest.candidateTargets.length
        ? state.pendingMarkRequest.candidateTargets
        : [{
            selector: state.pendingMarkRequest.selector || '',
            elementMeta: state.pendingMarkRequest.elementMeta || {},
            label: state.pendingMarkRequest.elementMeta?.tagName || state.pendingMarkRequest.selector || '当前元素'
          }];
      const selectedCandidateIndex = Math.min(
        Math.max(Number(state.pendingMarkRequest?.selectedCandidateIndex || 0), 0),
        Math.max(candidateTargets.length - 1, 0)
      );
      const selectedCandidate = candidateTargets[selectedCandidateIndex] || candidateTargets[0] || null;
      const selectedFieldName = state.pendingMarkRequest?.selectedFieldName || markFields[0]?.name || '';
      const selectedFieldType = getCurrentMarkFieldType(selectedFieldName);
      const selectedAttribute = state.pendingMarkRequest?.selectedAttribute || getDefaultAttribute(
        selectedCandidate?.elementMeta?.tagName,
        selectedFieldType
      );
      const nextRecordAction = state.markConfig?.disableRecordAction ? 'append' : (state.nextRecordAction === 'new' ? 'new' : 'append');
      const tableOptions = hasMarkTables
        ? markTables
            .map((table) => {
              const label = escapeHtml(table.name || '');
              const selectedClass = table.id === selectedTableId ? ' is-selected' : '';
              return '    <button type="button" class="__aibrowser-recorder-mark-candidate-option' + selectedClass + '" data-action="select-dropdown-option" data-dropdown-type="table" data-value="' + escapeAttributeValue(table.id || '') + '" title="' + label + '">' + label + '</button>';
            })
            .join('')
        : '';
      const markFieldOptions = hasMarkFields
        ? markFields
            .map((field) => {
              const label = escapeHtml(field.name || '') + ' (' + escapeHtml(field.type || 'text') + ')';
              const selectedClass = field.name === selectedFieldName ? ' is-selected' : '';
              return '    <button type="button" class="__aibrowser-recorder-mark-candidate-option' + selectedClass + '" data-action="select-dropdown-option" data-dropdown-type="field" data-value="' + escapeAttributeValue(field.name || '') + '" title="' + label + '">' + label + '</button>';
            })
            .join('')
        : '';
      const candidateOptions = candidateTargets
        .map((candidate, index) => {
          const label = escapeHtml(candidate.label || candidate.selector || ('候选元素 ' + (index + 1)));
          const selectedClass = index === selectedCandidateIndex ? ' is-selected' : '';
          return '    <button type="button" class="__aibrowser-recorder-mark-candidate-option' + selectedClass + '" data-action="select-dropdown-option" data-dropdown-type="candidate" data-value="' + index + '" title="' + label + '">' + label + '</button>';
        })
        .join('');
      const attributeOptions = [
        ['innerText', '显示文本 (innerText)'],
        ['text', '文本内容 (textContent)'],
        ['innerHTML', 'HTML 内容'],
        ['href', '链接地址 (href)'],
        ['src', '图片/资源地址 (src)'],
        ['backgroundImage', '背景图 (background-image)'],
        ['poster', '视频封面 (poster)'],
        ['value', '表单值 (value)'],
        ['alt', '替代文本 (alt)'],
        ['title', '标题 (title)']
      ]
        .map(([value, label]) => {
          const selectedClass = value === selectedAttribute ? ' is-selected' : '';
          const escapedLabel = escapeHtml(label);
          return '    <button type="button" class="__aibrowser-recorder-mark-candidate-option' + selectedClass + '" data-action="select-dropdown-option" data-dropdown-type="attribute" data-value="' + value + '" title="' + escapedLabel + '">' + escapedLabel + '</button>';
        })
        .join('');
      markBox.classList.add('is-visible');
      markBox.innerHTML = [
        '<div class="__aibrowser-recorder-mark-title">确认字段标注</div>',
        '<div class="__aibrowser-recorder-mark-preview">',
        '  <div><strong>selector:</strong> ' + (selectedCandidate?.selector || state.pendingMarkRequest.selector || '') + '</div>',
        selectedCandidate?.elementMeta?.text
          ? '  <div><strong>文本:</strong> ' + selectedCandidate.elementMeta.text + '</div>'
          : '',
        selectedCandidate?.elementMeta?.tagName
          ? '  <div><strong>标签:</strong> ' + selectedCandidate.elementMeta.tagName + '</div>'
          : '',
        '</div>',
        candidateTargets.length > 1
          ? '<div class="__aibrowser-recorder-mark-field"><label>目标元素</label>' + buildDropdownTrigger('目标元素', selectedCandidate?.label || '', 'mark-candidate-menu') + '<div class="__aibrowser-recorder-mark-candidate-menu" data-role="mark-candidate-menu">' + candidateOptions + '</div></div></div>'
          : '',
        '<div class="__aibrowser-recorder-mark-field">',
        '  <label>数据表</label>',
        hasMarkTables
          ? buildDropdownTrigger('数据表', selectedTable?.name || '', 'mark-table-menu') + '<div class="__aibrowser-recorder-mark-candidate-menu" data-role="mark-table-menu">' + tableOptions + '</div></div>'
          : '<div class="__aibrowser-recorder-mark-hint">当前还没有数据表，请先在工作台创建数据表。</div>',
        '</div>',
        (state.markConfig?.disableRecordAction
          ? ''
          : [
              '<div class="__aibrowser-recorder-mark-field">',
              '  <label>写入方式</label>',
              '  <div class="__aibrowser-recorder-mark-write-mode">',
              '    <button type="button" data-action="start-new-record"' + (nextRecordAction === 'new' ? ' class="is-active"' : '') + '>开始新记录</button>',
              '    <div class="__aibrowser-recorder-mark-write-hint">' + (nextRecordAction === 'new' ? '本次保存将开始新记录' : '默认继续当前记录') + '</div>',
              '  </div>',
              '</div>'
            ].join('')),
        '<div class="__aibrowser-recorder-mark-field">',
        '  <label>字段名</label>',
        hasMarkFields
          ? buildDropdownTrigger('字段名', (markFields.find((field) => field.name === selectedFieldName)?.name || selectedFieldName || '') + ' (' + selectedFieldType + ')', 'mark-field-menu') + '<div class="__aibrowser-recorder-mark-candidate-menu" data-role="mark-field-menu">' + markFieldOptions + '</div></div>'
          : '<div class="__aibrowser-recorder-mark-hint">' + (hasMarkTables ? '当前数据表没有字段，请先在工作台的数据表中创建字段。' : '当前还没有数据表，请先在工作台创建数据表。') + '</div>',
        '</div>',
        '<div class="__aibrowser-recorder-mark-field">',
        '  <label>提取属性</label>',
        buildDropdownTrigger('提取属性', ({
          innerText: '显示文本 (innerText)',
          text: '文本内容 (textContent)',
          innerHTML: 'HTML 内容',
          href: '链接地址 (href)',
          src: '图片/资源地址 (src)',
          backgroundImage: '背景图 (background-image)',
          poster: '视频封面 (poster)',
          value: '表单值 (value)',
          alt: '替代文本 (alt)',
          title: '标题 (title)'
        }[selectedAttribute] || selectedAttribute), 'mark-attribute-menu') + '<div class="__aibrowser-recorder-mark-candidate-menu" data-role="mark-attribute-menu">' + attributeOptions + '</div></div>',
        '</div>',
        '<div class="__aibrowser-recorder-mark-actions">',
        '  <button type="button" data-action="save-mark"' + (hasMarkFields && hasMarkTables ? '' : ' disabled') + '>保存标注</button>',
        '  <button type="button" data-action="cancel-mark" class="secondary">取消</button>',
        '</div>'
      ].join('');

      if (markBox instanceof HTMLElement && headerEl instanceof HTMLElement) {
        const loopControlsHeight =
          loopControlsEl instanceof HTMLElement && loopControlsEl.childElementCount > 0
            ? loopControlsEl.offsetHeight
            : 0;
        const availableHeight = Math.max(root.clientHeight - headerEl.offsetHeight - loopControlsHeight - 36, 180);
        markBox.style.height = availableHeight + 'px';
        markBox.style.maxHeight = availableHeight + 'px';
      }
    } else {
      markBox.classList.remove('is-visible');
      markBox.innerHTML = '';
      if (markBox instanceof HTMLElement) {
        markBox.style.height = '';
        markBox.style.maxHeight = '';
      }
    }

    if (!visibleEvents.length) {
      if (loopControl.active) {
        eventsEl.innerHTML = [
          '<div class="__aibrowser-recorder-item">',
          '  <div class="__aibrowser-recorder-meta"><strong>' + escapeHtml(loopControl.title || '循环子任务录制') + '</strong></div>',
          '  <div class="__aibrowser-recorder-meta">' + escapeHtml(loopControl.hint || '') + '</div>',
          '</div>',
          '<div class="__aibrowser-recorder-empty">' + (loopControl.phase === 'transition' ? '当前处于过渡阶段，这段操作不会被记录。' : '当前子任务还没有记录到事件。') + '</div>'
        ].join('');
        return;
      }
      eventsEl.innerHTML = '<div class="__aibrowser-recorder-empty">录制开始后，这里显示关键操作。</div>';
      return;
    }

    eventsEl.innerHTML =
      (loopControl.active
        ? [
            '<div class="__aibrowser-recorder-item">',
            '  <div class="__aibrowser-recorder-meta"><strong>' + escapeHtml(loopControl.title || '循环子任务录制') + '</strong></div>',
            '  <div class="__aibrowser-recorder-meta">' + escapeHtml(loopControl.hint || '') + '</div>',
            '</div>'
          ].join('')
        : '') +
      visibleEvents
      .map((event) => {
        const meta = [];
        if (event.title) meta.push('<div><strong>页面:</strong> ' + event.title + '</div>');
        if (event.selector) meta.push('<div><strong>selector:</strong> ' + event.selector + '</div>');
        if (event.fieldName) meta.push('<div><strong>字段:</strong> ' + event.fieldName + '</div>');
        if (event.tableName) meta.push('<div><strong>数据表:</strong> ' + event.tableName + '</div>');
        if (event.recordAction) meta.push('<div><strong>写入方式:</strong> ' + (event.recordAction === 'new' ? '开始新记录' : '继续当前记录') + '</div>');
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
          elementMeta: getElementMeta(target),
          candidateTargets: collectMarkCandidates(target, event.clientX, event.clientY),
          selectedCandidateIndex: 0
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
            tables: Array.isArray(config.tables) ? config.tables : [],
            disableRecordAction: !!config.disableRecordAction
          }
        : { selectedTableId: '', tables: [], disableRecordAction: false };
      renderPanel();
    },
    setLoopControl(control) {
      state.loopControl = control && typeof control === 'object'
        ? {
            active: !!control.active,
            phase: control.phase || 'idle',
            title: control.title || '',
            hint: control.hint || '',
            visibleEventIds: Array.isArray(control.visibleEventIds) ? control.visibleEventIds : []
          }
        : {
            active: false,
            phase: 'idle',
            title: '',
            hint: '',
            visibleEventIds: []
          };
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
      state.nextRecordAction = 'append';
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
    recordAction?: RecordingEvent['recordAction'];
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
    recordAction: payload.recordAction || 'append',
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

export function resolveRecordedNavigationMeta(params: {
  action: RecordingEvent['action'];
  previousEvent?: RecordingEvent;
  openerAction?: RecordingEvent['openerAction'];
}): Pick<RecordingEvent, 'navigationKind' | 'navigationSource'> {
  if (params.action === 'back') {
    return { navigationKind: 'derived', navigationSource: 'back' };
  }

  if (params.action === 'forward') {
    return { navigationKind: 'derived', navigationSource: 'forward' };
  }

  if (params.openerAction === 'contextmenu' || params.openerAction === 'middle-click') {
    return {
      navigationKind: 'derived',
      navigationSource: params.openerAction
    };
  }

  if (params.previousEvent?.action === 'click') {
    return { navigationKind: 'derived', navigationSource: 'click' };
  }

  return { navigationKind: 'explicit', navigationSource: 'direct' };
}

export class BrowserRecorder {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private callbacks: BrowserRecorderCallbacks;
  private mode: RecordingMode = 'action';
  private stopRequested = false;
  private captureEnabled = true;
  private pageIds = new WeakMap<Page, string>();
  private lastUrls = new WeakMap<Page, string>();
  private pageHistory = new WeakMap<Page, RecordingPageHistoryState>();
  private spawnedPageOpeners = new WeakMap<Page, PendingOpenIntent>();
  private currentStatusMessage = '录制已启动，请开始操作';
  private loopControlState: RecordingLoopUiState = {
    active: false,
    phase: 'idle',
    title: '',
    hint: '',
    visibleEventIds: []
  };
  private eventSequence = 0;
  private recordedEvents: RecordingEvent[] = [];
  private pendingMarkRequests = new Map<string, RecordingMarkRequest>();
  private pendingOpenIntents: PendingOpenIntent[] = [];
  private markConfig: RecordingMarkConfig = {
    selectedTableId: '',
    tables: [],
    disableRecordAction: false
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
      tables: Array.isArray(config.tables) ? config.tables : [],
      disableRecordAction: Boolean(config.disableRecordAction)
    };
    await this.broadcastMarkConfig();
  }

  async setLoopControl(control: {
    active: boolean;
    phase: 'idle' | 'recording-first' | 'transition' | 'recording-last';
    title?: string;
    hint?: string;
    visibleEventIds?: string[];
  }): Promise<void> {
    this.loopControlState = {
      active: Boolean(control.active),
      phase: control.phase,
      title: control.title || '',
      hint: control.hint || '',
      visibleEventIds: Array.isArray(control.visibleEventIds) ? control.visibleEventIds.filter(id => typeof id === 'string') : []
    };
    await this.broadcastLoopControl();
  }

  async setCaptureEnabled(enabled: boolean): Promise<void> {
    this.captureEnabled = enabled;
    this.currentStatusMessage = enabled ? '已恢复录制采集' : '录制采集已暂停';
    this.callbacks.onStatus?.({
      state: enabled ? 'capture-resumed' : 'capture-paused',
      message: this.currentStatusMessage,
      mode: this.mode
    });
    await this.broadcastStatus(this.currentStatusMessage);
  }

  async appendLoopCaptureEvent(payload: {
    summary: string;
    firstSampleIds: string[];
    lastSampleIds: string[];
    loopCapture: RecordingEvent['loopCapture'];
  }): Promise<void> {
    const removableIds = new Set([...(payload.firstSampleIds || []), ...(payload.lastSampleIds || [])]);
    this.recordedEvents = this.recordedEvents.filter(event => !removableIds.has(event.id));

    this.addRecordedEvent({
      id: this.nextEventId(),
      kind: 'meta',
      action: 'loop-capture',
      timestamp: Date.now(),
      pageId: 'loop-capture',
      url: '',
      title: '',
      summary: payload.summary || '循环录制',
      loopCapture: payload.loopCapture || undefined
    });

    this.currentStatusMessage = '已写入循环录制结果';
    this.callbacks.onStatus?.({ state: 'event-recorded', message: this.currentStatusMessage, mode: this.mode });
    await this.broadcastEvents();
    await this.broadcastStatus(this.currentStatusMessage);
  }

  async confirmMark(
    request: RecordingMarkRequest,
    payload: {
      fieldName: string;
      fieldType: RecordingEvent['fieldType'];
      tableId?: string;
      tableName?: string;
      attribute?: string;
      recordAction?: RecordingEvent['recordAction'];
    }
  ): Promise<void> {
    const normalizedRequest = createRecordingMarkRequest(request.pageId, request, {
      url: request.url,
      title: request.title || ''
    });

    if (!this.captureEnabled) {
      return;
    }
    const event = createRecordedMarkEvent(normalizedRequest, payload);
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
      if (!this.captureEnabled) {
        return;
      }
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

    if (!this.captureEnabled) {
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

      if (!this.captureEnabled) {
        return;
      }

      const action = this.resolveNavigationAction(page, url);
      const opener = action === 'navigate' ? this.consumePendingOpenIntent(url) : undefined;
      const navigationMeta = resolveRecordedNavigationMeta({
        action,
        previousEvent: this.recordedEvents[0],
        openerAction: opener?.action
      });
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
        openerElementMeta: opener?.elementMeta,
        navigationKind: navigationMeta.navigationKind,
        navigationSource: navigationMeta.navigationSource
      };

      if (opener && (opener.action === 'contextmenu' || opener.action === 'middle-click')) {
        this.spawnedPageOpeners.set(page, opener);
      }

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

    page.on('close', async () => {
      if (this.stopRequested) {
        return;
      }

      const opener = this.spawnedPageOpeners.get(page);
      this.spawnedPageOpeners.delete(page);
      if (!opener || !this.captureEnabled) {
        return;
      }

      const backEvent: RecordingEvent = {
        id: this.nextEventId(),
        kind: 'action',
        action: 'back',
        timestamp: Date.now(),
        pageId: opener.pageId,
        url: opener.url,
        title: opener.title || '',
        openerPageId: opener.pageId,
        openerUrl: opener.url,
        openerSelector: opener.selector,
        openerAction: opener.action,
        openerElementMeta: opener.elementMeta,
        navigationKind: 'derived',
        navigationSource: 'back'
      };

      this.addRecordedEvent(backEvent);
      this.currentStatusMessage = '已记录：返回';
      this.callbacks.onStatus?.({ state: 'event-recorded', message: this.currentStatusMessage, mode: this.mode });
      await this.broadcastEvents();
      await this.broadcastStatus(this.currentStatusMessage);
    });

    await this.installRecorderRuntime(page);
    await this.captureSpawnedPageNavigationFallback(page, pageId);
  }

  private async captureSpawnedPageNavigationFallback(page: Page, pageId: string): Promise<void> {
    if (this.stopRequested || !this.captureEnabled) {
      return;
    }

    if (this.lastUrls.has(page) || this.pendingOpenIntents.length === 0) {
      return;
    }

    const pendingIntent = this.pendingOpenIntents[this.pendingOpenIntents.length - 1];
    if (!pendingIntent || (pendingIntent.action !== 'contextmenu' && pendingIntent.action !== 'middle-click')) {
      return;
    }

    await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => null);

    const url = page.url();
    if (!url || url === 'about:blank' || this.lastUrls.get(page) === url) {
      return;
    }

    const opener = this.consumePendingOpenIntent(url);
    if (!opener || (opener.action !== 'contextmenu' && opener.action !== 'middle-click')) {
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
    const navigationMeta = resolveRecordedNavigationMeta({
      action,
      previousEvent: this.recordedEvents[0],
      openerAction: opener.action
    });

    const event: RecordingEvent = {
      id: this.nextEventId(),
      kind: 'action',
      action,
      timestamp: Date.now(),
      pageId,
      url,
      title,
      openerPageId: opener.pageId,
      openerUrl: opener.url,
      openerSelector: opener.selector,
      openerAction: opener.action,
      openerElementMeta: opener.elementMeta,
      navigationKind: navigationMeta.navigationKind,
      navigationSource: navigationMeta.navigationSource
    };

    this.spawnedPageOpeners.set(page, opener);
    this.addRecordedEvent(event);
    this.currentStatusMessage = `已记录：${this.describeAction(action)}`;
    this.callbacks.onStatus?.({ state: 'event-recorded', message: this.currentStatusMessage, mode: this.mode });
    await this.suppressNextZeroScroll(page);
    await this.broadcastEvents();
    await this.pushStatusToPage(page, this.currentStatusMessage);
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
    await this.pushEventsToPage(page);
    await this.pushLoopControlToPage(page);
    const pageId = this.pageIds.get(page);
    if (pageId) {
      const pendingMark = this.pendingMarkRequests.get(pageId);
      if (pendingMark) {
        await this.pushPendingMarkToPage(page, pendingMark);
      }
    }
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

  private async pushEventsToPage(page: Page): Promise<void> {
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
    await this.pushEventsToPage(page);
  }

  private async pushLoopControlToPage(page: Page): Promise<void> {
    try {
      await page.evaluate((payload) => {
        (globalThis as any).__aibrowserRecorder?.setLoopControl?.(payload);
      }, this.loopControlState);
    } catch {
      // ignore
    }
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
    await Promise.all(this.context.pages().map(page => this.pushEventsToPage(page)));
  }

  private async broadcastLoopControl(): Promise<void> {
    if (!this.context) return;
    await Promise.all(this.context.pages().map(page => this.pushLoopControlToPage(page)));
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
      'field-mark': '标注字段',
      'loop-capture': '循环录制'
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
          attribute: typeof payload.attribute === 'string' ? payload.attribute : 'innerText',
          recordAction: payload.recordAction === 'new' ? 'new' : 'append'
        });
        return;
      }

      if (payload.action === 'delete-event' && payload.eventId) {
        await this.deleteEvent(payload.eventId);
        return;
      }

      if (payload.action === 'loop-control' && payload.loopAction) {
        const loopAction = payload.loopAction;
        if (loopAction === 'start' || loopAction === 'finish-first' || loopAction === 'start-last' || loopAction === 'finish' || loopAction === 'cancel') {
          this.callbacks.onLoopControl?.({ action: loopAction });
        }
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
