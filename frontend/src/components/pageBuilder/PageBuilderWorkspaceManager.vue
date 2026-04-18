<template>
  <div v-if="show" class="workspace-manager-modal" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>工作空间管理</h2>
        <button class="close-btn" type="button" @click="$emit('close')" aria-label="关闭">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6L18 18M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="workspace-actions">
          <button class="btn-primary" type="button" @click="createWorkspace">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5V19M5 12H19" />
            </svg>
            <span>新建工作空间</span>
          </button>

          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索工作空间..."
            class="search-input"
          />
        </div>

        <div class="workspace-list">
          <div
            v-for="workspace in filteredWorkspaces"
            :key="workspace.id"
            class="workspace-item"
            :class="{ active: workspace.id === currentWorkspaceId }"
            @click="selectWorkspace(workspace.id)"
          >
            <div class="workspace-info">
              <div class="workspace-name">{{ workspace.name }}</div>
              <div class="workspace-meta">
                <span class="workspace-date">{{ formatDate(workspace.updatedAt) }}</span>
                <span v-if="workspace.id === currentWorkspaceId" class="workspace-description">当前工作空间</span>
                <span v-else class="workspace-description">{{ resolveTableName(workspace.selectedTableId) }}</span>
              </div>
            </div>

            <div class="workspace-actions-menu">
              <button class="action-btn" type="button" title="重命名" @click.stop="renameWorkspace(workspace)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 20L8.5 19L19 8.5L15.5 5L5 15.5L4 20Z" />
                  <path d="M13.5 7L17 10.5" />
                </svg>
              </button>
              <button class="action-btn danger" type="button" title="删除" @click.stop="deleteWorkspace(workspace.id, workspace.name)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 7H19" />
                  <path d="M9 7V5H15V7" />
                  <path d="M8 7L9 19H15L16 7" />
                  <path d="M10 11V16M14 11V16" />
                </svg>
              </button>
            </div>
          </div>

          <div v-if="filteredWorkspaces.length === 0" class="empty-state">
            <p>{{ searchQuery ? '没有匹配的工作空间' : '还没有工作空间，点击上方按钮创建一个' }}</p>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog ref="confirmDialog" />
    <InputDialog ref="inputDialog" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
import type { DataTable } from '../../stores/dataTable';
import type { PageBuilderWorkspaceMeta } from '../../types/pageBuilder';

const ConfirmDialog = defineAsyncComponent(() => import('../ConfirmDialog.vue'));
const InputDialog = defineAsyncComponent(() => import('../InputDialog.vue'));

const props = defineProps<{
  show: boolean;
  currentWorkspaceId: string | null;
  currentWorkspaceName: string;
  workspaces: PageBuilderWorkspaceMeta[];
  tables: DataTable[];
}>();

const emit = defineEmits<{
  close: [];
  create: [name: string];
  select: [workspaceId: string];
  delete: [workspaceId: string];
  rename: [payload: { workspaceId: string; name: string }];
}>();

const searchQuery = ref('');
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const inputDialog = ref<InstanceType<typeof InputDialog> | null>(null);

const filteredWorkspaces = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.workspaces;
  }

  const query = searchQuery.value.trim().toLowerCase();
  return props.workspaces.filter((workspace) => {
    const tableName = resolveTableName(workspace.selectedTableId).toLowerCase();
    return workspace.name.toLowerCase().includes(query) || tableName.includes(query);
  });
});

async function createWorkspace() {
  const name = await inputDialog.value?.show({
    title: '新建工作空间',
    defaultValue: '',
    placeholder: '请输入工作空间名称',
    confirmText: '创建',
    cancelText: '取消'
  });

  if (name) {
    emit('create', name);
  }
}

function selectWorkspace(workspaceId: string) {
  emit('select', workspaceId);
  emit('close');
}

async function renameWorkspace(workspace: PageBuilderWorkspaceMeta) {
  const name = await inputDialog.value?.show({
    title: '重命名工作空间',
    defaultValue: workspace.name,
    placeholder: '请输入新的工作空间名称',
    confirmText: '保存',
    cancelText: '取消'
  });

  if (name && name !== workspace.name) {
    emit('rename', {
      workspaceId: workspace.id,
      name
    });
  }
}

async function deleteWorkspace(workspaceId: string, workspaceName: string) {
  const confirmed = await confirmDialog.value?.show({
    title: '确认删除',
    message: `确定要删除工作空间 "${workspaceName}" 吗？此操作无法撤销。`,
    confirmText: '删除',
    cancelText: '取消',
    type: 'danger'
  });

  if (confirmed) {
    emit('delete', workspaceId);
  }
}

function resolveTableName(tableId: string | null) {
  if (!tableId) {
    return '未选择数据表';
  }

  return props.tables.find((table) => table.id === tableId)?.name || '数据表不存在';
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;

  return date.toLocaleDateString('zh-CN');
}
</script>

<style scoped>
.workspace-manager-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-bg-surface);
  border-radius: var(--radius-sm);
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
  appearance: none;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn svg,
.btn-primary svg,
.action-btn svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
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

.workspace-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.btn-primary {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: #2f4f9d;
  color: #fff;
}

.btn-primary svg {
  color: #76b900;
}

.btn-primary:hover {
  background: #3a62c0;
}

.search-input {
  appearance: none;
  flex: 1;
  padding: 10px 16px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: 14px;
  min-height: 44px;
}

.search-input:focus {
  outline: none;
  border-color: #76b900;
}

.workspace-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workspace-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--color-bg-panel);
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.workspace-item:hover {
  background: #333;
  border-color: #444;
}

.workspace-item.active {
  border-color: #3f68d8;
  background: #1c2d3f;
}

.workspace-info {
  flex: 1;
  min-width: 0;
}

.workspace-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.workspace-meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--color-text-muted);
}

.workspace-description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-actions-menu {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.workspace-item:hover .workspace-actions-menu,
.workspace-item.active .workspace-actions-menu {
  opacity: 1;
}

.action-btn {
  appearance: none;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: #8c9bbb;
  padding: 0;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: rgba(118, 185, 0, 0.12);
  color: #76b900;
}

.action-btn.danger:hover {
  background: rgba(229, 32, 32, 0.14);
  color: #ff8a80;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--color-text-muted);
}

@media (max-width: 780px) {
  .workspace-actions {
    flex-direction: column;
  }

  .workspace-item {
    align-items: flex-start;
  }

  .workspace-actions-menu {
    opacity: 1;
  }
}
</style>
