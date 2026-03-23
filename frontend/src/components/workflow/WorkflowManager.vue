<template>
  <div v-if="show" class="workflow-manager-modal" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>工作流管理</h2>
        <button @click="$emit('close')" class="close-btn">✕</button>
      </div>

      <div class="modal-body">
        <div class="workflow-actions">
          <button @click="showNewWorkflowForm = true" class="btn-primary">
            ➕ 新建工作流
          </button>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="搜索工作流..." 
            class="search-input"
          />
        </div>

        <!-- 新建工作流表单 -->
        <div v-if="showNewWorkflowForm" class="new-workflow-form">
          <h3>新建工作流</h3>
          <input 
            v-model="newWorkflowName" 
            type="text" 
            placeholder="工作流名称" 
            class="form-input"
            @keyup.enter="createWorkflow"
          />
          <textarea 
            v-model="newWorkflowDescription" 
            placeholder="描述（可选）" 
            class="form-textarea"
            rows="3"
          ></textarea>
          <div class="form-actions">
            <button @click="createWorkflow" class="btn-primary">创建</button>
            <button @click="cancelNewWorkflow" class="btn-secondary">取消</button>
          </div>
        </div>

        <!-- 工作流列表 -->
        <div class="workflow-list">
          <div 
            v-for="workflow in filteredWorkflows" 
            :key="workflow.id"
            class="workflow-item"
            :class="{ active: workflow.id === currentWorkflowId }"
            @click="selectWorkflow(workflow.id)"
          >
            <div class="workflow-info">
              <div class="workflow-name">{{ workflow.name }}</div>
              <div class="workflow-meta">
                <span class="workflow-date">{{ formatDate(workflow.updatedAt) }}</span>
                <span v-if="workflow.description" class="workflow-description">
                  {{ workflow.description }}
                </span>
              </div>
            </div>
            <div class="workflow-actions-menu">
              <button @click.stop="renameWorkflow(workflow)" class="action-btn" title="重命名">
                ✏️
              </button>
              <button @click.stop="duplicateWorkflow(workflow)" class="action-btn" title="复制">
                📋
              </button>
              <button @click.stop="deleteWorkflow(workflow.id)" class="action-btn danger" title="删除">
                🗑️
              </button>
            </div>
          </div>

          <div v-if="filteredWorkflows.length === 0" class="empty-state">
            <p>{{ searchQuery ? '未找到匹配的工作流' : '还没有工作流，点击上方按钮创建一个' }}</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 确认对话框 -->
    <ConfirmDialog ref="confirmDialog" />
    
    <!-- 输入对话框 -->
    <InputDialog ref="inputDialog" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent } from 'vue';

const ConfirmDialog = defineAsyncComponent(() => import('../ConfirmDialog.vue'));
const InputDialog = defineAsyncComponent(() => import('../InputDialog.vue'));

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  blocks: any[];
  connections: any[];
  variables?: any;
  createdAt: number;
  updatedAt: number;
}

