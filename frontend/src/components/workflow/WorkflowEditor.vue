<template>
  <div class="workflow-editor">
    <div class="editor-toolbar">
      <button @click="save" class="btn-primary">💾 保存</button>
      <button @click="executeWorkflow" class="btn-success">▶️ 执行</button>
      <button @click="compile" class="btn-secondary">📝 生成代码</button>
      <button @click="showParseModal = true" class="btn-secondary">🔍 解析脚本</button>
      <button @click="loadExample" class="btn-secondary">📋 加载示例</button>
      <button @click="showDataTableModal = true" class="btn-secondary">📊 数据表</button>
      <button @click="undo" :disabled="!canUndo" class="btn-icon">↶</button>
      <button @click="redo" :disabled="!canRedo" class="btn-icon">↷</button>
      <button @click="clear" class="btn-danger">🗑️ 清空</button>
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
          <div class="palette-block" @click="addBlock('scroll')">
            <span class="block-icon">📜</span>
            <span>滚动页面</span>
          </div>
          <div class="palette-block" @click="addBlock('wait')">
            <span class="block-icon">⏱️</span>
            <span>等待</span>
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
          <div class="palette-block" @click="addBlock('extract-images')">
            <span class="block-icon">🖼️</span>
            <span>提取图片</span>
          </div>
        </div>

        <div class="palette-category">
          <h4>逻辑控制</h4>
          <div class="palette-block" @click="addBlock('log')">
            <span class="block-icon">📝</span>
            <span>日志输出</span>
          </div>
        </div>
      </div>

      <div class="canvas-area">
        <VueFlow
          v-model="elements"
          :default-zoom="1"
          :min-zoom="0.2"
          :max-zoom="4"
          @node-click="onNodeClick"
          @connect="onConnect"
          @nodes-change="onNodesChange"
        >
          <Background pattern-color="#30363d" :gap="16" />
          <Controls />
          <MiniMap />
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

    <!-- 代码预览弹窗 -->
    <div v-if="showCodeModal" class="modal-overlay" @click="showCodeModal = false">
      <div class="modal-content" @click.stop>
        <h3>生成的代码</h3>
        <textarea v-model="generatedCode" readonly class="code-preview"></textarea>
        <div class="modal-actions">
          <button @click="copyCode" class="btn-primary">复制代码</button>
          <button @click="showCodeModal = false" class="btn-secondary">关闭</button>
        </div>
      </div>
    </div>

    <!-- 解析脚本弹窗 -->
    <div v-if="showParseModal" class="modal-overlay" @click="showParseModal = false">
      <div class="modal-content" @click.stop>
        <h3>解析Playwright脚本</h3>
        <textarea v-model="scriptToParse" placeholder="粘贴Playwright脚本代码..." class="code-preview"></textarea>
        <div class="modal-actions">
          <button @click="parseScript" class="btn-primary">解析</button>
          <button @click="showParseModal = false" class="btn-secondary">取消</button>
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

    <!-- 确认对话框 -->
    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent, onMounted, onBeforeUnmount } from 'vue';
import { VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { useWorkflowStore } from '../../stores/workflow';
import { useDataTableStore } from '../../stores/dataTable';
import api from '../../services/api';
import socketService from '../../services/socket';
import type { BlockType } from '../../types/block';
import { simpleLogWorkflow } from '../../examples/workflowExample';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

// 动态导入属性组件
const NavigateProperty = defineAsyncComponent(() => import('./properties/NavigateProperty.vue'));
const ScrollProperty = defineAsyncComponent(() => import('./properties/ScrollProperty.vue'));
const WaitProperty = defineAsyncComponent(() => import('./properties/WaitProperty.vue'));
const ClickProperty = defineAsyncComponent(() => import('./properties/ClickProperty.vue'));
const TypeProperty = defineAsyncComponent(() => import('./properties/TypeProperty.vue'));
const ExtractProperty = defineAsyncComponent(() => import('./properties/ExtractProperty.vue'));
const ExtractImagesProperty = defineAsyncComponent(() => import('./properties/ExtractImagesProperty.vue'));
const LogProperty = defineAsyncComponent(() => import('./properties/LogProperty.vue'));
const DataTableManager = defineAsyncComponent(() => import('../DataTableManager.vue'));
const ConfirmDialog = defineAsyncComponent(() => import('../ConfirmDialog.vue'));

const workflowStore = useWorkflowStore();
const dataTableStore = useDataTableStore();
const showCodeModal = ref(false);
const showParseModal = ref(false);
const showExecutionModal = ref(false);
const showDataTableModal = ref(false);
const generatedCode = ref('');
const scriptToParse = ref('');
const isExecuting = ref(false);
const executionLogs = ref<string[]>([]);
const executionResult = ref<any>(null);
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);

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
      console.log('已加载上次的工作流:', savedWorkflow.name);
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
});

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
    
    console.log('自动保存成功');
  } catch (error) {
    console.error('自动保存失败:', error);
  }
}

