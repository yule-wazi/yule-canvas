<template>
  <div class="data-table-manager">
    <div class="manager-header">
      <h2>数据表管理</h2>
      <div class="header-actions">
        <button @click="emit('close')" class="btn-icon">✕</button>
      </div>
    </div>

    <div class="manager-body">
      <!-- 左侧：数据表列表 -->
      <div class="tables-sidebar">
        <button @click="showCreateModal = true" class="btn-primary btn-full">+ 新建数据表</button>
        
        <div class="tables-list">
          <div 
            v-for="table in dataTableStore.tables" 
            :key="table.id"
            class="table-card"
            :class="{ active: selectedTableId === table.id }"
            @click="selectTable(table.id)"
          >
            <div class="table-info">
              <h3>{{ table.name }}</h3>
              <p>{{ table.rows.length }} 行 · {{ table.columns.length }} 列</p>
              <small>{{ formatDate(table.updatedAt) }}</small>
            </div>
            <div class="table-actions">
              <button @click.stop="clearTableData(table.id)" class="btn-icon-small" title="清空数据">🗑️</button>
              <button @click.stop="deleteTable(table.id)" class="btn-icon-small" title="删除表">❌</button>
            </div>
          </div>

          <div v-if="dataTableStore.tables.length === 0" class="empty-state">
            <p>还没有数据表</p>
            <p>点击"新建数据表"开始</p>
          </div>
        </div>
      </div>

      <!-- 右侧：数据表详情 -->
      <div class="table-detail" v-if="selectedTable">
        <div class="detail-header">
          <h3>{{ selectedTable.name }}</h3>
          <div class="header-right">
            <!-- 搜索栏 -->
            <div class="search-bar-compact">
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="搜索数据..." 
                class="search-input-compact"
              />
              <select v-model="searchColumn" class="search-column-select-compact">
                <option value="">全部列</option>
                <option v-for="column in selectedTable.columns" :key="column.key" :value="column.key">
                  {{ column.key }}
                </option>
              </select>
              <button v-if="searchQuery" @click="clearSearch" class="btn-icon-small" title="清除搜索">✕</button>
            </div>
            <div class="detail-actions">
              <button @click="clearTableData(selectedTable.id)" class="btn-danger">清空数据</button>
              <button @click="exportJSON" class="btn-secondary">导出 JSON</button>
              <button @click="exportCSV" class="btn-secondary">导出 CSV</button>
            </div>
          </div>
        </div>

        <div v-if="searchQuery" class="search-info-compact">
          找到 {{ filteredRows.length }} 条结果
        </div>

        <!-- 列定义 -->
        <div class="columns-section">
          <div class="columns-header">
            <h4>列定义</h4>
            <button @click="showAddColumnModal = true" class="btn-primary btn-small">+ 添加列</button>
          </div>
          <div class="columns-list">
            <div 
              v-for="(column, index) in selectedTable.columns" 
              :key="column.key" 
              class="column-item"
              draggable="true"
              @dragstart="onColumnDragStart(index)"
              @dragover.prevent
              @drop="onColumnDrop(index)"
              @dragenter="onColumnDragEnter(index)"
              @dragleave="onColumnDragLeave"
              :class="{ 'drag-over': dragOverIndex === index }"
            >
              <span class="drag-handle">⋮⋮</span>
              <span class="column-key">{{ column.key }}</span>
              <span class="column-type">{{ column.type }}</span>
              <button @click="deleteColumn(column.key)" class="btn-icon-small">×</button>
            </div>
          </div>
        </div>

        <!-- 数据表格 -->
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th v-for="column in selectedTable.columns" :key="column.key">
                  {{ column.key }}
                </th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in filteredRows" :key="row._id">
                <td>{{ row._mergeDisplayKey !== undefined && row._mergeDisplayKey !== null ? row._mergeDisplayKey : (row._mergeKey !== undefined && row._mergeKey !== null ? row._mergeKey : index + 1) }}</td>
                <td v-for="column in selectedTable.columns" :key="column.key">
                  <span v-if="column.type === 'image' && row[column.key]">
                    <img :src="normalizeUrl(row[column.key])" alt="" class="table-image clickable-image" @click="openImageModal(row[column.key])" />
                  </span>
                  <span v-else-if="column.type === 'video' && row[column.key]">
                    <div 
                      class="video-thumbnail-wrapper" 
                      @click="openVideoModal(row[column.key], row)"
                      :style="getVideoThumbnailStyle(row)"
                    >
                      <div class="play-icon-overlay">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                          <circle cx="24" cy="24" r="24" fill="rgba(0, 0, 0, 0.6)"/>
                          <path d="M18 14L34 24L18 34V14Z" fill="white"/>
                        </svg>
                      </div>
                    </div>
                  </span>
                  <span v-else-if="column.type === 'url' && row[column.key]">
                    <a :href="normalizeUrl(row[column.key])" target="_blank" class="table-link">{{ row[column.key] }}</a>
                  </span>
                  <span v-else>{{ row[column.key] }}</span>
                </td>
                <td>
                  <button @click="deleteRow(row._id)" class="btn-icon-small">删除</button>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="filteredRows.length === 0" class="empty-data">
            {{ searchQuery ? '没有找到匹配的数据' : '暂无数据' }}
          </div>
        </div>
      </div>

      <div v-else class="table-detail empty-state">
        <p>请选择一个数据表</p>
      </div>
    </div>

    <!-- 创建数据表弹窗 -->
    <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
      <div class="modal-content" @click.stop>
        <h3>创建数据表</h3>
        <div class="form-group">
          <label>表名</label>
          <input v-model="newTableName" type="text" placeholder="例如: 商品列表" />
        </div>

        <div class="form-group">
          <label>列定义</label>
          <div v-for="(col, index) in newTableColumns" :key="index" class="column-input">
            <input v-model="col.key" type="text" placeholder="列名" />
            <select v-model="col.type">
              <option value="text">文本</option>
              <option value="number">数字</option>
              <option value="url">链接</option>
              <option value="image">图片</option>
              <option value="video">视频</option>
              <option value="date">日期</option>
            </select>
            <button @click="newTableColumns.splice(index, 1)" class="btn-icon-small">×</button>
          </div>
          <button @click="addNewColumn" class="btn-secondary">+ 添加列</button>
        </div>

        <div class="modal-actions">
          <button @click="showCreateModal = false" class="btn-secondary">取消</button>
          <button @click="createTable" class="btn-primary">创建</button>
        </div>
      </div>
    </div>

    <!-- 添加列弹窗 -->
    <div v-if="showAddColumnModal" class="modal-overlay" @click="showAddColumnModal = false">
      <div class="modal-content" @click.stop>
        <h3>添加列</h3>
        <div class="form-group">
          <label>列名</label>
          <input v-model="newColumnKey" type="text" placeholder="例如: price" />
        </div>
        <div class="form-group">
          <label>类型</label>
          <select v-model="newColumnType">
            <option value="text">文本</option>
            <option value="number">数字</option>
            <option value="url">链接</option>
            <option value="image">图片</option>
            <option value="video">视频</option>
            <option value="date">日期</option>
          </select>
        </div>
        <div class="modal-actions">
          <button @click="showAddColumnModal = false" class="btn-secondary">取消</button>
          <button @click="addColumn" class="btn-primary">添加</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 确认对话框 -->
  <ConfirmDialog ref="confirmDialog" />
  
  <!-- Toast 提示 -->
  <Toast ref="toast" />

  <!-- 视频预览弹窗 -->
  <div v-if="showImageModal" class="modal-overlay" @click="closeImageModal">
    <div class="modal-content image-modal" @click.stop>
      <div class="image-modal-header">
        <h3>图片预览</h3>
        <button @click="closeImageModal" class="btn-icon">✕</button>
      </div>
      <div class="image-modal-body">
        <img v-if="currentImageUrl" :src="normalizeUrl(currentImageUrl)" alt="" class="image-preview" />
      </div>
    </div>
  </div>

  <div v-if="showVideoModal" class="modal-overlay" @click="closeVideoModal">
    <div class="modal-content video-modal" @click.stop>
      <div class="video-modal-header">
        <h3>视频预览</h3>
        <button @click="closeVideoModal" class="btn-icon">✕</button>
      </div>
      <div class="video-modal-body">
        <video 
          v-if="currentVideoUrl" 
          :src="normalizeUrl(currentVideoUrl)"
          :poster="currentVideoPoster || undefined"
          controls 
          autoplay
          preload="auto"
          class="video-player"
        ></video>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useDataTableStore } from '../stores/dataTable';
