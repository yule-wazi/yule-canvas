<template>
  <div class="workflow-editor">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <button @click="showWorkflowManager = true" class="btn-workflow">
          📁 {{ currentWorkflowName }}
        </button>
        <button @click="save" class="btn-primary">💾 保存</button>
        <button @click="executeWorkflow" class="btn-success">▶️ 执行</button>
        <button @click="exportJson" class="btn-secondary">📤 导出JSON</button>
        <button @click="showImportModal = true" class="btn-secondary">📥 导入JSON</button>
      </div>
      <div class="toolbar-right">
        <button @click="loadExample" class="btn-secondary">📋 加载示例</button>
        <button @click="showDataTableModal = true" class="btn-secondary">📊 数据表</button>
        <button @click="showVariablesModal = true" class="btn-secondary">🔢 变量</button>
        <button @click="undo" :disabled="!canUndo" class="btn-icon">↶</button>
        <button @click="redo" :disabled="!canRedo" class="btn-icon">↷</button>
        <button @click="clear" class="btn-danger">🗑️ 清空</button>
      </div>
    </div>

    <div class="editor-content">
      <div class="block-palette">
        <h3>功能块</h3>
        
        <div class="palette-category">
          <h4>浏览器控制</h4>
          <div class="palette-block" @click="addBlock('navigate')">
            <span class="block-icon">🌐</span>
            <span>访问页面</span>
          </div>
          <div class="palette-block" @click="addBlock('back')">
            <span class="block-icon">⬅️</span>
            <span>返回</span>
          </div>
          <div class="palette-block" @click="addBlock('forward')">
            <span class="block-icon">➡️</span>
            <span>前进</span>
          </div>
          <div class="palette-block" @click="addBlock('scroll')">
            <span class="block-icon">📜</span>
            <span>滚动页面</span>
          </div>
          <div class="palette-block" @click="addBlock('wait')">
            <span class="block-icon">⏱️</span>
            <span>等待</span>
          </div>
          <div class="palette-block" @click="addBlock('log')">
            <span class="block-icon">📝</span>
            <span>日志输出</span>
          </div>
        </div>

        <div class="palette-category">
          <h4>页面交互</h4>
          <div class="palette-block" @click="addBlock('click')">
            <span class="block-icon">👆</span>
            <span>点击元素</span>
          </div>
          <div class="palette-block" @click="addBlock('type')">
            <span class="block-icon">⌨️</span>
            <span>输入文本</span>
          </div>
        </div>

        <div class="palette-category">
          <h4>数据提取</h4>
          <div class="palette-block" @click="addBlock('extract')">
            <span class="block-icon">📊</span>
            <span>提取数据</span>
          </div>
        </div>

        <div class="palette-category">
          <h4>逻辑控制</h4>
          <div class="palette-block" @click="addBlock('loop')">
            <span class="block-icon">�</span>
            <span>循环</span>
          </div>
        </div>
      </div>

      <div class="canvas-area">
        <VueFlow
          v-model="elements"
          :default-zoom="1"
          :min-zoom="0.2"
          :max-zoom="4"
          :connect-on-click="false"
          :node-types="nodeTypes"
          @node-click="onNodeClick"
          @connect="onConnect"
          @nodes-change="onNodesChange"
          @edges-change="onEdgesChange"
        >
          <Background pattern-color="#30363d" :gap="16" />
          <MiniMap 
            :nodeColor="getMinimapNodeColor"
            nodeStrokeColor="#484f58"
            :nodeStrokeWidth="1"
            maskColor="rgba(13, 17, 23, 0.85)"
            maskStrokeColor="#58a6ff"
            :maskStrokeWidth="2"
            pannable
            zoomable
          />
        </VueFlow>
      </div>

      <div class="property-panel" v-if="selectedBlock">
        <h3>属性配置</h3>
        <div class="property-content">
          <component
            :is="getPropertyComponent(selectedBlock.type)"
            :block="selectedBlock"
            @update="updateBlockData"
          />
        </div>
      </div>
    </div>

    <!-- 导入 JSON 弹窗 -->
    <div v-if="showImportModal" class="modal-overlay" @click="showImportModal = false">
      <div class="modal-content import-modal" @click.stop>
        <h3>导入 Workflow JSON</h3>
        <textarea 
          v-model="importJsonText" 
          placeholder="粘贴 Workflow JSON..."
          class="json-textarea"
        ></textarea>
        <div v-if="importJsonError" class="json-error">
          ❌ {{ importJsonError }}
        </div>
        <div class="modal-actions">
          <button @click="importJson" class="btn-primary">导入</button>
          <button @click="showImportModal = false" class="btn-secondary">取消</button>
        </div>
      </div>
    </div>

    <!-- 执行日志弹窗 -->
    <div v-if="showExecutionModal" class="modal-overlay" @click="!isExecuting && (showExecutionModal = false)">
      <div class="modal-content execution-modal" @click.stop>
        <h3>执行日志</h3>
        <div class="execution-logs">
          <div v-for="(log, index) in executionLogs" :key="index" class="log-line">{{ log }}</div>
        </div>
        
        <div class="modal-actions">
          <button v-if="isExecuting" @click="stopExecution" class="btn-danger">停止执行</button>
          <button v-else @click="showExecutionModal = false" class="btn-secondary">关闭</button>
        </div>
      </div>
    </div>

    <!-- 数据表管理弹窗 -->
    <div v-if="showDataTableModal" class="modal-overlay" @click="showDataTableModal = false">
      <div class="modal-content data-table-modal" @click.stop>
        <DataTableManager @close="showDataTableModal = false" />
      </div>
    </div>

    <!-- 变量管理弹窗 -->
    <div v-if="showVariablesModal" class="modal-overlay" @click="showVariablesModal = false">
      <div class="modal-content variables-modal" @click.stop>
        <h3>全局变量管理</h3>
        <div class="variables-content">
          <div class="variables-list">
            <div v-if="workflowVariables.length === 0" class="empty-state">
              暂无变量，点击下方按钮添加
            </div>
            <div v-for="(variable, index) in workflowVariables" :key="index" class="variable-item">
              <div class="variable-info">
                <span class="variable-name">{{variable.name}}</span>
                <span class="variable-value">= {{variable.value}}</span>
                <span class="variable-desc" v-if="variable.description">{{variable.description}}</span>
              </div>
              <div class="variable-actions">
                <button @click="editVariable(index)" class="btn-icon-small">✏️</button>
                <button @click="deleteVariable(index)" class="btn-icon-small">🗑️</button>
              </div>
            </div>
          </div>
          
          <div class="variable-form" v-if="showVariableForm">
            <h4>{{ editingVariableIndex !== null ? '编辑变量' : '添加变量' }}</h4>
            <div class="form-group">
              <label>变量名</label>
              <input 
                v-model="newVariable.name" 
                placeholder="例如: pageUrl, userName"
                @input="validateVariableName"
              />
              <small v-if="variableNameError" class="error">{{ variableNameError }}</small>
            </div>
            <div class="form-group">
              <label>默认值</label>
              <input 
                v-model="newVariable.value" 
                placeholder="变量的默认值"
              />
            </div>
            <div class="form-group">
              <label>描述（可选）</label>
              <input 
                v-model="newVariable.description" 
                placeholder="变量的用途说明"
              />
            </div>
            <div class="form-actions">
              <button @click="saveVariable" class="btn-primary" :disabled="!isVariableValid">保存</button>
              <button @click="cancelVariableEdit" class="btn-secondary">取消</button>
            </div>
          </div>
        </div>
        
        <div class="modal-actions">
          <button v-if="!showVariableForm" @click="addNewVariable" class="btn-primary">➕ 添加变量</button>
          <button @click="closeVariablesModal" class="btn-secondary">关闭</button>
        </div>
        
        <div class="variables-help">
          <p>💡 使用提示：在选择器或文本中使用 <code v-text="'{{变量名}}'"></code> 引用变量</p>
          <p>例如：<code v-text="'{{pageUrl}}'"></code> 会被替换为变量的值</p>
        </div>
      </div>
    </div>

    <!-- 确认对话框 -->
    <ConfirmDialog ref="confirmDialog" />
    
    <!-- Toast 提示 -->
    <Toast ref="toast" />
    
    <!-- 工作流管理弹窗 -->
    <WorkflowManager 
      :show="showWorkflowManager"
      :current-workflow-id="workflowStore.currentWorkflow?.id"
      @close="showWorkflowManager = false"
      @select="loadWorkflow"
      @create="createNewWorkflow"
      @delete="onWorkflowDeleted"
      @rename="onWorkflowRenamed"
      @duplicate="onWorkflowDuplicated"
      @error="(msg) => toast?.show({ message: msg, type: 'error' })"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent, onMounted, onBeforeUnmount, markRaw } from 'vue';