// 转换为Vue Flow格式
const elements = computed({
  get() {
    const nodes = workflowStore.blocks.map(block => ({
      id: block.id,
      type: 'default',
      position: block.position,
      label: block.label,
      data: { ...block.data, blockType: block.type },
      style: {
        background: getBlockColor(block.category),
        color: '#fff',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '10px',
        minWidth: '150px'
      }
    }));

    const edges = workflowStore.connections.map(conn => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      sourceHandle: conn.sourceHandle,
      targetHandle: conn.targetHandle,
      type: conn.type === 'data' ? 'smoothstep' : 'default',
      style: {
        stroke: conn.type === 'data' ? '#f85149' : '#58a6ff',
        strokeWidth: 2
      }
    }));

    return [...nodes, ...edges];
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

function addBlock(type: BlockType) {
  const position = {
    x: Math.random() * 400 + 100,
    y: Math.random() * 300 + 100
  };
  workflowStore.addBlock(type, position);
}

function onNodeClick(event: any) {
  workflowStore.selectBlock(event.node.id);
}

function onConnect(connection: any) {
  workflowStore.addConnection({
    source: connection.source,
    sourceHandle: connection.sourceHandle || 'out',
    target: connection.target,
    targetHandle: connection.targetHandle || 'in'
  });
}

function onNodesChange(changes: any[]) {
  changes.forEach(change => {
    if (change.type === 'position' && change.position) {
      workflowStore.updateBlockPosition(change.id, change.position);
    } else if (change.type === 'remove') {
      workflowStore.removeBlock(change.id);
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
    scroll: ScrollProperty,
    wait: WaitProperty,
    click: ClickProperty,
    type: TypeProperty,
    extract: ExtractProperty,
    'extract-images': ExtractImagesProperty,
    log: LogProperty
  };
  return components[type] || 'div';
}

function save() {
  try {
    if (!workflowStore.currentWorkflow) {
      alert('没有可保存的工作流');
      return;
    }

    // 更新工作流数据
    const workflow = {
      ...workflowStore.currentWorkflow,
      blocks: workflowStore.blocks,
      connections: workflowStore.connections,
      updatedAt: Date.now()
    };

    // 保存到localStorage
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
    
    alert('工作流保存成功！');
  } catch (error: any) {
    console.error('保存失败:', error);
    alert('保存失败: ' + error.message);
  }
}

async function compile() {
  try {
    console.log('开始编译工作流');
    console.log('Blocks 数量:', workflowStore.blocks.length);
    console.log('Blocks:', JSON.stringify(workflowStore.blocks, null, 2));
    console.log('Connections 数量:', workflowStore.connections.length);
    console.log('Connections:', JSON.stringify(workflowStore.connections, null, 2));
    
    if (workflowStore.blocks.length === 0) {
      alert('工作流为空，请先添加一些功能块');
      return;
    }
    
    const response: any = await api.post('/workflow/compile', {
      workflow: {
        blocks: workflowStore.blocks,
        connections: workflowStore.connections
      }
    });
    
    console.log('编译响应:', response);
    
    // 注意：api 拦截器已经返回了 response.data，所以这里直接访问 response.code
    if (!response || !response.code) {
      throw new Error('后端返回的数据格式不正确');
    }
    
    generatedCode.value = response.code;
    showCodeModal.value = true;
  } catch (error: any) {
    console.error('编译失败:', error);
    const errorMessage = error.response?.data?.error || error.message || '未知错误';
    alert('生成代码失败: ' + errorMessage);
  }
}

function copyCode() {
  navigator.clipboard.writeText(generatedCode.value);
  alert('代码已复制到剪贴板');
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
    message: '确定要清空工作流吗？',
    confirmText: '清空',
    cancelText: '取消',
    type: 'danger'
  }).then((confirmed) => {
    if (confirmed) {
      workflowStore.clearWorkflow();
      // 清除当前工作流ID记录
      localStorage.removeItem(CURRENT_WORKFLOW_ID_KEY);
      // 重新初始化
      workflowStore.initWorkflow();
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
        
        alert('示例工作流已加载');
      }
    });
  } else {
    workflowStore.clearWorkflow();
    workflowStore.loadWorkflow(simpleLogWorkflow as any);
    
    // 更新当前工作流ID
    localStorage.setItem(CURRENT_WORKFLOW_ID_KEY, simpleLogWorkflow.id);
    
    alert('示例工作流已加载');
  }
}

