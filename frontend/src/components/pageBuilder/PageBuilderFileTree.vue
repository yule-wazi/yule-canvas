<template>
  <aside class="page-builder-filetree">
    <div class="panel-header">
      <div>
        <p class="eyebrow">项目文件</p>
        <h2>页面工程</h2>
      </div>
      <span class="count-badge">{{ files.length }}</span>
    </div>

    <div v-if="files.length" class="file-list">
      <button
        v-for="file in files"
        :key="file.id"
        class="file-item"
        :class="{ 'is-active': file.id === activeFileId }"
        type="button"
        @click="$emit('selectFile', file.id)"
      >
        <span class="file-badge">{{ file.type.toUpperCase() }}</span>
        <span class="file-name">{{ file.name }}</span>
      </button>
    </div>

    <div v-else class="empty-state">
      <p>还没有生成文件。</p>
      <span>先选择输入项，再生成第一版页面工程。</span>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { PageBuilderFile } from '../../types/pageBuilder';

defineProps<{
  files: PageBuilderFile[];
  activeFileId: string | null;
}>();

defineEmits<{
  selectFile: [fileId: string];
}>();
</script>

<style scoped>
.page-builder-filetree {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  min-height: 0;
  padding: 18px;
  background: linear-gradient(180deg, rgba(16, 16, 16, 0.98) 0%, rgba(8, 8, 8, 0.98) 100%);
  border-right: 1px solid var(--color-border-default);
  overflow: auto;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
  line-height: var(--line-height-tight);
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-brand-accent);
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid var(--color-border-default);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.file-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
}

.file-item.is-active {
  border-color: var(--color-border-strong);
  box-shadow: inset 0 0 0 1px rgba(118, 185, 0, 0.25);
}

.file-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  padding: 6px 8px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 700;
  color: var(--color-brand-accent);
}

.file-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  padding: 16px;
  border: 1px dashed var(--color-border-default);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}

.empty-state p {
  margin: 0 0 8px;
  color: var(--color-text-primary);
}
</style>