import ConfirmDialog from './ConfirmDialog.vue';
import Toast from './Toast.vue';

// 定义 emits
const emit = defineEmits<{
  close: [];
}>();

const dataTableStore = useDataTableStore();
const selectedTableId = ref<string | null>(null);
const showCreateModal = ref(false);
const showAddColumnModal = ref(false);
const showImageModal = ref(false);
const showVideoModal = ref(false);
const currentImageUrl = ref<string>('');
const currentVideoUrl = ref<string>('');
const currentVideoPoster = ref<string>('');
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const toast = ref<InstanceType<typeof Toast> | null>(null);

const newTableName = ref('');
const newTableColumns = ref<Array<{ key: string; type: string }>>([
  { key: '', type: 'text' }
]);

const newColumnKey = ref('');
const newColumnType = ref('text');

// 搜索相关状态
const searchQuery = ref('');
const searchColumn = ref('');

// 拖动相关状态
const draggedColumnIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

// 辅助函数：补全相对协议URL
function normalizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  
  // 如果是相对协议URL（以//开头），补全为https
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  
  return url;
}

onMounted(() => {
  dataTableStore.init();
});

const selectedTable = computed(() => {
  if (!selectedTableId.value) return null;
  return dataTableStore.getTableById(selectedTableId.value);
});

