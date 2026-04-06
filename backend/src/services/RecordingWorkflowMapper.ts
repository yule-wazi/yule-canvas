import { Workflow } from './WorkflowInterpreter';

interface RecordingV2Event {
  step?: number;
  kind?: 'action' | 'mark' | 'meta' | string;
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
    tableId?: string;
    tableName?: string;
    attribute?: string;
    recordAction?: 'new' | 'append' | string;
  };
  navigationKind?: 'explicit' | 'derived' | string;
  navigationSource?: 'direct' | 'click' | 'contextmenu' | 'middle-click' | 'back' | 'forward' | string;
  loopCapture?: {
    variableName?: string;
    startValue?: number;
    endValue?: number;
    count?: number;
    templateEvents?: RecordingV2Event[];
    firstSample?: RecordingV2Event[];
    lastSample?: RecordingV2Event[];
    fieldNames?: string[];
  };
}

interface RecordingV2Payload {
  schemaVersion?: string;
  events?: RecordingV2Event[];
}

type SupportedAction =
  | 'navigate'
  | 'click'
  | 'type'
  | 'select'
  | 'scroll'
  | 'back'
  | 'forward'
  | 'field-mark'
  | 'loop-capture';

interface RecordingUnit {
  entryId: string;
  entryHandle: string;
  exitId: string;
  exitHandle: string;
}

