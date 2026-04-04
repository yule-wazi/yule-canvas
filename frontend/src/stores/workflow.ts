import { defineStore } from 'pinia';
import type { Block, BlockData, BlockType } from '../types/block';
import type { Connection } from '../types/connection';
import type { Workflow } from '../types/workflow';
import { DEFAULT_SELECTOR_TIMEOUT } from '../constants/workflow';

interface WorkflowState {
  currentWorkflow: Workflow | null;
  blocks: Block[];
  connections: Connection[];
  selectedBlockId: string | null;
  history: Workflow[];
  historyIndex: number;
}

function createConditionRule() {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceType: 'variable',
    variableName: '',
    selector: '',
    elementValueType: 'text',
    attributeName: '',
    timeout: DEFAULT_SELECTOR_TIMEOUT,
    operator: 'equals',
    value: ''
  };
}

function createConditionBranch(index: number) {
  return {
    id: `path-${index + 1}`,
    name: `路径 ${index + 1}`,
    matchType: 'all',
    rules: [createConditionRule()]
  };
}

function getDefaultConditionData() {
  return {
    branches: [createConditionBranch(0), createConditionBranch(1)],
    fallbackEnabled: true
  };
}

function buildConditionOutputs(data: Record<string, any>) {
  const branches = Array.isArray(data?.branches) ? data.branches : [];
  const outputs = branches.map((branch: any, index: number) => ({
    id: `condition-${branch.id || `path-${index + 1}`}-right`,
    name: branch.name || `路径 ${index + 1}`,
    type: 'flow' as const
  }));

  if (data?.fallbackEnabled !== false) {
    outputs.push({
      id: 'condition-fallback-bottom',
      name: '兜底',
      type: 'flow' as const
    });
  }

  return outputs;
}

function normalizeConditionBlock(block: Block): Block {
  if (block.type !== 'condition') {
    return block;
  }

  const baseData = block.data || {};
  const branches = Array.isArray(baseData.branches) && baseData.branches.length > 0
    ? baseData.branches.map((branch: any, index: number) => ({
      id: branch.id || `path-${index + 1}`,
      name: branch.name || `路径 ${index + 1}`,
      matchType: branch.matchType === 'any' ? 'any' : 'all',
      rules: Array.isArray(branch.rules) && branch.rules.length > 0
        ? branch.rules.map((rule: any) => ({
          ...createConditionRule(),
          ...rule
        }))
        : [createConditionRule()]
    }))
    : getDefaultConditionData().branches;

  const data = {
    branches,
    fallbackEnabled: baseData.fallbackEnabled !== false
  };

  return {
    ...block,
    data,
    inputs: [{ id: 'in', name: '输入', type: 'flow' }],
    outputs: buildConditionOutputs(data)
  };
}

function normalizeWorkflowBlocks(blocks: Block[]): Block[] {
  return blocks.map(block => normalizeConditionBlock(block));
}