// 过滤后的行数据
const filteredRows = computed(() => {
  if (!selectedTable.value) return [];
  
  const rows = selectedTable.value.rows;
  
  // 如果没有搜索条件，返回所有行
  if (!searchQuery.value.trim()) {
    return rows;
  }
  
  const query = searchQuery.value.toLowerCase();
  
  return rows.filter(row => {
    // 如果指定了搜索列
    if (searchColumn.value) {
      const value = row[searchColumn.value];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(query);
    }
    
    // 搜索所有列
    return selectedTable.value!.columns.some(column => {
      const value = row[column.key];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(query);
    });
  });
});

function selectTable(id: string) {
  selectedTableId.value = id;
  // 切换表时清空搜索
  clearSearch();
}

function clearSearch() {
  searchQuery.value = '';
  searchColumn.value = '';
}

function addNewColumn() {
  newTableColumns.value.push({ key: '', type: 'text' });
}

function createTable() {
  if (!newTableName.value.trim()) {
    toast.value?.show({ message: '请输入表名', type: 'warning' });
    return;
  }

  const validColumns = newTableColumns.value.filter(c => c.key.trim());
  if (validColumns.length === 0) {
    toast.value?.show({ message: '请至少添加一列', type: 'warning' });
    return;
  }

  dataTableStore.createTable(newTableName.value, validColumns as any);
  
  // 重置
  newTableName.value = '';
  newTableColumns.value = [{ key: '', type: 'text' }];
  showCreateModal.value = false;
  
  toast.value?.show({ message: '数据表创建成功', type: 'success' });
}

function deleteTable(id: string) {
  confirmDialog.value?.show({
    title: '删除数据表',
    message: '确定要删除这个数据表吗？所有数据将被清除！',
    confirmText: '删除',
    cancelText: '取消',
    type: 'danger'
  }).then((confirmed) => {
    if (confirmed) {
      dataTableStore.deleteTable(id);
      if (selectedTableId.value === id) {
        selectedTableId.value = null;
      }
    }
  });
}

function clearTableData(id: string) {
  confirmDialog.value?.show({
    title: '清空数据',
    message: '确定要清空这个数据表的所有数据吗？',
    confirmText: '清空',
    cancelText: '取消',
    type: 'danger'
  }).then((confirmed) => {
    if (confirmed) {
      dataTableStore.clearTable(id);
    }
  });
}

function addColumn() {
  if (!newColumnKey.value.trim()) {
    toast.value?.show({ message: '请输入列名', type: 'warning' });
    return;
  }

  if (!selectedTableId.value) return;

  dataTableStore.addColumn(selectedTableId.value, {
    key: newColumnKey.value,
    type: newColumnType.value as any
  });

  newColumnKey.value = '';
  newColumnType.value = 'text';
  showAddColumnModal.value = false;
  
  toast.value?.show({ message: '列添加成功', type: 'success' });
}

function deleteColumn(key: string) {
  if (!selectedTableId.value) return;
  confirmDialog.value?.show({
    title: '删除列',
    message: `确定要删除列 "${key}" 吗？`,
    confirmText: '删除',
    cancelText: '取消',
    type: 'danger'
  }).then((confirmed) => {
    if (confirmed && selectedTableId.value) {
      dataTableStore.deleteColumn(selectedTableId.value, key);
    }
  });
}

function deleteRow(rowId: string) {
  if (!selectedTableId.value) return;
  dataTableStore.deleteRow(selectedTableId.value, rowId);
}

function exportJSON() {
  if (!selectedTableId.value) return;
  const json = dataTableStore.exportTableAsJSON(selectedTableId.value);
  downloadFile(json, `${selectedTable.value?.name}.json`, 'application/json');
}

