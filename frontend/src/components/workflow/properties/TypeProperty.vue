<template>
  <div class="property-form">
    <div class="form-group">
      <label>CSS 选择器</label>
      <textarea
        v-model="localData.selector"
        placeholder="例如: input[name='username']"
        rows="3"
        @input="emitUpdate"
      ></textarea>
    </div>

    <div class="form-group">
      <label>输入文本</label>
      <textarea
        v-model="localData.text"
        placeholder="要输入的文本内容"
        rows="3"
        @input="emitUpdate"
      ></textarea>
    </div>

    <div class="form-group">
      <label>输入延迟 (毫秒)</label>
      <input
        v-model.number="localData.delay"
        type="number"
        min="0"
        step="10"
        @input="emitUpdate"
      />
    </div>

    <div class="form-group">
      <label>等待超时 (毫秒)</label>
      <input
        v-model.number="localData.timeout"
        type="number"
        min="1000"
        step="1000"
        @input="emitUpdate"
      />
      <small>等待元素出现的最长时间</small>
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
.form-group textarea {
  background: var(--color-bg-page-elevated);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  padding: 0.5rem;
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-brand-link-hover);
}

.form-group textarea {
  resize: vertical;
  min-height: 84px;
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.form-group small {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: -0.25rem;
}
</style>
