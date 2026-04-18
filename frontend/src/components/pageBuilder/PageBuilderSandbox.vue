<template>
  <section class="page-builder-sandbox">
    <div class="sandbox-toolbar">
      <div class="toolbar-left">
        <div v-if="mode === 'preview'" class="device-toggle">
          <button
            v-for="option in viewportOptions"
            :key="option.value"
            class="device-btn"
            :class="{ 'is-active': option.value === viewport }"
            type="button"
            @click="$emit('changeViewport', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="mode-switch">
        <button
          v-for="option in modeOptions"
          :key="option.value"
          class="mode-btn"
          :class="{ 'is-active': option.value === mode }"
          type="button"
          @click="$emit('changeMode', option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-show="mode === 'preview'" class="sandbox-panel">
      <PageBuilderPreview
        :files="files"
        :table-snapshot="tableSnapshot"
        :viewport="viewport"
        @change-viewport="$emit('changeViewport', $event)"
      />
    </div>

    <div v-show="mode === 'code'" class="sandbox-panel">
      <PageBuilderCodeTabs
        :files="files"
        :active-file-id="activeFileId"
        @select-file="$emit('selectFile', $event)"
        @update-content="$emit('updateContent', $event)"
      />
    </div>

    <div v-show="mode === 'data'" class="sandbox-panel">
      <PageBuilderDataPanel
        :title="dataTitle"
        :description="dataDescription"
        :content="dataContent"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import PageBuilderCodeTabs from './PageBuilderCodeTabs.vue';
import PageBuilderDataPanel from './PageBuilderDataPanel.vue';
import PageBuilderPreview from './PageBuilderPreview.vue';
import type { PageBuilderCenterMode, PageBuilderFile, PageBuilderPreviewTableSnapshot } from '../../types/pageBuilder';

defineProps<{
  mode: PageBuilderCenterMode;
  files: PageBuilderFile[];
  tableSnapshot: PageBuilderPreviewTableSnapshot | null;
  activeFileId: string | null;
  viewport: 'desktop' | 'tablet' | 'mobile';
  dataTitle: string;
  dataDescription: string;
  dataContent: string;
}>();

defineEmits<{
  changeMode: [mode: PageBuilderCenterMode];
  selectFile: [fileId: string];
  updateContent: [value: string];
  changeViewport: [viewport: 'desktop' | 'tablet' | 'mobile'];
}>();

const viewportOptions = [
  { label: 'Desktop', value: 'desktop' as const },
  { label: 'Tablet', value: 'tablet' as const },
  { label: 'Mobile', value: 'mobile' as const }
];

const modeOptions: Array<{ label: string; value: PageBuilderCenterMode }> = [
  { label: 'Preview', value: 'preview' },
  { label: 'Code', value: 'code' },
  { label: 'Data', value: 'data' }
];
</script>

<style scoped>
.page-builder-sandbox {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  height: 100%;
}

.sandbox-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-default);
  background: rgba(10, 10, 10, 0.98);
}

.toolbar-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.device-toggle,
.mode-switch {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.device-btn,
.mode-btn {
  min-height: 34px;
  min-width: 76px;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.device-btn.is-active,
.mode-btn.is-active {
  background: rgba(118, 185, 0, 0.14);
  color: var(--color-text-primary);
}

.sandbox-panel {
  min-height: 0;
  height: 100%;
}

@media (max-width: 900px) {
  .sandbox-toolbar {
    flex-wrap: wrap;
  }

  .toolbar-left {
    width: 100%;
  }
}
</style>
