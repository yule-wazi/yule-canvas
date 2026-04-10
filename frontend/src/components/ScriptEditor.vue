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
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.code-textarea {
  width: 100%;
  height: 100%;
  padding: 1rem;
  background: var(--color-bg-page-elevated);
  color: var(--color-text-primary);
  border: none;
  font-family: var(--font-family-mono);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
}

.code-textarea:focus {
  outline: 2px solid var(--color-brand-link-hover);
  outline-offset: -2px;
}
</style>
