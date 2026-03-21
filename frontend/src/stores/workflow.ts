import { defineStore } from 'pinia';
import type { Block, BlockType, BlockData } from '../types/block';
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
    }
  },

  actions: {
    // 初始化新工作流
    initWorkflow(name: string = '新工作流') {
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

    // 添加Block
    addBlock(type: BlockType, position: { x: number; y: number }) {
      const block = this.createBlock(type, position);
      this.blocks.push(block);
      this.saveToHistory();
      return block;
    },

    // 创建Block
    createBlock(type: BlockType, position: { x: number; y: number }): Block {
      const id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const blockConfig = this.getBlockConfig(type);
      
      return {
        id,
        type,
        label: blockConfig.label,
        category: blockConfig.category,
        position,
        data: blockConfig.defaultData,
        inputs: blockConfig.inputs,
        outputs: blockConfig.outputs
      };
    },

    // 获取Block配置
    getBlockConfig(type: BlockType) {
      const configs: Record<BlockType, any> = {
        navigate: {
          label: '访问页面',
          category: 'browser',
          defaultData: { url: '', waitUntil: 'domcontentloaded', timeout: 60000 },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [{ id: 'out', name: '输出', type: 'flow' }]
        },
        scroll: {
          label: '滚动页面',
          category: 'browser',
          defaultData: { target: 'page', selector: '', timeout: DEFAULT_SELECTOR_TIMEOUT, mode: 'smart', maxScrolls: 15, scrollDistance: 800, delay: 800 },
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
          defaultData: { selector: '', waitForElement: true, timeout: DEFAULT_SELECTOR_TIMEOUT },
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
          label: '选择下拉框',
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
        'extract-images': {
          label: '提取图片',
          category: 'extraction',
          defaultData: { selector: 'img', filterInvalid: true, attributes: ['src', 'data-src'], timeout: DEFAULT_SELECTOR_TIMEOUT },
          inputs: [{ id: 'in', name: '输入', type: 'flow' }],
          outputs: [
            { id: 'out', name: '输出', type: 'flow' },
            { id: 'data', name: '图片列表', type: 'data' }
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
          label: '条件判断',
          category: 'logic',
          defaultData: { condition: '' },
          inputs: [
            { id: 'in', name: '输入', type: 'flow' },
            { id: 'data', name: '数据', type: 'data' }
          ],
          outputs: [
            { id: 'true', name: '真', type: 'flow' },
            { id: 'false', name: '假', type: 'flow' }
          ]
        },
        loop: {
          label: '循环',
          category: 'logic',
          defaultData: { mode: 'count', count: 10 },
          inputs: [
            { id: 'in', name: '输入', type: 'flow' },
            { id: 'data', name: '数据', type: 'data' }
          ],
          outputs: [
            { id: 'loop', name: '循环体', type: 'flow' },
            { id: 'out', name: '完成', type: 'flow' }
          ]
        },
        log: {
          label: '日志输出',
          category: 'logic',
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

    // 删除Block
    removeBlock(id: string) {
      this.blocks = this.blocks.filter(b => b.id !== id);
      this.connections = this.connections.filter(
        c => c.source !== id && c.target !== id
      );
      if (this.selectedBlockId === id) {
        this.selectedBlockId = null;
      }
      this.saveToHistory();
    },

    // 更新Block
    updateBlock(id: string, data: Partial<BlockData>) {
      const block = this.blocks.find(b => b.id === id);
      if (block) {
        block.data = { ...block.data, ...data };
        this.saveToHistory();
      }
    },

    // 更新Block位置
    updateBlockPosition(id: string, position: { x: number; y: number }) {
      const block = this.blocks.find(b => b.id === id);
      if (block) {
        block.position = position;
      }
    },

    // 添加连接
    addConnection(connection: Omit<Connection, 'id'>) {
      const id = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.connections.push({ id, ...connection });
      this.saveToHistory();
    },

    // 删除连接
    removeConnection(id: string) {
      this.connections = this.connections.filter(c => c.id !== id);
      this.saveToHistory();
    },

    // 选择Block
    selectBlock(id: string | null) {
      this.selectedBlockId = id;
    },

    // 保存到历史记录
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

      // 删除当前索引之后的历史
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(snapshot);
      this.historyIndex++;

      // 限制历史记录数量
      if (this.history.length > 50) {
        this.history.shift();
        this.historyIndex--;
      }
    },

    // 撤销
    undo() {
      if (this.canUndo) {
        this.historyIndex--;
        this.loadFromHistory();
      }
    },

    // 重做
    redo() {
      if (this.canRedo) {
        this.historyIndex++;
        this.loadFromHistory();
      }
    },

    // 从历史记录加载
    loadFromHistory() {
      const snapshot = this.history[this.historyIndex];
      if (snapshot) {
        this.currentWorkflow = snapshot;
        this.blocks = JSON.parse(JSON.stringify(snapshot.blocks));
        this.connections = JSON.parse(JSON.stringify(snapshot.connections));
      }
    },

    // 加载工作流
    loadWorkflow(workflow: Workflow) {
      this.currentWorkflow = workflow;
      this.blocks = JSON.parse(JSON.stringify(workflow.blocks));
      this.connections = JSON.parse(JSON.stringify(workflow.connections));
      this.history = [workflow];
      this.historyIndex = 0;
    },

    // 清空工作流
    clearWorkflow() {
      this.blocks = [];
      this.connections = [];
      this.selectedBlockId = null;
      this.history = [];
      this.historyIndex = -1;
    }
  }
});