export const useWorkflowStore = defineStore('workflow', {
  state: (): WorkflowState => ({
    currentWorkflow: null,
    blocks: [],
    connections: [],
    selectedBlockId: null,
    history: [],
    historyIndex: -1
  }),

  getters: {
    selectedBlock(state): Block | null {
      if (!state.selectedBlockId) return null;
      return state.blocks.find(b => b.id === state.selectedBlockId) || null;
    },

    canUndo(state): boolean {
      return state.historyIndex > 0;
    },

    canRedo(state): boolean {
      return state.historyIndex < state.history.length - 1;
    },

    variables(state): Record<string, any> {
      return state.currentWorkflow?.variables || {};
    }
  },

  actions: {
    initWorkflow(name = '新工作流') {
      this.currentWorkflow = {
        id: Date.now().toString(),
        name,
        description: '',
        blocks: [],
        connections: [],
        variables: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.blocks = [];
      this.connections = [];
      this.saveToHistory();
    },

    addBlock(type: BlockType, position: { x: number; y: number }) {
      const block = this.createBlock(type, position);
      this.blocks.push(block);
      this.saveToHistory();
      return block;
    },

    createBlock(type: BlockType, position: { x: number; y: number }): Block {
      const id = `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const blockConfig = this.getBlockConfig(type);

      if (!blockConfig) {
        throw new Error(`未找到 block 类型 "${type}" 的配置`);
      }

      return normalizeConditionBlock({
        id,
        type,
        label: blockConfig.label,
        category: blockConfig.category,
        position,
        data: blockConfig.defaultData,
        inputs: blockConfig.inputs,
        outputs: blockConfig.outputs
      });
    },

    getBlockConfig(type: BlockType) {
      const defaultConditionData = getDefaultConditionData();
      const configs: Record<BlockType, any> = {
        navigate: {
          label: '访问页面',
          category: 'browser',
          defaultData: { url: '', waitUntil: 'domcontentloaded', timeout: 60000 },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [{ id: 'out', name: '输出', type: 'flow' }]
        },
        back: {
          label: '返回',
          category: 'browser',
          defaultData: {},
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [{ id: 'out', name: '输出', type: 'flow' }]
        },
        forward: {
          label: '前进',
          category: 'browser',
          defaultData: {},
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [{ id: 'out', name: '输出', type: 'flow' }]
        },
        scroll: {
          label: '滚动页面',
          category: 'browser',
          defaultData: {
            target: 'page',
            selector: '',
            timeout: DEFAULT_SELECTOR_TIMEOUT,
            mode: 'smart',
            maxScrolls: 15,
            scrollDistance: 800,
            delay: 800
          },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [{ id: 'out', name: '输出', type: 'flow' }]
        },
        wait: {
          label: '等待',
          category: 'browser',
          defaultData: { duration: 3000 },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [{ id: 'out', name: '输出', type: 'flow' }]
        },
        click: {
          label: '点击元素',
          category: 'interaction',
          defaultData: {
            selector: '',
            waitForElement: true,
            timeout: DEFAULT_SELECTOR_TIMEOUT,
            openInNewTab: false,
            runInBackground: false,
            waitUntil: 'domcontentloaded'
          },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [{ id: 'out', name: '输出', type: 'flow' }]
        },
        type: {
          label: '输入文本',
          category: 'interaction',
          defaultData: { selector: '', text: '', delay: 100, timeout: DEFAULT_SELECTOR_TIMEOUT },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [{ id: 'out', name: '输出', type: 'flow' }]
        },
        select: {
          label: '选择下拉项',
          category: 'interaction',
          defaultData: { selector: '', value: '' },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [{ id: 'out', name: '输出', type: 'flow' }]
        },
        extract: {
          label: '提取数据',
          category: 'extraction',
          defaultData: {
            multiple: true,
            timeout: DEFAULT_SELECTOR_TIMEOUT,
            saveToTable: '',
            extractions: []
          },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [
            { id: 'out', name: '输出', type: 'flow' },
            { id: 'data', name: '数据', type: 'data' }
          ]
        },
        'extract-links': {
          label: '提取链接',
          category: 'extraction',
          defaultData: { filterPattern: '' },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [
            { id: 'out', name: '输出', type: 'flow' },
            { id: 'data', name: '链接列表', type: 'data' }
          ]
        },
        condition: {
          label: '条件',
          category: 'logic',
          defaultData: defaultConditionData,
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: buildConditionOutputs(defaultConditionData)
        },
        loop: {
          label: '循环',
          category: 'logic',
          defaultData: { mode: 'count', count: 10, condition: '', maxIterations: 1000 },
          inputs: [{ id: 'loop-end', name: '循环结束', type: 'flow' }],
          outputs: [{ id: 'loop-start', name: '循环开始', type: 'flow' }]
        },
        log: {
          label: '日志输出',
          category: 'browser',
          defaultData: { message: '' },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [{ id: 'out', name: '输出', type: 'flow' }]
        },
        transform: {
          label: '数据转换',
          category: 'data',
          defaultData: { script: '' },
          inputs: [
            { id: 'in', name: '输入', type: 'flow' },
            { id: 'data', name: '数据', type: 'data' }
          ],
          outputs: [
            { id: 'out', name: '输出', type: 'flow' },
            { id: 'result', name: '结果', type: 'data' }
          ]
        },
        filter: {
          label: '数据过滤',
          category: 'data',
          defaultData: { condition: '' },
          inputs: [
            { id: 'in', name: '输入', type: 'flow' },
            { id: 'data', name: '数据', type: 'data' }
          ],
          outputs: [
            { id: 'out', name: '输出', type: 'flow' },
            { id: 'result', name: '结果', type: 'data' }
          ]
        }
      };

      return configs[type];
    },

    removeBlock(id: string) {
      this.blocks = this.blocks.filter(b => b.id !== id);
      this.connections = this.connections.filter(c => c.source !== id && c.target !== id);
      if (this.selectedBlockId === id) {
        this.selectedBlockId = null;
      }
      this.saveToHistory();
    },

    updateBlock(id: string, data: Partial<BlockData>) {
      const block = this.blocks.find(b => b.id === id);
      if (!block) {
        return;
      }

      block.data = { ...block.data, ...data };
      if (block.type === 'condition') {
        const normalized = normalizeConditionBlock(block);
        block.data = normalized.data;
        block.inputs = normalized.inputs;
        block.outputs = normalized.outputs;
      }
      this.saveToHistory();
    },

    updateBlockPosition(id: string, position: { x: number; y: number }) {
      const block = this.blocks.find(b => b.id === id);
      if (block) {
        block.position = position;
      }
    },

    addConnection(connection: Omit<Connection, 'id'>) {
      const id = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      this.connections.push({ id, ...connection });
      this.saveToHistory();
    },

    removeConnection(id: string) {
      this.connections = this.connections.filter(c => c.id !== id);
      this.saveToHistory();
    },

    updateConnection(id: string, connection: Omit<Connection, 'id'>) {
      const index = this.connections.findIndex(c => c.id === id);
      if (index === -1) {
        return;
      }

      this.connections[index] = {
        id,
        ...connection
      };
      this.saveToHistory();
    },

    selectBlock(id: string | null) {
      this.selectedBlockId = id;
    },

    saveToHistory() {
      const snapshot: Workflow = {
        id: this.currentWorkflow?.id || Date.now().toString(),
        name: this.currentWorkflow?.name || '新工作流',
        description: this.currentWorkflow?.description || '',
        blocks: JSON.parse(JSON.stringify(this.blocks)),
        connections: JSON.parse(JSON.stringify(this.connections)),
        variables: this.currentWorkflow?.variables || {},
        createdAt: this.currentWorkflow?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(snapshot);
      this.historyIndex++;

      if (this.history.length > 50) {
        this.history.shift();
        this.historyIndex--;
      }
    },

    undo() {
      if (this.canUndo) {
        this.historyIndex--;
        this.loadFromHistory();
      }
    },

    redo() {
      if (this.canRedo) {
        this.historyIndex++;
        this.loadFromHistory();
      }
    },

    loadFromHistory() {
      const snapshot = this.history[this.historyIndex];
      if (!snapshot) {
        return;
      }

      this.currentWorkflow = snapshot;
      this.blocks = normalizeWorkflowBlocks(JSON.parse(JSON.stringify(snapshot.blocks)));
      this.connections = JSON.parse(JSON.stringify(snapshot.connections));
    },

    loadWorkflow(workflow: Workflow) {
      this.currentWorkflow = workflow;
      this.blocks = normalizeWorkflowBlocks(JSON.parse(JSON.stringify(workflow.blocks)));
      this.connections = JSON.parse(JSON.stringify(workflow.connections));
      this.history = [workflow];
      this.historyIndex = 0;
    },

    migrateConditionBlocks() {
      let changed = false;
      this.blocks = this.blocks.map(block => {
        if (block.type !== 'condition') {
          return block;
        }

        const normalized = normalizeConditionBlock(JSON.parse(JSON.stringify(block)));
        const before = JSON.stringify({
          data: block.data,
          inputs: block.inputs,
          outputs: block.outputs
        });
        const after = JSON.stringify({
          data: normalized.data,
          inputs: normalized.inputs,
          outputs: normalized.outputs
        });

        if (before !== after) {
          changed = true;
          return normalized;
        }

        return block;
      });

      if (changed) {
        this.saveToHistory();
      }
    },

    clearWorkflow() {
      this.blocks = [];
      this.connections = [];
      this.selectedBlockId = null;
      this.history = [];
      this.historyIndex = -1;
    },

    setVariable(name: string, value: string, description = '') {
      if (!this.currentWorkflow) {
        this.initWorkflow();
      }
      if (!this.currentWorkflow!.variables) {
        this.currentWorkflow!.variables = {};
      }
      this.currentWorkflow!.variables[name] = { value, description };
      this.saveToHistory();
    },

    deleteVariable(name: string) {
      if (this.currentWorkflow?.variables) {
        delete this.currentWorkflow.variables[name];
        this.saveToHistory();
      }
    }
  }
});
