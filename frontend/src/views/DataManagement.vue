<template>
  <div class="data-management">
    <h2>数据管理</h2>
    
    <div class="layout">
      <div class="left-panel">
        <div class="data-list">
          <div class="header">
            <h3>爬取记录</h3>
            <button @click="loadData" class="refresh-btn">刷新</button>
          </div>

          <div class="list">
            <div 
              v-for="item in dataList" 
              :key="item.id"
              class="data-item"
              :class="{ active: selectedId === item.id }"
              @click="selectData(item)"
            >
              <div class="data-info">
                <div class="status-badge" :class="item.status">
                  {{ item.status === 'success' ? '成功' : '失败' }}
                </div>
                <div class="time">{{ formatTime(item.executedAt) }}</div>
                <div class="duration">耗时: {{ (item.duration / 1000).toFixed(2) }}s</div>
              </div>
              <button @click.stop="deleteData(item.id)" class="delete-btn">删除</button>
            </div>

            <div v-if="dataList.length === 0" class="empty">
              暂无数据记录
            </div>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <DataPreview :data="selectedData" />
        
        <div v-if="selectedLogs.length > 0" class="logs-section">
          <h3>执行日志</h3>
          <div class="logs">
            <div v-for="(log, index) in selectedLogs" :key="index" class="log-entry">
              {{ log }}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 确认对话框 -->
    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue';
import DataPreview from '../components/DataPreview.vue';
import storageManager, { type ScrapedData } from '../services/storage';

const ConfirmDialog = defineAsyncComponent(() => import('../components/ConfirmDialog.vue'));

const dataList = ref<ScrapedData[]>([]);
const selectedId = ref('');
const selectedData = ref<any>(null);
const selectedLogs = ref<string[]>([]);
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);

const loadData = () => {
  dataList.value = storageManager.getAllData().sort((a, b) => b.executedAt - a.executedAt);
};

const selectData = (item: ScrapedData) => {
  selectedId.value = item.id;
  selectedData.value = item.data;
  selectedLogs.value = item.logs || [];
};

const deleteData = async (id: string) => {
  const confirmed = await confirmDialog.value?.show({
    title: '确认删除',
    message: '确定要删除这条数据记录吗？',
    confirmText: '删除',
    cancelText: '取消'
  });
  
  if (confirmed) {
    storageManager.deleteData(id);
    loadData();
    
    if (selectedId.value === id) {
      selectedId.value = '';
      selectedData.value = null;
      selectedLogs.value = [];
    }
  }
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.data-management {
  max-width: 1400px;
  margin: 0 auto;
}

h2 {
  margin-bottom: 2rem;
  color: #58a6ff;
}

.layout {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 2rem;
}

.left-panel {
  position: sticky;
  top: 1rem;
}

.data-list {
  background: #161b22;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #30363d;
  max-height: calc(100vh - 8rem);
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

h3 {
  margin: 0;
  color: #58a6ff;
}

.refresh-btn {
  padding: 0.4rem 1rem;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  color: #c9d1d9;
}

.refresh-btn:hover {
  background: #30363d;
}

.list {
  flex: 1;
  overflow-y: auto;
}

.data-item {
  padding: 1rem;
  border: 1px solid #30363d;
  border-radius: 6px;
  margin-bottom: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0d1117;
}

.data-item:hover {
  border-color: #58a6ff;
  box-shadow: 0 2px 8px rgba(88, 166, 255, 0.2);
}

.data-item.active {
  border-color: #1f6feb;
  background: #1c2128;
}

.data-info {
  flex: 1;
}

.status-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-bottom: 0.3rem;
}

.status-badge.success {
  background: #1c2d20;
  color: #3fb950;
  border: 1px solid #2ea043;
}

.status-badge.failed {
  background: #3d1319;
  color: #f85149;
  border: 1px solid #da3633;
}

.time {
  font-size: 0.85rem;
  color: #8b949e;
  margin-bottom: 0.2rem;
}

.duration {
  font-size: 0.75rem;
  color: #8b949e;
}

.delete-btn {
  padding: 0.3rem 0.8rem;
  background: #da3633;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.delete-btn:hover {
  background: #f85149;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.logs-section {
  background: #161b22;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #30363d;
}

.logs {
  background: #0d1117;
  color: #c9d1d9;
  padding: 1rem;
  border-radius: 6px;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.85rem;
  border: 1px solid #30363d;
}

.log-entry {
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #8b949e;
}

@media (max-width: 1024px) {
  .layout {
    grid-template-columns: 1fr;
  }
  
  .left-panel {
    position: static;
  }
}
</style>
