<template>
  <div class="property-form">
    <div class="form-group">
      <label>循环模式</label>
      <select v-model="localData.mode" @change="emitUpdate">
        <option value="count">固定次数</option>
        <option value="condition">条件循环</option>
      </select>
    </div>

    <div v-if="localData.mode === 'count'" class="form-group">
      <label>循环次数</label>
      <input 
        type="number" 
        v-model.number="localData.count" 
        @input="emitUpdate"
        min="1"
        placeholder="输入循环次数或使用 {{变量名}}"
      />
    </div>

    <div v-if="localData.mode === 'condition'" class="form-group">
      <label>循环条件</label>
      <textarea 
        v-model="localData.condition" 
        @input="emitUpdate"
        placeholder="例如: index < 10"
        rows="3"
      ></textarea>
      <small>条件为真时继续循环</small>
    </div>

    <div class="form-group">
      <div class="toggle-header">
        <label>使用循环变量</label>
        <button 
          type="button"
          class="toggle-button" 
          :class="{ active: localData.useVariable }"
          @click="toggleVariable"
        >
          {{ localData.useVariable ? '已启用' : '已禁用' }}
        </button>
      </div>
      <small v-if="!localData.useVariable">启用后可在选择器中使用循环索引</small>
    </div>

    <div v-if="localData.useVariable" class="form-group">
      <label>选择循环控制变量</label>
      <select 
        v-model="selectedVariable" 
        @change="handleVariableChange"
      >
        <option value="">请选择全局变量</option>
        <option v-for="varName in availableVariables" :key="varName" :value="varName">
          {{ varName }}
        </option>
      </select>
      
      <small v-if="selectedVariable">
        循环将使用 {{selectedVariable}} 作为循环变量，初始值从全局变量获取
      </small>
      <small v-else style="color: #f85149;">
        必须选择一个全局变量作为循环控制变量
      </small>
    </div>

    <div class="form-group">
      <label>最大循环次数（防止死循环）</label>
      <input 
        type="number" 
        v-model.number="localData.maxIterations" 
        @input="emitUpdate"
        min="1"
        placeholder="默认 1000"
      />
    </div>

    <div class="info-box">
      <h4>💡 使用说明</h4>
      <p>循环模块的连接方式特殊：</p>
      <ul>
        <li><strong>左端点（出口）</strong>：连接到循环体的第一个模块</li>
        <li><strong>右端点（入口）</strong>：接收循环体最后一个模块的连接</li>
      </ul>
      <p>形成循环：循环模块 → 模块1 → 模块2 → ... → 回到循环模块</p>
      <p v-if="localData.useVariable && selectedVariable">
        <strong>变量使用</strong>：在选择器中使用 <span v-text="variableUsageHint"></span> 引用循环索引（初始值从全局变量获取）
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useWorkflowStore } from '../../../stores/workflow';

interface Props {
  block: any;
}

const props = defineProps<Props>();
const emit = defineEmits(['update']);
const workflowStore = useWorkflowStore();

const localData = ref({
  mode: props.block.data.mode || 'count',
  count: props.block.data.count || 10,
  condition: props.block.data.condition || '',
  maxIterations: props.block.data.maxIterations || 1000,
  useVariable: props.block.data.useVariable || false,
  variableName: props.block.data.variableName || '',
  startValueType: 'variable', // 固定为使用全局变量
  startValue: props.block.data.startValue || ''
});

// 用于选择框的变量名（不带 {{}}）
const selectedVariable = ref('');

// 初始化时从 startValue 中提取变量名
if (localData.value.startValue) {
  const match = localData.value.startValue.match(/\{\{(.+?)\}\}/);
  if (match) {
    selectedVariable.value = match[1];
  }
}

// 获取可用的全局变量列表
const availableVariables = computed(() => {
  return Object.keys(workflowStore.variables);
});

// 用于显示的变量使用提示
const variableUsageHint = computed(() => {
  return `{{${selectedVariable.value}}}`;
});

watch(() => props.block.data, (newData) => {
  localData.value = {
    mode: newData.mode || 'count',
    count: newData.count || 10,
    condition: newData.condition || '',
    maxIterations: newData.maxIterations || 1000,
    useVariable: newData.useVariable || false,
    variableName: newData.variableName || '',
    startValueType: 'variable',
    startValue: newData.startValue || ''
  };
  
  // 更新选择的变量名
  if (newData.startValue) {
    const match = newData.startValue.match(/\{\{(.+?)\}\}/);
    if (match) {
      selectedVariable.value = match[1];
    }
  }
}, { deep: true });

function emitUpdate() {
  emit('update', localData.value);
}

function toggleVariable() {
  localData.value.useVariable = !localData.value.useVariable;
  // 禁用时清空变量相关配置
  if (!localData.value.useVariable) {
    localData.value.variableName = '';
    localData.value.startValue = '';
    selectedVariable.value = '';
  }
  emitUpdate();
}

function handleVariableChange() {
  if (selectedVariable.value) {
    // 设置变量名和起始值
    localData.value.variableName = selectedVariable.value;
    localData.value.startValue = `{{${selectedVariable.value}}}`;
    localData.value.startValueType = 'variable';
  } else {
    localData.value.variableName = '';
    localData.value.startValue = '';
  }
  emitUpdate();
}
</script>

<style scoped>
.property-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.9rem;
  color: #8b949e;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 0.5rem;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 0.9rem;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #58a6ff;
}

.form-group small {
  font-size: 0.8rem;
  color: #8b949e;
}

.info-box {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 1rem;
  margin-top: 0.5rem;
}

.info-box h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #58a6ff;
}

.info-box p {
  margin: 0.5rem 0;
  font-size: 0.85rem;
  color: #8b949e;
  line-height: 1.5;
}

.info-box ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  font-size: 0.85rem;
  color: #8b949e;
  line-height: 1.6;
}

.info-box li {
  margin: 0.25rem 0;
}

.info-box strong {
  color: #c9d1d9;
}

.toggle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-button {
  padding: 0.25rem 0.75rem;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #8b949e;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-button:hover {
  background: #30363d;
  border-color: #58a6ff;
}

.toggle-button.active {
  background: #1f6feb;
  border-color: #1f6feb;
  color: #ffffff;
}
</style>
