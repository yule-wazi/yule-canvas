import { Page } from 'playwright';

export type BlockType =
  | 'navigate'
  | 'back'
  | 'forward'
  | 'scroll'
  | 'wait'
  | 'click'
  | 'type'
  | 'select'
  | 'extract'
  | 'extract-links'
  | 'condition'
  | 'loop'
  | 'log'
  | 'transform'
  | 'filter';

export interface Block {
  id: string;
  type: BlockType;
  label: string;
  category: string;
  position: { x: number; y: number };
  data: any;
  inputs: Array<{ id: string; name: string; type: string }>;
  outputs: Array<{ id: string; name: string; type: string }>;
}

export interface Connection {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface Workflow {
  blocks: Block[];
  connections: Connection[];
  variables: Record<string, any>;
}

export interface ExecutionContext {
  page: Page;
  variables: Record<string, any>;
  logs: string[];
  extractedData: any[];
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  logs: string[];
  error?: string;
}

interface LogEntry {
  timestamp: number;
  message: string;
}

interface InterpreterOptions {
  onLog?: (entry: LogEntry) => void;
  onSaveData?: (data: any) => void;
  onTrace?: (event: TraceEvent) => void;
  silent?: boolean;
}

export interface TraceEvent {
  type: 'block-start' | 'block-end' | 'loop-start' | 'loop-iteration' | 'loop-end';
  blockId?: string;
  blockType?: BlockType;
  label?: string;
  loopId?: string;
  iteration?: number;
  timestamp: number;
}

interface LoopInfo {
  loop: Block;
  startTargetId: string | null;
  endSourceId: string | null;
  bodyBlockIds: Set<string>;
  parentLoopId: string | null;
}

interface ExecutionUnit {
  id: string;
  kind: 'block' | 'loop';
  block?: Block;
  loopInfo?: LoopInfo;
}

/**
 * WorkflowInterpreter
 * 直接解释执行 Workflow JSON，而不是先编译为代码。
 */
export class WorkflowInterpreter {
  private page: Page;
  private options: InterpreterOptions;
  private sortCache: Map<string, ExecutionUnit[]> = new Map();

  constructor(page: Page, options: InterpreterOptions = {}) {
    this.page = page;
    this.options = options;
  }

  clearCache(): void {
    this.sortCache.clear();
  }

  async execute(workflow: Workflow): Promise<ExecutionResult> {
    try {
      const context: ExecutionContext = {
        page: this.page,
        variables: this.normalizeVariables(workflow.variables),
        logs: [],
        extractedData: []
      };

      const blocksById = new Map(workflow.blocks.map(block => [block.id, block]));
      const loopInfos = this.buildLoopInfos(workflow.blocks, workflow.connections);

      this.log(context, '开始执行工作流');

      const topLevelLoops = Array.from(loopInfos.values()).filter(info => !info.parentLoopId);
      const topLevelLoopIds = new Set(topLevelLoops.map(info => info.loop.id));
      const blocksInTopLevelLoops = new Set<string>();

      topLevelLoops.forEach(info => {
        info.bodyBlockIds.forEach(id => blocksInTopLevelLoops.add(id));
      });

      const rootBlocks = workflow.blocks.filter(block =>
        block.type !== 'loop' && !blocksInTopLevelLoops.has(block.id)
      );

      const sequence = this.buildExecutionSequence(
        rootBlocks,
        topLevelLoops,
        workflow.connections
      );

      await this.executeSequence(sequence, blocksById, workflow.connections, loopInfos, context);

      this.log(context, '工作流执行完成');

      return {
        success: true,
        result: this.buildResult(context),
        logs: context.logs
      };
    } catch (error: any) {
      console.error('执行工作流失败:', error);
      return {
        success: false,
        error: error.message,
        logs: []
      };
    }
  }

