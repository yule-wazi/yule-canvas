<template>
  <Transition name="toast">
    <div v-if="visible" class="toast-container" :class="`toast-${type}`">
      <div class="toast-icon">
        <span v-if="type === 'success'">✓</span>
        <span v-else-if="type === 'error'">✕</span>
        <span v-else-if="type === 'warning'">⚠</span>
        <span v-else>ℹ</span>
      </div>
      <div class="toast-content">
        <div v-if="title" class="toast-title">{{ title }}</div>
        <div class="toast-message">{{ message }}</div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const visible = ref(false);
const message = ref('');
const title = ref('');
const type = ref<'success' | 'error' | 'warning' | 'info'>('info');
let timer: number | null = null;

function show(options: {
  message: string;
  title?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}) {
  message.value = options.message;
  title.value = options.title || '';
  type.value = options.type || 'info';
  visible.value = true;

  if (timer) {
    clearTimeout(timer);
  }

  const duration = options.duration || 3000;
  timer = window.setTimeout(() => {
    visible.value = false;
  }, duration);
}

defineExpose({
  show
});
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 10000;
  min-width: 300px;
  max-width: 500px;
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 1rem;
  font-weight: bold;
  flex-shrink: 0;
}

.toast-success {
  border-left: 4px solid #238636;
}

.toast-success .toast-icon {
  background: #238636;
  color: white;
}

.toast-error {
  border-left: 4px solid #da3633;
}

.toast-error .toast-icon {
  background: #da3633;
  color: white;
}

.toast-warning {
  border-left: 4px solid #d29922;
}

.toast-warning .toast-icon {
  background: #d29922;
  color: white;
}

.toast-info {
  border-left: 4px solid #1f6feb;
}

.toast-info .toast-icon {
  background: #1f6feb;
  color: white;
}

.toast-content {
  flex: 1;
  color: var(--color-text-primary);
}

.toast-title {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
  color: #ffffff;
}

.toast-message {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style>
