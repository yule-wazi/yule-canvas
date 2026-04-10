<template>
  <div v-if="isVisible" class="confirm-overlay" @click="handleCancel">
    <div class="confirm-dialog" @click.stop>
      <div class="confirm-header">
        <h3>{{ title }}</h3>
      </div>
      <div class="confirm-body">
        <p>{{ message }}</p>
      </div>
      <div class="confirm-actions">
        <button @click="handleCancel" class="btn-cancel">{{ cancelText }}</button>
        <button @click="handleConfirm" class="btn-confirm" :class="{ 'btn-danger': type === 'danger' }">
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'default' | 'danger';
}

const isVisible = ref(false);
const title = ref('确认');
const message = ref('');
const confirmText = ref('确定');
const cancelText = ref('取消');
const type = ref<'default' | 'danger'>('default');

let resolvePromise: ((value: boolean) => void) | null = null;

function show(options: ConfirmOptions): Promise<boolean> {
  title.value = options.title || '确认';
  message.value = options.message;
  confirmText.value = options.confirmText || '确定';
  cancelText.value = options.cancelText || '取消';
  type.value = options.type || 'default';
  isVisible.value = true;

  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
}

function handleConfirm() {
  isVisible.value = false;
  if (resolvePromise) {
    resolvePromise(true);
    resolvePromise = null;
  }
}

function handleCancel() {
  isVisible.value = false;
  if (resolvePromise) {
    resolvePromise(false);
    resolvePromise = null;
  }
}

defineExpose({
  show
});
</script>

<style scoped>
.confirm-overlay {
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
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.confirm-dialog {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  width: 90%;
  max-width: 450px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.confirm-header {
  padding: 1.5rem 1.5rem 1rem 1.5rem;
  border-bottom: 1px solid var(--color-border-default);
}

.confirm-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.1rem;
  font-weight: 600;
}

.confirm-body {
  padding: 1.5rem;
}

.confirm-body p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  line-height: 1.6;
}

.confirm-actions {
  padding: 1rem 1.5rem 1.5rem 1.5rem;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-cancel,
.btn-confirm {
  padding: 0.6rem 1.5rem;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--color-bg-panel);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
}

.btn-cancel:hover {
  background: var(--color-bg-surface);
  border-color: var(--color-brand-link-hover);
}

.btn-confirm {
  background: #238636;
  color: white;
}

.btn-confirm:hover {
  background: #2ea043;
}

.btn-confirm.btn-danger {
  background: #da3633;
}

.btn-confirm.btn-danger:hover {
  background: #f85149;
}
</style>