  private async executeSequence(
    sequence: ExecutionUnit[],
    blocksById: Map<string, Block>,
    connections: Connection[],
    loopInfos: Map<string, LoopInfo>,
    context: ExecutionContext
  ): Promise<void> {
    for (const unit of sequence) {
      if (unit.kind === 'block' && unit.block) {
        this.trace({
          type: 'block-start',
          blockId: unit.block.id,
          blockType: unit.block.type,
          label: unit.block.label
        });
        await this.executeBlock(unit.block, context);
        this.trace({
          type: 'block-end',
          blockId: unit.block.id,
          blockType: unit.block.type,
          label: unit.block.label
        });
      } else if (unit.kind === 'loop' && unit.loopInfo) {
        await this.executeLoop(unit.loopInfo, blocksById, connections, loopInfos, context);
      }
    }
  }

  private buildLoopInfos(blocks: Block[], connections: Connection[]): Map<string, LoopInfo> {
    const loopInfos = new Map<string, LoopInfo>();

    blocks
      .filter(block => block.type === 'loop')
      .forEach(loop => {
        const startConn = connections.find(
          conn => conn.source === loop.id && conn.sourceHandle === 'loop-start'
        );
        const endConn = connections.find(
          conn => conn.target === loop.id && conn.targetHandle === 'loop-end'
        );

        const bodyBlockIds = new Set<string>();

        if (startConn?.target && endConn?.source) {
          this.walkLoopBody(startConn.target, endConn.source, connections).forEach(id => {
            if (id !== loop.id) {
              bodyBlockIds.add(id);
            }
          });
        }

        loopInfos.set(loop.id, {
          loop,
          startTargetId: startConn?.target || null,
          endSourceId: endConn?.source || null,
          bodyBlockIds,
          parentLoopId: null
        });
      });

    const infos = Array.from(loopInfos.values());

    infos.forEach(info => {
      const parentCandidates = infos.filter(other =>
        other.loop.id !== info.loop.id &&
        info.bodyBlockIds.size > 0 &&
        this.isSubset(info.bodyBlockIds, other.bodyBlockIds) &&
        other.bodyBlockIds.size > info.bodyBlockIds.size
      );

      if (parentCandidates.length === 0) {
        return;
      }

      parentCandidates.sort((a, b) => a.bodyBlockIds.size - b.bodyBlockIds.size);
      info.parentLoopId = parentCandidates[0].loop.id;
    });

    return loopInfos;
  }

  private buildExecutionSequence(
    blocks: Block[],
    childLoops: LoopInfo[],
    connections: Connection[]
  ): ExecutionUnit[] {
    const cacheKey = this.generateSequenceCacheKey(blocks, childLoops, connections);
    const cached = this.sortCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const units = new Map<string, ExecutionUnit>();
    const visibleBlockIds = new Set(blocks.map(block => block.id));
    const childLoopBodies = childLoops.map(loop => ({
      loopId: loop.loop.id,
      bodyIds: loop.bodyBlockIds
    }));

    blocks.forEach(block => {
      units.set(block.id, { id: block.id, kind: 'block', block });
    });

    childLoops.forEach(loopInfo => {
      units.set(loopInfo.loop.id, { id: loopInfo.loop.id, kind: 'loop', loopInfo });
    });

    const resolveOwner = (blockId: string): string | null => {
      if (visibleBlockIds.has(blockId)) {
        return blockId;
      }

      for (const childLoop of childLoopBodies) {
        if (childLoop.bodyIds.has(blockId)) {
          return childLoop.loopId;
        }
      }

      return null;
    };

    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    Array.from(units.keys()).forEach(id => {
      graph.set(id, new Set());
      inDegree.set(id, 0);
    });

    connections
      .filter(conn => this.isNormalConnection(conn))
      .forEach(conn => {
        const sourceOwner = resolveOwner(conn.source);
        const targetOwner = resolveOwner(conn.target);

        if (!sourceOwner || !targetOwner || sourceOwner === targetOwner) {
          return;
        }

        const neighbors = graph.get(sourceOwner);
        if (!neighbors || neighbors.has(targetOwner)) {
          return;
        }

        neighbors.add(targetOwner);
        inDegree.set(targetOwner, (inDegree.get(targetOwner) || 0) + 1);
      });

    const queue: string[] = [];
    const sorted: ExecutionUnit[] = [];

    inDegree.forEach((degree, id) => {
      if (degree === 0) {
        queue.push(id);
      }
    });

    while (queue.length > 0) {
      const id = queue.shift()!;
      const unit = units.get(id);
      if (unit) {
        sorted.push(unit);
      }

      const neighbors = graph.get(id) || new Set<string>();
      neighbors.forEach(neighborId => {
        const nextDegree = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, nextDegree);
        if (nextDegree === 0) {
          queue.push(neighborId);
        }
      });
    }

