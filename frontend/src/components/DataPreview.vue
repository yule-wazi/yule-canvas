<template>
  <div class="data-preview">
    <div class="header">
      <h3>数据预览</h3>
      <div class="actions">
        <button @click="toggleView" class="view-btn">
          {{ viewMode === 'json' ? '表格视图' : 'JSON视图' }}
        </button>
        <button @click="exportData" class="export-btn">导出</button>
      </div>
    </div>

    <div v-if="!data" class="empty">
      暂无数据
    </div>

    <div v-else class="content">
      <!-- JSON视图 -->
      <div v-if="viewMode === 'json'" class="json-view">
        <pre>{{ JSON.stringify(data, null, 2) }}</pre>
      </div>

      <!-- 表格视图 -->
      <div v-else class="table-view">
        <table v-if="tableData.length > 0">
          <thead>
            <tr>
              <th v-for="col in columns" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in tableData" :key="index">
              <td v-for="col in columns" :key="col">
                {{ formatValue(row[col]) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">
          数据格式不支持表格视图
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Props {
  data: any;
}

const props = defineProps<Props>();

const viewMode = ref<'json' | 'table'>('json');

const columns = computed(() => {
  if (!props.data) return [];
  
  if (Array.isArray(props.data) && props.data.length > 0) {
    return Object.keys(props.data[0]);
  }
  
  if (typeof props.data === 'object') {
    return Object.keys(props.data);
  }
  
  return [];
});

const tableData = computed(() => {
  if (!props.data) return [];
  
  if (Array.isArray(props.data)) {
    return props.data;
  }
  
  if (typeof props.data === 'object') {
    return [props.data];
  }
  
  return [];
});

const toggleView = () => {
  viewMode.value = viewMode.value === 'json' ? 'table' : 'json';
};

const exportData = () => {
  if (!props.data) return;
  
  const dataStr = JSON.stringify(props.data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `data_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const formatValue = (value: any) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
</script>

<style scoped>
.data-preview {
  background: #161b22;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #30363d;
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

.actions {
  display: flex;
  gap: 0.5rem;
}

.view-btn,
.export-btn {
  padding: 0.4rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.view-btn {
  background: #1f6feb;
  color: white;
}

.view-btn:hover {
  background: #388bfd;
}

.export-btn {
  background: #238636;
  color: white;
}

.export-btn:hover {
  background: #2ea043;
}

.content {
  max-height: 500px;
  overflow: auto;
}

.json-view pre {
  background: #0d1117;
  padding: 1rem;
  border-radius: 6px;
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #c9d1d9;
  border: 1px solid #30363d;
}

.table-view {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

thead {
  background: #21262d;
}

th, td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #30363d;
  color: #c9d1d9;
}

th {
  font-weight: 600;
  color: #58a6ff;
}

tbody tr:hover {
  background: #1c2128;
}

.empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #8b949e;
}
</style>
