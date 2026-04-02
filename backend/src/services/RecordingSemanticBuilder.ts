export interface RecordingElementSnapshot {
  selector?: string;
  tagName?: string;
  text?: string;
  id?: string;
  className?: string;
  href?: string;
  src?: string;
  value?: string;
}

export interface RecordingInputEvent {
  id?: string;
  step?: number;
  kind?: 'action' | 'mark' | string;
  action?: string;
  timestamp?: number;
  pageId?: string;
  url?: string;
  title?: string;
  selector?: string;
  value?: string;
  fieldName?: string;
  fieldType?: 'text' | 'image' | 'video' | 'link' | 'custom' | string;
  elementMeta?: RecordingElementSnapshot;
  target?: RecordingElementSnapshot;
  input?: {
    value?: string;
  };
  scroll?: {
    target?: 'page' | 'element' | string;
    x?: number;
    y?: number;
  };
  field?: {
    name?: string;
    type?: string;
  };
  openerPageId?: string;
  openerUrl?: string;
  openerSelector?: string;
  openerAction?: 'contextmenu' | 'middle-click' | string;
  openerElementMeta?: RecordingElementSnapshot;
  opener?: {
    pageId?: string;
    url?: string;
    selector?: string;
    action?: string;
    href?: string;
    text?: string;
    tagName?: string;
  };
  raw?: {
    value?: string;
  };
}

export interface RecordingSemanticStep {
  step: number;
  stepId: string;
  kind: 'action' | 'mark';
  action: string;
  summary: string;
  signal: 'high' | 'medium' | 'low';
  noiseReason?: string;
  timestamp: number;
  pageId: string;
  page: {
    url: string;
    title: string;
  };
  target: RecordingElementSnapshot;
  input?: {
    value: string;
  };
  scroll?: {
    target: string;
    x: number;
    y: number;
  };
  field?: {
    name: string;
    type: string;
  };
  opener?: {
    pageId: string;
    url: string;
    selector: string;
    action: string;
    href: string;
    text: string;
    tagName: string;
  };
}

export interface RecordingSemanticPackage {
  schemaVersion: 'recording.semantic.v1';
  generatedAt: string;
  recorder: {
    mode: string;
    status: string;
  };
  summary: {
    totalSteps: number;
    pageCount: number;
    actionCounts: Record<string, number>;
    markedFields: Array<{
      name: string;
      type: string;
      pageId: string;
      selector: string;
    }>;
    likelyGoal: string;
  };
  pages: Array<{
    pageId: string;
    pageIndex: number;
    firstSeenStep: number;
    lastSeenStep: number;
    latestUrl: string;
    latestTitle: string;
    urls: string[];
    titles: string[];
    openedFrom: null | {
      pageId: string;
      url: string;
      selector: string;
      action: string;
      href: string;
    };
    markedFields: Array<{
      name: string;
      type: string;
      selector: string;
    }>;
  }>;
  navigationChains: Array<{
    step: number;
    fromPageId: string;
    fromUrl: string;
    toPageId: string;
    toUrl: string;
    triggerAction: string;
    triggerSelector: string;
  }>;
  semanticSteps: RecordingSemanticStep[];
  rawEvents: RecordingInputEvent[];
}

interface RecordingPayloadInput {
  recorder?: {
    mode?: string;
    status?: string;
  };
  mode?: string;
  status?: string;
  events?: RecordingInputEvent[];
}

