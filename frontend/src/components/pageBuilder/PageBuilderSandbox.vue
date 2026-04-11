<template>
  <section class="page-builder-sandbox" :class="{ 'is-split': mode === 'split' }">
    <PageBuilderPreview
      v-if="mode !== 'code'"
      :srcdoc="previewHtml"
      :viewport="viewport"
      :status-label="statusLabel"
      @change-viewport="$emit('changeViewport', $event)"
    />
    <PageBuilderCodeTabs
      v-if="mode !== 'preview'"
      :files="files"
      :active-file-id="activeFileId"
      @select-file="$emit('selectFile', $event)"
    />
  </section>
</template>

<script setup lang="ts">
import PageBuilderCodeTabs from './PageBuilderCodeTabs.vue';
import PageBuilderPreview from './PageBuilderPreview.vue';
import type { PageBuilderCenterMode, PageBuilderFile } from '../../types/pageBuilder';

defineProps<{
  mode: PageBuilderCenterMode;
  files: PageBuilderFile[];
  activeFileId: string | null;
  previewHtml: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  statusLabel: string;
}>();

defineEmits<{
  selectFile: [fileId: string];
  changeViewport: [viewport: 'desktop' | 'tablet' | 'mobile'];
}>();
</script>

<style scoped>
.page-builder-sandbox {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  min-height: 0;
}

.page-builder-sandbox.is-split {
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
}

@media (max-width: 1180px) {
  .page-builder-sandbox,
  .page-builder-sandbox.is-split {
    grid-template-columns: 1fr;
  }
}
</style>
