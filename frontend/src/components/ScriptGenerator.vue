<template>
  <div class="script-generator">
    <h3>AI生成工作流</h3>
    
    <div class="form-group">
      <label>选择AI模型</label>
      <select v-model="selectedModel" class="model-select">
        <option value="siliconflow">硅基流动</option>
        <option value="qwen">阿里千问</option>
      </select>
    </div>

    <div v-if="selectedModel === 'siliconflow'" class="form-group">
      <label>硅基流动模型</label>
      <select v-model="siliconflowModel" class="model-select">
        <option value="Qwen/Qwen3-8B">通义千问 Qwen/Qwen3-8B</option>
        <option value="Qwen/Qwen2.5-7B-Instruct">通义千问 2.5-7B</option>
        <option value="Qwen/Qwen3.5-27B">通义千问 3.5-27B</option>
        <option value="deepseek-ai/DeepSeek-V2.5">DeepSeek V2.5</option>
        <option value="THUDM/glm-4-9b-chat">智谱 GLM-4-9B</option>
        <option value="meta-llama/Meta-Llama-3.1-8B-Instruct">Llama 3.1-8B</option>
      </select>
    </div>

    <div class="form-group">
      <label>需求描述</label>
      <textarea
        v-model="prompt"
        placeholder="例如：爬取淘宝商品列表的标题和价格"
        rows="4"
        class="prompt-input"
      ></textarea>
    </div>

    <button 
      @click="generate" 
      :disabled="loading || !prompt.trim()"
      class="generate-btn"
    >
      {{ loading ? '生成中...' : '生成' }}
    </button>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="generatedWorkflow" class="result">
      <h4>生成的工作流</h4>
      <div class="workflow-info">
        <p>✅ 包含 {{ generatedWorkflow.blocks?.length || 0 }} 个模块</p>
        <p>✅ 包含 {{ generatedWorkflow.connections?.length || 0 }} 个连接</p>
      </div>
      <div class="actions">
        <button @click="importToEditor" class="import-btn">导入到编辑器</button>
        <button @click="copyWorkflowJson" class="copy-btn">复制 JSON</button>
      </div>
    </div>

  </div>
  
  <!-- Toast 提示 -->
  <Toast ref="toast" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api';
import Toast from './Toast.vue';
import { useWorkflowStore } from '../stores/workflow';

const router = useRouter();
const workflowStore = useWorkflowStore();

const selectedModel = ref('siliconflow');
const siliconflowModel = ref('Qwen/Qwen3-8B');
const prompt = ref('');
const generatedWorkflow = ref<any>(null);
const toast = ref<InstanceType<typeof Toast> | null>(null);
const loading = ref(false);
const error = ref('');

const generate = async () => {
  if (!prompt.value.trim()) return;

  loading.value = true;
  error.value = '';
  generatedWorkflow.value = null;

  try {
    const requestData: any = {
      prompt: prompt.value,
      model: selectedModel.value
    };
    
    // 如果是硅基流动，传递具体的模型名称
    if (selectedModel.value === 'siliconflow') {
      requestData.options = {
        model: siliconflowModel.value
      };
    }
    
    const response: any = await api.post('/ai/generate-workflow', requestData);

    if (response.success) {
      generatedWorkflow.value = response.workflow;
      toast.value?.show({ message: '工作流生成成功', type: 'success' });
    } else {
      error.value = response.error || '生成失败';
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || '生成失败';
  } finally {
    loading.value = false;
  }
};

const importToEditor = () => {
  if (!generatedWorkflow.value) return;
  
  const workflow = {
    id: `workflow-${Date.now()}`,
    name: 'AI 生成工作流',
    description: prompt.value.trim(),
    blocks: generatedWorkflow.value.blocks || [],
    connections: generatedWorkflow.value.connections || [],
    variables: generatedWorkflow.value.variables || {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  workflowStore.loadWorkflow(workflow as any);
  
  toast.value?.show({ message: '工作流已导入到编辑器', type: 'success' });
  
  router.push('/workflow');
};

const copyWorkflowJson = async () => {
  try {
    const json = JSON.stringify(generatedWorkflow.value, null, 2);
    await navigator.clipboard.writeText(json);
    toast.value?.show({ message: 'JSON 已复制到剪贴板', type: 'success' });
  } catch (err) {
    console.error('复制失败:', err);
    toast.value?.show({ message: '复制失败', type: 'error' });
  }
};
</script>

<style scoped>
.script-generator {
  background: var(--color-bg-surface);
  padding: 2rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-default);
}

h3 {
  margin-top: 0;
  color: var(--color-brand-link-hover);
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.model-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  background: var(--color-bg-page-elevated);
  color: var(--color-text-primary);
}

.prompt-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  background: var(--color-bg-page-elevated);
  color: var(--color-text-primary);
}

.generate-btn {
  background: #238636;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

.generate-btn:hover:not(:disabled) {
  background: #2ea043;
}

.generate-btn:disabled {
  background: var(--color-bg-panel);
  cursor: not-allowed;
  color: var(--color-text-secondary);
}

.error-message {
  margin-top: 1rem;
  padding: 1rem;
  background: #3d1319;
  border: 1px solid #da3633;
  border-radius: var(--radius-sm);
  color: #f85149;
}

.result {
  margin-top: 2rem;
}

.result h4 {
  margin-bottom: 1rem;
  color: var(--color-brand-link-hover);
}

.workflow-info {
  padding: 1rem;
  background: var(--color-bg-page-elevated);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  margin-bottom: 1rem;
}

.workflow-info p {
  margin: 0.5rem 0;
  color: var(--color-text-secondary);
}

.actions {
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
}

.save-btn,
.copy-btn,
.import-btn {
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.3s;
}

.save-btn,
.import-btn {
  background: var(--color-brand-link-hover);
  color: white;
}

.save-btn:hover,
.import-btn:hover {
  background: #388bfd;
}

.copy-btn {
  background: var(--color-bg-panel);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
}

.copy-btn:hover {
  background: #30363d;
}
</style>