    Array.from(units.values()).forEach(unit => {
      if (!sorted.some(item => item.id === unit.id)) {
        sorted.push(unit);
      }
    });

    this.sortCache.set(cacheKey, sorted);
    return sorted;
  }

  private generateSequenceCacheKey(
    blocks: Block[],
    childLoops: LoopInfo[],
    connections: Connection[]
  ): string {
    const blockIds = blocks.map(block => block.id).sort().join(',');
    const loopIds = childLoops.map(loop => loop.loop.id).sort().join(',');
    const connectionIds = connections
      .filter(conn => this.isNormalConnection(conn))
      .map(conn => `${conn.source}:${conn.sourceHandle}->${conn.target}:${conn.targetHandle}`)
      .sort()
      .join(',');

    return `${blockIds}|${loopIds}|${connectionIds}`;
  }

  private async executeLoop(
    loopInfo: LoopInfo,
    blocksById: Map<string, Block>,
    connections: Connection[],
    loopInfos: Map<string, LoopInfo>,
    context: ExecutionContext
  ): Promise<void> {
    const directChildLoops = Array.from(loopInfos.values()).filter(
      info => info.parentLoopId === loopInfo.loop.id
    );
    const directChildBodyIds = new Set<string>();

    directChildLoops.forEach(info => {
      info.bodyBlockIds.forEach(id => directChildBodyIds.add(id));
    });

    const loopBlocks = Array.from(loopInfo.bodyBlockIds)
      .map(id => blocksById.get(id))
      .filter((block): block is Block => Boolean(block))
      .filter(block => block.type !== 'loop' && !directChildBodyIds.has(block.id));

    const sequence = this.buildExecutionSequence(loopBlocks, directChildLoops, connections);
    const variableName = loopInfo.loop.data.variableName || 'index';
    const shouldUseVariable = Boolean(loopInfo.loop.data.useVariable);
    const previousValue = context.variables[variableName];
    const hasPreviousValue = Object.prototype.hasOwnProperty.call(context.variables, variableName);
    const startValue = this.getLoopStartValue(loopInfo.loop, context);
    const mode = loopInfo.loop.data.mode || 'count';
    const maxIterations = Number.parseInt(String(loopInfo.loop.data.maxIterations || 1000), 10) || 1000;
    const plannedCount = mode === 'count' ? this.getLoopCount(loopInfo.loop, context) : null;
    let iteration = 0;

    this.trace({
      type: 'loop-start',
      loopId: loopInfo.loop.id,
      label: loopInfo.loop.label
    });

    this.log(
      context,
      mode === 'condition'
        ? `开始循环: ${loopInfo.loop.label}，模式: condition，最大迭代: ${maxIterations}`
        : `开始循环: ${loopInfo.loop.label}，循环次数: ${plannedCount}`
    );

    while (this.shouldContinueLoop(loopInfo.loop, context, iteration, maxIterations, plannedCount)) {
      if (shouldUseVariable) {
        context.variables[variableName] = startValue + iteration;
        this.log(context, `循环变量 ${variableName} = ${context.variables[variableName]}`);
      }

      this.trace({
        type: 'loop-iteration',
        loopId: loopInfo.loop.id,
        label: loopInfo.loop.label,
        iteration: iteration + 1
      });
      await this.executeSequence(sequence, blocksById, connections, loopInfos, context);
      iteration++;
    }

    if (shouldUseVariable) {
      if (hasPreviousValue) {
        context.variables[variableName] = previousValue;
      } else {
        delete context.variables[variableName];
      }
    }

    this.log(context, `循环结束: ${loopInfo.loop.label}`);
    this.trace({
      type: 'loop-end',
      loopId: loopInfo.loop.id,
      label: loopInfo.loop.label
    });
  }

