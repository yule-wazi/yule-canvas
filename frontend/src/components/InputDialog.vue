<template>
  <div v-if="visible" class="input-dialog-overlay" @click.self="cancel">
    <div class="input-dialog">
      <h3>{{ title }}</h3>
      <input 
        ref="inputRef"
        v-model="inputValue" 
        type="text" 
        :placeholder="placeholder"
        @keyup.enter="confirm"
        @keyup.esc="cancel"
        class="input-field"
      />
      <div class="dialog-actions">
        <button @click="confirm" class="btn-primary">{{ confirmText }}</button>
        <button @click="cancel" class="btn-secondary">{{ cancelText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';

const visible = ref(false);
const title = ref('');
const placeholder = ref('');
const confirmText = ref('确定');
const cancelText = ref('取消');
const inputValue = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

let resolvePromise: ((value: string | null) => void) | null = null;

interface ShowOptions {
  title: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

const show = (options: ShowOptions): Promise<string | null> => {
  title.value = options.title;
  inputValue.value = options.defaultValue || '';
  placeholder.value = options.placeholder || '';
  confirmText.value = options.confirmText || '确定';
  cancelText.value = options.cancelText || '取消';
  visible.value = true;
  
  // 聚焦输入框
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
  
  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
};

const confirm = () => {
  visible.value = false;
  if (resolvePromise) {
    resolvePromise(inputValue.value.trim() || null);
    resolvePromise = null;
  }
};

const cancel = () => {
  visible.value = false;
  if (resolvePromise) {
    resolvePromise(null);
    resolvePromise = null;
  }
};

defineExpose({ show });
</script>

<style scoped>
.input-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.input-dialog {
  background: var(--color-bg-surface);
  border-radius: var(--radius-sm);
  padding: 24px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.input-dialog h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: var(--color-text-primary);
}

.input-field {
  width: 100%;
  padding: 10px 12px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: 14px;
  margin-bottom: 20px;
  font-family: inherit;
}

.input-field:focus {
  outline: none;
  border-color: var(--color-brand-link-hover);
}

.dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  min-height: 44px;
  padding: 0 18px;
  border-radius: var(--radius-sm);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  border: 2px solid #76b900;
  background: rgba(118, 185, 0, 0.12);
  color: #f5f7fb;
}

.btn-primary:hover {
  background: rgba(118, 185, 0, 0.2);
  border-color: #bff230;
}

.btn-secondary {
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-panel);
  color: var(--color-text-primary);
}

.btn-secondary:hover {
  background: #252525;
  border-color: rgba(255, 255, 255, 0.18);
}
</style>