import { VueFlow, MarkerType } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { MiniMap } from '@vue-flow/minimap';
import { useWorkflowStore } from '../../stores/workflow';
import { useDataTableStore } from '../../stores/dataTable';
import api from '../../services/api';
import socketService from '../../services/socket';
import storageManager from '../../services/storage';
import type { BlockType } from '../../types/block';
import { simpleLogWorkflow } from '../../examples/workflowExample';
import CustomNode from './CustomNode.vue';
import LoopNode from './LoopNode.vue';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

// 动态导入属性组件
const NavigateProperty = defineAsyncComponent(() => import('./properties/NavigateProperty.vue'));
const BackProperty = defineAsyncComponent(() => import('./properties/BackProperty.vue'));
const ForwardProperty = defineAsyncComponent(() => import('./properties/ForwardProperty.vue'));
const ScrollProperty = defineAsyncComponent(() => import('./properties/ScrollProperty.vue'));
const WaitProperty = defineAsyncComponent(() => import('./properties/WaitProperty.vue'));
const ClickProperty = defineAsyncComponent(() => import('./properties/ClickProperty.vue'));
const TypeProperty = defineAsyncComponent(() => import('./properties/TypeProperty.vue'));
const ExtractProperty = defineAsyncComponent(() => import('./properties/ExtractProperty.vue'));
const LogProperty = defineAsyncComponent(() => import('./properties/LogProperty.vue'));
const LoopProperty = defineAsyncComponent(() => import('./properties/LoopProperty.vue'));
const DataTableManager = defineAsyncComponent(() => import('../DataTableManager.vue'));
const ConfirmDialog = defineAsyncComponent(() => import('../ConfirmDialog.vue'));
const Toast = defineAsyncComponent(() => import('../Toast.vue'));
const WorkflowManager = defineAsyncComponent(() => import('./WorkflowManager.vue'));

// 定义节点类型
const nodeTypes = {
  custom: markRaw(CustomNode) as any,
  loop: markRaw(LoopNode) as any
};

const workflowStore = useWorkflowStore();
const dataTableStore = useDataTableStore();
const showExecutionModal = ref(false);
const showDataTableModal = ref(false);
const showVariablesModal = ref(false);
const showVariableForm = ref(false);
const showWorkflowManager = ref(false);
const showImportModal = ref(false);
const importJsonText = ref('');
const importJsonError = ref('');
const editingVariableIndex = ref<number | null>(null);
const newVariable = ref({ name: '', value: '', description: '' });
const variableNameError = ref('');
const isExecuting = ref(false);
const executionLogs = ref<string[]>([]);
const executionResult = ref<any>(null);
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const toast = ref<InstanceType<typeof Toast> | null>(null);

// 工作流变量
const workflowVariables = computed(() => {
  const vars = workflowStore.variables;
  return Object.entries(vars).map(([name, data]: [string, any]) => ({
    name,
    value: data.value || '',
    description: data.description || ''
  }));
});

// 当前工作流名称
const currentWorkflowName = computed(() => {
  return workflowStore.currentWorkflow?.name || '未命名工作流';
});

// 验证变量名
function validateVariableName() {
  const name = newVariable.value.name.trim();
  
  if (!name) {
    variableNameError.value = '';
    return;
  }
  
  // 检查变量名格式（只允许字母、数字、下划线，且不能以数字开头）
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    variableNameError.value = '变量名只能包含字母、数字和下划线，且不能以数字开头';
    return;
  }
  
  // 检查是否与循环变量冲突
  const loopBlocks = workflowStore.blocks.filter(b => b.type === 'loop');
  const loopVariableNames = loopBlocks.map(b => b.data.variableName || 'index');
  if (loopVariableNames.includes(name)) {
    variableNameError.value = '变量名与循环变量冲突';
    return;
  }
  
  // 检查是否已存在（编辑时排除自己）
  const existingNames = Object.keys(workflowStore.variables);
  if (editingVariableIndex.value !== null) {
    const editingName = workflowVariables.value[editingVariableIndex.value]?.name;
    if (name !== editingName && existingNames.includes(name)) {
      variableNameError.value = '变量名已存在';
      return;
    }
  } else {
    if (existingNames.includes(name)) {
      variableNameError.value = '变量名已存在';
      return;
    }
  }
  
  variableNameError.value = '';
}

