<template>
  <div class="workflow-editor">
    <div class="editor-toolbar">
      <button @click="save" class="btn-primary">保存</button>
      <button @click="compile" class="btn-secondary">生成代码</button>
      <button @click="showParseModal = true" class="btn-secondary">解析脚本</button>
      <button @click="undo" :disabled="!canUndo" class="btn-icon">↶</button>
      <button @click="redo" :disabled="!canRedo" class="btn-icon">↷</button>
      <button @click="clear" class="btn-danger">清空</button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent } from 'vue';
import { VueFlow, Background, Controls, MiniMap } from '@vue-flow/core';
import { useWorkflowStore } from '../../stores/workflow';
import { BlockCompiler } from '../../services/BlockCompiler';
import { ScriptParser } from '../../services/ScriptParser';
import type { BlockType } from '../../types/block';
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
const ExtractImagesProperty = defineAsyncComponent(() => import('./properties/ExtractImagesProperty.vue'));
const LogProperty = defineAsyncComponent(() => import('./properties/LogProperty.vue'));

const workflowStore = useWorkflowStore();
const compiler = new BlockCompiler();
const parser = new ScriptParser();
const showCodeModal = ref(false);
const showParseModal = ref(false);
const generatedCode = ref('');
const scriptToParse = ref('');

// 初始化工作流
workflowStore.initWorkflow();

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
    'extract-images': ExtractImagesProperty,
    log: LogProperty
  };
  return components[type] || 'div';
}

function save() {
  alert('保存功能待实现');
}

async function compile() {
  try {
    const code = compiler.compile(workflowStore.blocks, workflowStore.connections);
    generatedCode.value = code;
    showCodeModal.value = true;
  } catch (error: any) {
    alert('生成代码失败: ' + error.message);
  }
}

function generateCode(): string {
  // 使用新的编译器
  return compiler.compile(workflowStore.blocks, workflowStore.connections);
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
  if (confirm('确定要清空工作流吗？')) {
    workflowStore.clearWorkflow();
  }
}

function parseScript() {
  try {
    if (!scriptToParse.value.trim()) {
      alert('请输入要解析的脚本');
      return;
    }

    const { blocks, connections } = parser.parse(scriptToParse.value);
    
    if (blocks.length === 0) {
      alert('未能解析出任何block，请检查脚本格式');
      return;
    }

    // 清空当前工作流
    workflowStore.clearWorkflow();
    
    // 加载解析的blocks和connections
    blocks.forEach(block => {
      workflowStore.blocks.push(block);
    });
    
    connections.forEach(conn => {
      workflowStore.connections.push(conn);
    });
    
    workflowStore.saveToHistory();
    
    showParseModal.value = false;
    scriptToParse.value = '';
    
    alert(`成功解析 ${blocks.length} 个功能块`);
  } catch (error: any) {
    alert('解析失败: ' + error.message);
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

.modal-content h3 {
  margin: 0 0 1rem 0;
  color: #58a6ff;
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
</style>
