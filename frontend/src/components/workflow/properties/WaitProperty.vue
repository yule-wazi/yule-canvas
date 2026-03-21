<template>
  <div class="property-form">
    <div class="form-group">
      <label>等待时间 (毫秒)</label>
      <input
        v-model.number="localData.duration"
        type="number"
        min="0"
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

.form-group input {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 0.5rem;
  color: #c9d1d9;
  font-size: 0.9rem;
}

.form-group input:focus {
  outline: none;
  border-color: #58a6ff;
}
</style>
