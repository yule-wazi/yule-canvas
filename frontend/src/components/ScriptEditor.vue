<template>
  <div class="script-editor-wrapper">
    <textarea
      v-model="code"
      class="code-textarea"
      :readonly="readonly"
      spellcheck="false"
    ></textarea>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  modelValue: string;
  readonly?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
  (e: 'change', value: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  readonly: false
});

const emit = defineEmits<Emits>();

const code = ref(props.modelValue);

watch(() => props.modelValue, (newValue) => {
  code.value = newValue;
});

watch(code, (newValue) => {
  emit('update:modelValue', newValue);
  emit('change', newValue);
});
</script>

<style scoped>
.script-editor-wrapper {
  width: 100%;
  height: 400px;
  border: 1px solid #30363d;
  border-radius: 6px;
  overflow: hidden;
}

.code-textarea {
  width: 100%;
  height: 100%;
  padding: 1rem;
  background: #0d1117;
  color: #c9d1d9;
  border: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
}

.code-textarea:focus {
  outline: 2px solid #1f6feb;
  outline-offset: -2px;
}
</style>