interface MappingState {
  blocks: any[];
  connections: any[];
  recordCounters: Map<string, number>;
  activeTableId: string;
  activeMergeKey: string;
}

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
    case 'loop':
      return {
        inputs: [{ id: 'loop-end', name: '循环结束', type: 'flow' }],
        outputs: [{ id: 'loop-start', name: '循环开始', type: 'flow' }]
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

function normalizeEvents(payload: RecordingV2Payload): RecordingV2Event[] {
  return Array.isArray(payload.events)
    ? [...payload.events].sort((a, b) => Number(a.step || 0) - Number(b.step || 0))
    : [];
}

function isSupportedAction(action: string): action is SupportedAction {
  return ['navigate', 'click', 'type', 'select', 'scroll', 'back', 'forward', 'field-mark', 'loop-capture'].includes(action);
}

function connectUnits(connections: any[], sourceId: string, sourceHandle: string, targetId: string, targetHandle: string) {
  connections.push({
    id: `recorded-conn-${connections.length + 1}`,
    source: sourceId,
    sourceHandle,
    target: targetId,
    targetHandle
  });
}

function allocateMergeKey(state: MappingState, tableId: string) {
  const counterKey = tableId || state.activeTableId || '__default__';
  const nextCount = (state.recordCounters.get(counterKey) || 0) + 1;
  state.recordCounters.set(counterKey, nextCount);
  state.activeTableId = tableId || state.activeTableId || '';
  state.activeMergeKey = `record_${nextCount}`;
  return state.activeMergeKey;
}

function pushExtractBlock(
  state: MappingState,
  extractions: Array<{ selector: string; attribute: string; saveToColumn: string }>,
  tableId: string,
  mergeKey: string
) {
  if (extractions.length === 0) {
    return null;
  }

  const block = createBlock('extract', '提取已标注字段', 'extraction', state.blocks.length, {
    multiple: false,
    timeout: 5000,
    saveToTable: tableId,
    mergeKey,
    extractions
  });

  state.blocks.push(block);
  return block;
}

function appendBasicBlock(state: MappingState, type: string, label: string, category: string, data: any): RecordingUnit {
  const block = createBlock(type, label, category, state.blocks.length, data);
  state.blocks.push(block);
  return {
    entryId: block.id,
    entryHandle: 'target-left',
    exitId: block.id,
    exitHandle: 'source-right'
  };
}

function appendFieldMarkGroup(state: MappingState, events: RecordingV2Event[], startIndex: number, forcedMergeKey?: string) {
  const firstEvent = events[startIndex];
  const pageId = firstEvent.pageId || '';
  let tableId = firstEvent.field?.tableId || '';
  let mergeKey = forcedMergeKey || '';
  let extractions: Array<{ selector: string; attribute: string; saveToColumn: string }> = [];
  const seenFieldNames = new Set<string>();
  const units: RecordingUnit[] = [];

  let index = startIndex;
  while (index < events.length) {
    const markEvent = events[index];
    if (String(markEvent.action || '') !== 'field-mark' || (markEvent.pageId || '') !== pageId) {
      break;
    }

    if (markEvent.target?.selector && markEvent.field?.name) {
      const fieldName = markEvent.field.name;
      const currentTableId = markEvent.field.tableId || '';
      const recordAction = markEvent.field.recordAction === 'new' ? 'new' : 'append';

      if (!forcedMergeKey && (recordAction === 'new' || !state.activeMergeKey || (state.activeTableId && currentTableId && currentTableId !== state.activeTableId))) {
        mergeKey = allocateMergeKey(state, currentTableId);
      } else if (forcedMergeKey) {
        mergeKey = forcedMergeKey;
      }

      if (
        extractions.length > 0 &&
        (
          (tableId && currentTableId && currentTableId !== tableId) ||
          seenFieldNames.has(fieldName)
        )
      ) {
        const block = pushExtractBlock(state, extractions, tableId, mergeKey);
        if (block) {
          units.push({
            entryId: block.id,
            entryHandle: 'target-left',
            exitId: block.id,
            exitHandle: 'source-right'
          });
        }
        extractions = [];
        seenFieldNames.clear();
      }

      tableId = currentTableId || tableId;
      extractions.push({
        selector: markEvent.target.selector,
        attribute: markEvent.field.attribute || 'innerText',
        saveToColumn: fieldName
      });
      seenFieldNames.add(fieldName);
    }

    index += 1;
  }

  const finalBlock = pushExtractBlock(state, extractions, tableId, mergeKey);
  if (finalBlock) {
    units.push({
      entryId: finalBlock.id,
      entryHandle: 'target-left',
      exitId: finalBlock.id,
      exitHandle: 'source-right'
    });
  }

  for (let unitIndex = 1; unitIndex < units.length; unitIndex += 1) {
    connectUnits(
      state.connections,
      units[unitIndex - 1].exitId,
      units[unitIndex - 1].exitHandle,
      units[unitIndex].entryId,
      units[unitIndex].entryHandle
    );
  }

  return {
    unit: units[0]
      ? {
          entryId: units[0].entryId,
          entryHandle: units[0].entryHandle,
          exitId: units[units.length - 1].exitId,
          exitHandle: units[units.length - 1].exitHandle
        }
      : null,
    nextIndex: index
  };
}

function appendLoopCaptureUnit(state: MappingState, event: RecordingV2Event): RecordingUnit | null {
  const loopCapture = event.loopCapture;
  if (!loopCapture?.templateEvents?.length) {
    return null;
  }

  const loopBlock = createBlock('loop', '循环录制', 'logic', state.blocks.length, {
    mode: 'count',
    count: Number(loopCapture.count || 1),
    maxIterations: 1000,
    useVariable: true,
    variableName: loopCapture.variableName || 'loopIndex',
    startValueType: 'custom',
    startValue: String(loopCapture.startValue ?? 1)
  });
  state.blocks.push(loopBlock);

  const loopState: MappingState = {
    blocks: state.blocks,
    connections: state.connections,
    recordCounters: state.recordCounters,
    activeTableId: state.activeTableId,
    activeMergeKey: `{{${loopCapture.variableName || 'loopIndex'}}}`
  };

  let firstBodyUnit: RecordingUnit | null = null;
  let lastBodyUnit: RecordingUnit | null = null;
  let innerIndex = 0;
  const innerEvents = loopCapture.templateEvents;

  while (innerIndex < innerEvents.length) {
    const innerEvent = innerEvents[innerIndex];
    const action = String(innerEvent.action || '');
    if (!isSupportedAction(action) || action === 'loop-capture') {
      innerIndex += 1;
      continue;
    }

    let nextUnit: RecordingUnit | null = null;

    if (action === 'field-mark') {
      const result = appendFieldMarkGroup(loopState, innerEvents, innerIndex, `{{${loopCapture.variableName || 'loopIndex'}}}`);
      nextUnit = result.unit;
      innerIndex = result.nextIndex;
    } else {
      nextUnit = appendEventUnit(loopState, innerEvent);
      innerIndex += 1;
    }

    if (!nextUnit) {
      continue;
    }

    if (!firstBodyUnit) {
      firstBodyUnit = nextUnit;
    }

    if (lastBodyUnit) {
      connectUnits(
        state.connections,
        lastBodyUnit.exitId,
        lastBodyUnit.exitHandle,
        nextUnit.entryId,
        nextUnit.entryHandle
      );
    }

    lastBodyUnit = nextUnit;
  }

  if (!firstBodyUnit || !lastBodyUnit) {
    return null;
  }

  connectUnits(state.connections, loopBlock.id, 'loop-start', firstBodyUnit.entryId, firstBodyUnit.entryHandle);
  connectUnits(state.connections, lastBodyUnit.exitId, lastBodyUnit.exitHandle, loopBlock.id, 'loop-end');

  return {
    entryId: firstBodyUnit.entryId,
    entryHandle: firstBodyUnit.entryHandle,
    exitId: lastBodyUnit.exitId,
    exitHandle: lastBodyUnit.exitHandle
  };
}

function appendEventUnit(state: MappingState, event: RecordingV2Event): RecordingUnit | null {
  const action = String(event.action || '');

  switch (action) {
    case 'navigate':
      if (event.navigationKind === 'derived' || !event.page?.url) {
        return null;
      }
      return appendBasicBlock(state, 'navigate', '访问页面', 'browser', {
        url: event.page.url,
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    case 'click':
      if (!event.target?.selector) {
        return null;
      }
      return appendBasicBlock(state, 'click', '点击元素', 'interaction', {
        selector: event.target.selector,
        waitForElement: true,
        timeout: 5000,
        openInNewTab: false,
        runInBackground: false,
        waitUntil: 'domcontentloaded'
      });
    case 'type':
      if (!event.target?.selector) {
        return null;
      }
      return appendBasicBlock(state, 'type', '输入文本', 'interaction', {
        selector: event.target.selector,
        text: event.input?.value || '',
        delay: 100,
        timeout: 5000
      });
    case 'select':
      if (!event.target?.selector) {
        return null;
      }
      return appendBasicBlock(state, 'select', '选择下拉项', 'interaction', {
        selector: event.target.selector,
        value: event.input?.value || ''
      });
    case 'scroll':
      return appendBasicBlock(state, 'scroll', '滚动页面', 'browser', {
        target: event.scroll?.target === 'element' ? 'element' : 'page',
        selector: event.scroll?.target === 'element' ? event.target?.selector || '' : '',
        timeout: 5000,
        mode: 'fixed',
        maxScrolls: 1,
        scrollDistance: 800,
        delay: 800
      });
    case 'back':
      return appendBasicBlock(state, 'back', '返回', 'browser', {});
    case 'forward':
      return appendBasicBlock(state, 'forward', '前进', 'browser', {});
    case 'loop-capture':
      return appendLoopCaptureUnit(state, event);
    default:
      return null;
  }
}

export class RecordingWorkflowMapper {
  static map(payload: RecordingV2Payload): Workflow {
    const events = normalizeEvents(payload);
    const state: MappingState = {
      blocks: [],
      connections: [],
      recordCounters: new Map<string, number>(),
      activeTableId: '',
      activeMergeKey: ''
    };

    let previousUnit: RecordingUnit | null = null;
    let index = 0;

    while (index < events.length) {
      const event = events[index];
      const action = String(event.action || '');

      if (!isSupportedAction(action)) {
        index += 1;
        continue;
      }

      let nextUnit: RecordingUnit | null = null;

      if (action === 'field-mark') {
        const result = appendFieldMarkGroup(state, events, index);
        nextUnit = result.unit;
        index = result.nextIndex;
      } else {
        nextUnit = appendEventUnit(state, event);
        index += 1;
      }

      if (!nextUnit) {
        continue;
      }

      if (previousUnit) {
        connectUnits(
          state.connections,
          previousUnit.exitId,
          previousUnit.exitHandle,
          nextUnit.entryId,
          nextUnit.entryHandle
        );
      }

      previousUnit = nextUnit;
    }

    return {
      blocks: state.blocks,
      connections: state.connections,
      variables: {}
    };
  }
}
