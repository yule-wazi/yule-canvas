<template>
  <div class="property-form">
    <div class="form-group">
      <label>CSS选择器</label>
      <input
        v-model="localData.selector"
        type="text"
        placeholder="例如: button.submit"
        @input="emitUpdate"
      />
    </div>

    <div class="form-group">
      <label>
        <input
          v-model="localData.waitForElement"
          type="checkbox"
          @change="emitUpdate"
        />
        等待元素出现
      </label>
    </div>

    <div class="form-group">
      <label>超时时间 (毫秒)</label>
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
  color: #8b949e;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-group input[type="text"],
.form-group input[type="number"] {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 0.5rem;
  color: #c9d1d9;
  font-size: 0.9rem;
}

.form-group input[type="text"]:focus,
.form-group input[type="number"]:focus {
  outline: none;
  border-color: #58a6ff;
}

.form-group input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.form-group small {
  font-size: 0.8rem;
  color: #6e7681;
  margin-top: -0.25rem;
}
</style>