// 变量是否有效
const isVariableValid = computed(() => {
  return newVariable.value.name.trim() !== '' && 
         newVariable.value.value.trim() !== '' && 
         variableNameError.value === '';
});

// 添加新变量
function addNewVariable() {
  newVariable.value = { name: '', value: '', description: '' };
  editingVariableIndex.value = null;
  variableNameError.value = '';
  showVariableForm.value = true;
}

// 编辑变量
function editVariable(index: number) {
  const variable = workflowVariables.value[index];
  newVariable.value = { ...variable };
  editingVariableIndex.value = index;
  variableNameError.value = '';
  showVariableForm.value = true;
}

// 保存变量
function saveVariable() {
  if (!isVariableValid.value) return;
  
  const name = newVariable.value.name.trim();
  const value = newVariable.value.value.trim();
  const description = newVariable.value.description.trim();
  
  // 如果是编辑模式，先删除旧的变量名
  if (editingVariableIndex.value !== null) {
    const oldName = workflowVariables.value[editingVariableIndex.value].name;
    if (oldName !== name) {
      workflowStore.deleteVariable(oldName);
    }
  }
  
  // 保存变量
  workflowStore.setVariable(name, value, description);
  
  // 重置表单
  showVariableForm.value = false;
  editingVariableIndex.value = null;
  newVariable.value = { name: '', value: '', description: '' };
  
  toast.value?.show({
    message: '变量保存成功',
    type: 'success'
  });
}

// 删除变量
async function deleteVariable(index: number) {
  const variable = workflowVariables.value[index];
  
  const confirmed = await confirmDialog.value?.show({
    title: '确认删除',
    message: `确定要删除变量 "${variable.name}" 吗？`,
    confirmText: '删除',
    cancelText: '取消'
  });
  
  if (confirmed) {
    workflowStore.deleteVariable(variable.name);
    toast.value?.show({
      message: '变量已删除',
      type: 'success'
    });
  }
}

// 取消编辑
function cancelVariableEdit() {
  showVariableForm.value = false;
  editingVariableIndex.value = null;
  newVariable.value = { name: '', value: '', description: '' };
  variableNameError.value = '';
}

// 关闭变量管理弹窗
function closeVariablesModal() {
  showVariablesModal.value = false;
  showVariableForm.value = false;
  editingVariableIndex.value = null;
  newVariable.value = { name: '', value: '', description: '' };
  variableNameError.value = '';
}

// 初始化工作流 - 尝试从localStorage加载
const WORKFLOWS_KEY = 'saved_workflows';
const CURRENT_WORKFLOW_ID_KEY = 'current_workflow_id';

function initializeWorkflow() {
  // 尝试加载上次编辑的工作流
  const currentWorkflowId = localStorage.getItem(CURRENT_WORKFLOW_ID_KEY);
  
  if (currentWorkflowId) {
    const workflows = JSON.parse(localStorage.getItem(WORKFLOWS_KEY) || '[]');
    const savedWorkflow = workflows.find((w: any) => w.id === currentWorkflowId);
    
    if (savedWorkflow) {
      workflowStore.loadWorkflow(savedWorkflow);
      return;
    }
  }
  
  // 如果没有保存的工作流，创建新的
  workflowStore.initWorkflow();
}

initializeWorkflow();

// 初始化数据表 store
onMounted(() => {
  dataTableStore.init();
  updateHandleStyles();
});

// 监听连接变化，更新 handle 样式
watch(
  () => workflowStore.connections,
  () => {
    updateHandleStyles();
  },
  { deep: true }
);

// 更新连接点样式
function updateHandleStyles() {
  // 延迟执行，确保 DOM 已更新
  setTimeout(() => {
    // 重置所有 handle
    document.querySelectorAll('.vue-flow__handle').forEach(handle => {
      handle.classList.remove('connected');
    });
    
    // 标记已连接的 handle
    workflowStore.connections.forEach(conn => {
      // 源节点的 handle
      const sourceNode = document.querySelector(`[data-id="${conn.source}"]`);
      if (sourceNode) {
        // 根据 sourceHandle 查找对应的 handle
        let sourceHandle;
        if (conn.sourceHandle === 'loop-start') {
          sourceHandle = sourceNode.querySelector('.vue-flow__handle-left');
        } else {
          sourceHandle = sourceNode.querySelector('.vue-flow__handle-right');
        }
        if (sourceHandle) {
          sourceHandle.classList.add('connected');
        }
      }
      
      // 目标节点的 handle
      const targetNode = document.querySelector(`[data-id="${conn.target}"]`);
      if (targetNode) {
        // 根据 targetHandle 查找对应的 handle
        let targetHandle;
        if (conn.targetHandle === 'loop-end') {
          targetHandle = targetNode.querySelector('.vue-flow__handle-right');
        } else {
          targetHandle = targetNode.querySelector('.vue-flow__handle-left');
        }
        if (targetHandle) {
          targetHandle.classList.add('connected');
        }
      }
    });
  }, 100);
}

// 自动保存 - 监听blocks和connections的变化
let autoSaveTimer: any = null;

watch(
  () => [workflowStore.blocks, workflowStore.connections],
  () => {
    // 防抖：延迟2秒后自动保存
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    
    autoSaveTimer = setTimeout(() => {
      if (workflowStore.currentWorkflow && workflowStore.blocks.length > 0) {
        autoSave();
      }
    }, 2000);
  },
  { deep: true }
);

// 页面卸载前保存
onBeforeUnmount(() => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  if (workflowStore.currentWorkflow && workflowStore.blocks.length > 0) {
    autoSave();
  }
});

function autoSave() {
  try {
    if (!workflowStore.currentWorkflow) return;

    const workflow = {
      ...workflowStore.currentWorkflow,
      blocks: workflowStore.blocks,
      connections: workflowStore.connections,
      updatedAt: Date.now()
    };

    const workflows = JSON.parse(localStorage.getItem(WORKFLOWS_KEY) || '[]');
    const index = workflows.findIndex((w: any) => w.id === workflow.id);
    
    if (index >= 0) {
      workflows[index] = workflow;
    } else {
      workflows.push(workflow);
    }
    
    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
    localStorage.setItem(CURRENT_WORKFLOW_ID_KEY, workflow.id);
  } catch (error) {
    console.error('自动保存失败:', error);
  }
}

