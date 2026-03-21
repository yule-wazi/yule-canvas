<template>
  <div class="property-form">
    <div class="form-group">
      <label>滚动模式</label>
      <select v-model="localData.mode" @change="emitUpdate">
        <option value="smart">智能滚动 (检测底部)</option>
        <option value="fixed">固定次数</option>
      </select>
    </div>

    <div class="form-group">
      <label>最大滚动次数</label>
      <input
        v-model.number="localData.maxScrolls"
        type="number"
        min="1"
        max="50"
        @input="emitUpdate"
      />
    </div>

    <div class="form-group">
      <label>滚动间隔 (毫秒)</label>
      <input
        v-model.number="localData.delay"
        type="number"
        min="100"
        step="100"
        @input="emitUpdate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Block } from '../../../types/block';

const props = defineProps<{
  block: Block;
}>();

const emit = defineEmits<{
  update: [data: any];
}>();

const localData = ref({ ...props.block.data });

watch(() => props.block.data, (newData) => {
  localData.value = { ...newData };
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
}

.form-group input,
.form-group select {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 0.5rem;
  color: #c9d1d9;
  font-size: 0.9rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #58a6ff;
}
</style>
