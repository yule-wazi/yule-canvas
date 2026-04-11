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
        title="Generated page preview"
        :srcdoc="srcdoc"
      />
      <div v-else class="preview-placeholder">
        Generate a page project to render the sandbox preview.
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
  { label: 'Desktop', value: 'desktop' as const },
  { label: 'Tablet', value: 'tablet' as const },
  { label: 'Mobile', value: 'mobile' as const }
];
</script>

<style scoped>
.preview-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: linear-gradient(180deg, rgba(17, 17, 17, 0.98) 0%, rgba(6, 6, 6, 0.98) 100%);
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border-default);
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
  padding: 18px;
  background:
    radial-gradient(circle at top, rgba(118, 185, 0, 0.08) 0%, transparent 36%),
    linear-gradient(180deg, rgba(4, 4, 4, 1) 0%, rgba(12, 12, 12, 1) 100%);
}

.preview-stage.is-desktop .preview-frame {
  width: 100%;
}

.preview-stage.is-tablet .preview-frame {
  width: 860px;
  max-width: 100%;
}

.preview-stage.is-mobile .preview-frame {
  width: 430px;
  max-width: 100%;
}

.preview-frame {
  min-height: 100%;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: #050505;
}

.preview-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 360px;
  border: 1px dashed var(--color-border-default);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}
</style>