// 转换为Vue Flow格式
const elements = computed({
  get() {
    const nodes = workflowStore.blocks.map(block => {
      // 安全检查
      if (!block || !block.label) {
        console.error('Block 数据不完整:', block);
        return null;
      }
      
      // 检查该节点的连接状态
      const hasSourceConnection = workflowStore.connections.some(c => c.source === block.id);
      const hasTargetConnection = workflowStore.connections.some(c => c.target === block.id);
      
      return {
        id: block.id,
        type: block.type === 'loop' ? 'loop' : 'custom',  // 循环模块使用特殊节点类型
        position: block.position,
        label: block.label,
        data: { 
          label: block.label,
          ...block.data, 
          blockType: block.type,
          hasSourceConnection,
          hasTargetConnection
        },
        style: {
          background: getBlockColor(block.category),
          color: '#fff',
          border: '1px solid #30363d',
          borderRadius: '8px',
          minWidth: '150px',
          textAlign: 'center' as const
        }
      };
    }).filter(node => node !== null);

    const edges = workflowStore.connections.map(conn => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      sourceHandle: conn.sourceHandle || 'source-right',
      targetHandle: conn.targetHandle || 'target-left',
      type: 'default', // 使用默认的贝塞尔曲线
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: conn.type === 'data' ? '#f85149' : '#58a6ff',
        width: 20,
        height: 20
      },
      style: {
        stroke: conn.type === 'data' ? '#f85149' : '#58a6ff',
        strokeWidth: 2
      }
    }));

    return [...nodes, ...edges] as any;
  },
  set(value) {
    // Vue Flow会更新这个值
  }
});

const selectedBlock = computed(() => workflowStore.selectedBlock);
const canUndo = computed(() => workflowStore.canUndo);
const canRedo = computed(() => workflowStore.canRedo);

function getBlockColor(category: string) {
  const colors: Record<string, string> = {
    browser: '#1f6feb',
    interaction: '#238636',
    extraction: '#f85149',
    logic: '#8957e5',
    data: '#6e7681'
  };
  return colors[category] || '#6e7681';
}

function getMinimapNodeColor(node: any) {
  // 从节点的 style 中获取背景色
  if (node.style && node.style.background) {
    return node.style.background;
  }
  
  // 如果没有 style，根据 blockType 返回颜色
  const blockType = node.data?.blockType;
  if (blockType) {
    const colorMap: Record<string, string> = {
      navigate: '#1f6feb',
      back: '#1f6feb',
      forward: '#1f6feb',
      scroll: '#1f6feb',
      wait: '#1f6feb',
      click: '#238636',
      type: '#238636',
      extract: '#f85149',
      loop: '#8957e5',
      log: '#8957e5'
    };
    return colorMap[blockType] || '#6e7681';
  }
  
  return '#6e7681';
}

function addBlock(type: BlockType) {
  // 计算新节点的位置 - 水平布局
  const existingBlocks = workflowStore.blocks;
  let x = 100;
  let y = 200;
  
  if (existingBlocks.length > 0) {
    // 找到最右边的节点
    const rightmostBlock = existingBlocks.reduce((max, block) => 
      block.position.x > max.position.x ? block : max
    );
    // 在最右边节点的右侧添加新节点
    x = rightmostBlock.position.x + 250;
    y = rightmostBlock.position.y;
  }
  
  const position = { x, y };
  workflowStore.addBlock(type, position);
}

function onNodeClick(event: any) {
  workflowStore.selectBlock(event.node.id);
}

function onConnect(connection: any) {
  // 获取源节点和目标节点
  const sourceBlock = workflowStore.blocks.find(b => b.id === connection.source);
  const targetBlock = workflowStore.blocks.find(b => b.id === connection.target);
  
  // 循环模块的特殊连接规则
  if (sourceBlock?.type === 'loop') {
    // 循环模块的左端点（loop-start）只能连接到其他模块的左端点（target-left）
    if (connection.sourceHandle === 'loop-start') {
      if (!connection.targetHandle || !connection.targetHandle.includes('left')) {
        return; // 静默拒绝
      }
    }
  }
  
  if (targetBlock?.type === 'loop') {
    // 循环模块的右端点（loop-end）只能接收其他模块的右端点（source-right）
    if (connection.targetHandle === 'loop-end') {
      if (!connection.sourceHandle || !connection.sourceHandle.includes('right')) {
        return; // 静默拒绝
      }
    }
  }
  
  // 普通模块的连接规则：只允许连接到左侧端点（target-left）
  // 拒绝连接到右侧端点
  if (targetBlock?.type !== 'loop' && connection.targetHandle && connection.targetHandle.includes('right')) {
    return; // 静默拒绝
  }
  
  // 验证：source 必须是右侧，target 必须是左侧（循环模块除外）
  if (sourceBlock?.type !== 'loop') {
    if (connection.sourceHandle && !connection.sourceHandle.includes('right')) {
      return; // 静默拒绝
    }
  }
  
  if (targetBlock?.type !== 'loop') {
    if (connection.targetHandle && !connection.targetHandle.includes('left')) {
      return; // 静默拒绝
    }
  }
  
  // 检测循环体交叉
  if (sourceBlock?.type === 'loop' && connection.sourceHandle === 'loop-start') {
    // 这是一个循环的开始连接，检查是否会导致循环体交叉
    const loopId = sourceBlock.id;
    
    // 找到这个循环的结束连接
    const loopEndConn = workflowStore.connections.find(c => 
      c.target === loopId && c.targetHandle === 'loop-end'
    );
    
    if (loopEndConn) {
      // 已经有循环体了，检查新的起始点是否会导致交叉
      const currentLoopBody = findLoopBody(loopId, connection.target, loopEndConn.source);
      
      // 检查当前循环体是否包含其他循环的循环体块
      const hasIntersection = checkLoopIntersection(currentLoopBody, loopId);
      
      if (hasIntersection) {
        toast.value?.show({ 
          message: '不允许循环体交叉！当前循环体包含了其他循环的循环体块，这会导致循环嵌套冲突。请调整连接，确保循环体之间不会交叉。', 
          type: 'warning' 
        });
        return;
      }
    }
  }
  
  if (targetBlock?.type === 'loop' && connection.targetHandle === 'loop-end') {
    // 这是一个循环的结束连接，检查是否会导致循环体交叉
    const loopId = targetBlock.id;
    
    // 找到这个循环的开始连接
    const loopStartConn = workflowStore.connections.find(c => 
      c.source === loopId && c.sourceHandle === 'loop-start'
    );
    
    if (loopStartConn) {
      // 已经有循环体了，检查新的结束点是否会导致交叉
      const currentLoopBody = findLoopBody(loopId, loopStartConn.target, connection.source);
      
      // 检查当前循环体是否包含其他循环的循环体块
      const hasIntersection = checkLoopIntersection(currentLoopBody, loopId);
      
      if (hasIntersection) {
        toast.value?.show({ 
          message: '不允许循环体交叉！当前循环体包含了其他循环的循环体块，这会导致循环嵌套冲突。请调整连接，确保循环体之间不会交叉。', 
          type: 'warning' 
        });
        return;
      }
    }
  }
  
  workflowStore.addConnection({
    source: connection.source,
    sourceHandle: connection.sourceHandle || 'source-right',
    target: connection.target,
    targetHandle: connection.targetHandle || 'target-left'
  });
  updateHandleStyles();
}

