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
        placeholder="输入循环次数"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  block: any;
}

const props = defineProps<Props>();
const emit = defineEmits(['update']);

const localData = ref({
  mode: props.block.data.mode || 'count',
  count: props.block.data.count || 10,
  condition: props.block.data.condition || '',
  maxIterations: props.block.data.maxIterations || 1000
});

watch(() => props.block.data, (newData) => {
  localData.value = {
    mode: newData.mode || 'count',
    count: newData.count || 10,
    condition: newData.condition || '',
    maxIterations: newData.maxIterations || 1000
  };
}, { deep: true });

function emitUpdate() {
  emit('update', localData.value);
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
</style>