async function executeWorkflow() {
  try {
    if (workflowStore.blocks.length === 0) {
      alert('工作流为空，请先添加一些功能块');
      return;
    }

    if (isExecuting.value) {
      alert('工作流正在执行中...');
      return;
    }

    // 编译工作流为代码
    const response: any = await api.post('/workflow/compile', {
      workflow: {
        blocks: workflowStore.blocks,
        connections: workflowStore.connections
      }
    });

    if (!response || !response.code) {
      throw new Error('编译失败');
    }

    const code = response.code;
    
    // 清空日志
    executionLogs.value = [];
    isExecuting.value = true;
    showExecutionModal.value = true;

    // 连接Socket.io
    socketService.connect();

    // 监听日志
    socketService.onLog((log) => {
      executionLogs.value.push(`[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`);
    });

    // 监听完成
    socketService.onComplete((result) => {
      executionLogs.value.push(`\n✅ 执行完成！`);
      
      // 注意：PlaywrightExecutor 返回的格式是 { success, data, duration }
      // 实际的脚本结果在 result.data 中
      const scriptResult = result.data;
      executionResult.value = scriptResult;
      
      // 显示提取的数据统计
      if (scriptResult && scriptResult.results) {
        saveToDataTables(scriptResult.results);
        const { images, data, links } = scriptResult.results;
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

    // 执行脚本
    const scriptId = `workflow-${Date.now()}`;
    socketService.executeScript(scriptId, code);
    
    executionLogs.value.push('🚀 开始执行工作流...\n');
  } catch (error: any) {
    console.error('执行失败:', error);
    alert('执行失败: ' + (error.response?.data?.error || error.message));
    isExecuting.value = false;
  }
}

async function parseScript() {
  try {
    if (!scriptToParse.value.trim()) {
      alert('请输入要解析的脚本');
      return;
    }

    const response: any = await api.post('/workflow/parse', {
      code: scriptToParse.value
    });
    
    // 注意：api 拦截器已经返回了 response.data，所以这里直接访问 response.workflow
    const workflow = response.workflow;
    
    if (!workflow || !workflow.blocks || workflow.blocks.length === 0) {
      alert('未能解析出任何block，请检查脚本格式');
      return;
    }

    // 清空当前工作流
    workflowStore.clearWorkflow();
    
    // 加载解析的blocks和connections
    workflow.blocks.forEach((block: any) => {
      workflowStore.blocks.push(block);
    });
    
    workflow.connections.forEach((conn: any) => {
      workflowStore.connections.push(conn);
    });
    
    workflowStore.saveToHistory();
    
    showParseModal.value = false;
    scriptToParse.value = '';
    
    alert(`成功解析 ${workflow.blocks.length} 个功能块`);
  } catch (error: any) {
    alert('解析失败: ' + (error.response?.data?.error || error.message));
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
  gap: 0.5rem;
  padding: 1rem;
  background: #161b22;
  border-bottom: 1px solid #30363d;
}

.btn-primary, .btn-secondary, .btn-danger, .btn-icon {
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
</style>
