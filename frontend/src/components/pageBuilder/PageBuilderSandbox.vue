<template>
  <section class="page-builder-sandbox">
    <PageBuilderPreview
      v-if="mode === 'preview'"
      :files="files"
      :viewport="viewport"
      @change-viewport="$emit('changeViewport', $event)"
    />

    <PageBuilderCodeTabs
      v-else-if="mode === 'code'"
      :files="files"
      :active-file-id="activeFileId"
      @select-file="$emit('selectFile', $event)"
      @update-content="$emit('updateContent', $event)"
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
import type { PageBuilderCenterMode, PageBuilderFile } from '../../types/pageBuilder';

defineProps<{
  mode: PageBuilderCenterMode;
  files: PageBuilderFile[];
  activeFileId: string | null;
  viewport: 'desktop' | 'tablet' | 'mobile';
  dataTitle: string;
  dataDescription: string;
  dataContent: string;
}>();

defineEmits<{
  selectFile: [fileId: string];
  updateContent: [value: string];
  changeViewport: [viewport: 'desktop' | 'tablet' | 'mobile'];
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