  private walkLoopBody(startId: string, endId: string, connections: Connection[]): string[] {
    const path: string[] = [];
    const visited = new Set<string>();
    let currentId: string | null = startId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      path.push(currentId);

      if (currentId === endId) {
        break;
      }

      const nextConnection = connections.find(conn =>
        conn.source === currentId && this.isNormalConnection(conn)
      );

      currentId = nextConnection?.target || null;
    }

    return path;
  }

  private async executeBlock(block: Block, context: ExecutionContext): Promise<void> {
    this.log(context, `执行模块: ${block.label} (${block.type})`);

    const data = this.replaceVariables(block.data, context.variables);

    switch (block.type) {
      case 'navigate':
        await this.executeNavigate(data, context);
        break;
      case 'back':
        await this.executeBack(context);
        break;
      case 'forward':
        await this.executeForward(context);
        break;
      case 'click':
        await this.executeClick(data, context);
        break;
      case 'type':
        await this.executeType(data, context);
        break;
      case 'select':
        await this.executeSelect(data, context);
        break;
      case 'scroll':
        await this.executeScroll(data, context);
        break;
      case 'wait':
        await this.executeWait(data, context);
        break;
      case 'extract':
        await this.executeExtract(data, context);
        break;
      case 'extract-links':
        await this.executeExtractLinks(data, context);
        break;
      case 'log':
        await this.executeLog(data, context);
        break;
      default:
        this.log(context, `未实现的模块类型: ${block.type}`);
    }
  }

  private normalizeVariables(variables: Record<string, any> = {}): Record<string, any> {
    const normalized: Record<string, any> = {};

    Object.entries(variables).forEach(([name, value]) => {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.prototype.hasOwnProperty.call(value, 'value')
      ) {
        normalized[name] = value.value;
      } else {
        normalized[name] = value;
      }
    });

    return normalized;
  }

  private getLoopCount(loopBlock: Block, context: ExecutionContext): number {
    const rawCount = this.replaceVariables(loopBlock.data.count, context.variables);
    const count = Number.parseInt(String(rawCount), 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }

  private shouldContinueLoop(
    loopBlock: Block,
    context: ExecutionContext,
    iteration: number,
    maxIterations: number,
    plannedCount: number | null
  ): boolean {
    if (iteration >= maxIterations) {
      this.log(context, `循环达到最大迭代次数 ${maxIterations}，已停止`);
      return false;
    }

    const mode = loopBlock.data.mode || 'count';

    if (mode === 'condition') {
      const condition = String(this.replaceVariables(loopBlock.data.condition || '', context.variables)).trim();

      if (!condition) {
        return false;
      }

      return this.evaluateCondition(condition, context.variables);
    }

    return iteration < (plannedCount || 0);
  }

  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    try {
      const names = Object.keys(variables);
      const values = Object.values(variables);
      const fn = new Function(...names, `return Boolean(${condition});`);
      return Boolean(fn(...values));
    } catch (error) {
      console.error('循环条件解析失败:', condition, error);
      return false;
    }
  }

  private getLoopStartValue(loopBlock: Block, context: ExecutionContext): number {
    const startValueType = loopBlock.data.startValueType;
    const rawStartValue = loopBlock.data.startValue;

    if (startValueType === 'custom' || startValueType === 'variable') {
      const replaced = this.replaceVariables(rawStartValue, context.variables);
      const parsed = Number.parseInt(String(replaced), 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 1;
  }

  private replaceVariables(data: any, variables: Record<string, any>): any {
    if (Object.keys(variables).length === 0) {
      return data;
    }

    if (typeof data === 'string') {
      if (!data.includes('{{')) {
        return data;
      }

      return data.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return variables[varName] !== undefined ? String(variables[varName]) : match;
      });
    }

    if (Array.isArray(data)) {
      return data.map(item => this.replaceVariables(item, variables));
    }

    if (typeof data === 'object' && data !== null) {
      const result: Record<string, any> = {};

      Object.keys(data).forEach(key => {
        result[key] = this.replaceVariables(data[key], variables);
      });

      return result;
    }

    return data;
  }

  private log(context: ExecutionContext, message: string): void {
    const timestamp = Date.now();
    const formattedMessage = `[${new Date(timestamp).toLocaleTimeString()}] ${message}`;

    context.logs.push(formattedMessage);
    this.options.onLog?.({ timestamp, message });
    if (!this.options.silent) {
      console.log(formattedMessage);
    }
  }

  private trace(event: Omit<TraceEvent, 'timestamp'>): void {
    this.options.onTrace?.({
      ...event,
      timestamp: Date.now()
    });
  }

  private buildResult(context: ExecutionContext): any {
    return {
      dataType: 'workflow',
      url: this.page.url(),
      timestamp: Date.now(),
      count: context.extractedData.length,
      results: {
        data: context.extractedData
      }
    };
  }

  private isNormalSourceHandle(handle?: string): boolean {
    return handle === 'source-right' || handle === 'out';
  }

  private isNormalTargetHandle(handle?: string): boolean {
    return handle === 'target-left' || handle === 'in';
  }

  private isNormalConnection(connection: Connection): boolean {
    return (
      this.isNormalSourceHandle(connection.sourceHandle) &&
      this.isNormalTargetHandle(connection.targetHandle)
    );
  }

  private isSubset(child: Set<string>, parent: Set<string>): boolean {
    for (const item of child) {
      if (!parent.has(item)) {
        return false;
      }
    }

    return true;
  }

  private resolveMergeKeyValue(mergeKey: string | undefined, variables: Record<string, any>): any {
    if (!mergeKey) {
      return undefined;
    }

    return variables[mergeKey] !== undefined ? variables[mergeKey] : mergeKey;
  }

  private async executeNavigate(data: any, context: ExecutionContext): Promise<void> {
    const url = data.url;
    const waitUntil = data.waitUntil || 'domcontentloaded';
    const timeout = data.timeout || 60000;

    this.log(context, `访问页面: ${url}`);
    await context.page.goto(url, { waitUntil, timeout });
  }

  private async executeBack(context: ExecutionContext): Promise<void> {
    this.log(context, '返回上一页');
    await context.page.goBack();
  }

  private async executeForward(context: ExecutionContext): Promise<void> {
    this.log(context, '前进下一页');
    await context.page.goForward();
  }

  private async executeClick(data: any, context: ExecutionContext): Promise<void> {
    const selector = data.selector;
    const timeout = data.timeout || 5000;

    this.log(context, `点击元素: ${selector}`);

    if (data.waitForElement) {
      await context.page.waitForSelector(selector, { timeout });
    }

    await context.page.click(selector);
  }

  private async executeType(data: any, context: ExecutionContext): Promise<void> {
    const selector = data.selector;
    const text = data.text || '';
    const delay = data.delay || 100;
    const timeout = data.timeout || 5000;

    this.log(context, `输入文本: ${selector} = ${text}`);
    await context.page.waitForSelector(selector, { timeout });
    await context.page.type(selector, text, { delay });
  }

  private async executeSelect(data: any, context: ExecutionContext): Promise<void> {
    const selector = data.selector;
    const value = data.value;
    const timeout = data.timeout || 5000;

    this.log(context, `选择下拉项: ${selector} = ${value}`);
    await context.page.waitForSelector(selector, { timeout });
    await context.page.selectOption(selector, value);
  }

  private async executeScroll(data: any, context: ExecutionContext): Promise<void> {
    const target = data.target || 'page';
    const selector = data.selector || '';
    const timeout = data.timeout || 5000;
    const mode = data.mode || 'smart';
    const maxScrolls = data.maxScrolls || 15;
    const scrollDistance = data.scrollDistance || 800;
    const delay = data.delay || 500;

    this.log(context, `滚动: target=${target}, mode=${mode}, maxScrolls=${maxScrolls}`);

    if (target === 'element' && selector) {
      await context.page.waitForSelector(selector, { timeout });

      await context.page.evaluate(
        async ({ sel, scrollMode, maxTimes, distance, waitDelay }) => {
          const doc = (globalThis as any).document;
          const container = doc.querySelector(sel);
          if (!container) {
            throw new Error(`找不到元素: ${sel}`);
          }

          const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

          if (scrollMode === 'smart') {
            let lastScrollTop = container.scrollTop;
            let count = 0;

            while (count < maxTimes) {
              container.scrollBy(0, distance);
              await sleep(waitDelay);

              if (container.scrollTop === lastScrollTop) {
                break;
              }

              lastScrollTop = container.scrollTop;
              count++;
            }
          } else {
            for (let index = 0; index < maxTimes; index++) {
              container.scrollBy(0, distance);
              await sleep(waitDelay);
            }
          }
        },
        {
          sel: selector,
          scrollMode: mode,
          maxTimes: maxScrolls,
          distance: scrollDistance,
          waitDelay: delay
        }
      );

      return;
    }

    if (mode === 'smart') {
      let scrollCount = 0;
      let stableRounds = 0;

      while (scrollCount < maxScrolls) {
        const beforeState = await context.page.evaluate(() => {
          const win = (globalThis as any).window;
          const doc = (globalThis as any).document;
          return {
            scrollY: win.scrollY,
            innerHeight: win.innerHeight,
            scrollHeight: doc.body.scrollHeight
          };
        });

        await context.page.evaluate(distance => (globalThis as any).window.scrollBy(0, distance), scrollDistance);
        await context.page.waitForTimeout(delay);

        const afterState = await context.page.evaluate(() => {
          const win = (globalThis as any).window;
          const doc = (globalThis as any).document;
          return {
            scrollY: win.scrollY,
            innerHeight: win.innerHeight,
            scrollHeight: doc.body.scrollHeight
          };
        });

        scrollCount++;

        const noMovement =
          afterState.scrollY === beforeState.scrollY &&
          afterState.scrollHeight === beforeState.scrollHeight;
        const reachedBottom =
          afterState.scrollY + afterState.innerHeight >= afterState.scrollHeight - 4;

        if (noMovement || reachedBottom) {
          stableRounds++;
        } else {
          stableRounds = 0;
        }

        if (stableRounds >= 2) {
          break;
        }
      }

      this.log(context, `智能滚动完成，共滚动 ${scrollCount} 次`);
      return;
    }

    for (let index = 0; index < maxScrolls; index++) {
      await context.page.evaluate(distance => (globalThis as any).window.scrollBy(0, distance), scrollDistance);
      await context.page.waitForTimeout(delay);
    }

    this.log(context, `固定滚动完成，共滚动 ${maxScrolls} 次`);
  }

  private async executeWait(data: any, context: ExecutionContext): Promise<void> {
    const duration = data.duration || 3000;
    this.log(context, `等待 ${duration}ms`);
    await context.page.waitForTimeout(duration);
  }

  private async executeExtract(data: any, context: ExecutionContext): Promise<void> {
    const extractions = Array.isArray(data.extractions) && data.extractions.length > 0
      ? data.extractions.filter((item: any) => item.selector)
      : data.selector
        ? [{
            selector: data.selector,
            attribute: data.attribute || 'text',
            customAttribute: data.customAttribute || '',
            saveToColumn: data.saveToColumn || 'value'
          }]
        : [];
    const multiple = data.multiple !== false;
    const timeout = data.timeout || 5000;

    if (extractions.length === 0) {
      this.log(context, '提取数据: 未配置有效的提取项');
      return;
    }

    this.log(context, `提取数据: ${extractions.length} 个提取项`);

    await context.page.waitForSelector(extractions[0].selector, { timeout }).catch(() => null);

    const rows = await context.page.evaluate(
      ({ configs, isMultiple }) => {
        const extractValue = (element: any, attribute: string, customAttribute: string) => {
          if (!element) {
            return '';
          }

          if (attribute === 'text' || attribute === 'innerText') {
            return (element.textContent || '').trim();
          }

          if (attribute === 'html' || attribute === 'innerHTML') {
            return element.innerHTML || '';
          }

          if (attribute === 'data-*' && customAttribute) {
            return element.getAttribute(customAttribute) || '';
          }

          return element.getAttribute(attribute) || '';
        };

        const getElements = (selector: string) => {
          const elements = Array.from((globalThis as any).document.querySelectorAll(selector));
          if (isMultiple) {
            return elements;
          }

          return elements.length > 0 ? [elements[0]] : [];
        };

        const baseElements = getElements(configs[0].selector);

        return baseElements.map((_, index) => {
          const row: Record<string, any> = {};

          configs.forEach((config: any, configIndex: number) => {
            const elements = getElements(config.selector);
            const element = isMultiple ? elements[index] || null : elements[0] || null;
            const key = config.saveToColumn || `field_${configIndex}`;
            row[key] = extractValue(element, config.attribute, config.customAttribute);
          });

          return row;
        });
      },
      {
        configs: extractions,
        isMultiple: multiple
      }
    );

    if (data.saveToTable) {
      const mergeKeyValue = this.resolveMergeKeyValue(data.mergeKey, context.variables);
      const rowsToSave = rows.map((row: Record<string, any>) => {
        const rowData = { ...row };

        if (mergeKeyValue !== undefined && mergeKeyValue !== '') {
          rowData._mergeKey = mergeKeyValue;
        }

        return rowData;
      });

      context.extractedData.push(
        ...rowsToSave.map(row => ({
          _table: data.saveToTable,
          _rowData: row
        }))
      );

      this.options.onSaveData?.({
        type: 'data',
        tableId: data.saveToTable,
        rows: rowsToSave
      });
    } else {
      context.extractedData.push(...rows);
    }

    this.log(context, `提取完成，共获得 ${rows.length} 行数据`);
  }

  private async executeExtractLinks(data: any, context: ExecutionContext): Promise<void> {
    const filterPattern = data.filterPattern || '';

    this.log(context, '提取链接');

    const links = await context.page.evaluate(pattern => {
      return Array.from((globalThis as any).document.querySelectorAll('a[href]'))
        .map((element, index) => {
          const anchor = element as any;
              const href = anchor.getAttribute('href') || '';
              return {
                index: index + 1,
                href,
                text: (anchor.textContent || '').trim(),
                title: anchor.title || ''
              };
            })
        .filter(link => !pattern || link.href.includes(pattern));
    }, filterPattern);

    context.extractedData.push(...links);
    this.log(context, `链接提取完成，共获得 ${links.length} 条数据`);
  }

  private async executeLog(data: any, context: ExecutionContext): Promise<void> {
    const message = data.message || '';
    this.log(context, `日志: ${message}`);
  }
}