// 查找循环体内的所有块ID（包括嵌套的循环模块）
function findLoopBody(loopId: string, startBlockId: string, endBlockId: string): Set<string> {
  const bodyBlockIds = new Set<string>();
  const visited = new Set<string>();
  let currentId = startBlockId;
  
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    bodyBlockIds.add(currentId);
    
    if (currentId === endBlockId) {
      break;
    }
    
    // 找到下一个连接（使用 source-right 或 out handle）
    const nextConn = workflowStore.connections.find(c => 
      c.source === currentId && 
      (c.sourceHandle === 'source-right' || c.sourceHandle === 'out')
    );
    
    if (nextConn) {
      currentId = nextConn.target;
    } else {
      break;
    }
  }
  
  return bodyBlockIds;
}

// 检查循环体是否与其他循环体交叉（允许完全嵌套，但不允许部分交叉）
function checkLoopIntersection(currentLoopBody: Set<string>, currentLoopId: string): boolean {
  // 获取所有其他循环模块
  const otherLoops = workflowStore.blocks.filter(b => 
    b.type === 'loop' && b.id !== currentLoopId
  );
  
  for (const otherLoop of otherLoops) {
    // 找到其他循环的循环体
    const loopStartConn = workflowStore.connections.find(c => 
      c.source === otherLoop.id && c.sourceHandle === 'loop-start'
    );
    const loopEndConn = workflowStore.connections.find(c => 
      c.target === otherLoop.id && c.targetHandle === 'loop-end'
    );
    
    if (loopStartConn && loopEndConn) {
      const otherLoopBody = findLoopBody(otherLoop.id, loopStartConn.target, loopEndConn.source);
      
      // 检查交叉情况
      let currentContainsOther = 0; // 当前循环体包含其他循环体的块数
      let otherContainsCurrent = 0; // 其他循环体包含当前循环体的块数
      
      for (const blockId of otherLoopBody) {
        if (currentLoopBody.has(blockId)) {
          currentContainsOther++;
        }
      }
      
      for (const blockId of currentLoopBody) {
        if (otherLoopBody.has(blockId)) {
          otherContainsCurrent++;
        }
      }
      
      // 情况1：完全不相交 - 允许
      if (currentContainsOther === 0 && otherContainsCurrent === 0) {
        continue;
      }
      
      // 情况2：当前循环完全包含其他循环（嵌套） - 允许
      // 需要包含其他循环的所有循环体块
      // 注意：其他循环模块本身不在循环体内，所以不需要检查 currentLoopBody.has(otherLoop.id)
      // 只要当前循环体包含了其他循环的所有循环体块，就说明其他循环被完全嵌套在当前循环内
      if (currentContainsOther === otherLoopBody.size) {
        // 额外检查：其他循环的起始块和结束块都应该在当前循环体内
        if (currentLoopBody.has(loopStartConn.target) && currentLoopBody.has(loopEndConn.source)) {
          continue; // 合法嵌套
        }
      }
      
      // 情况3：其他循环完全包含当前循环（被嵌套） - 允许
      // 需要包含当前循环的所有循环体块
      if (otherContainsCurrent === currentLoopBody.size) {
        // 额外检查：当前循环的起始块和结束块都应该在其他循环体内
        // 找到当前循环的起始和结束连接
        const currentLoopStartConn = workflowStore.connections.find(c => 
          c.source === currentLoopId && c.sourceHandle === 'loop-start'
        );
        const currentLoopEndConn = workflowStore.connections.find(c => 
          c.target === currentLoopId && c.targetHandle === 'loop-end'
        );
        
        if (currentLoopStartConn && currentLoopEndConn) {
          if (otherLoopBody.has(currentLoopStartConn.target) && otherLoopBody.has(currentLoopEndConn.source)) {
            continue; // 合法嵌套
          }
        }
      }
      
      // 情况4：部分交叉 - 不允许
      return true;
    }
  }
  
  return false;
}

function onNodesChange(changes: any[]) {
  changes.forEach(change => {
    if (change.type === 'position' && change.position) {
      workflowStore.updateBlockPosition(change.id, change.position);
    } else if (change.type === 'remove') {
      workflowStore.removeBlock(change.id);
      updateHandleStyles();
    }
  });
}

function onEdgesChange(changes: any[]) {
  changes.forEach(change => {
    if (change.type === 'remove') {
      workflowStore.removeConnection(change.id);
      updateHandleStyles();
    }
  });
}

function updateBlockData(data: any) {
  if (selectedBlock.value) {
    workflowStore.updateBlock(selectedBlock.value.id, data);
  }
}

function getPropertyComponent(type: BlockType) {
  const components: Record<string, any> = {
    navigate: NavigateProperty,
    back: BackProperty,
    forward: ForwardProperty,
    scroll: ScrollProperty,
    wait: WaitProperty,
    click: ClickProperty,
    type: TypeProperty,
    extract: ExtractProperty,
    loop: LoopProperty,
    log: LogProperty
  };
  return components[type] || 'div';
}

async function save() {
  try {
    if (!workflowStore.currentWorkflow) {
      toast.value?.show({ message: '没有可保存的工作流', type: 'warning' });
      return;
    }

    if (workflowStore.blocks.length === 0) {
      toast.value?.show({ message: '工作流为空，请先添加一些功能块', type: 'warning' });
      return;
    }

    // 更新工作流数据
    const workflow = {
      ...workflowStore.currentWorkflow,
      blocks: workflowStore.blocks,
      connections: workflowStore.connections,
      updatedAt: Date.now()
    };

    // 保存工作流到localStorage
    const workflows = JSON.parse(localStorage.getItem(WORKFLOWS_KEY) || '[]');
    
    const index = workflows.findIndex((w: any) => w.id === workflow.id);
    if (index >= 0) {
      workflows[index] = workflow;
    } else {
      workflows.push(workflow);
    }
    
    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
    
    // 记住当前工作流ID
    localStorage.setItem(CURRENT_WORKFLOW_ID_KEY, workflow.id);

    // 编译工作流为代码
    const response: any = await api.post('/workflow/compile', {
      workflow: {
        blocks: workflowStore.blocks,
        connections: workflowStore.connections
      }
    });

    if (response && response.code) {
      // 保存到脚本管理系统
      const script = {
        id: workflow.id,
        name: workflow.name || '未命名工作流',
        description: workflow.description || '可视化工作流生成',
        code: response.code,
        aiModel: 'workflow',
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        executionCount: 0
      };

      storageManager.saveScript(script);
      
      toast.value?.show({ message: '工作流和脚本保存成功！', type: 'success' });
    } else {
      toast.value?.show({ message: '工作流保存成功，但代码生成失败', type: 'warning' });
    }
  } catch (error: any) {
    console.error('保存失败:', error);
    toast.value?.show({ message: '保存失败: ' + error.message, type: 'error' });
  }
}

