<template>
  <div class="script-list">
    <div class="header">
      <h3>我的脚本</h3>
      <button @click="refresh" class="refresh-btn">刷新</button>
    </div>

    <div class="search-box">
      <input 
        v-model="searchQuery"
        type="text"
        placeholder="搜索脚本..."
        class="search-input"
      />
    </div>

    <div class="list">
      <div 
        v-for="script in filteredScripts" 
        :key="script.id"
        class="script-item"
        :class="{ active: selectedId === script.id }"
        @click="selectScript(script)"
      >
        <div class="script-info">
          <div class="script-name">{{ script.name }}</div>
          <div class="script-meta">
            <span class="model-tag">{{ getModelName(script.aiModel) }}</span>
            <span class="time">{{ formatTime(script.createdAt) }}</span>
          </div>
          <div class="script-desc">{{ script.description }}</div>
        </div>
        <div class="script-actions">
          <button @click.stop="editScript(script)" class="action-btn edit">编辑</button>
          <button @click.stop="deleteScript(script.id)" class="action-btn delete">删除</button>
        </div>
      </div>

      <div v-if="filteredScripts.length === 0" class="empty">
        {{ searchQuery ? '未找到匹配的脚本' : '暂无脚本，快去生成一个吧！' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import storageManager from '../services/storage';
import type { Script } from '../stores/script';

interface Emits {
  (e: 'select', script: Script): void;
  (e: 'edit', script: Script): void;
  (e: 'delete', id: string): void;
}

const emit = defineEmits<Emits>();

const scripts = ref<Script[]>([]);
const searchQuery = ref('');
const selectedId = ref('');

const filteredScripts = computed(() => {
  if (!searchQuery.value) return scripts.value;
  
  const query = searchQuery.value.toLowerCase();
  return scripts.value.filter(s => 
    s.name.toLowerCase().includes(query) ||
    s.description.toLowerCase().includes(query)
  );
});

const loadScripts = () => {
  scripts.value = storageManager.getAllScripts().sort((a, b) => b.createdAt - a.createdAt);
};

const refresh = () => {
  loadScripts();
};

const selectScript = (script: Script) => {
  selectedId.value = script.id;
  emit('select', script);
};

const editScript = (script: Script) => {
  emit('edit', script);
};

const deleteScript = (id: string) => {
  if (confirm('确定要删除这个脚本吗？')) {
    storageManager.deleteScript(id);
    loadScripts();
    emit('delete', id);
  }
};

const getModelName = (modelId: string) => {
  const models: Record<string, string> = {
    qwen: '千问',
    siliconflow: '硅基'
  };
  return models[modelId] || modelId;
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', { 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

onMounted(() => {
  loadScripts();
});

defineExpose({ refresh });
</script>

<style scoped>
.script-list {
  background: #161b22;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #30363d;
  height: 100%;
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

.search-box {
  margin-bottom: 1rem;
}

.search-input {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid #30363d;
  border-radius: 6px;
  font-size: 0.9rem;
  background: #0d1117;
  color: #c9d1d9;
}

.list {
  flex: 1;
  overflow-y: auto;
}

.script-item {
  padding: 1rem;
  border: 1px solid #30363d;
  border-radius: 6px;
  margin-bottom: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  background: #0d1117;
}

.script-item:hover {
  border-color: #58a6ff;
  box-shadow: 0 2px 8px rgba(88, 166, 255, 0.2);
}

.script-item.active {
  border-color: #1f6feb;
  background: #1c2128;
}

.script-info {
  margin-bottom: 0.5rem;
}

.script-name {
  font-weight: 500;
  color: #c9d1d9;
  margin-bottom: 0.3rem;
}

.script-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.3rem;
}

.model-tag {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  background: #1c2128;
  color: #58a6ff;
  border-radius: 3px;
  font-size: 0.75rem;
  border: 1px solid #30363d;
}

.time {
  font-size: 0.75rem;
  color: #8b949e;
}

.script-desc {
  font-size: 0.85rem;
  color: #8b949e;
}

.script-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.3rem 0.8rem;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn.edit {
  background: #1f6feb;
  color: white;
}

.action-btn.edit:hover {
  background: #388bfd;
}

.action-btn.delete {
  background: #da3633;
  color: white;
}

.action-btn.delete:hover {
  background: #f85149;
}

.empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #8b949e;
}
</style>
