<template>
  <div class="preview-shell">
    <div class="preview-toolbar">
      <div class="device-toggle">
        <button
          v-for="option in options"
          :key="option.value"
          class="device-btn"
          :class="{ 'is-active': option.value === viewport }"
          type="button"
          @click="$emit('changeViewport', option.value)"
        >
          {{ option.label }}
        </button>
      </div>
      <span class="preview-status">{{ statusLabel }}</span>
    </div>

    <div class="preview-stage" :class="`is-${viewport}`">
      <iframe
        v-if="srcdoc"
        class="preview-frame"
        title="生成页面预览"
        :srcdoc="srcdoc"
      />
      <div v-else class="preview-placeholder">
        先生成页面工程，预览会显示在这里。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  srcdoc: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  statusLabel: string;
}>();

defineEmits<{
  changeViewport: [viewport: 'desktop' | 'tablet' | 'mobile'];
}>();

const options = [
  { label: '桌面', value: 'desktop' as const },
  { label: '平板', value: 'tablet' as const },
  { label: '手机', value: 'mobile' as const }
];
</script>

<style scoped>
.preview-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #050505;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-default);
  background: rgba(10, 10, 10, 0.98);
}

.device-toggle {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.device-btn {
  min-height: 34px;
  min-width: 76px;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.device-btn.is-active {
  background: rgba(118, 185, 0, 0.14);
  color: var(--color-text-primary);
}

.preview-status {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.preview-stage {
  display: flex;
  flex: 1;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
  padding: 0;
  background: #050505;
}

.preview-stage.is-desktop .preview-frame {
  width: 100%;
}

.preview-stage.is-tablet .preview-frame {
  width: 960px;
  max-width: 100%;
}

.preview-stage.is-mobile .preview-frame {
  width: 440px;
  max-width: 100%;
}

.preview-frame {
  width: 100%;
  height: 100%;
  min-height: 100%;
  border: 0;
  background: #050505;
}

.preview-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 100%;
  color: var(--color-text-secondary);
}
</style>