// 工作流管理相关函数
function loadWorkflow(workflowId: string) {
  const workflows = JSON.parse(localStorage.getItem(WORKFLOWS_KEY) || '[]');
  const workflow = workflows.find((w: any) => w.id === workflowId);
  
  if (workflow) {
    workflowStore.loadWorkflow(workflow);
    localStorage.setItem(CURRENT_WORKFLOW_ID_KEY, workflowId);
    toast.value?.show({ message: `已加载工作流: ${workflow.name}`, type: 'success' });
  } else {
    toast.value?.show({ message: '未找到该工作流', type: 'error' });
  }
}

function createNewWorkflow(workflow: any) {
  workflowStore.loadWorkflow(workflow);
  localStorage.setItem(CURRENT_WORKFLOW_ID_KEY, workflow.id);
  toast.value?.show({ message: `已创建工作流: ${workflow.name}`, type: 'success' });
}

function onWorkflowDeleted(workflowId: string) {
  // 如果删除的是当前工作流，清空编辑器
  if (workflowStore.currentWorkflow?.id === workflowId) {
    workflowStore.initWorkflow();
    localStorage.removeItem(CURRENT_WORKFLOW_ID_KEY);
  }
}

function onWorkflowRenamed(workflowId: string, newName: string) {
  // 如果重命名的是当前工作流，更新名称
  if (workflowStore.currentWorkflow?.id === workflowId) {
    workflowStore.currentWorkflow.name = newName;
  }
}

function onWorkflowDuplicated(workflow: any) {
  toast.value?.show({ message: `已复制工作流: ${workflow.name}`, type: 'success' });
}

function exportJson() {
  try {
    if (workflowStore.blocks.length === 0) {
      toast.value?.show({ message: '工作流为空，无法导出', type: 'warning' });
      return;
    }

    const workflowJson = {
      blocks: workflowStore.blocks,
      connections: workflowStore.connections,
      variables: workflowStore.variables
    };

    const jsonString = JSON.stringify(workflowJson, null, 2);
    navigator.clipboard.writeText(jsonString);
    toast.value?.show({ message: '✅ Workflow JSON 已复制到剪贴板', type: 'success' });
  } catch (error: any) {
    console.error('导出失败:', error);
    toast.value?.show({ message: '导出失败: ' + error.message, type: 'error' });
  }
}

function importJson() {
  try {
    importJsonError.value = '';

    if (!importJsonText.value.trim()) {
      importJsonError.value = '请输入 JSON 内容';
      return;
    }

    // 解析 JSON
    const workflow = JSON.parse(importJsonText.value);

    // 验证格式
    if (!workflow.blocks || !Array.isArray(workflow.blocks)) {
      importJsonError.value = 'JSON 格式错误：缺少 blocks 数组';
      return;
    }

    if (!workflow.connections || !Array.isArray(workflow.connections)) {
      importJsonError.value = 'JSON 格式错误：缺少 connections 数组';
      return;
    }

    // 清空当前工作流
    workflowStore.blocks = [];
    workflowStore.connections = [];

    // 导入 blocks
    workflow.blocks.forEach((block: any) => {
      workflowStore.blocks.push(block);
    });

    // 导入 connections
    workflow.connections.forEach((conn: any) => {
      workflowStore.connections.push(conn);
    });

    // 导入 variables
    if (workflow.variables) {
      if (workflowStore.currentWorkflow) {
        workflowStore.currentWorkflow.variables = workflow.variables;
      }
    }

    workflowStore.saveToHistory();

    showImportModal.value = false;
    importJsonText.value = '';
    toast.value?.show({ 
      message: `✅ 成功导入 ${workflow.blocks.length} 个模块`, 
      type: 'success' 
    });
  } catch (error: any) {
    console.error('导入失败:', error);
    importJsonError.value = error.message;
  }
}

function undo() {
  workflowStore.undo();
}

function redo() {
  workflowStore.redo();
}

function clear() {
  confirmDialog.value?.show({
    title: '清空工作流',
    message: '确定要清空当前工作流的所有模块吗？',
    confirmText: '清空',
    cancelText: '取消',
    type: 'danger'
  }).then((confirmed) => {
    if (confirmed) {
      // 只清空 blocks 和 connections，保留当前工作流信息
      workflowStore.blocks = [];
      workflowStore.connections = [];
      workflowStore.selectedBlockId = null;
      workflowStore.saveToHistory();
      
      toast.value?.show({ message: '工作流已清空', type: 'success' });
    }
  });
}

function stopExecution() {
  socketService.disconnect();
  isExecuting.value = false;
  executionLogs.value.push('\n⚠️ 执行已停止');
}

function saveToDataTables(results: any) {
  // 初始化数据表 store
  dataTableStore.init();
  
  // 处理提取的数据
  if (results.data && results.data.length > 0) {
    // 按数据表分组
    const tableGroups = new Map<string, any[]>();
    
    results.data.forEach((item: any) => {
      // 新格式：包含 _rowData 的完整行数据
      if (item._table && item._rowData) {
        if (!tableGroups.has(item._table)) {
          tableGroups.set(item._table, []);
        }
        tableGroups.get(item._table)!.push(item._rowData);
      }
      // 旧格式：单列数据（向后兼容）
      else if (item._table && item._column) {
        if (!tableGroups.has(item._table)) {
          tableGroups.set(item._table, []);
        }
        tableGroups.get(item._table)!.push({
          [item._column]: item.value
        });
      }
    });
    
    // 保存到各个数据表
    tableGroups.forEach((rows, tableId) => {
      dataTableStore.insertRows(tableId, rows);
    });
  }
  
  // 处理提取的图片
  if (results.images && results.images.length > 0) {
    const tableGroups = new Map<string, any[]>();
    
    results.images.forEach((item: any) => {
      if (item._table && item._column) {
        if (!tableGroups.has(item._table)) {
          tableGroups.set(item._table, []);
        }
        tableGroups.get(item._table)!.push({
          [item._column]: item.src
        });
      }
    });
    
    tableGroups.forEach((rows, tableId) => {
      dataTableStore.insertRows(tableId, rows);
    });
  }
}