export class RecordingSemanticBuilder {
  static build(payload: RecordingPayloadInput | RecordingInputEvent[]): RecordingSemanticPackage {
    const events = this.extractEvents(payload);
    const orderedEvents = events
      .map((event, index) => this.normalizeEvent(event, index + 1))
      .sort((a, b) => a.step - b.step);

    const actionCounts: Record<string, number> = {};
    const markedFields: Array<{ name: string; type: string; pageId: string; selector: string }> = [];
    const pageOrder: string[] = [];
    const pages = new Map<string, {
      pageId: string;
      firstSeenStep: number;
      lastSeenStep: number;
      latestUrl: string;
      latestTitle: string;
      urls: Set<string>;
      titles: Set<string>;
      openedFrom: null | {
        pageId: string;
        url: string;
        selector: string;
        action: string;
        href: string;
      };
      markedFields: Array<{
        name: string;
        type: string;
        selector: string;
      }>;
    }>();
    const navigationChains: RecordingSemanticPackage['navigationChains'] = [];

    orderedEvents.forEach(event => {
      actionCounts[event.action] = (actionCounts[event.action] || 0) + 1;

      if (!pages.has(event.pageId)) {
        pageOrder.push(event.pageId);
        pages.set(event.pageId, {
          pageId: event.pageId,
          firstSeenStep: event.step,
          lastSeenStep: event.step,
          latestUrl: event.page.url,
          latestTitle: event.page.title,
          urls: new Set(event.page.url ? [event.page.url] : []),
          titles: new Set(event.page.title ? [event.page.title] : []),
          openedFrom: event.opener
            ? {
                pageId: event.opener.pageId,
                url: event.opener.url,
                selector: event.opener.selector,
                action: event.opener.action,
                href: event.opener.href
              }
            : null,
          markedFields: []
        });
      }

      const page = pages.get(event.pageId)!;
      page.lastSeenStep = event.step;
      if (event.page.url) {
        page.latestUrl = event.page.url;
        page.urls.add(event.page.url);
      }
      if (event.page.title) {
        page.latestTitle = event.page.title;
        page.titles.add(event.page.title);
      }

      if (!page.openedFrom && event.opener) {
        page.openedFrom = {
          pageId: event.opener.pageId,
          url: event.opener.url,
          selector: event.opener.selector,
          action: event.opener.action,
          href: event.opener.href
        };
      }

      if (event.field?.name) {
        const field = {
          name: event.field.name,
          type: event.field.type,
          pageId: event.pageId,
          selector: event.target.selector || ''
        };
        markedFields.push(field);
        page.markedFields.push({
          name: field.name,
          type: field.type,
          selector: field.selector
        });
      }

      if (event.action === 'navigate' && event.opener?.pageId) {
        navigationChains.push({
          step: event.step,
          fromPageId: event.opener.pageId,
          fromUrl: event.opener.url,
          toPageId: event.pageId,
          toUrl: event.page.url,
          triggerAction: event.opener.action,
          triggerSelector: event.opener.selector
        });
      }
    });

    return {
      schemaVersion: 'recording.semantic.v1',
      generatedAt: new Date().toISOString(),
      recorder: {
        mode: Array.isArray(payload) ? 'action' : payload.recorder?.mode || payload.mode || 'action',
        status: Array.isArray(payload) ? '' : payload.recorder?.status || payload.status || ''
      },
      summary: {
        totalSteps: orderedEvents.length,
        pageCount: pageOrder.length,
        actionCounts,
        markedFields,
        likelyGoal: this.inferLikelyGoal(markedFields, orderedEvents)
      },
      pages: pageOrder.map((pageId, index) => {
        const page = pages.get(pageId)!;
        return {
          pageId,
          pageIndex: index + 1,
          firstSeenStep: page.firstSeenStep,
          lastSeenStep: page.lastSeenStep,
          latestUrl: page.latestUrl,
          latestTitle: page.latestTitle,
          urls: Array.from(page.urls),
          titles: Array.from(page.titles),
          openedFrom: page.openedFrom,
          markedFields: page.markedFields
        };
      }),
      navigationChains,
      semanticSteps: this.markNoiseAndSignals(orderedEvents),
      rawEvents: orderedEvents.map(event => this.toRawEvent(event))
    };
  }

