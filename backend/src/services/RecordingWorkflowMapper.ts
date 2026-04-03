import { Workflow } from './WorkflowInterpreter';

interface RecordingV2Event {
  step?: number;
  kind?: 'action' | 'mark' | string;
  action?: string;
  pageId?: string;
  page?: {
    url?: string;
    title?: string;
  };
  target?: {
    selector?: string;
    href?: string;
  };
  input?: {
    value?: string;
  };
  scroll?: {
    target?: string;
  };
  field?: {
    name?: string;
    type?: string;
  };
}

interface RecordingV2Payload {
  schemaVersion?: string;
  events?: RecordingV2Event[];
}

type SupportedAction = 'navigate' | 'click' | 'type' | 'select' | 'scroll' | 'back' | 'forward' | 'field-mark';

function createPorts(type: string) {
  switch (type) {
    case 'extract':
      return {
        inputs: [{ id: 'in', name: '输入', type: 'flow' }],
        outputs: [
          { id: 'out', name: '输出', type: 'flow' },
          { id: 'data', name: '数据', type: 'data' }
        ]
      };
    default:
      return {
        inputs: [{ id: 'in', name: '输入', type: 'flow' }],
        outputs: [{ id: 'out', name: '输出', type: 'flow' }]
      };
  }
}

function createBlock(type: string, label: string, category: string, index: number, data: any) {
  const ports = createPorts(type);
  return {
    id: `recorded-${type}-${index + 1}`,
    type,
    label,
    category,
    position: {
      x: 160 + index * 240,
      y: 180
    },
    data,
    inputs: ports.inputs,
    outputs: ports.outputs
  };
}

function createConnection(sourceId: string, targetId: string, index: number) {
  return {
    id: `recorded-conn-${index + 1}`,
    source: sourceId,
    sourceHandle: 'source-right',
    target: targetId,
    targetHandle: 'target-left'
  };
}

function normalizeEvents(payload: RecordingV2Payload): RecordingV2Event[] {
  return Array.isArray(payload.events)
    ? [...payload.events].sort((a, b) => Number(a.step || 0) - Number(b.step || 0))
    : [];
}

function isSupportedAction(action: string): action is SupportedAction {
  return ['navigate', 'click', 'type', 'select', 'scroll', 'back', 'forward', 'field-mark'].includes(action);
}

export class RecordingWorkflowMapper {
  static map(payload: RecordingV2Payload): Workflow {
    const events = normalizeEvents(payload);
    const blocks: any[] = [];
    const connections: any[] = [];

    let index = 0;
    while (index < events.length) {
      const event = events[index];
      const action = String(event.action || '');

      if (!isSupportedAction(action)) {
        index += 1;
        continue;
      }

      if (action === 'field-mark') {
        const pageId = event.pageId || '';
        const extractions: Array<{ selector: string; attribute: string; saveToColumn: string }> = [];

        while (index < events.length) {
          const markEvent = events[index];
          if (String(markEvent.action || '') !== 'field-mark' || (markEvent.pageId || '') !== pageId) {
            break;
          }

          if (markEvent.target?.selector && markEvent.field?.name) {
            extractions.push({
              selector: markEvent.target.selector,
              attribute: 'innerText',
              saveToColumn: markEvent.field.name
            });
          }

          index += 1;
        }

        if (extractions.length > 0) {
          blocks.push(createBlock('extract', '提取已标注字段', 'extraction', blocks.length, {
            multiple: false,
            timeout: 5000,
            saveToTable: '',
            extractions
          }));
        }
        continue;
      }

      switch (action) {
        case 'navigate':
          if (event.page?.url) {
            blocks.push(createBlock('navigate', '访问页面', 'browser', blocks.length, {
              url: event.page.url,
              waitUntil: 'domcontentloaded',
              timeout: 60000
            }));
          }
          break;
        case 'click':
          if (event.target?.selector) {
            blocks.push(createBlock('click', '点击元素', 'interaction', blocks.length, {
              selector: event.target.selector,
              waitForElement: true,
              timeout: 5000,
              openInNewTab: false,
              runInBackground: false,
              waitUntil: 'domcontentloaded'
            }));
          }
          break;
        case 'type':
          if (event.target?.selector) {
            blocks.push(createBlock('type', '输入文本', 'interaction', blocks.length, {
              selector: event.target.selector,
              text: event.input?.value || '',
              delay: 100,
              timeout: 5000
            }));
          }
          break;
        case 'select':
          if (event.target?.selector) {
            blocks.push(createBlock('select', '选择下拉项', 'interaction', blocks.length, {
              selector: event.target.selector,
              value: event.input?.value || ''
            }));
          }
          break;
        case 'scroll':
          blocks.push(createBlock('scroll', '滚动页面', 'browser', blocks.length, {
            target: event.scroll?.target === 'element' ? 'element' : 'page',
            selector: event.scroll?.target === 'element' ? event.target?.selector || '' : '',
            timeout: 5000,
            mode: 'fixed',
            maxScrolls: 1,
            scrollDistance: 800,
            delay: 800
          }));
          break;
        case 'back':
          blocks.push(createBlock('back', '返回', 'browser', blocks.length, {}));
          break;
        case 'forward':
          blocks.push(createBlock('forward', '前进', 'browser', blocks.length, {}));
          break;
      }

      index += 1;
    }

    for (let i = 1; i < blocks.length; i += 1) {
      connections.push(createConnection(blocks[i - 1].id, blocks[i].id, connections.length));
    }

    return {
      blocks,
      connections,
      variables: {}
    };
  }
}