function loadExample() {
  if (workflowStore.blocks.length > 0) {
    confirmDialog.value?.show({
      title: '加载示例',
      message: '当前工作流将被清空，确定要加载示例吗？',
      confirmText: '加载',
      cancelText: '取消',
      type: 'default'
    }).then((confirmed) => {
      if (confirmed) {
        workflowStore.clearWorkflow();
        workflowStore.loadWorkflow(simpleLogWorkflow as any);
        
        // 更新当前工作流ID
        localStorage.setItem(CURRENT_WORKFLOW_ID_KEY, simpleLogWorkflow.id);
        
        toast.value?.show({ message: '示例工作流已加载', type: 'success' });
      }
    });
  } else {
    workflowStore.clearWorkflow();
    workflowStore.loadWorkflow(simpleLogWorkflow as any);
    
    // 更新当前工作流ID
    localStorage.setItem(CURRENT_WORKFLOW_ID_KEY, simpleLogWorkflow.id);
    
    toast.value?.show({ message: '示例工作流已加载', type: 'success' });
  }
}

async function executeWorkflow() {
  try {
    if (workflowStore.blocks.length === 0) {
      toast.value?.show({ message: '工作流为空，请先添加一些功能块', type: 'warning' });
      return;
    }

    if (isExecuting.value) {
      toast.value?.show({ message: '工作流正在执行中...', type: 'warning' });
      return;
    }

    // 准备工作流 JSON（直接执行，不再编译为代码）
    const workflow = {
      blocks: workflowStore.blocks,
      connections: workflowStore.connections,
      variables: workflowStore.variables
    };
    
    // 清空日志
    executionLogs.value = [];
    isExecuting.value = true;
    showExecutionModal.value = true;

    // 连接Socket.io
    socketService.connect();

    // 监听日志
    socketService.onLog((log) => {
      executionLogs.value.push(log.timestamp ? `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}` : log.message);
    });

    // 监听实时数据保存
    socketService.on('saveData', (data: any) => {
      if (data.type === 'data' && data.tableId && data.rows) {
        // 立即保存提取的数据
        dataTableStore.insertRows(data.tableId, data.rows);
        executionLogs.value.push(`💾 已保存 ${data.rows.length} 行数据到数据表`);
      } else if (data.type === 'images' && data.tableId && data.rows) {
        // 立即保存提取的图片
        dataTableStore.insertRows(data.tableId, data.rows);
        executionLogs.value.push(`💾 已保存 ${data.rows.length} 张图片到数据表`);
      }
    });

    // 监听完成
    socketService.onComplete((result) => {
      executionLogs.value.push(`\n✅ 执行完成！`);
      
      // WorkflowExecutor 返回的格式是 { success, data, logs, duration }
      executionResult.value = result.data;
      
      // 显示提取的数据统计
      if (result.data && result.data.results) {
        const { images, data, links } = result.data.results;
        if (images && images.length > 0) {
          executionLogs.value.push(`� 提取了 ${images.length} 张图片`);
        }
        if (data && data.length > 0) {
          executionLogs.value.push(`📊 提取了 ${data.length} 条数据`);
        }
        if (links && links.length > 0) {
          executionLogs.value.push(`🔗 提取了 ${links.length} 个链接`);
        }
      }
      
      isExecuting.value = false;
      socketService.offAll();
    });

    // 监听错误
    socketService.onError((error) => {
      executionLogs.value.push(`\n❌ 执行失败: ${error.message}`);
      isExecuting.value = false;
      socketService.offAll();
    });

    // 执行工作流（使用新的 execute-workflow 事件）
    const workflowId = `workflow-${Date.now()}`;
    socketService.executeWorkflow(workflowId, workflow);
    
    executionLogs.value.push('🚀 开始执行工作流...\n');
  } catch (error: any) {
    console.error('执行失败:', error);
    toast.value?.show({ message: '执行失败: ' + (error.response?.data?.error || error.message), type: 'error' });
    isExecuting.value = false;
  }
}
</script>

<style scoped>
.workflow-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0d1117;
  color: #c9d1d9;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #161b22;
  border-bottom: 1px solid #30363d;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-workflow {
  padding: 0.5rem 1rem;
  border: 2px solid #58a6ff;
  border-radius: 6px;
  background: #0d1117;
  color: #58a6ff;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-workflow:hover {
  background: #1c2d3f;
  border-color: #79c0ff;
  color: #79c0ff;
}

.btn-primary, .btn-secondary, .btn-danger, .btn-icon, .btn-success {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s;
}

.btn-primary {
  background: #238636;
  color: white;
}

.btn-primary:hover {
  background: #2ea043;
}

.btn-success {
  background: #1f6feb;
  color: white;
}

.btn-success:hover {
  background: #388bfd;
}

.btn-secondary {
  background: #1f6feb;
  color: white;
}

.btn-secondary:hover {
  background: #388bfd;
}

.btn-danger {
  background: #da3633;
  color: white;
}

.btn-danger:hover {
  background: #f85149;
}

.btn-icon {
  background: #21262d;
  color: #c9d1d9;
  padding: 0.5rem 0.75rem;
}

.btn-icon:hover:not(:disabled) {
  background: #30363d;
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.editor-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.block-palette {
  width: 250px;
  background: #161b22;
  border-right: 1px solid #30363d;
  overflow-y: auto;
  padding: 1rem;
}

.block-palette h3 {
  margin: 0 0 1rem 0;
  color: #58a6ff;
}

.palette-category {
  margin-bottom: 1.5rem;
}

.palette-category h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #8b949e;
}

