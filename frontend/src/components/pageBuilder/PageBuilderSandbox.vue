<template>
  <section class="page-builder-sandbox">
    <PageBuilderPreview
      v-if="mode === 'preview'"
      :srcdoc="previewHtml"
      :viewport="viewport"
      :status-label="statusLabel"
      @change-viewport="$emit('changeViewport', $event)"
      @preview-select="$emit('previewSelect', $event)"
    />

    <PageBuilderCodeTabs
      v-else-if="mode === 'code'"
      :files="files"
      :active-file-id="activeFileId"
      @select-file="$emit('selectFile', $event)"
    />

    <PageBuilderDataPanel
      v-else
      :title="dataTitle"
      :description="dataDescription"
      :content="dataContent"
    />
  </section>
</template>

<script setup lang="ts">
import PageBuilderCodeTabs from './PageBuilderCodeTabs.vue';
import PageBuilderDataPanel from './PageBuilderDataPanel.vue';
import PageBuilderPreview from './PageBuilderPreview.vue';
import type { PageBuilderCenterMode, PageBuilderFile, PageBuilderPreviewSelection } from '../../types/pageBuilder';

defineProps<{
  mode: PageBuilderCenterMode;
  files: PageBuilderFile[];
  activeFileId: string | null;
  previewHtml: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  statusLabel: string;
  dataTitle: string;
  dataDescription: string;
  dataContent: string;
}>();

defineEmits<{
  selectFile: [fileId: string];
  changeViewport: [viewport: 'desktop' | 'tablet' | 'mobile'];
  previewSelect: [selection: PageBuilderPreviewSelection];
}>();
</script>

<style scoped>
.page-builder-sandbox {
  display: grid;
  grid-template-columns: 1fr;
  min-height: 0;
  height: 100%;
}
</style>