  private static extractEvents(payload: RecordingPayloadInput | RecordingInputEvent[]): RecordingInputEvent[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.events)) {
      return payload.events;
    }

    throw new Error('缺少录制事件列表');
  }

  private static normalizeEvent(event: RecordingInputEvent, fallbackStep: number): RecordingSemanticStep {
    const target = event.target || {
      selector: event.selector || '',
      tagName: event.elementMeta?.tagName || '',
      text: event.elementMeta?.text || '',
      id: event.elementMeta?.id || '',
      className: event.elementMeta?.className || '',
      href: event.elementMeta?.href || '',
      src: event.elementMeta?.src || '',
      value: event.elementMeta?.value || ''
    };
    const scroll = event.scroll || this.parseScrollValue(event.value || event.raw?.value);
    const field = event.field || (
      event.fieldName
        ? {
            name: event.fieldName,
            type: String(event.fieldType || 'text')
          }
        : undefined
    );
    const opener = event.opener || (
      event.openerPageId || event.openerSelector || event.openerElementMeta?.href
        ? {
            pageId: event.openerPageId || '',
            url: event.openerUrl || '',
            selector: event.openerSelector || '',
            action: String(event.openerAction || ''),
            href: event.openerElementMeta?.href || '',
            text: this.normalizeText(event.openerElementMeta?.text),
            tagName: event.openerElementMeta?.tagName || ''
          }
        : undefined
    );
    const step = Number.isFinite(event.step) ? Number(event.step) : fallbackStep;
    const action = String(event.action || 'unknown');
    const normalizedEvent: RecordingSemanticStep = {
      step,
      stepId: String(event.id || `step-${step}`),
      kind: event.kind === 'mark' ? 'mark' : 'action',
      action,
      summary: '',
      signal: 'medium',
      timestamp: Number.isFinite(event.timestamp) ? Number(event.timestamp) : Date.now(),
      pageId: String(event.pageId || 'page-unknown'),
      page: {
        url: String(event.url || ''),
        title: String(event.title || '')
      },
      target: {
        selector: target.selector || '',
        tagName: target.tagName || '',
        text: this.normalizeText(target.text),
        id: target.id || '',
        className: target.className || '',
        href: target.href || '',
        src: target.src || '',
        value: target.value || ''
      },
      input: action === 'type' || action === 'select'
        ? { value: String(event.input?.value || event.value || '') }
        : undefined,
      scroll: scroll
        ? {
            target: String(scroll.target || 'page'),
            x: Number(scroll.x || 0),
            y: Number(scroll.y || 0)
          }
        : undefined,
      field: field
        ? {
            name: String(field.name || ''),
            type: String(field.type || 'text')
          }
        : undefined,
      opener: opener
        ? {
            pageId: opener.pageId || '',
            url: opener.url || '',
            selector: opener.selector || '',
            action: opener.action || '',
            href: opener.href || '',
            text: this.normalizeText(opener.text),
            tagName: opener.tagName || ''
          }
        : undefined
    };

    normalizedEvent.summary = this.buildSummary(normalizedEvent);
    return normalizedEvent;
  }

  private static markNoiseAndSignals(events: RecordingSemanticStep[]): RecordingSemanticStep[] {
    return events.map((event, index) => {
      const previous = index > 0 ? events[index - 1] : undefined;
      const duplicateAction =
        previous &&
        previous.action === event.action &&
        previous.pageId === event.pageId &&
        previous.target.selector === event.target.selector &&
        event.timestamp - previous.timestamp < 1500;

      if (event.kind === 'mark') {
        return { ...event, signal: 'high' };
      }

      if (['navigate', 'click', 'contextmenu', 'middle-click', 'type', 'select', 'field-mark'].includes(event.action)) {
        return { ...event, signal: 'high' };
      }

      if (event.action === 'scroll') {
        if (duplicateAction) {
          return { ...event, signal: 'low', noiseReason: '短时间内重复滚动，可能只是探索过程' };
        }
        return { ...event, signal: 'medium' };
      }

      if (duplicateAction) {
        return { ...event, signal: 'low', noiseReason: '短时间内重复动作，可能是试探性操作' };
      }

      return { ...event, signal: ['back', 'forward'].includes(event.action) ? 'medium' : event.signal };
    });
  }

  private static buildSummary(event: RecordingSemanticStep): string {
    if (event.kind === 'mark' && event.field) {
      return `用户将元素 ${event.target.selector || event.target.text || event.target.tagName || 'unknown'} 标注为字段 ${event.field.name} (${event.field.type})`;
    }

    switch (event.action) {
      case 'navigate':
        if (event.opener?.selector) {
          return `用户从 ${event.opener.selector} 触发跳转，进入新页面 ${event.page.url}`;
        }
        return `用户访问页面 ${event.page.url}`;
      case 'click':
        return `用户点击元素 ${event.target.selector || event.target.text || event.target.tagName || 'unknown'}`;
      case 'contextmenu':
        return `用户右键元素 ${event.target.selector || event.target.text || event.target.tagName || 'unknown'}`;
      case 'middle-click':
        return `用户通过中键打开元素 ${event.target.selector || event.target.text || event.target.tagName || 'unknown'}`;
      case 'type':
        return `用户在 ${event.target.selector || '目标输入框'} 输入文本`;
      case 'select':
        return `用户在 ${event.target.selector || '目标下拉框'} 选择选项`;
      case 'scroll':
        return event.scroll?.target === 'element'
          ? `用户滚动容器元素 ${event.target.selector || 'unknown'}`
          : '用户滚动页面';
      case 'back':
        return '用户返回上一页';
      case 'forward':
        return '用户前进到下一页';
      default:
        return `用户执行动作 ${event.action}`;
    }
  }

  private static parseScrollValue(rawValue?: string) {
    if (!rawValue) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (parsed && typeof parsed === 'object') {
        return parsed as { target?: string; x?: number; y?: number };
      }
    } catch {
      return undefined;
    }

    return undefined;
  }

  private static inferLikelyGoal(
    markedFields: Array<{ name: string; type: string }>,
    events: RecordingSemanticStep[]
  ): string {
    if (markedFields.length > 0) {
      const fieldNames = markedFields.map(field => field.name).join('、');
      return `用户很可能想采集这些字段：${fieldNames}`;
    }

    const navigations = events.filter(event => event.action === 'navigate').length;
    const clicks = events.filter(event => event.action === 'click').length;
    if (navigations > 0 && clicks > 0) {
      return '用户很可能在探索从列表页进入详情页的采集流程';
    }

    return '用户很可能在录制一个网页采集工作流';
  }

  private static toRawEvent(event: RecordingSemanticStep): RecordingInputEvent {
    return {
      id: event.stepId,
      step: event.step,
      kind: event.kind,
      action: event.action,
      timestamp: event.timestamp,
      pageId: event.pageId,
      url: event.page.url,
      title: event.page.title,
      selector: event.target.selector,
      value: event.input?.value || '',
      fieldName: event.field?.name,
      fieldType: event.field?.type,
      target: event.target,
      input: event.input,
      scroll: event.scroll,
      opener: event.opener
    };
  }

  private static normalizeText(value?: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }
}