.palette-block {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.palette-block:hover {
  background: #30363d;
  border-color: #58a6ff;
}

.block-icon {
  font-size: 1.2rem;
}

.canvas-area {
  flex: 1;
  position: relative;
}

.property-panel {
  width: 300px;
  background: #161b22;
  border-left: 1px solid #30363d;
  padding: 1rem;
  overflow-y: auto;
}

.property-panel h3 {
  margin: 0 0 1rem 0;
  color: #58a6ff;
}

.property-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 2rem;
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.execution-modal {
  max-width: 900px;
}

.import-modal {
  max-width: 700px;
}

.json-textarea {
  flex: 1;
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 1rem;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9rem;
  resize: vertical;
  min-height: 400px;
}

.json-textarea:focus {
  outline: none;
  border-color: #58a6ff;
}

.json-error {
  padding: 0.75rem;
  background: #da3633;
  color: white;
  border-radius: 6px;
  font-size: 0.9rem;
  margin-top: 1rem;
}

.modal-content h3 {
  margin: 0 0 1rem 0;
  color: #58a6ff;
}

.modal-content h4 {
  margin: 0 0 0.5rem 0;
  color: #8b949e;
  font-size: 0.9rem;
}

.code-preview {
  flex: 1;
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 1rem;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9rem;
  resize: none;
  min-height: 400px;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  justify-content: flex-end;
}

.execution-logs {
  flex: 1;
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 1rem;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9rem;
  overflow-y: auto;
  min-height: 400px;
  max-height: 500px;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-line {
  margin-bottom: 0.25rem;
  line-height: 1.5;
}

.data-preview {
  margin-top: 1rem;
  padding: 1rem;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
}

.data-summary {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.data-summary span {
  padding: 0.5rem 1rem;
  background: #21262d;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #c9d1d9;
}

.data-table-modal {
  width: 95%;
  max-width: 1400px;
  height: 85vh;
  max-height: 85vh;
  padding: 0;
  overflow: hidden;
}

.variables-modal {
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  overflow-y: auto;
}

.variables-content {
  margin: 1.5rem 0;
}

.variables-list {
  margin-bottom: 1.5rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #8b949e;
  font-size: 0.9rem;
}

.variable-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

.variable-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.variable-name {
  font-size: 1rem;
  font-weight: 600;
  color: #58a6ff;
  font-family: 'Consolas', 'Monaco', monospace;
}

.variable-value {
  font-size: 0.9rem;
  color: #c9d1d9;
  font-family: 'Consolas', 'Monaco', monospace;
}

.variable-desc {
  font-size: 0.85rem;
  color: #8b949e;
  font-style: italic;
}

.variable-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon-small {
  padding: 0.4rem 0.6rem;
  background: transparent;
  border: 1px solid #30363d;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-icon-small:hover {
  background: #21262d;
  border-color: #58a6ff;
}

.variable-form {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.variable-form h4 {
  margin: 0 0 1rem 0;
  color: #c9d1d9;
  font-size: 1rem;
}

.variable-form .form-group {
  margin-bottom: 1rem;
}

.variable-form .form-group:last-child {
  margin-bottom: 0;
}

.variable-form label {
  display: block;
  margin-bottom: 0.5rem;
  color: #8b949e;
  font-size: 0.9rem;
  font-weight: 500;
}

.variable-form input {
  width: 100%;
  padding: 0.6rem;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #c9d1d9;
  font-size: 0.9rem;
  font-family: 'Consolas', 'Monaco', monospace;
}

.variable-form input:focus {
  outline: none;
  border-color: #58a6ff;
}

.variable-form small {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: #8b949e;
}

.variable-form small.error {
  color: #f85149;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.variables-help {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  border-left: 3px solid #58a6ff;
}

.variables-help p {
  margin: 0.5rem 0;
  font-size: 0.85rem;
  color: #8b949e;
  line-height: 1.5;
}

.variables-help p:first-child {
  margin-top: 0;
}

.variables-help p:last-child {
  margin-bottom: 0;
}

.variables-help code {
  padding: 0.2rem 0.4rem;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 3px;
  color: #58a6ff;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.85rem;
}

/* 自定义 MiniMap 样式 */
:deep(.vue-flow__minimap) {
  background: #161b22 !important;
  border: 1px solid #30363d !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
}

:deep(.vue-flow__minimap-mask) {
  fill: rgba(13, 17, 23, 0.85) !important;
  stroke: #58a6ff !important;
  stroke-width: 2 !important;
  rx: 8 !important;
}

:deep(.vue-flow__minimap svg) {
  background: #161b22 !important;
  border-radius: 8px !important;
}

/* MiniMap 节点颜色 - 让它继承节点的实际颜色 */
:deep(.vue-flow__minimap-node) {
  stroke: #484f58;
  stroke-width: 1;
  /* 不设置 fill，让它自动继承节点背景色 */
}

/* 全局覆盖 MiniMap 背景 */
.vue-flow__minimap {
  background: #161b22 !important;
}

/* 自定义连接点样式 - 默认空心 */
:deep(.vue-flow__handle) {
  width: 12px !important;
  height: 12px !important;
  background: #0d1117 !important;
  border: 2px solid #58a6ff !important;
  border-radius: 50% !important;
  transition: all 0.2s ease !important;
  --vf-handle: #0d1117 !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: all !important;
  z-index: 10 !important;
  position: absolute !important;
}

/* 左侧 handle 定位 - 在节点外部 */
:deep(.vue-flow__handle-left) {
  left: -6px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
}

/* 右侧 handle 定位 - 在节点外部 */
:deep(.vue-flow__handle-right) {
  right: -6px !important;
  left: auto !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
}

/* 已连接的连接点 - 实心 */
:deep(.vue-flow__handle.connected),
:deep(.vue-flow__handle-left.connected),
:deep(.vue-flow__handle-right.connected) {
  background: #58a6ff !important;
  --vf-handle: #58a6ff !important;
}

/* hover 时变为实心 - 居中放大 */
:deep(.vue-flow__handle:hover) {
  background: #58a6ff !important;
  border-color: #388bfd !important;
  box-shadow: 0 0 8px rgba(88, 166, 255, 0.6) !important;
  --vf-handle: #58a6ff !important;
  width: 16px !important;
  height: 16px !important;
}

/* hover 时左侧 handle 保持在外部居中 */
:deep(.vue-flow__handle-left:hover) {
  left: -8px !important;
  transform: translateY(-50%) !important;
}

/* hover 时右侧 handle 保持在外部居中 */
:deep(.vue-flow__handle-right:hover) {
  right: -8px !important;
  transform: translateY(-50%) !important;
}

/* 连接线样式 */
:deep(.vue-flow__edge-path) {
  stroke-width: 2;
}

:deep(.vue-flow__edge:hover .vue-flow__edge-path) {
  stroke-width: 3;
}

/* 选中的边 */
:deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke-width: 3;
}

/* 箭头样式 */
:deep(.vue-flow__edge .vue-flow__edge-textwrapper) {
  pointer-events: all;
}

:deep(.vue-flow__arrowhead) {
  fill: #58a6ff;
}

:deep(.vue-flow__arrowhead path) {
  fill: inherit;
}

</style>
