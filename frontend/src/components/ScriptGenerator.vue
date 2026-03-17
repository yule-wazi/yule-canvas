<template>
  <div class="script-generator">
    <h3>AI生成脚本</h3>
    
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
      {{ loading ? '生成中...' : '生成脚本' }}
    </button>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="generatedCode" class="result">
      <h4>生成的脚本</h4>
      <ScriptEditor 
        v-model="generatedCode" 
        :readonly="false"
        @change="handleCodeChange"
      />
      <div class="actions">
        <button @click="saveScript" class="save-btn">保存脚本</button>
        <button @click="copyCode" class="copy-btn">复制代码</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import api from '../services/api';
import ScriptEditor from './ScriptEditor.vue';

interface Emits {
  (e: 'scriptGenerated', code: string): void;
  (e: 'saveScript', code: string, model: string): void;
}

const emit = defineEmits<Emits>();

const selectedModel = ref('siliconflow');
const siliconflowModel = ref('Qwen/Qwen3-8B');
const prompt = ref('');
const generatedCode = ref('');
const loading = ref(false);
const error = ref('');

const generate = async () => {
  if (!prompt.value.trim()) return;

  loading.value = true;
  error.value = '';
  generatedCode.value = '';

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
    
    const response: any = await api.post('/ai/generate', requestData);

    if (response.success) {
      generatedCode.value = response.code;
      emit('scriptGenerated', response.code);
    } else {
      error.value = response.error || '生成失败';
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || '生成失败';
  } finally {
    loading.value = false;
  }
};

const handleCodeChange = (code: string) => {
  generatedCode.value = code;
};

const saveScript = () => {
  emit('saveScript', generatedCode.value, selectedModel.value);
};

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(generatedCode.value);
    alert('代码已复制到剪贴板');
  } catch (err) {
    console.error('复制失败:', err);
  }
};
</script>

<style scoped>
.script-generator {
  background: #161b22;
  padding: 2rem;
  border-radius: 8px;
  border: 1px solid #30363d;
}

h3 {
  margin-top: 0;
  color: #58a6ff;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #c9d1d9;
}

.model-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #30363d;
  border-radius: 6px;
  font-size: 1rem;
  background: #0d1117;
  color: #c9d1d9;
}

.prompt-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #30363d;
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  background: #0d1117;
  color: #c9d1d9;
}

.generate-btn {
  background: #238636;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

.generate-btn:hover:not(:disabled) {
  background: #2ea043;
}

.generate-btn:disabled {
  background: #21262d;
  cursor: not-allowed;
  color: #8b949e;
}

.error-message {
  margin-top: 1rem;
  padding: 1rem;
  background: #3d1319;
  border: 1px solid #da3633;
  border-radius: 6px;
  color: #f85149;
}

.result {
  margin-top: 2rem;
}

.result h4 {
  margin-bottom: 1rem;
  color: #58a6ff;
}

.actions {
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
}

.save-btn,
.copy-btn {
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.3s;
}

.save-btn {
  background: #1f6feb;
  color: white;
}

.save-btn:hover {
  background: #388bfd;
}

.copy-btn {
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
}

.copy-btn:hover {
  background: #30363d;
}
</style>
