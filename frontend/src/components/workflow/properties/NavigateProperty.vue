<template>
  <div class="property-form">
    <div class="form-group">
      <label>URL地址</label>
      <input
        v-model="localData.url"
        type="text"
        placeholder="https://example.com"
        @input="emitUpdate"
      />
    </div>

    <div class="form-group">
      <label>等待策略</label>
      <select v-model="localData.waitUntil" @change="emitUpdate">
        <option value="load">完全加载 (load)</option>
        <option value="domcontentloaded">DOM加载 (domcontentloaded)</option>
        <option value="networkidle">网络空闲 (networkidle)</option>
      </select>
    </div>

    <div class="form-group">
      <label>超时时间 (毫秒)</label>
      <input
        v-model.number="localData.timeout"
        type="number"
        min="0"
        step="1000"
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
  color: var(--color-text-secondary);
}

.form-group input,
.form-group select {
  background: var(--color-bg-page-elevated);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  padding: 0.5rem;
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-brand-link-hover);
}
</style>