interface Props {
  show: boolean;
  currentWorkflowId?: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'select', workflowId: string): void;
  (e: 'create', workflow: Workflow): void;
  (e: 'delete', workflowId: string): void;
  (e: 'rename', workflowId: string, newName: string): void;
  (e: 'duplicate', workflow: Workflow): void;
  (e: 'error', message: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const searchQuery = ref('');
const showNewWorkflowForm = ref(false);
const newWorkflowName = ref('');
const newWorkflowDescription = ref('');
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const inputDialog = ref<InstanceType<typeof InputDialog> | null>(null);

// 从 localStorage 加载工作流列表
const workflows = ref<Workflow[]>([]);
const WORKFLOWS_KEY = 'saved_workflows';

const loadWorkflows = () => {
  const stored = localStorage.getItem(WORKFLOWS_KEY);
  workflows.value = stored ? JSON.parse(stored) : [];
};

// 初始加载
loadWorkflows();

// 监听弹窗打开，重新加载工作流列表
watch(() => props.show, (newVal) => {
  if (newVal) {
    loadWorkflows();
  }
});

const filteredWorkflows = computed(() => {
  if (!searchQuery.value) return workflows.value;
  
  const query = searchQuery.value.toLowerCase();
  return workflows.value.filter(w => 
    w.name.toLowerCase().includes(query) || 
    w.description?.toLowerCase().includes(query)
  );
});

const createWorkflow = () => {
  if (!newWorkflowName.value.trim()) {
    // 使用 emit 通知父组件显示 toast
    emit('error', '请输入工作流名称');
    return;
  }

  const workflow: Workflow = {
    id: `workflow-${Date.now()}`,
    name: newWorkflowName.value.trim(),
    description: newWorkflowDescription.value.trim(),
    blocks: [],
    connections: [],
    variables: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  workflows.value.unshift(workflow);
  saveWorkflows();
  
  emit('create', workflow);
  cancelNewWorkflow();
};

const cancelNewWorkflow = () => {
  showNewWorkflowForm.value = false;
  newWorkflowName.value = '';
  newWorkflowDescription.value = '';
};

const selectWorkflow = (workflowId: string) => {
  emit('select', workflowId);
  emit('close');
};

const deleteWorkflow = async (workflowId: string) => {
  const workflow = workflows.value.find(w => w.id === workflowId);
  if (!workflow) return;
  
  const confirmed = await confirmDialog.value?.show({
    title: '确认删除',
    message: `确定要删除工作流 "${workflow.name}" 吗？此操作无法撤销。`,
    confirmText: '删除',
    cancelText: '取消'
  });
  
  if (confirmed) {
    workflows.value = workflows.value.filter(w => w.id !== workflowId);
    saveWorkflows();
    emit('delete', workflowId);
  }
};

const renameWorkflow = async (workflow: Workflow) => {
  const newName = await inputDialog.value?.show({
    title: '重命名工作流',
    defaultValue: workflow.name,
    placeholder: '请输入新名称',
    confirmText: '确定',
    cancelText: '取消'
  });
  
  if (newName && newName !== workflow.name) {
    workflow.name = newName;
    workflow.updatedAt = Date.now();
    saveWorkflows();
    emit('rename', workflow.id, newName);
  }
};

const duplicateWorkflow = (workflow: Workflow) => {
  const duplicated: Workflow = {
    ...workflow,
    id: `workflow-${Date.now()}`,
    name: `${workflow.name} (副本)`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  workflows.value.unshift(duplicated);
  saveWorkflows();
  emit('duplicate', duplicated);
};

const saveWorkflows = () => {
  localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows.value));
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  
  return date.toLocaleDateString('zh-CN');
};

// 暴露方法供父组件调用
defineExpose({
  loadWorkflows
});
</script>

<style scoped>
.workflow-manager-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1c1c1c;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #333;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #333;
  color: #fff;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.workflow-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.search-input {
  flex: 1;
  padding: 10px 16px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #58a6ff;
}

.new-workflow-form {
  background: #2a2a2a;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.new-workflow-form h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #fff;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  background: #1c1c1c;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  margin-bottom: 12px;
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #58a6ff;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.workflow-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workflow-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #2a2a2a;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.workflow-item:hover {
  background: #333;
  border-color: #444;
}

.workflow-item.active {
  border-color: #58a6ff;
  background: #1c2d3f;
}

.workflow-info {
  flex: 1;
  min-width: 0;
}

.workflow-name {
  font-size: 16px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 4px;
}

.workflow-meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: #999;
}

.workflow-description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-actions-menu {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.workflow-item:hover .workflow-actions-menu {
  opacity: 1;
}

.action-btn {
  background: none;
  border: none;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 16px;
  transition: background 0.2s;
}

.action-btn:hover {
  background: #444;
}

.action-btn.danger:hover {
  background: #dc3545;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #58a6ff;
  color: #fff;
}

.btn-primary:hover {
  background: #4a8fd8;
}

.btn-secondary {
  background: #444;
  color: #fff;
}

.btn-secondary:hover {
  background: #555;
}
</style>
