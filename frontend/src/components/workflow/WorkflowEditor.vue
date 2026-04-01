<template>
  <div class="workflow-editor">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <button @click="showWorkflowManager = true" class="btn-workflow">
          📁 {{ currentWorkflowName }}
        </button>
        <button @click="save" class="btn-primary">💾 保存</button>
        <button @click="executeWorkflow" class="btn-success">▶️ 执行</button>
        <button @click="showRecordingSetupModal = true" class="btn-secondary" :disabled="isRecording">🎥 开始录制</button>
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
          <div class="palette-block" draggable="true" @dragstart="onPaletteDragStart($event, 'navigate')">
            <span class="block-icon">🌐</span>
            <span>访问页面</span>
          </div>
          <div class="palette-block" draggable="true" @dragstart="onPaletteDragStart($event, 'back')">
            <span class="block-icon">⬅️</span>
            <span>返回</span>
          </div>
          <div class="palette-block" draggable="true" @dragstart="onPaletteDragStart($event, 'forward')">
            <span class="block-icon">➡️</span>
            <span>前进</span>
          </div>
          <div class="palette-block" draggable="true" @dragstart="onPaletteDragStart($event, 'scroll')">
            <span class="block-icon">📜</span>
            <span>滚动页面</span>
          </div>
          <div class="palette-block" draggable="true" @dragstart="onPaletteDragStart($event, 'wait')">
            <span class="block-icon">⏱️</span>
            <span>等待</span>
          </div>
          <div class="palette-block" draggable="true" @dragstart="onPaletteDragStart($event, 'log')">
            <span class="block-icon">📝</span>
            <span>日志输出</span>
          </div>
        </div>

        <div class="palette-category">
          <h4>页面交互</h4>
          <div class="palette-block" draggable="true" @dragstart="onPaletteDragStart($event, 'click')">
            <span class="block-icon">👆</span>
            <span>点击元素</span>
          </div>
          <div class="palette-block" draggable="true" @dragstart="onPaletteDragStart($event, 'type')">
            <span class="block-icon">⌨️</span>
            <span>输入文本</span>
          </div>
        </div>

        <div class="palette-category">
          <h4>数据提取</h4>
          <div class="palette-block" draggable="true" @dragstart="onPaletteDragStart($event, 'extract')">
            <span class="block-icon">📊</span>
            <span>提取数据</span>
          </div>
        </div>

        <div class="palette-category">
          <h4>逻辑控制</h4>
          <div class="palette-block" draggable="true" @dragstart="onPaletteDragStart($event, 'condition')">
            <span class="block-icon">🔀</span>
            <span>条件</span>
          </div>
          <div class="palette-block" draggable="true" @dragstart="onPaletteDragStart($event, 'loop')">
            <span class="block-icon">�</span>
            <span>循环</span>
          </div>
        </div>
      </div>

      <div
        ref="canvasAreaRef"
        class="canvas-area"
        @dragover.prevent="onCanvasDragOver"
        @drop="onCanvasDrop"
      >
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
    <div v-if="showExecutionModal" ref="executionPanelRef" class="execution-panel-floating" :style="executionPanelStyle">
      <div class="execution-panel-header" @mousedown="startExecutionPanelDrag">
        <h3>执行日志</h3>
        <div class="execution-panel-actions">
          <span v-if="isExecuting" class="execution-status">执行中</span>
          <button v-if="isExecuting" @click="stopExecution" class="btn-danger">停止执行</button>
          <button @click="showExecutionModal = false" class="btn-secondary">关闭</button>
        </div>
      </div>
      <div ref="executionLogsRef" class="execution-logs">
        <div v-for="(log, index) in executionLogs" :key="index" class="log-line">{{ log }}</div>
      </div>
    </div>

    <div v-if="showRecordingPanel" class="recording-panel-floating">
      <div class="recording-panel-header">
        <div>
          <h3>录制事件</h3>
          <p>{{ recordingStatusText }}</p>
        </div>
        <div class="recording-panel-actions">
          <span class="recording-mode-tag" :class="{ 'is-mark': recordingMode === 'mark' }">
            {{ recordingMode === 'mark' ? '标注模式' : '动作模式' }}
          </span>
          <button
            v-if="isRecording"
            @click="toggleRecordingMode"
            class="btn-secondary"
            :class="{ 'is-active': recordingMode === 'mark' }"
          >
            {{ recordingMode === 'mark' ? '切到动作模式' : '切到标注模式' }}
          </button>
          <button v-if="isRecording" @click="stopRecording" class="btn-danger">停止录制</button>
          <button v-else @click="showRecordingPanel = false" class="btn-secondary">关闭</button>
        </div>
      </div>
      <div class="recording-panel-toolbar">
        <span>{{ recordingEvents.length }} 条关键事件</span>
        <div class="recording-panel-toolbar-actions">
          <button
            v-if="!isRecording && recordingEvents.length"
            @click="copyRecordingJson"
            class="btn-secondary"
          >
            复制 JSON
          </button>
          <button v-if="recordingEvents.length" @click="clearRecordingEvents" class="btn-icon">清空</button>
        </div>
      </div>
      <div class="recording-events">
        <div v-if="recordingEvents.length === 0" class="empty-recording-state">
          录制开始后，这里只显示关键操作和字段标注。
        </div>
        <div v-for="event in recordingEvents" :key="event.id" class="recording-event-item">
          <div class="recording-event-line">
            <span class="recording-event-summary">{{ formatRecordingEventSummary(event) }}</span>
            <button class="recording-event-delete" @click="deleteRecordingEvent(event.id)">删除</button>
          </div>
          <div
            class="recording-event-meta"
            v-if="event.selector || event.fieldName || event.value || event.openerSelector || event.openerElementMeta?.href"
          >
            <div v-if="event.title"><strong>页面:</strong> {{ event.title }}</div>
            <div v-if="event.selector"><strong>selector:</strong> {{ event.selector }}</div>
            <div v-if="event.fieldName"><strong>字段:</strong> {{ event.fieldName }} <span v-if="event.fieldType">({{ event.fieldType }})</span></div>
            <div v-if="event.value"><strong>值:</strong> {{ event.value }}</div>
            <div v-if="event.openerSelector"><strong>来源元素:</strong> {{ event.openerSelector }}</div>
            <div v-if="event.openerAction"><strong>来源动作:</strong> {{ event.openerAction === 'contextmenu' ? '右键元素' : '中键打开' }}</div>
            <div v-if="event.openerElementMeta?.href"><strong>来源链接:</strong> {{ event.openerElementMeta.href }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showRecordingSetupModal" class="modal-overlay" @click="closeRecordingSetup">
      <div class="modal-content recording-setup-modal" @click.stop>
        <h3>开始录制</h3>
        <div class="form-group">
          <label>起始网址（可选）</label>
          <input
            v-model="recordingStartUrl"
            placeholder="例如：https://news.aibase.com/zh/news"
          />
          <small>留空则打开一个空白浏览器页，你也可以手动输入网址开始操作。</small>
        </div>
        <div class="modal-actions">
          <button @click="startRecording" class="btn-primary">开始录制</button>
          <button @click="closeRecordingSetup" class="btn-secondary">取消</button>
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
import { ref, reactive, computed, watch, defineAsyncComponent, onMounted, onBeforeUnmount, markRaw, nextTick } from 'vue';
import { VueFlow, MarkerType, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { MiniMap } from '@vue-flow/minimap';
import { useWorkflowStore } from '../../stores/workflow';
import { useDataTableStore } from '../../stores/dataTable';
import socketService from '../../services/socket';
import type { BlockType } from '../../types/block';
import { simpleLogWorkflow } from '../../examples/workflowExample';
import { findLoopBody, hasLoopIntersection } from '../../../../shared/workflowLoopGuards';
import CustomNode from './CustomNode.vue';
import ConditionNode from './ConditionNode.vue';
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
const ConditionProperty = defineAsyncComponent(() => import('./properties/ConditionProperty.vue'));
const LogProperty = defineAsyncComponent(() => import('./properties/LogProperty.vue'));
const LoopProperty = defineAsyncComponent(() => import('./properties/LoopProperty.vue'));
const DataTableManager = defineAsyncComponent(() => import('../DataTableManager.vue'));
const ConfirmDialog = defineAsyncComponent(() => import('../ConfirmDialog.vue'));
const Toast = defineAsyncComponent(() => import('../Toast.vue'));
const WorkflowManager = defineAsyncComponent(() => import('./WorkflowManager.vue'));

interface RecordingEventItem {
  id: string;
  kind: 'action' | 'mark';
  action: string;
  timestamp: number;
  pageId: string;
  url: string;
  title?: string;
  selector?: string;
  value?: string;
  fieldName?: string;
  fieldType?: 'text' | 'image' | 'video' | 'link' | 'custom';
  elementMeta?: {
    tagName?: string;
    text?: string;
    id?: string;
    className?: string;
    href?: string;
    src?: string;
    value?: string;
  };
  openerPageId?: string;
  openerUrl?: string;
  openerSelector?: string;
  openerAction?: 'contextmenu' | 'middle-click';
  openerElementMeta?: {
    tagName?: string;
    text?: string;
    id?: string;
    className?: string;
    href?: string;
    src?: string;
    value?: string;
  };
}

// 定义节点类型
const nodeTypes = {
  custom: markRaw(CustomNode) as any,
  condition: markRaw(ConditionNode) as any,
  loop: markRaw(LoopNode) as any
};

const { project } = useVueFlow();

const workflowStore = useWorkflowStore();
const dataTableStore = useDataTableStore();
const canvasAreaRef = ref<HTMLElement | null>(null);
const showExecutionModal = ref(false);
const showDataTableModal = ref(false);
const showVariablesModal = ref(false);
const showVariableForm = ref(false);
const showWorkflowManager = ref(false);
const showImportModal = ref(false);
const showRecordingSetupModal = ref(false);
const showRecordingPanel = ref(false);
const importJsonText = ref('');
const importJsonError = ref('');
const editingVariableIndex = ref<number | null>(null);
const newVariable = ref({ name: '', value: '', description: '' });
const variableNameError = ref('');
const isExecuting = ref(false);
const isRecording = ref(false);
const recordingMode = ref<'action' | 'mark'>('action');
const recordingStatusText = ref('尚未开始录制');
const recordingStartUrl = ref('');
const recordingEvents = ref<RecordingEventItem[]>([]);
const executionLogs = ref<string[]>([]);
const executionResult = ref<any>(null);
const executionPanelRef = ref<HTMLElement | null>(null);
const executionLogsRef = ref<HTMLElement | null>(null);
const executionPanelPosition = reactive({ x: 24, y: 96, width: 520, height: 420 });
const executionPanelDragging = ref(false);
const executionPanelDragOffset = reactive({ x: 0, y: 0 });
let executionPanelResizeObserver: ResizeObserver | null = null;
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
const executionPanelStyle = computed(() => ({
  left: `${executionPanelPosition.x}px`,
  top: `${executionPanelPosition.y}px`,
  width: `${executionPanelPosition.width}px`,
  height: `${executionPanelPosition.height}px`
}));

function startExecutionPanelDrag(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('button')) {
    return;
  }

  executionPanelDragging.value = true;
  executionPanelDragOffset.x = event.clientX - executionPanelPosition.x;
  executionPanelDragOffset.y = event.clientY - executionPanelPosition.y;
  window.addEventListener('mousemove', onExecutionPanelDrag);
  window.addEventListener('mouseup', stopExecutionPanelDrag);
}

function onExecutionPanelDrag(event: MouseEvent) {
  if (!executionPanelDragging.value) {
    return;
  }

  const maxX = Math.max(window.innerWidth - executionPanelPosition.width - 16, 0);
  const maxY = Math.max(window.innerHeight - executionPanelPosition.height - 16, 0);
  executionPanelPosition.x = Math.min(Math.max(event.clientX - executionPanelDragOffset.x, 0), maxX);
  executionPanelPosition.y = Math.min(Math.max(event.clientY - executionPanelDragOffset.y, 0), maxY);
}

function stopExecutionPanelDrag() {
  executionPanelDragging.value = false;
  window.removeEventListener('mousemove', onExecutionPanelDrag);
  window.removeEventListener('mouseup', stopExecutionPanelDrag);
}

async function scrollExecutionLogsToBottom() {
  await nextTick();
  if (executionLogsRef.value) {
    executionLogsRef.value.scrollTop = executionLogsRef.value.scrollHeight;
  }
}

function syncExecutionPanelSize() {
  if (!executionPanelRef.value) {
    return;
  }

  const rect = executionPanelRef.value.getBoundingClientRect();
  executionPanelPosition.width = Math.round(rect.width);
  executionPanelPosition.height = Math.round(rect.height);
}

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

function closeRecordingSetup() {
  showRecordingSetupModal.value = false;
  recordingStartUrl.value = '';
}

function clearRecordingEvents() {
  if (isRecording.value) {
    socketService.clearRecordingEvents();
    return;
  }

  recordingEvents.value = [];
}

function deleteRecordingEvent(eventId: string) {
  if (isRecording.value) {
    socketService.deleteRecordingEvent(eventId);
    return;
  }

  recordingEvents.value = recordingEvents.value.filter(event => event.id !== eventId);
}

function normalizeRecordingText(value?: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseRecordingScrollValue(value?: string) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function getRecordingEventLabel(action: string) {
  const labels: Record<string, string> = {
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

  return labels[action] || '未命名事件';
}

function buildRecordingEventSummaryText(event: RecordingEventItem) {
  if (event.kind === 'mark') {
    const fieldType = event.fieldType ? ` (${event.fieldType})` : '';
    return `标注字段 ${event.fieldName || '未命名字段'}${fieldType}`;
  }

  const targetText = normalizeRecordingText(event.elementMeta?.text);
  const selector = event.selector || '';

  if (event.action === 'navigate') {
    if (event.openerSelector) {
      return `新页面导航，由${event.openerAction === 'contextmenu' ? '右键' : '中键'}元素触发: ${event.url}`;
    }
    return `访问页面: ${event.url}`;
  }

  if (event.action === 'type') {
    return `在 ${selector || '目标元素'} 输入文本`;
  }

  if (event.action === 'select') {
    return `在 ${selector || '目标元素'} 选择选项`;
  }

  if (event.action === 'scroll') {
    const scroll = parseRecordingScrollValue(event.value);
    if (scroll?.target === 'element' && selector) {
      return `滚动元素: ${selector}`;
    }
    return '滚动页面';
  }

  if (event.action === 'contextmenu') {
    return `右键元素${selector ? `: ${selector}` : targetText ? `: ${targetText}` : ''}`;
  }

  if (event.action === 'middle-click') {
    return `中键打开${selector ? `: ${selector}` : targetText ? `: ${targetText}` : ''}`;
  }

  return `${getRecordingEventLabel(event.action)}${selector ? `: ${selector}` : targetText ? `: ${targetText}` : ''}`;
}

function buildRecordingExport(events: RecordingEventItem[], mode: 'action' | 'mark', status: string) {
  const orderedEvents = [...events]
    .reverse()
    .map((event, index) => {
      const scroll = event.action === 'scroll' ? parseRecordingScrollValue(event.value) : null;

      return {
        step: index + 1,
        stepId: event.id,
        summary: buildRecordingEventSummaryText(event),
        kind: event.kind,
        action: event.action,
        timestamp: event.timestamp,
        pageId: event.pageId,
        page: {
          url: event.url,
          title: event.title || ''
        },
        target: {
          selector: event.selector || '',
          tagName: event.elementMeta?.tagName || '',
          text: normalizeRecordingText(event.elementMeta?.text),
          id: event.elementMeta?.id || '',
          className: event.elementMeta?.className || '',
          href: event.elementMeta?.href || '',
          src: event.elementMeta?.src || '',
          value: event.elementMeta?.value || ''
        },
        input: event.action === 'type' || event.action === 'select'
          ? {
              value: event.value || ''
            }
          : undefined,
        scroll: scroll || undefined,
        field: event.kind === 'mark'
          ? {
              name: event.fieldName || '',
              type: event.fieldType || 'text'
            }
          : undefined,
        opener: event.openerSelector || event.openerPageId || event.openerElementMeta?.href
          ? {
              pageId: event.openerPageId || '',
              url: event.openerUrl || '',
              selector: event.openerSelector || '',
              action: event.openerAction || '',
              href: event.openerElementMeta?.href || '',
              text: normalizeRecordingText(event.openerElementMeta?.text),
              tagName: event.openerElementMeta?.tagName || ''
            }
          : undefined,
        raw: {
          value: event.value || ''
        }
      };
    });

  const pageOrder: string[] = [];
  const pages = new Map<string, {
    pageId: string;
    firstSeenStep: number;
    latestUrl: string;
    latestTitle: string;
    urls: Set<string>;
    titles: Set<string>;
    openedFrom?: {
      pageId: string;
      url: string;
      selector: string;
      action: string;
      href: string;
    };
  }>();
  const actionCounts: Record<string, number> = {};
  const markedFields: Array<{ name: string; type: string; pageId: string; selector: string }> = [];

  orderedEvents.forEach(event => {
    actionCounts[event.action] = (actionCounts[event.action] || 0) + 1;

    if (!pages.has(event.pageId)) {
      pages.set(event.pageId, {
        pageId: event.pageId,
        firstSeenStep: event.step,
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
          : undefined
      });
      pageOrder.push(event.pageId);
    } else {
      const page = pages.get(event.pageId)!;
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
    }

    if (event.field?.name) {
      markedFields.push({
        name: event.field.name,
        type: event.field.type,
        pageId: event.pageId,
        selector: event.target.selector
      });
    }
  });

  return {
    schemaVersion: 'recording.v2',
    exportedAt: new Date().toISOString(),
    recorder: {
      mode,
      status
    },
    summary: {
      totalSteps: orderedEvents.length,
      pageCount: pageOrder.length,
      actionCounts,
      markedFields
    },
    pages: pageOrder.map((pageId, index) => {
      const page = pages.get(pageId)!;
      return {
        pageId,
        pageIndex: index + 1,
        firstSeenStep: page.firstSeenStep,
        latestUrl: page.latestUrl,
        latestTitle: page.latestTitle,
        urls: Array.from(page.urls),
        titles: Array.from(page.titles),
        openedFrom: page.openedFrom || null
      };
    }),
    events: orderedEvents
  };
}

async function copyRecordingJson() {
  if (!recordingEvents.value.length) {
    toast.value?.show({ message: '当前没有可复制的录制事件', type: 'warning' });
    return;
  }

  const exportPayload = buildRecordingExport(
    recordingEvents.value,
    recordingMode.value,
    recordingStatusText.value
  );

  const jsonText = JSON.stringify(exportPayload, null, 2);

  try {
    await navigator.clipboard.writeText(jsonText);
    toast.value?.show({ message: '录制事件 JSON 已复制到剪贴板', type: 'success' });
  } catch (error) {
    console.error('复制录制 JSON 失败:', error);
    toast.value?.show({ message: '复制失败，请检查浏览器剪贴板权限', type: 'error' });
  }
}

function formatRecordingEventSummary(event: RecordingEventItem) {
  if (event.kind === 'mark') {
    return event.fieldName || '标注字段';
  }

  return getRecordingEventLabel(event.action);
}

function stopRecordingSocketListeners() {
  socketService.off('recording-status');
  socketService.off('recording-event');
  socketService.off('recording-events');
}

function setupRecordingListeners() {
  stopRecordingSocketListeners();

  socketService.onRecordingStatus((status) => {
    if (status.mode) {
      recordingMode.value = status.mode;
    }

    recordingStatusText.value = status.message;

    if (status.state === 'started') {
      isRecording.value = true;
      showRecordingPanel.value = true;
    }

    if (status.state === 'stopped') {
      isRecording.value = false;
      recordingMode.value = 'action';
      stopRecordingSocketListeners();
    }
  });

  socketService.onRecordingEvents((events: RecordingEventItem[]) => {
    recordingEvents.value = Array.isArray(events) ? events : [];
    showRecordingPanel.value = true;
  });
}

function startRecording() {
  try {
    if (isExecuting.value) {
      toast.value?.show({ message: '当前已有工作流在执行，请先停止执行后再开始录制', type: 'warning' });
      return;
    }

    if (isRecording.value) {
      showRecordingPanel.value = true;
      toast.value?.show({ message: '录制已在进行中', type: 'warning' });
      return;
    }

    recordingEvents.value = [];
    recordingStatusText.value = '正在启动录制浏览器...';
    showRecordingPanel.value = true;
    const startUrl = recordingStartUrl.value.trim();
    closeRecordingSetup();

    socketService.connect();
    setupRecordingListeners();
    socketService.onError((error) => {
      toast.value?.show({ message: error.message || '录制失败', type: 'error' });
    });
    socketService.startRecording(startUrl);
  } catch (error: any) {
    toast.value?.show({ message: error.message || '启动录制失败', type: 'error' });
  }
}

function stopRecording() {
  socketService.stopRecording();
  recordingStatusText.value = '正在停止录制...';
  recordingMode.value = 'action';
}

function toggleRecordingMode() {
  if (!isRecording.value) {
    return;
  }

  const nextMode = recordingMode.value === 'action' ? 'mark' : 'action';
  socketService.setRecordingMode(nextMode);
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
workflowStore.migrateConditionBlocks();

// 初始化数据表 store
onMounted(() => {
  dataTableStore.init();
  workflowStore.migrateConditionBlocks();
  updateHandleStyles();
});

watch(
  () => executionLogs.value.length,
  () => {
    scrollExecutionLogsToBottom();
  }
);

watch(showExecutionModal, async (visible) => {
  if (!visible) {
    executionPanelResizeObserver?.disconnect();
    executionPanelResizeObserver = null;
    return;
  }

  await nextTick();
  syncExecutionPanelSize();
  executionPanelResizeObserver?.disconnect();
  if (executionPanelRef.value) {
    executionPanelResizeObserver = new ResizeObserver(() => {
      syncExecutionPanelSize();
    });
    executionPanelResizeObserver.observe(executionPanelRef.value);
  }
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
        let sourceHandle = sourceNode.querySelector(`[data-handleid="${conn.sourceHandle}"]`);
        if (!sourceHandle) {
          sourceHandle = conn.sourceHandle === 'loop-start'
            ? sourceNode.querySelector('.vue-flow__handle-left')
            : conn.sourceHandle === 'condition-fallback-bottom'
              ? sourceNode.querySelector('.vue-flow__handle-bottom')
            : sourceNode.querySelector('.vue-flow__handle-right');
        }
        if (sourceHandle) {
          sourceHandle.classList.add('connected');
        }
      }
      
      // 目标节点的 handle
      const targetNode = document.querySelector(`[data-id="${conn.target}"]`);
      if (targetNode) {
        // 根据 targetHandle 查找对应的 handle
        let targetHandle = targetNode.querySelector(`[data-handleid="${conn.targetHandle}"]`);
        if (!targetHandle) {
          targetHandle = conn.targetHandle === 'loop-end'
            ? targetNode.querySelector('.vue-flow__handle-right')
            : targetNode.querySelector('.vue-flow__handle-left');
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
  stopExecutionPanelDrag();
  executionPanelResizeObserver?.disconnect();
  executionPanelResizeObserver = null;
  if (isRecording.value) {
    socketService.stopRecording();
  }
  stopRecordingSocketListeners();
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
        type: block.type === 'loop' ? 'loop' : block.type === 'condition' ? 'condition' : 'custom',
        position: block.position,
        label: block.label,
        data: { 
          label: block.label,
          ...block.data, 
          blockType: block.type,
          outputs: block.outputs,
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

const PALETTE_BLOCK_MIME = 'application/x-aibrowser-block-type';

function onPaletteDragStart(event: DragEvent, type: BlockType) {
  if (!event.dataTransfer) {
    return;
  }

  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(PALETTE_BLOCK_MIME, type);
  event.dataTransfer.setData('text/plain', type);
}

function onCanvasDragOver(event: DragEvent) {
  if (!event.dataTransfer) {
    return;
  }

  event.dataTransfer.dropEffect = 'copy';
}

function onCanvasDrop(event: DragEvent) {
  const type = event.dataTransfer?.getData(PALETTE_BLOCK_MIME) as BlockType | '';
  const canvasRect = canvasAreaRef.value?.getBoundingClientRect();

  if (!type || !canvasRect) {
    return;
  }

  const position = project({
    x: event.clientX - canvasRect.left,
    y: event.clientY - canvasRect.top
  });

  addBlock(type, position);
}

function addBlock(type: BlockType, dropPosition?: { x: number; y: number }) {
  // 计算新节点的位置 - 水平布局
  const existingBlocks = workflowStore.blocks;
  let x = 100;
  let y = 200;

  if (dropPosition) {
    workflowStore.addBlock(type, dropPosition);
    return;
  }
  
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
    const sourceOutputs = sourceBlock?.outputs?.map(output => output.id) || [];
    if (connection.sourceHandle && !sourceOutputs.includes(connection.sourceHandle) && !connection.sourceHandle.includes('right')) {
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
      const currentLoopBody = findLoopBody(workflowStore.connections, connection.target, loopEndConn.source);
      
      // 检查当前循环体是否包含其他循环的循环体块
      const hasIntersection = hasLoopIntersection(
        workflowStore.blocks,
        workflowStore.connections,
        currentLoopBody,
        loopId
      );
      
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
      const currentLoopBody = findLoopBody(workflowStore.connections, loopStartConn.target, connection.source);
      
      // 检查当前循环体是否包含其他循环的循环体块
      const hasIntersection = hasLoopIntersection(
        workflowStore.blocks,
        workflowStore.connections,
        currentLoopBody,
        loopId
      );
      
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
    condition: ConditionProperty,
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
    
    workflowStore.currentWorkflow = workflow as any;

    // 记住当前工作流ID
    localStorage.setItem(CURRENT_WORKFLOW_ID_KEY, workflow.id);

    toast.value?.show({ message: '工作流保存成功', type: 'success' });
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

    const importedWorkflow = {
      ...(workflowStore.currentWorkflow || {
        id: Date.now().toString(),
        name: '导入的工作流',
        description: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }),
      blocks: workflow.blocks,
      connections: workflow.connections,
      variables: workflow.variables || {},
      updatedAt: Date.now()
    };

    workflowStore.loadWorkflow(importedWorkflow as any);

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
  socketService.stopExecution();
  socketService.offAll();
  socketService.disconnect();
  isExecuting.value = false;
  executionLogs.value.push('\n⚠️ 执行已停止');
}

function getWorkflowResultRows(result: any) {
  if (!result) {
    return [];
  }

  if (Array.isArray(result.results?.data)) {
    return result.results.data;
  }

  if (Array.isArray(result.data)) {
    return result.data;
  }

  return [];
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
      showExecutionModal.value = true;
      toast.value?.show({ message: '已有脚本正在执行，请先停止或等待当前执行完成', type: 'warning' });
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
    socketService.offAll();

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
      
      const extractedRows = getWorkflowResultRows(result.data);
      if (extractedRows.length > 0) {
        executionLogs.value.push(`📊 提取了 ${extractedRows.length} 条数据`);
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
  cursor: move;
  transition: all 0.2s;
}

.palette-block:hover {
  background: #30363d;
  border-color: #58a6ff;
}

.palette-block:active {
  cursor: move;
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

.execution-panel-floating {
  position: fixed;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  min-width: 360px;
  min-height: 240px;
  max-width: min(720px, calc(100vw - 16px));
  max-height: calc(100vh - 16px);
  background: rgba(22, 27, 34, 0.96);
  border: 1px solid #30363d;
  border-radius: 10px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  resize: both;
}

.execution-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  cursor: move;
  user-select: none;
}

.execution-panel-header h3 {
  margin: 0;
  color: #58a6ff;
}

.execution-panel-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.execution-status {
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
  background: rgba(31, 111, 235, 0.18);
  border: 1px solid rgba(88, 166, 255, 0.4);
  color: #79c0ff;
  font-size: 0.8rem;
  white-space: nowrap;
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
  border-radius: 0;
  padding: 1rem;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9rem;
  overflow-y: auto;
  min-height: 0;
  max-height: none;
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

.recording-panel-floating {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 520px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: rgba(22, 27, 34, 0.98);
  border: 1px solid #30363d;
  border-radius: 16px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  z-index: 1200;
}

.recording-panel-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #30363d;
}

.recording-panel-header h3 {
  margin: 0;
  font-size: 1.75rem;
  color: #58a6ff;
}

.recording-panel-header p {
  margin: 0.5rem 0 0;
  color: #8b949e;
  font-size: 0.95rem;
  line-height: 1.5;
}

.recording-panel-actions {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.recording-mode-tag {
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
  border: 1px solid #58a6ff;
  color: #58a6ff;
  background: rgba(88, 166, 255, 0.12);
  white-space: nowrap;
}

.recording-mode-tag.is-mark {
  border-color: #a855f7;
  color: #e9d5ff;
  background: rgba(168, 85, 247, 0.16);
}

.recording-panel-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid #30363d;
  color: #8b949e;
}

.recording-panel-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.recording-events {
  overflow-y: auto;
  padding: 0 1.25rem 1rem;
}

.empty-recording-state {
  padding: 1rem 0;
  color: #8b949e;
}

.recording-event-item {
  padding: 1rem 0;
  border-bottom: 1px solid #30363d;
}

.recording-event-item:last-child {
  border-bottom: none;
}

.recording-event-line {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.recording-event-delete {
  flex-shrink: 0;
  padding: 0.35rem 0.6rem;
  border: 1px solid #30363d;
  border-radius: 8px;
  background: transparent;
  color: #8b949e;
  cursor: pointer;
}

.recording-event-delete:hover {
  border-color: #58a6ff;
  color: #c9d1d9;
}

.recording-event-summary {
  flex: 1;
  line-height: 1.5;
}

.recording-event-meta {
  margin-top: 0.5rem;
  color: #8b949e;
  line-height: 1.5;
  word-break: break-word;
}

.recording-setup-modal,
.recording-mark-modal {
  width: min(520px, 92vw);
}

.recording-mark-preview {
  margin-bottom: 1rem;
  padding: 0.9rem 1rem;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 10px;
  color: #8b949e;
  line-height: 1.6;
  word-break: break-word;
}

</style>
