<template>
  <div class="script-management">
    <h2>脚本管理</h2>
    
    <div class="layout">
      <div class="left-panel">
        <ScriptList 
          ref="scriptListRef"
          @select="handleSelectScript"
          @edit="handleEditScript"
          @delete="handleDeleteScript"
        />
      </div>

      <div class="middle-panel">
        <ScriptGenerator 
          @scriptGenerated="handleScriptGenerated"
          @saveScript="handleSaveScript"
        />
      </div>

      <div class="right-panel">
        <div class="editor-section">
          <div class="editor-header">
            <h3>脚本编辑器</h3>
            <button 
              v-if="currentScriptId" 
              @click="updateScript"
              class="update-btn"
            >
              更新脚本
            </button>
          </div>
          <ScriptEditor 
            v-model="currentCode"
            :readonly="false"
          />
        </div>

        <ExecutionPanel 
          :code="currentCode"
          :scriptId="currentScriptId"
        />
      </div>
    </div>
    
    <!-- Toast 提示 -->
    <Toast ref="toast" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ScriptList from '../components/ScriptList.vue';
import ScriptGenerator from '../components/ScriptGenerator.vue';
import ScriptEditor from '../components/ScriptEditor.vue';
import ExecutionPanel from '../components/ExecutionPanel.vue';
import Toast from '../components/Toast.vue';
import storageManager from '../services/storage';
import type { Script } from '../stores/script';

const currentCode = ref('');
const currentScriptId = ref('');
const scriptListRef = ref<InstanceType<typeof ScriptList> | null>(null);
const toast = ref<InstanceType<typeof Toast> | null>(null);

const handleScriptGenerated = (code: string) => {
  currentCode.value = code;
  currentScriptId.value = '';
};

const handleSaveScript = (code: string, model: string) => {
  const script: Script = {
    id: Date.now().toString(),
    name: `脚本_${new Date().toLocaleString('zh-CN')}`,
    description: '通过AI生成',
    code: code,
    aiModel: model,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    executionCount: 0
  };

  storageManager.saveScript(script);
  currentScriptId.value = script.id;
  currentCode.value = code;
  
  scriptListRef.value?.refresh();
  
  toast.value?.show({ message: '脚本已保存！', type: 'success' });
};

const handleSelectScript = (script: Script) => {
  currentCode.value = script.code;
  currentScriptId.value = script.id;
};

const handleEditScript = (script: Script) => {
  currentCode.value = script.code;
  currentScriptId.value = script.id;
};

const handleDeleteScript = (id: string) => {
  if (currentScriptId.value === id) {
    currentCode.value = '';
    currentScriptId.value = '';
  }
};

const updateScript = () => {
  if (!currentScriptId.value) return;
  
  storageManager.updateScript(currentScriptId.value, {
    code: currentCode.value,
    updatedAt: Date.now()
  });
  
  scriptListRef.value?.refresh();
  toast.value?.show({ message: '脚本已更新！', type: 'success' });
};
</script>

<style scoped>
.script-management {
  max-width: 1600px;
  margin: 0 auto;
}

h2 {
  margin-bottom: 2rem;
  color: #58a6ff;
}

.layout {
  display: grid;
  grid-template-columns: 300px 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
}

.left-panel {
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 8rem);
}

.middle-panel,
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.editor-section {
  background: #161b22;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #30363d;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.editor-header h3 {
  margin: 0;
  color: #58a6ff;
}

.update-btn {
  padding: 0.5rem 1rem;
  background: #1f6feb;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.update-btn:hover {
  background: #388bfd;
}

@media (max-width: 1400px) {
  .layout {
    grid-template-columns: 1fr;
  }
  
  .left-panel {
    position: static;
    max-height: none;
  }
}
</style>