function exportCSV() {
  if (!selectedTableId.value) return;
  const csv = dataTableStore.exportTableAsCSV(selectedTableId.value);
  downloadFile(csv, `${selectedTable.value?.name}.csv`, 'text/csv');
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function openVideoModal(videoUrl: string, row: any) {
  currentVideoUrl.value = videoUrl;
  
  // 尝试从同一行中找到图片类型的列作为封面
  const imageColumn = selectedTable.value?.columns.find(col => col.type === 'image');
  if (imageColumn && row[imageColumn.key]) {
    currentVideoPoster.value = normalizeUrl(row[imageColumn.key]);
  } else {
    currentVideoPoster.value = '';
  }
  
  showVideoModal.value = true;
}

function openImageModal(imageUrl: string) {
  currentImageUrl.value = imageUrl;
  showImageModal.value = true;
}

function closeImageModal() {
  showImageModal.value = false;
  setTimeout(() => {
    currentImageUrl.value = '';
  }, 300);
}

function getVideoThumbnailStyle(row: any) {
  // 尝试从同一行中找到图片类型的列作为预览图
  const imageColumn = selectedTable.value?.columns.find(col => col.type === 'image');
  const posterUrl = imageColumn ? normalizeUrl(row[imageColumn.key]) : null;
  
  if (posterUrl) {
    return {
      backgroundImage: `url(${posterUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  }
  
  // 如果没有找到预览图，使用默认渐变背景
  return {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  };
}

function closeVideoModal() {
  showVideoModal.value = false;
  // 延迟清空 URL，避免关闭动画时视频消失
  setTimeout(() => {
    currentVideoUrl.value = '';
    currentVideoPoster.value = '';
  }, 300);
}

function getProxyVideoUrl(originalUrl: string): string {
  const fullUrl = normalizeUrl(originalUrl);
  if (!fullUrl) return '';
  
  // 通过后端代理访问视频，绕过防盗链限制
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  return `${apiUrl}/proxy/video?url=${encodeURIComponent(fullUrl)}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
}

// 列拖动处理
function onColumnDragStart(index: number) {
  draggedColumnIndex.value = index;
}

function onColumnDragEnter(index: number) {
  dragOverIndex.value = index;
}

function onColumnDragLeave() {
  dragOverIndex.value = null;
}

function onColumnDrop(dropIndex: number) {
  if (draggedColumnIndex.value === null || !selectedTableId.value) return;
  
  const dragIndex = draggedColumnIndex.value;
  if (dragIndex === dropIndex) {
    draggedColumnIndex.value = null;
    dragOverIndex.value = null;
    return;
  }

  // 重新排序列
  dataTableStore.reorderColumns(selectedTableId.value, dragIndex, dropIndex);
  
  draggedColumnIndex.value = null;
  dragOverIndex.value = null;
}
</script>

<style scoped>
.data-table-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-page-elevated);
  color: var(--color-text-primary);
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #161b22;
  border-bottom: 1px solid #30363d;
}

.manager-header h2 {
  margin: 0;
  color: var(--color-brand-link-hover);
  font-size: 1.2rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.manager-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.tables-sidebar {
  width: 280px;
  background: var(--color-bg-surface);
  border-right: 1px solid var(--color-border-default);
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.btn-full {
  width: 100%;
  margin-bottom: 1rem;
}

.tables-list {
  flex: 1;
  overflow-y: auto;
}

.table-card {
  padding: 1rem;
  margin-bottom: 0.5rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.table-card:hover {
  background: var(--color-bg-surface);
  border-color: var(--color-brand-link-hover);
}

.table-card.active {
  background: var(--color-brand-link-hover);
  border-color: var(--color-brand-link-hover);
}

.table-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.table-info p {
  margin: 0.25rem 0;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.table-info small {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.table-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.table-detail {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

.detail-header h3 {
  margin: 0;
  color: var(--color-brand-link-hover);
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  justify-content: flex-end;
}

.search-bar-compact {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.6rem;
  transition: border-color 0.2s;
}

.search-bar-compact:focus-within {
  border-color: var(--color-brand-link-hover);
}

.search-input-compact {
  background: transparent;
  border: none;
  color: #c9d1d9;
  font-size: 0.85rem;
  outline: none;
  width: 180px;
  padding: 0;
}

.search-input-compact::placeholder {
  color: var(--color-text-muted);
}

.search-column-select-compact {
  background: transparent;
  border: none;
  color: #c9d1d9;
  font-size: 0.8rem;
  outline: none;
  cursor: pointer;
  padding: 0;
}

.search-column-select-compact option {
  background: #161b22;
  color: #c9d1d9;
}

.search-column-select-compact:hover {
  color: #58a6ff;
}

.search-info-compact {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
  padding-left: 0.25rem;
}

.detail-actions {
  display: flex;
  gap: 0.5rem;
}

.columns-section {
  margin-bottom: 1.5rem;
}

.columns-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.columns-section h4 {
  margin: 0;
  color: #8b949e;
}

.btn-small {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
}

.columns-list {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.columns-list::-webkit-scrollbar {
  height: 6px;
}

.columns-list::-webkit-scrollbar-track {
  background: #0d1117;
  border-radius: 3px;
}

.columns-list::-webkit-scrollbar-thumb {
  background: #30363d;
  border-radius: 3px;
}

.columns-list::-webkit-scrollbar-thumb:hover {
  background: #484f58;
}

.column-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  cursor: move;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.column-item:hover {
  background: #30363d;
  border-color: #58a6ff;
}

.column-item.drag-over {
  border-color: #58a6ff;
  border-style: dashed;
  background: #1f6feb20;
}

.drag-handle {
  color: #6e7681;
  cursor: grab;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.column-key {
  font-weight: 500;
}

.column-type {
  font-size: 0.85rem;
  color: #8b949e;
}

.data-table-container {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  overflow: auto;
  flex: 1;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #30363d;
}

.data-table th {
  background: #21262d;
  font-weight: 500;
  position: sticky;
  top: 0;
  z-index: 1;
}

.data-table tbody tr:hover {
  background: #21262d;
}

.table-image {
  max-width: 100px;
  max-height: 60px;
  object-fit: cover;
  border-radius: 4px;
}

.clickable-image {
  cursor: zoom-in;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.clickable-image:hover {
  transform: scale(1.04);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

.table-video {
  max-width: 200px;
  max-height: 120px;
  border-radius: 4px;
}

.table-link {
  color: #58a6ff;
  text-decoration: none;
}

.table-link:hover {
  text-decoration: underline;
}

.empty-state,
.empty-data {
  text-align: center;
  padding: 2rem;
  color: #6e7681;
}

.btn-primary,
.btn-secondary,
.btn-danger,
.btn-icon,
.btn-icon-small {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-sm);
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

.btn-icon,
.btn-icon-small {
  background: #21262d;
  color: #c9d1d9;
  padding: 0.25rem 0.5rem;
}

.btn-icon:hover,
.btn-icon-small:hover {
  background: #30363d;
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
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  padding: 2rem;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-content h3 {
  margin: 0 0 1rem 0;
  color: var(--color-brand-link-hover);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #8b949e;
}

.form-group input,
.form-group select {
  width: 100%;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 0.5rem;
  color: #c9d1d9;
  font-size: 0.9rem;
}

.column-input {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.column-input input {
  flex: 1;
}

.column-input select {
  width: 120px;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  justify-content: flex-end;
}

.video-preview-btn {
  background: #238636;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.video-preview-btn:hover {
  background: #2ea043;
  transform: translateY(-1px);
}

.video-thumbnail-wrapper {
  position: relative;
  width: 200px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-thumbnail-wrapper:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.play-icon-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transition: transform 0.3s ease;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  pointer-events: none;
}

.video-thumbnail-wrapper:hover .play-icon-overlay {
  transform: translate(-50%, -50%) scale(1.1);
}

.play-icon-overlay svg {
  display: block;
}

.play-icon-overlay circle {
  transition: fill 0.3s ease;
}

.video-thumbnail-wrapper:hover .play-icon-overlay circle {
  fill: rgba(0, 0, 0, 0.8);
}

.video-modal {
  max-width: 90vw;
  max-height: 90vh;
  width: auto;
  padding: 0;
  overflow: hidden;
}

.image-modal {
  max-width: 92vw;
  max-height: 92vh;
  width: auto;
  padding: 0;
  overflow: hidden;
}

.image-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #30363d;
  background: #161b22;
}

.image-modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-text-primary);
}

.image-modal-body {
  padding: 1rem;
  background: #0d1117;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 320px;
  min-height: 240px;
}

.image-preview {
  max-width: min(88vw, 1400px);
  max-height: 80vh;
  object-fit: contain;
  border-radius: 8px;
}

.video-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #30363d;
  background: #161b22;
}

.video-modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-text-primary);
}

.video-modal-body {
  padding: 0;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.video-player {
  width: 100%;
  max-width: 1200px;
  max-height: 80vh;
  outline: none;
}
</style>
